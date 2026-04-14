import { z } from 'zod';

export const ReportSummaryProjectionSchema = z.object({
  id: z.string().min(1),
  job_id: z.string().min(1),
  user_id: z.string().min(1),
  canonical_artifact_id: z.string().min(1),
  generated_at: z.string().datetime(),
  overall_score_0_100: z.number().min(0).max(100),
  verdict: z.string().min(1),
  one_paragraph_summary: z.string().min(1),
  top_3_strengths: z.array(z.string()),
  top_3_risks: z.array(z.string()),
  confidence_0_1: z.number().min(0).max(1),
  warnings_count: z.number().int().nonnegative(),
  structural_pass: z.boolean(),
  refinement_unlocked: z.boolean(),
  wave_unlocked: z.boolean(),
  submission_packaging_unlocked: z.boolean(),
});

export type ReportSummaryProjection = z.infer<typeof ReportSummaryProjectionSchema>;
