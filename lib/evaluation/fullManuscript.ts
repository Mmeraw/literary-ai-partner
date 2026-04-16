/**
 * Full Manuscript Evaluation & Artifact Writing
 *
 * ─────────────────────────────────────────────────────────────────────
 * WAVE REVISION GUIDE AUTHORITY
 * ─────────────────────────────────────────────────────────────────────
 *
 * This module enforces the WAVE Revision Guide as defined in
 * docs/WAVE_REVISION_GUIDE_CANON.md
 *
 * WAVE Authority Chain:
 * 1. Canonical Guide (docs/WAVE_REVISION_GUIDE_CANON.md)
 * 2. 13 Criteria Registry (schemas/criteria-keys.ts)
 * 3. This module (full manuscript coordinator)
 * 4. AI Processor (lib/evaluation/processor.ts)
 * 5. Phase 2 Artifact Writer (lib/evaluation/phase2.ts)
 *
 * ─────────────────────────────────────────────────────────────────────
 * WAVE TIER STRUCTURE
 * ─────────────────────────────────────────────────────────────────────
 *
 * EARLY WAVES — Structural Truth
 * Purpose: Determine whether the manuscript actually works
 * Criteria: POV integrity, causality, scene goals, emotional coherence
 * Failure Mode: If Early waves fail, no Late polishing is permitted
 *
 * MID WAVES — Momentum & Meaning
 * Purpose: Determine whether the manuscript earns its space
 * Criteria: Redundancy, action-reaction, specificity, motif, compression
 * Failure Mode: If Mid waves reveal structural drag, revisit Early passes
 *
 * LATE WAVES — Authority & Polish
 * Purpose: Determine whether the manuscript reads as professional
 * Criteria: Body-part clichés, POV mind-reading, filter verbs, on-the-nose
 * Failure Mode: Late polish without Early/Mid verification creates false readiness
 *
 * ─────────────────────────────────────────────────────────────────────
 * 13 CRITERIA EVALUATION
 * ─────────────────────────────────────────────────────────────────────
 *
 * This module enforces all 13 canonical criteria from CRITERIA_KEYS:
 * 1.  concept              (Early tier - structural premise)
 * 2.  narrativeDrive       (Early tier - escalation & momentum)
 * 3.  character            (Mid tier - psychology & coherence)
 * 4.  voice                (Late tier - POV consistency & control)
 * 5.  sceneConstruction    (Mid tier - function & escalation)
 * 6.  dialogue             (Late tier - authenticity & subtext)
 * 7.  theme                (Mid tier - integration through action)
 * 8.  worldbuilding        (Early tier - internal logic)
 * 9.  pacing               (Mid tier - rhythm & balance)
 * 10. proseControl         (Late tier - line-level craft)
 * 11. tone                 (Late tier - tonal authority)
 * 12. narrativeClosure     (Early tier - promises kept or subverted)
 * 13. marketability        (Late tier - professional readiness)
 *
 * ─────────────────────────────────────────────────────────────────────
 * ARTIFACT PERSISTENCE (PHASE 2)
 * ─────────────────────────────────────────────────────────────────────
 *
 * After AI evaluation completes:
 * - Full EvaluationResultV1 is written to evaluation_artifacts table
 * - artifact_type = "evaluation_result_v1" (canonical)
 * - source_hash ensures idempotency (same input = same artifact)
 * - created_at/updated_at tracked by database
 *
 * Report UI reads from evaluation_artifacts, not from inline results.
 * This ensures canonical authority is always persisted.
 *
 * ─────────────────────────────────────────────────────────────────────
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import { runPhase2Aggregation, isPhase2Err } from "./phase2";

export type FullManuscriptEvaluationResult = {
  success: boolean;
  evaluationResult?: EvaluationResultV1;
  artifactId?: string;
  error?: string;
  details?: string;
};

/**
 * Validate that evaluation result contains all 13 canonical criteria.
 * This is a defensive gate before persisting to artifacts.
 */
function validateEvaluationCompleteness(
  result: EvaluationResultV1
): { valid: boolean; error?: string } {
  if (!result.criteria || !Array.isArray(result.criteria)) {
    return { valid: false, error: "No criteria array found in result" };
  }

  const resultKeys = new Set(result.criteria.map((c) => c.key));
  const expectedKeys = new Set(CRITERIA_KEYS);

  // Check count
  if (resultKeys.size !== expectedKeys.size) {
    return {
      valid: false,
      error: `Criteria count mismatch: got ${resultKeys.size}, expected ${expectedKeys.size}`,
    };
  }

  // Check all expected keys are present
  for (const key of expectedKeys) {
    if (!resultKeys.has(key)) {
      return { valid: false, error: `Missing criterion: ${key}` };
    }
  }

  // Check no extra keys are present
  for (const key of resultKeys) {
    if (!expectedKeys.has(key)) {
      return { valid: false, error: `Invalid criterion: ${key}` };
    }
  }

  return { valid: true };
}

/**
 * Full Manuscript Evaluation & Artifact Persistence
 *
 * Orchestrates the complete evaluation pipeline:
 * 1. Receive evaluation result from processor (AI or mock)
 * 2. Validate result contains all 13 criteria
 * 3. Call Phase 2 to persist artifact to evaluation_artifacts table
 * 4. Return artifact ID and status
 *
 * @param supabase - Supabase client (service role for artifact writes)
 * @param jobId - Job ID for artifact association
 * @param evaluationResult - EvaluationResultV1 from processor
 * @returns Result with artifact ID or error details
 */
export async function evaluateAndPersistFullManuscript(
  supabase: SupabaseClient,
  jobId: string,
  evaluationResult: EvaluationResultV1
): Promise<FullManuscriptEvaluationResult> {
  try {
    // GATE 1: Validate result completeness (13 criteria required)
    const validation = validateEvaluationCompleteness(evaluationResult);
    if (!validation.valid) {
      return {
        success: false,
        error: "Evaluation result validation failed",
        details: validation.error,
      };
    }

    // GATE 2: Persist to evaluation_artifacts via Phase 2
    const phase2Result = await runPhase2Aggregation(
      supabase,
      jobId,
      evaluationResult
    );

    if (isPhase2Err(phase2Result)) {
      return {
        success: false,
        error: "Phase 2 artifact persistence failed",
        details: phase2Result.details,
      };
    }

    // SUCCESS: Artifact persisted
    return {
      success: true,
      evaluationResult,
      artifactId: phase2Result.artifactId,
    };
  } catch (err) {
    return {
      success: false,
      error: "Full manuscript evaluation failed",
      details: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Retrieve persisted evaluation artifact from canonical source.
 *
 * This function reads from evaluation_artifacts table (canonical truth),
 * not from inline evaluation results. This ensures all reports are
 * backed by persisted, auditable artifacts.
 *
 * Reader is v2-first: queries evaluation_result_v2 before evaluation_result_v1
 * to support the migration from v1 to v2 without silent null returns.
 *
 * @param supabase - Supabase client
 * @param jobId - Job ID to retrieve artifact for
 * @returns EvaluationResultV1 or null if not found
 */
export async function getEvaluationArtifact(
  supabase: SupabaseClient,
  jobId: string
): Promise<EvaluationResultV1 | null> {
  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .select("content")
    .eq("job_id", jobId)
    .in("artifact_type", ["evaluation_result_v2", "evaluation_result_v1"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.warn(
      `[FullManuscript] No artifact found for job ${jobId}:`,
      error?.message
    );
    return null;
  }

  return data.content as EvaluationResultV1 | null;
}

/**
 * Audit: List all evaluation artifacts for a manuscript.
 * Used for debugging and ensuring artifact persistence.
 *
 * @param supabase - Supabase client
 * @param manuscriptId - Manuscript ID to list artifacts for
 * @returns Array of artifact metadata (id, created_at, artifact_type)
 */
export async function listEvaluationArtifacts(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<
  Array<{
    id: string;
    artifact_type: string;
    created_at: string;
    source_hash: string;
  }>
> {
  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .select("id, artifact_type, created_at, source_hash")
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(`[FullManuscript] Failed to list artifacts:`, error.message);
    return [];
  }

  return data || [];
}
