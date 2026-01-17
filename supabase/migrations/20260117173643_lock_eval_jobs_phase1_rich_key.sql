-- Phase 1 canonical "active job" lock (rich key)
-- Keep: uq_eval_jobs_active_phase1_kind
-- Drop: uq_eval_jobs_active_phase1, uq_eval_jobs_active_phase1_worktype

DROP INDEX IF EXISTS public.uq_eval_jobs_active_phase1;
DROP INDEX IF EXISTS public.uq_eval_jobs_active_phase1_worktype;
    