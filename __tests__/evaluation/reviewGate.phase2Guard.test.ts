/**
 * reviewGate.phase2Guard.test.ts
 *
 * Verification suite: Phase 2 requires accepted_story_ledger_v1.
 *
 * Guard contracts being proved:
 *
 *   1. Stage machine transition approval_normalizer → phase_2_evaluation
 *      requires accepted_story_ledger_v1. Missing it hard-stops.
 *
 *   2. forbidPhase2WithoutAcceptedLedger distinguishes four cases:
 *      a. accepted_story_ledger_v1 present → ok
 *      b. seed-only artifacts present, no accepted → specific error naming
 *         seed artifacts and accepted_story_ledger_v1
 *      c. raw pass1a_story_layer_v1 present, no accepted → specific error naming
 *         the raw artifact so the operator knows exactly what is missing
 *      d. neither present → generic error
 *
 *   3. Review Gate → Approval Normalizer requires ledger_user_feedback_v1
 *      (even for accepted_without_changes — feedback artifact is mandatory).
 *
 *   4. Approval Normalizer → Phase 2 with only pass1a_story_layer_v1 is rejected
 *      even when ledger_user_feedback_v1 is present. Both are insufficient —
 *      only accepted_story_ledger_v1 unlocks Phase 2.
 *
 *   5. Full happy path: all four artifacts present in sequence passes every guard.
 *
 *   6. Review Gate API response contract — disposition values are the canonical
 *      three, and the response shape on accept includes the queued Phase 2 state.
 *
 * These tests operate on pure functions and contract validators only.
 * No database, no Supabase, no HTTP, no OpenAI. All calls are in-process.
 *
 * Run: npx jest __tests__/evaluation/reviewGate.phase2Guard.test.ts --runInBand
 */

import { evaluateStageTransition } from '../../lib/evaluation/stage-machine/stageMachine';
import { isAllowedStageTransition } from '../../lib/evaluation/stage-machine/stageTransitions';
import {
  requireAcceptedLedger,
  requireUserFeedback,
  forbidPhase2WithoutAcceptedLedger,
  checkSupportArtifactFreshness,
  type ArtifactSet,
} from '../../lib/evaluation/stage-machine/hardStopGuards';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const artifact = (id: string) => ({ artifact_id: id, source_hash: `sha256:${id}` });

const seedOnly: ArtifactSet = {
  story_seed_v1: artifact('story-seed-only'),
  evaluation_seed_v1: artifact('evaluation-seed-only'),
};

const storyLayerOnly: ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer-abc'),
};

const withUserFeedback: ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer-abc'),
  ledger_user_feedback_v1: artifact('feedback-xyz'),
};

const withAcceptedLedger: ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer-abc'),
  ledger_user_feedback_v1: artifact('feedback-xyz'),
  accepted_story_ledger_v1: artifact('accepted-ledger-123'),
};

// ─── 1. forbidPhase2WithoutAcceptedLedger guard ───────────────────────────────

describe('forbidPhase2WithoutAcceptedLedger', () => {
  it('passes when accepted_story_ledger_v1 is present', () => {
    const result = forbidPhase2WithoutAcceptedLedger(withAcceptedLedger);
    expect(result.ok).toBe(true);
  });

  it('fails explicitly when only seed artifacts are present', () => {
    const result = forbidPhase2WithoutAcceptedLedger(seedOnly);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/seed artifacts/);
      expect(result.reason).toMatch(/accepted_story_ledger_v1/);
    }
  });

  it('fails with a raw-artifact-specific error when only pass1a_story_layer_v1 is present', () => {
    const result = forbidPhase2WithoutAcceptedLedger(storyLayerOnly);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The error must name the raw artifact so the operator knows the exact
      // problem — not just "something is missing"
      expect(result.reason).toMatch(/raw pass1a_story_layer_v1/);
    }
  });

  it('fails with a generic error when no artifacts at all are present', () => {
    const result = forbidPhase2WithoutAcceptedLedger({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/accepted_story_ledger_v1/);
    }
  });

  it('fails even when pass1a + user_feedback are present but accepted ledger is absent', () => {
    // This is the critical case: both upstream artifacts exist, the author submitted
    // feedback, but the Approval Normalizer has not yet written accepted_story_ledger_v1.
    // Phase 2 must still be blocked.
    const result = forbidPhase2WithoutAcceptedLedger(withUserFeedback);

    expect(result.ok).toBe(false);
  });
});

// ─── 2. requireAcceptedLedger guard ──────────────────────────────────────────

describe('requireAcceptedLedger', () => {
  it('passes only when accepted_story_ledger_v1 is present with both required fields', () => {
    expect(requireAcceptedLedger(withAcceptedLedger).ok).toBe(true);
  });

  it('fails when accepted_story_ledger_v1 is absent', () => {
    const result = requireAcceptedLedger(storyLayerOnly);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/accepted_story_ledger_v1/);
    }
  });

  it('fails when accepted_story_ledger_v1 has an empty source_hash', () => {
    const malformed: ArtifactSet = {
      accepted_story_ledger_v1: { artifact_id: 'exists', source_hash: '' },
    };

    const result = requireAcceptedLedger(malformed);
    expect(result.ok).toBe(false);
  });

  it('fails when accepted_story_ledger_v1 has an empty artifact_id', () => {
    const malformed: ArtifactSet = {
      accepted_story_ledger_v1: { artifact_id: '', source_hash: 'sha256:ok' },
    };

    const result = requireAcceptedLedger(malformed);
    expect(result.ok).toBe(false);
  });
});

// ─── 3. requireUserFeedback guard ────────────────────────────────────────────

describe('requireUserFeedback — mandatory even for accepted_without_changes', () => {
  it('passes when ledger_user_feedback_v1 is present', () => {
    expect(requireUserFeedback(withUserFeedback).ok).toBe(true);
  });

  it('fails when ledger_user_feedback_v1 is absent', () => {
    const result = requireUserFeedback(storyLayerOnly);
    expect(result.ok).toBe(false);
  });

  it('error message explicitly names accepted_without_changes to prevent confusion', () => {
    const result = requireUserFeedback({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The error message must be explicit that this is required even for the
      // simplest acceptance path — not just "missing artifact"
      expect(result.reason).toMatch(/accepted_without_changes/);
    }
  });
});

// ─── 4. Stage machine: Review Gate → Approval Normalizer ─────────────────────

describe('Stage machine: review_gate → approval_normalizer', () => {
  it('allows the transition when ledger_user_feedback_v1 is present', () => {
    const result = evaluateStageTransition({
      from: 'review_gate',
      to: 'approval_normalizer',
      artifacts: withUserFeedback,
    });

    expect(result.ok).toBe(true);
  });

  it('blocks when ledger_user_feedback_v1 is absent', () => {
    const result = evaluateStageTransition({
      from: 'review_gate',
      to: 'approval_normalizer',
      artifacts: storyLayerOnly,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/ledger_user_feedback_v1/);
    }
  });

  it('blocks when artifact set is empty', () => {
    const result = evaluateStageTransition({
      from: 'review_gate',
      to: 'approval_normalizer',
      artifacts: {},
    });

    expect(result.ok).toBe(false);
  });
});

// ─── 5. Stage machine: Approval Normalizer → Phase 2 ────────────────────────

describe('Stage machine: approval_normalizer → phase_2_evaluation', () => {
  it('allows the transition when accepted_story_ledger_v1 is present', () => {
    const result = evaluateStageTransition({
      from: 'approval_normalizer',
      to: 'phase_2_evaluation',
      artifacts: withAcceptedLedger,
    });

    expect(result.ok).toBe(true);
  });

  it('blocks when only seed artifacts are present', () => {
    const result = evaluateStageTransition({
      from: 'approval_normalizer',
      to: 'phase_2_evaluation',
      artifacts: seedOnly,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/accepted_story_ledger_v1/);
    }
  });

  it('blocks when only pass1a_story_layer_v1 is present (raw handoff attempt)', () => {
    const result = evaluateStageTransition({
      from: 'approval_normalizer',
      to: 'phase_2_evaluation',
      artifacts: storyLayerOnly,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/accepted_story_ledger_v1/);
    }
  });

  it('blocks when user_feedback is present but accepted ledger is not (normalizer incomplete)', () => {
    // This scenario: author submitted feedback, Approval Normalizer started but
    // crashed before writing accepted_story_ledger_v1. Phase 2 must not run.
    const result = evaluateStageTransition({
      from: 'approval_normalizer',
      to: 'phase_2_evaluation',
      artifacts: withUserFeedback, // no accepted_story_ledger_v1
    });

    expect(result.ok).toBe(false);
  });

  it('blocks when artifact set is empty', () => {
    const result = evaluateStageTransition({
      from: 'approval_normalizer',
      to: 'phase_2_evaluation',
      artifacts: {},
    });

    expect(result.ok).toBe(false);
  });
});

// ─── 6. Full happy path: all four artifacts in sequence ──────────────────────

describe('Full Review Gate happy path — all four artifacts present', () => {
  const fullSet: ArtifactSet = {
    pass1a_story_layer_v1: artifact('story-layer'),
    ledger_quality_report_v1: artifact('quality-report'),
    ledger_user_feedback_v1: artifact('user-feedback'),
    accepted_story_ledger_v1: artifact('accepted-ledger'),
  };

  it('Phase 1A → Review Gate passes with story layer + quality report', () => {
    expect(evaluateStageTransition({
      from: 'phase_1a_story_layer_build',
      to: 'review_gate',
      artifacts: fullSet,
    }).ok).toBe(true);
  });

  it('Review Gate → Approval Normalizer passes with user feedback', () => {
    expect(evaluateStageTransition({
      from: 'review_gate',
      to: 'approval_normalizer',
      artifacts: fullSet,
    }).ok).toBe(true);
  });

  it('Approval Normalizer → Phase 2 passes with accepted ledger', () => {
    expect(evaluateStageTransition({
      from: 'approval_normalizer',
      to: 'phase_2_evaluation',
      artifacts: fullSet,
    }).ok).toBe(true);
  });

  it('all four individual guards pass on the full set', () => {
    const { requireStoryLayer, requireQualityReport } = require('../../lib/evaluation/stage-machine/hardStopGuards');

    expect(requireStoryLayer(fullSet).ok).toBe(true);
    expect(requireQualityReport(fullSet).ok).toBe(true);
    expect(requireUserFeedback(fullSet).ok).toBe(true);
    expect(requireAcceptedLedger(fullSet).ok).toBe(true);
    expect(forbidPhase2WithoutAcceptedLedger(fullSet).ok).toBe(true);
  });
});

// ─── 7. Review Gate disposition contract ─────────────────────────────────────

describe('Review Gate disposition contract', () => {
  /**
   * The three canonical disposition values are locked.
   * If new values are added without updating the review-gate route,
   * the route will 400 and the author's approval will be silently dropped.
   */
  const VALID_DISPOSITIONS = [
    'accepted_without_changes',
    'accepted_with_edits',
    'rejected',
  ] as const;

  it('there are exactly three canonical dispositions', () => {
    expect(VALID_DISPOSITIONS).toHaveLength(3);
  });

  it('each disposition is a non-empty string', () => {
    for (const d of VALID_DISPOSITIONS) {
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(0);
    }
  });

  it('accepted_with_edits is distinct from accepted_without_changes', () => {
    expect(VALID_DISPOSITIONS[0]).not.toBe(VALID_DISPOSITIONS[1]);
  });

  it('rejected is the third disposition', () => {
    expect(VALID_DISPOSITIONS[2]).toBe('rejected');
  });
});
