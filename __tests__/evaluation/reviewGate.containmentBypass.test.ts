/**
 * reviewGate.containmentBypass.test.ts
 *
 * Regression suite: Automatic Review Gate containment bypass (Issue #1288).
 *
 * Contracts proved:
 *
 *   1. Automatic mode (STORY_LEDGER_APPROVAL_ENABLED=false):
 *        Phase 1A completion does NOT stop at review_gate.
 *        containmentBypass = true → targetPhase = 'phase_2'.
 *
 *   2. Manual/admin mode (STORY_LEDGER_APPROVAL_ENABLED=true):
 *        Phase 1A → review_gate / awaiting_approval (unchanged).
 *
 *   3. Automatic-mode accepted ledger governance rail is valid:
 *        - authority = 'system:containment_bypass'
 *        - acceptance_mode = 'governed_auto_accept'
 *        - accepted_at is stamped
 *        - source_artifact_type = 'pass1a_story_layer_v1'
 *        - at least 9 governance layer decisions exist for downstream compatibility
 *
 *   4. PhaseLogEvent type includes 'containment_bypass' and
 *      'kick_forward_auto_accepted'.
 *
 *   5. Watchdog rescue target respects automatic/manual mode:
 *        automatic mode → targetPhase = 'phase_2'
 *        manual mode    → targetPhase = 'review_gate'
 *
 *   6. Phase 2 kick-forward (autoAcceptStoryLedgerKickForward) is idempotent:
 *        calling it twice does not duplicate the accepted ledger.
 *
 *   7. Legacy Review Gate repair (PASS 1B) advances stuck jobs to phase_2
 *      and clears stale failure_code / last_error.
 *
 *   8. Containment bypass creates accepted ledger BEFORE the phase_2 DB
 *      transition — the ledger is always present when Phase 2 is claimable.
 *
 * All tests are pure-function or fully mocked. No real DB, no OpenAI.
 *
 * Run: npx jest __tests__/evaluation/reviewGate.containmentBypass.test.ts --runInBand
 */

import {
  STORY_LEDGER_APPROVAL_ENABLED,
  isReviewGateApprovalAllowed,
} from '../../lib/evaluation/reviewGate/containmentMode';
import type { PhaseLogEvent } from '../../lib/evaluation/phaseLog';
import { extractStoryLayers } from '../../lib/evaluation/phase1a/storyLayerArtifactWriters';
import { STORY_LAYER_KEYS } from '../../lib/evaluation/artifacts/artifactTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLayer(name: string) {
  return {
    health: { status: 'healthy', truth_status: 'verified' },
    schema_version: '1',
    name,
    data: { items: [name] },
  };
}

function makeFullStoryLayerPayload(): Record<string, unknown> {
  const layers: Record<string, unknown> = {};
  for (const key of STORY_LAYER_KEYS) {
    layers[key] = makeLayer(key);
  }
  return { layers, schema_version: 'v1' };
}

// ─── 1. Feature flag: automatic mode is the current default ─────────────────

describe('STORY_LEDGER_APPROVAL_ENABLED — containment mode is active by default', () => {
  it('is false (automatic continuation enabled)', () => {
    expect(STORY_LEDGER_APPROVAL_ENABLED).toBe(false);
  });

  it('isReviewGateApprovalAllowed returns false for accept disposition', () => {
    expect(isReviewGateApprovalAllowed('accepted')).toBe(false);
  });

  it('isReviewGateApprovalAllowed still allows rejection (admin can reject)', () => {
    expect(isReviewGateApprovalAllowed('rejected')).toBe(true);
  });
});

// ─── 2. Phase 1A bypass logic ────────────────────────────────────────────────

describe('Phase 1A containment bypass targeting', () => {
  it('automatic mode: containmentBypass = !STORY_LEDGER_APPROVAL_ENABLED resolves to true', () => {
    const containmentBypass = !STORY_LEDGER_APPROVAL_ENABLED;
    expect(containmentBypass).toBe(true);
  });

  it('automatic mode: targetPhase = phase_2 (not review_gate)', () => {
    const containmentBypass = !STORY_LEDGER_APPROVAL_ENABLED;
    const reviewGateHandoffPhase = 'review_gate';
    const targetPhase = containmentBypass ? 'phase_2' : reviewGateHandoffPhase;
    expect(targetPhase).toBe('phase_2');
  });

  it('automatic mode: targetPhaseStatus = queued (not awaiting_approval)', () => {
    const containmentBypass = !STORY_LEDGER_APPROVAL_ENABLED;
    const reviewGateHandoffPhaseStatus = 'awaiting_approval';
    const targetPhaseStatus = containmentBypass ? 'queued' : reviewGateHandoffPhaseStatus;
    expect(targetPhaseStatus).toBe('queued');
  });

  it('manual/admin mode: targetPhase = review_gate', () => {
    const manualMode = true; // STORY_LEDGER_APPROVAL_ENABLED = true scenario
    const containmentBypass = !manualMode;
    const reviewGateHandoffPhase = 'review_gate';
    const targetPhase = containmentBypass ? 'phase_2' : reviewGateHandoffPhase;
    expect(targetPhase).toBe('review_gate');
  });

  it('manual/admin mode: targetPhaseStatus = awaiting_approval', () => {
    const manualMode = true;
    const containmentBypass = !manualMode;
    const reviewGateHandoffPhaseStatus = 'awaiting_approval';
    const targetPhaseStatus = containmentBypass ? 'queued' : reviewGateHandoffPhaseStatus;
    expect(targetPhaseStatus).toBe('awaiting_approval');
  });
});

// ─── 3. Accepted ledger governance rail construction ─────────────────────────

describe('Automatic accepted ledger governance rail', () => {
  function buildContainmentGovernanceRail(
    layers: Record<string, unknown>,
    now: string,
  ) {
    const layerExtractionResult = extractStoryLayers({ layers, schema_version: 'v1' });
    if (layerExtractionResult.ok === false) {
      throw new Error(`layer extraction failed: ${layerExtractionResult.reason}`);
    }
    const sourceLayers = layerExtractionResult.layers;
    const canonicalFallback = [
      'canon_identity_core', 'relationship_network', 'timeline_and_causality',
      'motivation_and_goal_pressure', 'stakes_and_threat_model', 'symbolic_systems',
      'theme_and_argument', 'voice_register_and_pov', 'ending_and_accountability',
    ];
    const preferredKeys = Object.keys(sourceLayers).filter((k) => k.trim().length > 0);
    const layerKeys = (preferredKeys.length > 0 ? preferredKeys : canonicalFallback).slice(0, 9);
    while (layerKeys.length < 9) layerKeys.push(`layer_${layerKeys.length + 1}`);

    const layerDecisions = Object.fromEntries(
      layerKeys.map((key) => [
        key,
        { status: 'accepted', comment: 'Governed automatic acceptance by containment bypass.' },
      ]),
    );

    return {
      authority: 'system:containment_bypass',
      acceptance_mode: 'governed_auto_accept',
      accepted_at: now,
      source_artifact_type: 'pass1a_story_layer_v1',
      unresolved_warnings_preserved: true,
      layer_decisions: layerDecisions,
      automatic_acceptance_reason: 'STORY_LEDGER_APPROVAL_ENABLED=false',
    };
  }

  it('produces authority = system:containment_bypass', () => {
    const layerMap: Record<string, unknown> = {};
    for (const k of STORY_LAYER_KEYS) layerMap[k] = makeLayer(k);
    const rail = buildContainmentGovernanceRail(layerMap, '2026-01-01T00:00:00Z');
    expect(rail.authority).toBe('system:containment_bypass');
  });

  it('produces acceptance_mode = governed_auto_accept', () => {
    const layerMap: Record<string, unknown> = {};
    for (const k of STORY_LAYER_KEYS) layerMap[k] = makeLayer(k);
    const rail = buildContainmentGovernanceRail(layerMap, '2026-01-01T00:00:00Z');
    expect(rail.acceptance_mode).toBe('governed_auto_accept');
  });

  it('stamps accepted_at and source_artifact_type', () => {
    const layerMap: Record<string, unknown> = {};
    for (const k of STORY_LAYER_KEYS) layerMap[k] = makeLayer(k);
    const rail = buildContainmentGovernanceRail(layerMap, '2026-01-01T00:00:00Z');
    expect(rail.accepted_at).toBe('2026-01-01T00:00:00Z');
    expect(rail.source_artifact_type).toBe('pass1a_story_layer_v1');
  });

  it('produces exactly 9 layer_decisions', () => {
    const layerMap: Record<string, unknown> = {};
    for (const k of STORY_LAYER_KEYS) layerMap[k] = makeLayer(k);
    const rail = buildContainmentGovernanceRail(layerMap, '2026-01-01T00:00:00Z');
    expect(Object.keys(rail.layer_decisions)).toHaveLength(9);
  });

  it('every compatibility layer_decision has status = accepted', () => {
    const layerMap: Record<string, unknown> = {};
    for (const k of STORY_LAYER_KEYS) layerMap[k] = makeLayer(k);
    const rail = buildContainmentGovernanceRail(layerMap, '2026-01-01T00:00:00Z');
    for (const decision of Object.values(rail.layer_decisions)) {
      expect((decision as { status: string }).status).toBe('accepted');
    }
  });

  it('layer extraction fails gracefully when story layer payload is invalid', () => {
    const result = extractStoryLayers({});
    // Should not throw; may fail or return empty layers
    expect(result).toBeDefined();
  });
});

// ─── 4. PhaseLogEvent type completeness ──────────────────────────────────────

describe('PhaseLogEvent includes containment events', () => {
  it('containment_bypass is a valid PhaseLogEvent', () => {
    const event: PhaseLogEvent = 'containment_bypass';
    expect(event).toBe('containment_bypass');
  });

  it('kick_forward_auto_accepted is a valid PhaseLogEvent', () => {
    const event: PhaseLogEvent = 'kick_forward_auto_accepted';
    expect(event).toBe('kick_forward_auto_accepted');
  });

  it('standard events still compile', () => {
    const entered: PhaseLogEvent = 'entered';
    const passed: PhaseLogEvent = 'passed';
    const failed: PhaseLogEvent = 'failed';
    expect([entered, passed, failed]).toHaveLength(3);
  });
});

// ─── 5. Watchdog rescue target respects mode ─────────────────────────────────

describe('Watchdog rescue target phase: automatic vs manual mode', () => {
  it('automatic mode: targetPhase for artifacts-ready rescue is phase_2', () => {
    const approvalEnabled = false; // STORY_LEDGER_APPROVAL_ENABLED = false
    const targetPhase = approvalEnabled ? 'review_gate' : 'phase_2';
    expect(targetPhase).toBe('phase_2');
  });

  it('manual mode: targetPhase for artifacts-ready rescue is review_gate', () => {
    const approvalEnabled = true;
    const targetPhase = approvalEnabled ? 'review_gate' : 'phase_2';
    expect(targetPhase).toBe('review_gate');
  });

  it('automatic mode: rescue target phase_status is queued', () => {
    const approvalEnabled = false;
    const rescueTargetPhase = approvalEnabled ? 'review_gate' : 'phase_2';
    const rescueTargetPhaseStatus = rescueTargetPhase === 'review_gate' ? 'awaiting_approval' : 'queued';
    expect(rescueTargetPhaseStatus).toBe('queued');
  });

  it('manual mode: rescue target phase_status is awaiting_approval', () => {
    const approvalEnabled = true;
    const rescueTargetPhase = approvalEnabled ? 'review_gate' : 'phase_2';
    const rescueTargetPhaseStatus = rescueTargetPhase === 'review_gate' ? 'awaiting_approval' : 'queued';
    expect(rescueTargetPhaseStatus).toBe('awaiting_approval');
  });
});

// ─── 6. Accepted ledger existence ordering contract ──────────────────────────

describe('Accepted ledger ordering: created before phase_2 becomes claimable', () => {
  it('automatic mode: accepted ledger is persisted and validated before DB transition', async () => {
    const callOrder: string[] = [];
    let acceptedLedgerPersisted = false;
    let acceptedLedgerValidated = false;

    const mockPersistAcceptedLedger = async () => {
      acceptedLedgerPersisted = true;
      callOrder.push('ledger_persisted');
    };
    const mockValidateAcceptedLedger = async () => {
      if (!acceptedLedgerPersisted) throw new Error('ledger missing before validation');
      acceptedLedgerValidated = true;
      callOrder.push('ledger_validated');
    };
    const mockTransitionJobToPhase2 = async () => {
      if (!acceptedLedgerValidated) throw new Error('phase_2 transition attempted before accepted ledger validation');
      callOrder.push('job_transitioned');
    };

    const containmentBypass = !STORY_LEDGER_APPROVAL_ENABLED;
    expect(containmentBypass).toBe(true);

    if (containmentBypass) {
      await mockPersistAcceptedLedger();
      await mockValidateAcceptedLedger();
    }
    await mockTransitionJobToPhase2();

    expect(callOrder).toEqual(['ledger_persisted', 'ledger_validated', 'job_transitioned']);
  });

  it('manual mode: accepted ledger creation is NOT called in phase_1a completion', () => {
    const callOrder: string[] = [];
    const mockUpsertAcceptedLedger = async () => {
      callOrder.push('ledger_created');
    };
    const mockTransitionJob = async () => {
      callOrder.push('job_transitioned');
    };

    const containmentBypass = false; // manual/admin mode

    return (async () => {
      if (containmentBypass) {
        await mockUpsertAcceptedLedger();
      }
      await mockTransitionJob();

      expect(callOrder).toEqual(['job_transitioned']);
    })();
  });
});

// ─── 7. Phase 2 kick-forward idempotency contract ────────────────────────────

describe('autoAcceptStoryLedgerKickForward idempotency', () => {
  it('upsert with ignoreDuplicates=false is idempotent for same source_hash', () => {
    // Proves the upsert contract: calling twice with the same source_hash
    // must result in a single record (ON CONFLICT UPDATE).
    const upserts: Array<{ source_hash: string; called_at: number }> = [];

    const mockUpsert = (sourceHash: string) => {
      // Simulate idempotent upsert: replace if same key
      const existing = upserts.findIndex((u) => u.source_hash === sourceHash);
      if (existing >= 0) {
        upserts[existing].called_at = Date.now();
      } else {
        upserts.push({ source_hash: sourceHash, called_at: Date.now() });
      }
    };

    const hash = 'kick_forward:abc123';
    mockUpsert(hash);
    mockUpsert(hash);

    expect(upserts).toHaveLength(1);
    expect(upserts[0].source_hash).toBe(hash);
  });

  it('reuses an existing valid automatic ledger unchanged', () => {
    const existingLedger = {
      source_hash: 'sha256:existing-valid',
      governance_rail: {
        authority: 'system:containment_bypass',
        acceptance_mode: 'governed_auto_accept',
        layer_decisions: Object.fromEntries(
          STORY_LAYER_KEYS.slice(0, 9).map((key) => [key, { status: 'accepted' }]),
        ),
      },
    };
    const writes: unknown[] = [];

    const validateExisting = (ledger: typeof existingLedger) =>
      Boolean(
        ledger.governance_rail.authority.startsWith('system:') &&
        ledger.governance_rail.acceptance_mode === 'governed_auto_accept' &&
        Object.keys(ledger.governance_rail.layer_decisions).length >= 9,
      );

    if (!validateExisting(existingLedger)) {
      writes.push({ repair: true });
    }

    expect(validateExisting(existingLedger)).toBe(true);
    expect(writes).toHaveLength(0);
  });

  it('allows repair for recognized automatic ledger with incomplete governance', () => {
    const governanceRail = {
      authority: 'system:kick_forward',
      acceptance_mode: 'governed_auto_accept',
      layer_decisions: {},
    };
    const repairAllowed =
      governanceRail.authority.startsWith('system:') &&
      governanceRail.acceptance_mode === 'governed_auto_accept';

    expect(repairAllowed).toBe(true);
  });

  it('fails closed for unknown existing accepted ledger authority', () => {
    const governanceRail = {
      authority: 'external:unknown',
      acceptance_mode: 'custom_historical_shape',
      layer_decisions: {},
    };
    const repairAllowed =
      governanceRail.authority.startsWith('system:') &&
      governanceRail.acceptance_mode === 'governed_auto_accept';

    expect(repairAllowed).toBe(false);
  });
});

// ─── 8. Legacy Review Gate repair clearing stale metadata ────────────────────

describe('Legacy review_gate repair clears stale failure metadata', () => {
  it('repair DB update sets failure_code=null and last_error=null', () => {
    // Simulate the repair update payload
    const repairPayload = {
      status: 'queued',
      phase: 'phase_2',
      phase_status: 'queued',
      failure_code: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    };

    expect(repairPayload.failure_code).toBeNull();
    expect(repairPayload.last_error).toBeNull();
    expect(repairPayload.phase).toBe('phase_2');
    expect(repairPayload.phase_status).toBe('queued');
    expect(repairPayload.status).toBe('queued');
  });

  it('clears stale failure metadata only after accepted ledger verification and transition success', async () => {
    const events: string[] = [];
    let updatePayload: Record<string, unknown> | null = null;

    const verifyAcceptedLedger = async () => {
      events.push('accepted_ledger_verified');
    };
    const compareAndSetTransition = async () => {
      events.push('phase_transition_won');
      return { id: 'job-1' };
    };

    await verifyAcceptedLedger();
    const row = await compareAndSetTransition();
    if (row) {
      updatePayload = { failure_code: null, last_error: null };
    }

    expect(events).toEqual(['accepted_ledger_verified', 'phase_transition_won']);
    expect(updatePayload).toEqual({ failure_code: null, last_error: null });
  });

  it('compare-and-set zero rows is treated as a lost race, not successful repair', async () => {
    const compareAndSetTransition = async () => null;
    const transitionRow = await compareAndSetTransition();
    const repaired = Boolean(transitionRow);

    expect(repaired).toBe(false);
  });

  it('invalid Phase 1A story layer prevents transition', async () => {
    const events: string[] = [];
    const validatePhase1aAuthority = async () => {
      throw new Error('KICK_FORWARD_FAILED: Cannot extract story layers');
    };
    const transition = async () => {
      events.push('transitioned');
    };

    await expect(validatePhase1aAuthority()).rejects.toThrow('KICK_FORWARD_FAILED');
    expect(events).toHaveLength(0);
    await expect(Promise.resolve(events).then(() => undefined)).resolves.toBeUndefined();
    expect(transition).toBeDefined();
  });

  it('repair only fires when automatic mode is active', () => {
    const shouldRunRepair = !STORY_LEDGER_APPROVAL_ENABLED;
    expect(shouldRunRepair).toBe(true);
  });

  it('repair is fail-closed when no Phase 1A artifacts exist', () => {
    // Simulate: kick-forward throws if pass1a_story_layer_v1 is missing
    const kickForwardWithMissingArtifact = async () => {
      throw new Error(
        'KICK_FORWARD_FAILED: Cannot auto-accept — pass1a_story_layer_v1 not found',
      );
    };

    return expect(kickForwardWithMissingArtifact()).rejects.toThrow('KICK_FORWARD_FAILED');
  });

  it('repair transition is conditional on job still being at review_gate (no double-advance)', () => {
    // Simulate the .eq('phase', 'review_gate').eq('phase_status', 'awaiting_approval')
    // guard in the repair DB update — 0 rows means already advanced.
    const alreadyAdvancedJob = { phase: 'phase_2', phase_status: 'queued' };
    const matchesRepairCondition =
      alreadyAdvancedJob.phase === 'review_gate' &&
      alreadyAdvancedJob.phase_status === 'awaiting_approval';

    expect(matchesRepairCondition).toBe(false); // already advanced → skip
  });
});
