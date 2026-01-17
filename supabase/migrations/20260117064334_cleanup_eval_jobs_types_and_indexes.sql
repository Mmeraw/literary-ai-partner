-- Cleanup evaluation_jobs types and indexes for governed model

------------------------------------------------------------
-- 1) Drop duplicate / legacy CHECK constraints
------------------------------------------------------------

ALTER TABLE public.evaluation_jobs
  DROP CONSTRAINT IF EXISTS evaluation_jobs_phase_chk;

-- Keep the text-based CHECK constraints that already exist in schema:
--   chk_eval_jobs_policy_family
--   chk_eval_jobs_voice_preservation_level
--   chk_eval_jobs_english_variant
--   evaluation_jobs_job_type_check


------------------------------------------------------------
-- 2) Drop redundant unique indexes (keep rich phase_1 lock)
------------------------------------------------------------

DROP INDEX IF EXISTS public.uq_eval_jobs_active_phase1;
DROP INDEX IF EXISTS public.uq_eval_jobs_active_phase1_worktype;

-- We intentionally KEEP:
--   uq_eval_jobs_active_phase1_kind
-- as the canonical "only one active job" rule for phase_1:
--   (manuscript_id, job_type, policy_family, COALESCE(work_type, ''))
--   WHERE phase = 'phase_1' AND status IN ('queued','running','retry_pending');


------------------------------------------------------------
-- 3) Ensure canonical active-job uniqueness exists (rich key)
------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_jobs_active_phase1_kind
ON public.evaluation_jobs (
  manuscript_id,
  job_type,
  policy_family,
  COALESCE(work_type, ''::text)
)
WHERE
  phase = 'phase_1'::text
  AND status = ANY (ARRAY['queued'::text,'running'::text,'retry_pending'::text]);
