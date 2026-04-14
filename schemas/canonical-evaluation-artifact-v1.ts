import { z } from 'zod';
import { CriterionAssessmentSchema } from './pass-artifact-v1';

export const EligibilityBlockSchema = z.object({
  structural_pass: z.boolean(),
  refinement_unlocked: z.boolean(),
  wave_unlocked: z.boolean(),
  submission_packaging_unlocked: z.boolean(),
  reason: z.string().nullable(),
});

export const CanonicalEvaluationArtifactSchema = z
  .object({
    id: z.string().min(1),
    job_id: z.string().min(1),
    schema_version: z.literal('canonical-evaluation-artifact-v1'),
    generated_at: z.string().datetime(),
    source: z.object({
      pass1_artifact_id: z.string().min(1),
      pass2_artifact_id: z.string().min(1),
      pass3_artifact_id: z.string().min(1),
      convergence_artifact_id: z.string().min(1),
    }),
    overview: z.object({
      overall_score_0_100: z.number().min(0).max(100),
      verdict: z.string().min(1),
      one_paragraph_summary: z.string().min(1),
      top_strengths: z.array(z.string()),
      top_risks: z.array(z.string()),
    }),
    criteria: z.array(CriterionAssessmentSchema).min(1),
    governance: z.object({
      confidence_0_1: z.number().min(0).max(1),
      warnings: z.array(z.string()),
      limitations: z.array(z.string()),
      transparency_passed: z.boolean(),
      anchor_contract_passed: z.boolean(),
      canonical_ready: z.boolean(),
    }),
    eligibility: EligibilityBlockSchema,
    provenance: z.object({
      evaluator_version: z.string().min(1),
      prompt_pack_version: z.string().nullable(),
      run_id: z.string().min(1),
      finalizer_version: z.string().min(1),
    }),
  })
  .superRefine((value, ctx) => {
    const ids = [
      value.source.pass1_artifact_id,
      value.source.pass2_artifact_id,
      value.source.pass3_artifact_id,
    ];
    if (new Set(ids).size !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pass artifact ids must remain distinct',
        path: ['source'],
      });
    }

    if (!value.governance.canonical_ready) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'canonical artifact must be canonical_ready=true',
        path: ['governance', 'canonical_ready'],
      });
    }
  });

export type CanonicalEvaluationArtifact = z.infer<typeof CanonicalEvaluationArtifactSchema>;
