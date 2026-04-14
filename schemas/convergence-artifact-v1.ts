import { z } from 'zod';
import { CriterionAssessmentSchema } from './pass-artifact-v1';

export const ConvergenceArtifactSchema = z.object({
  id: z.string().min(1),
  job_id: z.string().min(1),
  schema_version: z.literal('convergence-artifact-v1'),
  generated_at: z.string().datetime(),
  inputs: z.object({
    pass1_artifact_id: z.string().min(1),
    pass2_artifact_id: z.string().min(1),
    pass3_artifact_id: z.string().min(1),
  }),
  merged_criteria: z.array(CriterionAssessmentSchema).min(1),
  overview_summary: z.string().min(1),
  convergence_notes: z.array(z.string()),
  conflicts_detected: z.array(z.string()),
  conflicts_resolved: z.array(z.string()),
  validations: z.object({
    schema_valid: z.literal(true),
    pass_separation_preserved: z.boolean(),
    all_required_passes_present: z.boolean(),
    anchor_contract_valid: z.boolean(),
  }),
});

export type ConvergenceArtifact = z.infer<typeof ConvergenceArtifactSchema>;
