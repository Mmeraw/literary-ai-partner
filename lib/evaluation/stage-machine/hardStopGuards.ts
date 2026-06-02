import { STORY_LAYER_KEYS, type StoryLayerCoreLayerKey } from '../artifacts/artifactTypes';

export type GuardResult = { ok: true } | { ok: false; reason: string };

export type ArtifactRef = {
  artifact_id: string;
  source_hash: string;
};

export type SupportArtifactRef = {
  accepted_story_ledger_source_hash: string;
};

export type ArtifactSet = {
  story_map_seed_v1?: ArtifactRef;
  evaluation_seed_v1?: ArtifactRef;
  pass1a_story_layer_v1?: ArtifactRef;
  ledger_quality_report_v1?: ArtifactRef;
  pass3_preflight_draft_v1?: ArtifactRef;
  ledger_user_feedback_v1?: ArtifactRef;
  accepted_story_ledger_v1?: ArtifactRef;
  /**
   * Truthful Phase 1/2 handoff artifact. For short-form submissions this may
   * carry `handoff_type=short_form_mode_bypass` instead of pretending an author
   * accepted a long-form Story Ledger.
   */
  pass12_handoff_v1?: ArtifactRef;
  story_shape_signal_map_v1?: SupportArtifactRef;
  manuscript_signal_appendix_v1?: SupportArtifactRef;
};

export type Pass3AStatus =
  | 'not_started'
  | 'running'
  | 'map_done'
  | 'reduce_running'
  | 'done'
  | 'degraded'
  | 'failed';

export type Pass3AGateValidity = 'not_ready' | 'gate_valid' | 'gate_blocking';

export type Pass3AMapStatus = 'not_started' | 'running' | 'done' | 'failed';

export type Pass3AReduceStatus =
  | 'not_started'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped';

export type PhaseV2Progress = {
  phase0_status?: string;
  chunk_manifest_status?: string;
  phase1a_status?: string;
  pass3a_status?: Pass3AStatus;
  pass3a_gate_validity?: Pass3AGateValidity;
  pass3a_map_status?: Pass3AMapStatus;
  pass3a_reduce_status?: Pass3AReduceStatus;
  review_gate_ready?: boolean;
  pass3a_completed_at?: string;
  degraded_reason?: string;
  degraded_reason_codes?: string[];
  degraded_at?: string;
};

export type ReviewerRole = 'author' | 'admin' | 'operator';

function ok(): GuardResult {
  return { ok: true };
}

function fail(reason: string): GuardResult {
  return { ok: false, reason };
}

function hasArtifactRef(ref: ArtifactRef | undefined): ref is ArtifactRef {
  return Boolean(ref?.artifact_id && ref?.source_hash);
}

function hasPhase2Authority(set: ArtifactSet): boolean {
  return hasArtifactRef(set.accepted_story_ledger_v1) || hasArtifactRef(set.pass12_handoff_v1);
}

function hasCompletionMetadata(progress: PhaseV2Progress): boolean {
  return (
    Boolean(progress.pass3a_completed_at) ||
    (progress.pass3a_map_status === 'done' && progress.pass3a_reduce_status === 'done')
  );
}

function hasStructuredDegradedProof(progress: PhaseV2Progress): boolean {
  return Boolean(
    progress.degraded_reason &&
      Array.isArray(progress.degraded_reason_codes) &&
      progress.degraded_reason_codes.length > 0 &&
      progress.degraded_at,
  );
}

/**
 * Derive Pass 3A gate validity from canonical progress + artifact evidence.
 * This value is computed truth and must not be hand-set.
 */
export function derivePass3aGateValidity(
  progress: PhaseV2Progress,
  artifacts: ArtifactSet,
): Pass3AGateValidity {
  const status = progress.pass3a_status;

  if (status === 'failed') {
    return 'gate_blocking';
  }

  if (status === 'done') {
    const hasDraft = hasArtifactRef(artifacts.pass3_preflight_draft_v1);
    if (!hasDraft || !hasCompletionMetadata(progress)) {
      return 'gate_blocking';
    }
    return 'gate_valid';
  }

  if (status === 'degraded') {
    return hasStructuredDegradedProof(progress) ? 'gate_valid' : 'gate_blocking';
  }

  if (
    status === 'not_started' ||
    status === 'running' ||
    status === 'map_done' ||
    status === 'reduce_running' ||
    typeof status === 'undefined'
  ) {
    return 'not_ready';
  }

  return 'gate_blocking';
}

/**
 * Review Gate readiness is derived, never hand-set in progress.
 */
export function deriveReviewGateReadiness(
  progress: PhaseV2Progress,
  artifacts: ArtifactSet,
): boolean {
  const storyLayerReady = hasArtifactRef(artifacts.pass1a_story_layer_v1);
  const qualityReportReady = hasArtifactRef(artifacts.ledger_quality_report_v1);
  const pass3aGateValidity = derivePass3aGateValidity(progress, artifacts);
  return storyLayerReady && qualityReportReady && pass3aGateValidity === 'gate_valid';
}

/**
 * Phase 2 must fail closed until Pass 3A is terminal-and-gate-valid.
 */
export function assertPhase2Preconditions(
  progress: PhaseV2Progress,
  artifacts: ArtifactSet,
): void {
  const status = progress.pass3a_status;
  const gateValidity = derivePass3aGateValidity(progress, artifacts);

  if (status === 'failed') {
    throw new Error('PASS3A_FAILED_BLOCKING');
  }

  if (
    status === 'not_started' ||
    status === 'running' ||
    status === 'map_done' ||
    status === 'reduce_running' ||
    typeof status === 'undefined'
  ) {
    throw new Error('PASS3A_NOT_READY');
  }

  if (status === 'done' && !hasArtifactRef(artifacts.pass3_preflight_draft_v1)) {
    throw new Error('PASS3A_ARTIFACT_MISSING');
  }

  if (status === 'degraded' && !hasStructuredDegradedProof(progress)) {
    throw new Error('PASS3A_DEGRADED_PROOF_MISSING');
  }

  if (gateValidity !== 'gate_valid') {
    throw new Error('PASS3A_HALF_WRITTEN');
  }
}

export function requireStoryLayer(set: ArtifactSet): GuardResult {
  return hasArtifactRef(set.pass1a_story_layer_v1)
    ? ok()
    : fail('pass1a_story_layer_v1 is required before leaving Phase 1A');
}

export function requireQualityReport(set: ArtifactSet): GuardResult {
  return hasArtifactRef(set.ledger_quality_report_v1)
    ? ok()
    : fail('ledger_quality_report_v1 is required before entering Review Gate');
}

export function requireUserFeedback(set: ArtifactSet): GuardResult {
  return hasArtifactRef(set.ledger_user_feedback_v1)
    ? ok()
    : fail('ledger_user_feedback_v1 is required before Approval Normalizer, even for accepted_without_changes');
}

export function requireAcceptedLedger(set: ArtifactSet): GuardResult {
  return hasPhase2Authority(set)
    ? ok()
    : fail('accepted_story_ledger_v1 or truthful short-form pass12_handoff_v1 is required before Phase 2 evaluation');
}

export function forbidPhase2WithoutAcceptedLedger(set: ArtifactSet): GuardResult {
  if (hasPhase2Authority(set)) {
    return ok();
  }

  if (hasArtifactRef(set.story_map_seed_v1) || hasArtifactRef(set.evaluation_seed_v1)) {
    return fail(
      'Phase 2 cannot consume seed artifacts (story_map_seed_v1/evaluation_seed_v1); accepted_story_ledger_v1 or short-form pass12_handoff_v1 is required',
    );
  }

  if (hasArtifactRef(set.pass1a_story_layer_v1)) {
    return fail('Phase 2 cannot consume raw pass1a_story_layer_v1; accepted_story_ledger_v1 or short-form pass12_handoff_v1 is required');
  }

  return fail('Phase 2 requires accepted_story_ledger_v1 or short-form pass12_handoff_v1 as story-understanding authority');
}

export function requireOverrideRole(role: ReviewerRole): GuardResult {
  return role === 'admin' || role === 'operator'
    ? ok()
    : fail('accepted_with_override may only be written by admin or operator roles');
}

export function checkSupportArtifactFreshness(set: ArtifactSet): GuardResult {
  const acceptedHash = set.accepted_story_ledger_v1?.source_hash;
  if (!acceptedHash) {
    return hasArtifactRef(set.pass12_handoff_v1)
      ? ok()
      : fail('accepted_story_ledger_v1 is required to validate support artifact freshness');
  }

  const supportArtifacts: Array<[keyof ArtifactSet, SupportArtifactRef | undefined]> = [
    ['story_shape_signal_map_v1', set.story_shape_signal_map_v1],
    ['manuscript_signal_appendix_v1', set.manuscript_signal_appendix_v1],
  ];

  for (const [artifactType, supportArtifact] of supportArtifacts) {
    if (!supportArtifact) continue;
    if (supportArtifact.accepted_story_ledger_source_hash !== acceptedHash) {
      return fail(`${artifactType} is stale relative to accepted_story_ledger_v1`);
    }
  }

  return ok();
}

export function canonicalLayerKeys(): StoryLayerCoreLayerKey[] {
  return [...STORY_LAYER_KEYS];
}

export function forbidLayer9(layerKeys: readonly string[]): GuardResult {
  const allowedKeys = new Set<string>(STORY_LAYER_KEYS);
  const seenKeys = new Set<string>();

  for (const key of layerKeys) {
    if (!allowedKeys.has(key)) {
      return fail(`Story Layer key "${key}" is non-canonical`);
    }
    if (seenKeys.has(key)) {
      return fail(`Story Layer key "${key}" is duplicated`);
    }
    seenKeys.add(key);
  }

  return ok();
}
