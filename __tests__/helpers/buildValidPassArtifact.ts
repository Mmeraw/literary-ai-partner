/**
 * Shared Canonical Fixture Builder — RevisionGrade
 *
 * SINGLE SOURCE OF TRUTH for valid pass artifact test fixtures.
 *
 * Rules:
 * - All success-path, release-path, canonical-path, persistence-path,
 *   and finalizer-path tests MUST use this builder.
 * - No local "minimal fake" builders for tests that pass through
 *   canonical finalization.
 * - This builder generates from CRITERIA_KEYS (canon), not memory.
 *
 * If a new invariant (enforce*, assert*) breaks this fixture,
 * the fix belongs HERE — not scattered across test files.
 */
import { CRITERIA_KEYS } from "../../schemas/criteria-keys";
import type { PassArtifact, CriterionAssessment, EvidenceAnchor } from "../../lib/jobs/finalize.types";

export function buildValidPassArtifact(
  passId: "pass1" | "pass2" | "pass3",
  overrides: Partial<PassArtifact> = {},
): PassArtifact {
  return {
    id: `artifact-${passId}`,
    job_id: "job-1",
    pass_id: passId,
    schema_version: "1.0.0",
    manuscript_revision_id: "rev-1",
    generated_at: new Date().toISOString(),
    summary: "Valid pass artifact fixture",
    criteria: CRITERIA_KEYS.map((key) => ({
      criterion_id: key,
      score_0_10: 7,
      rationale: `Rationale for ${key}`,
      confidence_0_1: 0.8,
      evidence: [
        {
          anchor_id: `anchor-${key}`,
          source_type: "manuscript_chunk" as const,
          source_ref: `chunk-${key}`,
          start_offset: 0,
          end_offset: 100,
          excerpt: `Evidence for ${key}`,
        },
      ],
      warnings: [],
    })),
    provenance: {
      evaluator_version: "1.0.0",
      prompt_pack_version: "1.0.0",
      run_id: "run-1",
    },
    validations: {
      schema_valid: true,
      anchor_contract_valid: true,
      evidence_nonempty: true,
      orphan_reasoning_absent: true,
    },
    ...overrides,
  };
}

/**
 * Build a valid convergence artifact that references the given pass artifacts.
 */
import type { ConvergenceArtifact } from "../../lib/jobs/finalize.types";

export function buildValidConvergenceArtifact(
  pass1Id: string,
  pass2Id: string,
  pass3Id: string,
  overrides: Partial<ConvergenceArtifact> = {},
): ConvergenceArtifact {
  return {
    id: "convergence-1",
    job_id: "job-1",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    inputs: {
      pass1_artifact_id: pass1Id,
      pass2_artifact_id: pass2Id,
      pass3_artifact_id: pass3Id,
    },
    merged_criteria: CRITERIA_KEYS.map((key) => ({
      criterion_id: key,
      score_0_10: 7,
      rationale: `Merged rationale for ${key}`,
      confidence_0_1: 0.85,
      evidence: [
        {
          anchor_id: `merged-anchor-${key}`,
          source_type: "manuscript_chunk" as const,
          source_ref: `merged-chunk-${key}`,
          start_offset: 0,
          end_offset: 100,
          excerpt: `Merged evidence for ${key}`,
        },
      ],
      warnings: [],
    })),
    overview_summary: "Convergence summary fixture",
    convergence_notes: [],
    conflicts_detected: [],
    conflicts_resolved: [],
    validations: {
      schema_valid: true,
      pass_separation_preserved: true,
      all_required_passes_present: true,
      anchor_contract_valid: true,
    },
    ...overrides,
  };
}
