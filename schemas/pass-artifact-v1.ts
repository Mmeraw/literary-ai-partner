import { z } from 'zod';

export const EvidenceAnchorSchema = z
  .object({
    anchor_id: z.string().min(1),
    source_type: z.enum(['manuscript_chunk', 'manuscript_span', 'criterion_note']),
    source_ref: z.string().min(1),
    start_offset: z.number().int().nonnegative().nullable(),
    end_offset: z.number().int().nonnegative().nullable(),
    excerpt: z.string().nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      value.start_offset !== null
      && value.end_offset !== null
      && value.end_offset < value.start_offset
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_offset cannot be less than start_offset',
        path: ['end_offset'],
      });
    }
  });

export const CriterionAssessmentSchema = z.object({
  criterion_id: z.string().min(1),
  score_0_10: z.number().min(0).max(10),
  rationale: z.string().min(1),
  confidence_0_1: z.number().min(0).max(1),
  evidence: z.array(EvidenceAnchorSchema),
  warnings: z.array(z.string()),
});

export const PassArtifactSchema = z
  .object({
    id: z.string().min(1),
    job_id: z.string().min(1),
    pass_id: z.enum(['pass1', 'pass2', 'pass3']),
    schema_version: z.literal('pass-artifact-v1'),
    manuscript_revision_id: z.string().min(1),
    generated_at: z.string().datetime(),
    summary: z.string().min(1),
    criteria: z.array(CriterionAssessmentSchema).min(1),
    provenance: z.object({
      evaluator_version: z.string().min(1),
      prompt_pack_version: z.string().nullable(),
      run_id: z.string().min(1),
    }),
    validations: z.object({
      schema_valid: z.literal(true),
      anchor_contract_valid: z.boolean(),
      evidence_nonempty: z.boolean(),
      orphan_reasoning_absent: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    for (const criterion of value.criteria) {
      if (criterion.rationale.trim().length > 0 && criterion.evidence.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `criterion ${criterion.criterion_id} has rationale but no evidence`,
          path: ['criteria'],
        });
      }
    }
  });

export type PassArtifact = z.infer<typeof PassArtifactSchema>;