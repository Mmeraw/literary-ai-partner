/**
 * Phase Input Artifact Guards (Mistake-Proofing)
 *
 * Each phase has a single guard function that enforces:
 * - Required artifacts MUST EXIST before the phase starts
 * - Corrupt artifacts ARE allowed (with corruption measure) — degraded ≠ missing
 * - Optional/optimization artifacts skip gracefully when absent
 *
 * Philosophy:
 *   MISSING = phase cannot reason at all → HARD STOP
 *   CORRUPT = phase can reason, just less confidently → ALWAYS PROCEED
 *
 * Call the appropriate guard at the very top of each phase's execution path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ArtifactExistenceResult {
  exists: boolean;
  artifact_id?: string;
  /** Whether content was found and is a non-empty record */
  has_content: boolean;
}

export interface PhaseInputGuardResult {
  ok: boolean;
  /** When ok=false, the specific missing artifact(s) */
  missing_artifacts: string[];
  /** Artifacts that exist but may be degraded */
  present_artifacts: string[];
  /** Human-readable failure reason (if !ok) */
  reason?: string;
  /** Guard code for logging/telemetry */
  code: string;
}

async function checkArtifactExists(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
  artifactType: string,
): Promise<ArtifactExistenceResult> {
  const { data, error } = await supabase
    .from('evaluation_artifacts')
    .select('id, content')
    .eq('job_id', jobId)
    .eq('artifact_type', artifactType)
    .maybeSingle();

  if (error || !data) {
    return { exists: false, has_content: false };
  }

  const hasContent = data.content !== null
    && typeof data.content === 'object'
    && Object.keys(data.content as Record<string, unknown>).length > 0;

  return {
    exists: true,
    artifact_id: data.id,
    has_content: hasContent,
  };
}

/**
 * Phase 0.5A/0.5B → Phase 1A Guard
 *
 * Required:
 * - story_map_seed_v1 (Phase 0.5A) — chunk routing depends on this
 * - evaluation_seed_v1 (Phase 0.5B) — criteria configuration depends on this
 */
export async function guardPhase1aInputs(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
): Promise<PhaseInputGuardResult> {
  const [storyMap, evalSeed] = await Promise.all([
    checkArtifactExists(supabase, jobId, 'story_map_seed_v1'),
    checkArtifactExists(supabase, jobId, 'evaluation_seed_v1'),
  ]);

  const missing: string[] = [];
  const present: string[] = [];

  if (!storyMap.exists) missing.push('story_map_seed_v1');
  else present.push('story_map_seed_v1');

  if (!evalSeed.exists) missing.push('evaluation_seed_v1');
  else present.push('evaluation_seed_v1');

  if (missing.length > 0) {
    return {
      ok: false,
      missing_artifacts: missing,
      present_artifacts: present,
      reason: `Phase 1A cannot start: missing required seed artifacts [${missing.join(', ')}]. Phase 0.5 must complete first.`,
      code: 'PHASE1A_SEED_ARTIFACTS_MISSING',
    };
  }

  return {
    ok: true,
    missing_artifacts: [],
    present_artifacts: present,
    code: 'PHASE1A_INPUTS_PRESENT',
  };
}

/**
 * Phase 1A → Phase 2 Guard
 *
 * Required:
 * - pass1a_story_layer_v1 — Phase 2 scores against the story layer
 * - accepted_story_ledger_v1 OR will be auto-created via kick-forward
 *
 * Optional (optimization):
 * - pass3_preflight_draft_v1 (Track C) — helps synthesis but not required
 * - ledger_quality_report_v1 — informs gate but not structurally needed for Phase 2
 */
export async function guardPhase2Inputs(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
): Promise<PhaseInputGuardResult> {
  const [storyLayer, acceptedLedger, preflight] = await Promise.all([
    checkArtifactExists(supabase, jobId, 'pass1a_story_layer_v1'),
    checkArtifactExists(supabase, jobId, 'accepted_story_ledger_v1'),
    checkArtifactExists(supabase, jobId, 'pass3_preflight_draft_v1'),
  ]);

  const missing: string[] = [];
  const present: string[] = [];

  // HARD REQUIREMENT: story layer must exist (Phase 1A must have completed)
  if (!storyLayer.exists) {
    missing.push('pass1a_story_layer_v1');
  } else {
    present.push('pass1a_story_layer_v1');
  }

  // SOFT: accepted_story_ledger_v1 — if missing, auto-accept will create it (kick forward)
  if (acceptedLedger.exists) present.push('accepted_story_ledger_v1');
  // Not added to missing[] — auto-accept handles this case

  // OPTIONAL: preflight (optimization only, never blocks)
  if (preflight.exists) present.push('pass3_preflight_draft_v1');

  if (missing.length > 0) {
    return {
      ok: false,
      missing_artifacts: missing,
      present_artifacts: present,
      reason: `Phase 2 cannot start: missing required artifacts [${missing.join(', ')}]. Phase 1A must complete first.`,
      code: 'PHASE2_REQUIRED_ARTIFACTS_MISSING',
    };
  }

  return {
    ok: true,
    missing_artifacts: [],
    present_artifacts: present,
    code: 'PHASE2_INPUTS_PRESENT',
  };
}

/**
 * Phase 2 → Phase 3 Guard
 *
 * Required:
 * - pass1a_story_layer_v1 — synthesis references story structure
 * - accepted_story_ledger_v1 — synthesis uses governance decisions
 * - At least one Phase 2 criterion result artifact
 *
 * Optional (optimization):
 * - pass3_preflight_draft_v1 — helps synthesis calibration
 */
export async function guardPhase3Inputs(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
): Promise<PhaseInputGuardResult> {
  const [storyLayer, acceptedLedger, preflight, phase2Results] = await Promise.all([
    checkArtifactExists(supabase, jobId, 'pass1a_story_layer_v1'),
    checkArtifactExists(supabase, jobId, 'accepted_story_ledger_v1'),
    checkArtifactExists(supabase, jobId, 'pass3_preflight_draft_v1'),
    // Check for at least one Phase 2 criterion result
    (async () => {
      const { count, error } = await supabase
        .from('evaluation_artifacts')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .like('artifact_type', 'pass2_criterion_%');
      return { exists: !error && (count ?? 0) > 0, count: count ?? 0 };
    })(),
  ]);

  const missing: string[] = [];
  const present: string[] = [];

  if (!storyLayer.exists) missing.push('pass1a_story_layer_v1');
  else present.push('pass1a_story_layer_v1');

  if (!acceptedLedger.exists) missing.push('accepted_story_ledger_v1');
  else present.push('accepted_story_ledger_v1');

  if (!phase2Results.exists) missing.push('pass2_criterion_results (at least 1)');
  else present.push(`pass2_criterion_results (${phase2Results.count})`);

  // Optional
  if (preflight.exists) present.push('pass3_preflight_draft_v1');

  if (missing.length > 0) {
    return {
      ok: false,
      missing_artifacts: missing,
      present_artifacts: present,
      reason: `Phase 3 cannot start: missing required artifacts [${missing.join(', ')}]. Prior phases must complete first.`,
      code: 'PHASE3_REQUIRED_ARTIFACTS_MISSING',
    };
  }

  return {
    ok: true,
    missing_artifacts: [],
    present_artifacts: present,
    code: 'PHASE3_INPUTS_PRESENT',
  };
}

// ── TIME-GATED AUTO-UNBLOCK ──────────────────────────────────────────────────

/** Retryable block codes that are eligible for time-gated auto-clear */
const RETRYABLE_BLOCK_CODES = new Set([
  'REVIEW_GATE_QUALITY_TECHNICAL_BLOCK',
  'PASS3A_NOT_READY',
  'PASS3A_HALF_WRITTEN',
  'PASS3A_REDUCER_FAILED',
  'REVIEW_GATE_TECHNICAL_KICK_FORWARD',
]);

/** Default auto-unblock threshold: 10 minutes */
const AUTO_UNBLOCK_THRESHOLD_MS = 10 * 60 * 1000;

export interface TimeGatedUnblockResult {
  should_unblock: boolean;
  block_code: string | null;
  block_age_ms: number;
  reason: string;
}

/**
 * Check whether a retryable block has persisted beyond the time threshold.
 * If so, the caller should auto-clear the block and kick forward.
 *
 * @param progress - The job's progress JSONB
 * @param thresholdMs - Override threshold (default 10 minutes)
 */
export function shouldTimeGatedUnblock(
  progress: Record<string, unknown>,
  thresholdMs: number = AUTO_UNBLOCK_THRESHOLD_MS,
): TimeGatedUnblockResult {
  const blockCode = typeof progress.block_code === 'string' ? progress.block_code : null;

  if (!blockCode) {
    return { should_unblock: false, block_code: null, block_age_ms: 0, reason: 'No block_code set.' };
  }

  if (!RETRYABLE_BLOCK_CODES.has(blockCode)) {
    return {
      should_unblock: false,
      block_code: blockCode,
      block_age_ms: 0,
      reason: `Block code "${blockCode}" is not retryable — requires manual resolution.`,
    };
  }

  // Determine when the block was set (from phase_log or phase1a_completed_at)
  let blockSetAt: number | null = null;

  // Check phase_log for the review_gate_blocked event
  if (Array.isArray(progress.phase_log)) {
    const blockEvents = (progress.phase_log as Array<{ at?: string; event?: string }>)
      .filter(e => e.event === 'review_gate_blocked' || e.event === 'track_c_reducer_failed')
      .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

    if (blockEvents.length > 0 && blockEvents[0].at) {
      blockSetAt = new Date(blockEvents[0].at).getTime();
    }
  }

  // Fallback: use phase1a_completed_at (block is set right after Phase 1A completes)
  if (!blockSetAt && typeof progress.phase1a_completed_at === 'string') {
    blockSetAt = new Date(progress.phase1a_completed_at).getTime();
  }

  // Final fallback: can't determine age — don't unblock
  if (!blockSetAt || isNaN(blockSetAt)) {
    return {
      should_unblock: false,
      block_code: blockCode,
      block_age_ms: 0,
      reason: 'Cannot determine block age — no timestamp found.',
    };
  }

  const blockAgeMs = Date.now() - blockSetAt;

  if (blockAgeMs >= thresholdMs) {
    return {
      should_unblock: true,
      block_code: blockCode,
      block_age_ms: blockAgeMs,
      reason: `Retryable block "${blockCode}" has persisted for ${Math.round(blockAgeMs / 60000)} minutes (threshold: ${Math.round(thresholdMs / 60000)} min). Auto-clearing.`,
    };
  }

  return {
    should_unblock: false,
    block_code: blockCode,
    block_age_ms: blockAgeMs,
    reason: `Block age ${Math.round(blockAgeMs / 1000)}s is under threshold ${Math.round(thresholdMs / 1000)}s.`,
  };
}
