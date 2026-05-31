import {
  assertChecklistPhaseMayStart,
  type ChecklistArtifactMap,
  type ChecklistDecision,
} from './checklistEnforcer';

export type PhaseV2ReadinessProgress = {
  phase0_status?: string;
  chunk_manifest_status?: string;
  checklist_artifacts?: ChecklistArtifactMap;
};

export type PhaseV2ReadinessDecision = {
  ok: boolean;
  code: string;
  reason: string;
};

function isDone(value: unknown): boolean {
  return value === 'done' || value === 'complete' || value === 'completed';
}

function fromChecklistDecision(decision: ChecklistDecision): PhaseV2ReadinessDecision {
  return {
    ok: decision.ok,
    code: decision.code,
    reason: decision.reason,
  };
}

export function assertManuscriptReadingTracksMayStart(
  progress: PhaseV2ReadinessProgress = {},
): PhaseV2ReadinessDecision {
  if (!isDone(progress.phase0_status)) {
    return {
      ok: false,
      code: 'PHASE0_NOT_COMPLETE',
      reason: 'Phase 0 governance warmup must complete before manuscript-reading tracks start.',
    };
  }

  if (!isDone(progress.chunk_manifest_status)) {
    return {
      ok: false,
      code: 'CHUNK_MANIFEST_NOT_DURABLE',
      reason: 'Chunk routing manifest must be durable before Phase 1A and Pass 3A start.',
    };
  }

  return {
    ok: true,
    code: 'MANUSCRIPT_READING_TRACKS_READY',
    reason: 'Phase 0 proof and durable chunk manifest are present.',
  };
}

export function assertPhase05aMayStart(
  progress: PhaseV2ReadinessProgress = {},
): PhaseV2ReadinessDecision {
  const decision = assertManuscriptReadingTracksMayStart(progress);
  if (!decision.ok) return decision;

  return fromChecklistDecision(
    assertChecklistPhaseMayStart('phase_0_5a', progress.checklist_artifacts ?? {}),
  );
}

export function assertPhase05bMayStart(
  progress: PhaseV2ReadinessProgress = {},
): PhaseV2ReadinessDecision {
  const decision = assertManuscriptReadingTracksMayStart(progress);
  if (!decision.ok) return decision;

  return fromChecklistDecision(
    assertChecklistPhaseMayStart('phase_0_5b', progress.checklist_artifacts ?? {}),
  );
}

export function assertPhase1aSeedVerificationMayStart(
  progress: PhaseV2ReadinessProgress = {},
): PhaseV2ReadinessDecision {
  const decision = assertManuscriptReadingTracksMayStart(progress);
  if (!decision.ok) return decision;

  return fromChecklistDecision(
    assertChecklistPhaseMayStart('phase_1a', progress.checklist_artifacts ?? {}),
  );
}

export function assertPhase1aMayStart(
  progress: PhaseV2ReadinessProgress = {},
): PhaseV2ReadinessDecision {
  const decision = assertManuscriptReadingTracksMayStart(progress);
  if (!decision.ok) return decision;

  if (progress.checklist_artifacts) {
    const checklistDecision = assertChecklistPhaseMayStart('phase_1a', progress.checklist_artifacts);
    if (!checklistDecision.ok) return fromChecklistDecision(checklistDecision);
  }

  return {
    ok: true,
    code: 'PHASE1A_MAY_START',
    reason: 'Phase 1A Story Layer lane may start.',
  };
}

export function assertPass3aMayStart(
  progress: PhaseV2ReadinessProgress = {},
): PhaseV2ReadinessDecision {
  const decision = assertManuscriptReadingTracksMayStart(progress);
  if (!decision.ok) return decision;

  return {
    ok: true,
    code: 'PASS3A_MAY_START',
    reason: 'Pass 3A Preflight Scout lane may start.',
  };
}
