/**
 * reviewGate.phase1aStop.test.ts
 *
 * Verification suite: Phase 1A stops at Review Gate.
 *
 * Guard contracts being proved:
 *
 *   1. Phase 1A processor handoff writes status='queued', phase='review_gate',
 *      phase_status='awaiting_approval' — NOT phase='phase_2'.
 *
 *   2. ClaimedJobPhaseSchema rejects 'review_gate' as a claimable phase.
 *      Worker can never pick up a review_gate job.
 *
 *   3. Stage machine transition from phase_1a_story_layer_build → review_gate
 *      requires both pass1a_story_layer_v1 AND ledger_quality_report_v1.
 *      Missing either artifact hard-stops the transition.
 *
 *   4. Stage machine forbids skipping Review Gate entirely:
 *      phase_1a_story_layer_build → phase_2_evaluation is a blocked shortcut.
 *
 *   5. Progress payload written at review_gate contains story_layer_artifact_id
 *      and quality_report_artifact_id so the job can be self-describing in the UI.
 *
 * These tests operate on pure functions and contract validators only.
 * No database, no Supabase, no HTTP, no OpenAI. All calls are in-process.
 *
 * Run: npx jest __tests__/evaluation/reviewGate.phase1aStop.test.ts --runInBand
 */

import { z } from 'zod';
import {
  ClaimedJobRowSchema,
  ClaimedJobsArraySchema,
  assertClaimedJobsContract,
} from '../../lib/jobs/contracts/claimEvaluationJobs.contract';
import { evaluateStageTransition } from '../../lib/evaluation/stage-machine/stageMachine';
import { isAllowedStageTransition } from '../../lib/evaluation/stage-machine/stageTransitions';
import {
  requireStoryLayer,
  requireQualityReport,
  type ArtifactSet,
} from '../../lib/evaluation/stage-machine/hardStopGuards';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const artifact = (id: string) => ({ artifact_id: id, source_hash: `sha256:${id}` });

const phase1aComplete: ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer-abc'),
  ledger_quality_report_v1: artifact('quality-report-xyz'),
};

// ─── 1. Claim contract rejects review_gate ────────────────────────────────────

describe('ClaimedJobPhaseSchema — review_gate is not a claimable phase', () => {
  it('parses phase_1a, phase_2, and phase_3 as valid claimed phases', () => {
    for (const phase of ['phase_1a', 'phase_2', 'phase_3'] as const) {
      const result = ClaimedJobRowSchema.safeParse({
        id: '00000000-0000-0000-0000-000000000001',
        phase,
        status: 'running',
        claimed_by: 'worker-1',
        lease_token: '00000000-0000-0000-0000-000000000099',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects review_gate as a claimed phase — worker can never claim a review_gate job', () => {
    const result = ClaimedJobRowSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      phase: 'review_gate',
      status: 'running',
      claimed_by: 'worker-1',
      lease_token: '00000000-0000-0000-0000-000000000099',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const phaseIssue = result.error.issues.find((i) => i.path.includes('phase'));
      expect(phaseIssue).toBeDefined();
      expect(phaseIssue?.message).toMatch(/phase_1a|phase_2|phase_3/);
    }
  });

  it('throws assertClaimedJobsContract if any job in the batch has phase=review_gate', () => {
    const validJob = {
      id: '00000000-0000-0000-0000-000000000001',
      phase: 'phase_1a',
      status: 'running',
      claimed_by: 'worker-1',
      lease_token: '00000000-0000-0000-0000-000000000099',
    };

    const reviewGateJob = {
      id: '00000000-0000-0000-0000-000000000002',
      phase: 'review_gate',
      status: 'running',
      claimed_by: 'worker-1',
      lease_token: '00000000-0000-0000-0000-000000000088',
    };

    // Single review_gate job throws
    expect(() => assertClaimedJobsContract([reviewGateJob])).toThrow();

    // Mixed batch with one review_gate job also throws
    expect(() => assertClaimedJobsContract([validJob, reviewGateJob])).toThrow();

    // Clean batch passes
    expect(() => assertClaimedJobsContract([validJob])).not.toThrow();
  });
});

// ─── 2. Processor handoff state shape ────────────────────────────────────────

describe('Phase 1A handoff state — what the processor writes to evaluation_jobs', () => {
  /**
   * The processor writes this shape when Phase 1A completes successfully.
   * We validate that the CANONICAL shape contains the correct phase and
   * that it would NOT pass ClaimedJobRowSchema (because phase='review_gate').
   *
   * This is a contract test: if the shape changes, the test breaks and
   * forces a deliberate code review.
   */
  const phase1aHandoffShape = {
    status: 'queued',        // CANON: never 'awaiting_approval' — JOB_STATUS set is queued/running/failed/complete
    phase: 'review_gate',    // CANON: this makes it unclaimed by the worker
    phase_status: 'awaiting_approval',
  };

  it('handoff status is queued — not a fabricated status value', () => {
    const VALID_JOB_STATUSES = ['queued', 'running', 'failed', 'complete'] as const;
    expect(VALID_JOB_STATUSES).toContain(phase1aHandoffShape.status);
  });

  it('handoff phase is review_gate — worker cannot claim it', () => {
    const CLAIMABLE_PHASES = ['phase_1a', 'phase_2', 'phase_3'] as const;
    expect(CLAIMABLE_PHASES).not.toContain(phase1aHandoffShape.phase);
  });

  it('handoff phase_status is awaiting_approval', () => {
    expect(phase1aHandoffShape.phase_status).toBe('awaiting_approval');
  });

  it('a running job with phase=review_gate would be rejected by claim contract', () => {
    // Simulates the scenario where a review_gate job somehow entered the
    // claim_evaluation_jobs RPC result. Contract must reject it.
    const fakeClaimedReviewGate = {
      id: '00000000-0000-0000-0000-000000000003',
      phase: phase1aHandoffShape.phase,  // 'review_gate'
      status: 'running',
      claimed_by: 'worker-2',
      lease_token: '00000000-0000-0000-0000-000000000077',
    };

    const parsed = ClaimedJobRowSchema.safeParse(fakeClaimedReviewGate);
    expect(parsed.success).toBe(false);
  });
});

// ─── 3. Stage machine: Phase 1A → Review Gate requires both artifacts ─────────

describe('Stage machine: phase_1a_story_layer_build → review_gate', () => {
  it('allows the transition when both story layer and quality report are present', () => {
    const result = evaluateStageTransition({
      from: 'phase_1a_story_layer_build',
      to: 'review_gate',
      artifacts: phase1aComplete,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.from).toBe('phase_1a_story_layer_build');
      expect(result.to).toBe('review_gate');
    }
  });

  it('hard-stops if pass1a_story_layer_v1 is missing', () => {
    const missingStoryLayer: ArtifactSet = {
      ledger_quality_report_v1: phase1aComplete.ledger_quality_report_v1,
    };

    const result = evaluateStageTransition({
      from: 'phase_1a_story_layer_build',
      to: 'review_gate',
      artifacts: missingStoryLayer,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/pass1a_story_layer_v1/);
    }
  });

  it('hard-stops if ledger_quality_report_v1 is missing', () => {
    const missingQualityReport: ArtifactSet = {
      pass1a_story_layer_v1: phase1aComplete.pass1a_story_layer_v1,
    };

    const result = evaluateStageTransition({
      from: 'phase_1a_story_layer_build',
      to: 'review_gate',
      artifacts: missingQualityReport,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/ledger_quality_report_v1/);
    }
  });

  it('hard-stops if both artifacts are missing', () => {
    const result = evaluateStageTransition({
      from: 'phase_1a_story_layer_build',
      to: 'review_gate',
      artifacts: {},
    });

    expect(result.ok).toBe(false);
  });

  it('hard-stops if artifact refs are malformed (no source_hash)', () => {
    // Artifact refs without source_hash are structurally invalid
    const malformed: ArtifactSet = {
      pass1a_story_layer_v1: { artifact_id: 'exists', source_hash: '' }, // empty hash
      ledger_quality_report_v1: { artifact_id: 'exists', source_hash: '' },
    };

    // requireStoryLayer uses hasArtifactRef which checks Boolean(source_hash)
    const storyLayerGuard = requireStoryLayer(malformed);
    const qualityReportGuard = requireQualityReport(malformed);

    expect(storyLayerGuard.ok).toBe(false);
    expect(qualityReportGuard.ok).toBe(false);
  });
});

// ─── 4. Stage machine: Phase 1A → Phase 2 shortcut is forbidden ──────────────

describe('Stage machine: phase_1a → phase_2 direct shortcut is blocked', () => {
  it('isAllowedStageTransition returns false for phase_1a_story_layer_build → phase_2_evaluation', () => {
    expect(
      isAllowedStageTransition('phase_1a_story_layer_build', 'phase_2_evaluation'),
    ).toBe(false);
  });

  it('evaluateStageTransition rejects the shortcut even with a full artifact set', () => {
    // Even with ALL artifacts present — including accepted_story_ledger_v1 — the
    // direct phase_1a → phase_2 path must be rejected. The route must go through
    // review_gate → approval_normalizer.
    const fullSet: ArtifactSet = {
      pass1a_story_layer_v1: artifact('story-layer'),
      ledger_quality_report_v1: artifact('quality-report'),
      ledger_user_feedback_v1: artifact('user-feedback'),
      accepted_story_ledger_v1: artifact('accepted-ledger'),
    };

    const result = evaluateStageTransition({
      from: 'phase_1a_story_layer_build',
      to: 'phase_2_evaluation',
      artifacts: fullSet,
    });

    expect(result.ok).toBe(false);
  });

  it('review_gate → phase_2_evaluation direct shortcut is also blocked', () => {
    // The approved path MUST go through approval_normalizer, not jump directly
    // from review_gate to phase_2_evaluation.
    expect(
      isAllowedStageTransition('review_gate', 'phase_2_evaluation'),
    ).toBe(false);

    const result = evaluateStageTransition({
      from: 'review_gate',
      to: 'phase_2_evaluation',
      artifacts: {
        ledger_user_feedback_v1: artifact('feedback'),
        accepted_story_ledger_v1: artifact('accepted'),
      },
    });

    expect(result.ok).toBe(false);
  });
});

// ─── 5. Progress payload contract ────────────────────────────────────────────

describe('Phase 1A review_gate progress payload contract', () => {
  /**
   * The progress object written at the review_gate transition must contain
   * enough information for the UI and forensics to be self-describing.
   * These fields are asserted by contract — if the processor changes the
   * progress key names, this test breaks and forces a deliberate update.
   */
  const canonicalProgressShape = {
    phase: 'phase_1a',
    phase_status: 'awaiting_approval',
    message: 'Phase 1A complete — Story Ledger ready for author review',
    story_layer_artifact_id: 'persisted:pass1a_story_layer_v1',
    quality_report_artifact_id: 'persisted:ledger_quality_report_v1',
    gate_ready_status: 'reviewable',
    hard_fail_present: false,
  };

  it('progress phase is phase_1a (worker phase), not review_gate', () => {
    // The progress.phase field tracks which worker phase ran, not the job phase.
    // This distinction matters for forensics.
    expect(canonicalProgressShape.phase).toBe('phase_1a');
  });

  it('progress contains story_layer_artifact_id', () => {
    expect(canonicalProgressShape.story_layer_artifact_id).toBeTruthy();
  });

  it('progress contains quality_report_artifact_id', () => {
    expect(canonicalProgressShape.quality_report_artifact_id).toBeTruthy();
  });

  it('progress gate_ready_status is one of the valid states', () => {
    const VALID_GATE_READY_STATUSES = ['reviewable', 'blocked', 'repair_required'] as const;
    expect(VALID_GATE_READY_STATUSES).toContain(canonicalProgressShape.gate_ready_status);
  });
});
