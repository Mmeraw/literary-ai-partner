-- Drop duplicate CHECK constraint (keep only one)
ALTER TABLE public.evaluation_jobs
  DROP CONSTRAINT IF EXISTS evaluation_jobs_phase_chk;

-- Drop redundant unique indexes (keep the canonical one)
DROP INDEX IF EXISTS public.uq_eval_jobs_active_phase1;
DROP INDEX IF EXISTS public.uq_eval_jobs_active_phase1_worktype;

-- Create ENUMs (idempotent)
DO $$ BEGIN
  CREATE TYPE public.eval_phase AS ENUM ('phase_0','phase_1','phase_2');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.eval_policy_family AS ENUM ('standard','dark_fiction','trauma_memoir');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.eval_voice_preservation_level AS ENUM ('strict','balanced','expressive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.eval_english_variant AS ENUM ('us','uk','ca','au');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.eval_job_type AS ENUM (
    'full_evaluation',
    'quick_evaluation',
    'screenplay_evaluation',
    'wave_only',
    'summary_only',
    're_evaluate_chunk',
    're_evaluate_wave',
    'novel_to_screenplay',
    'synopsis_generation',
    'query_package_generation',
    'comparables_generation',
    'governance_validation',
    'backfill_migration'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Convert columns from text -> enum
ALTER TABLE public.evaluation_jobs
  ALTER COLUMN phase TYPE public.eval_phase USING phase::public.eval_phase,
  ALTER COLUMN policy_family TYPE public.eval_policy_family USING policy_family::public.eval_policy_family,
  ALTER COLUMN voice_preservation_level TYPE public.eval_voice_preservation_level USING voice_preservation_level::public.eval_voice_preservation_level,
  ALTER COLUMN english_variant TYPE public.eval_english_variant USING english_variant::public.eval_english_variant,
  ALTER COLUMN job_type TYPE public.eval_job_type USING job_type::public.eval_job_type;

-- Drop old CHECK constraints now redundant
ALTER TABLE public.evaluation_jobs
  DROP CONSTRAINT IF EXISTS chk_eval_jobs_policy_family,
  DROP CONSTRAINT IF EXISTS chk_eval_jobs_voice_preservation_level,
  DROP CONSTRAINT IF EXISTS chk_eval_jobs_english_variant,
  DROP CONSTRAINT IF EXISTS evaluation_jobs_job_type_check,
  DROP CONSTRAINT IF EXISTS evaluation_jobs_phase_check;

-- Ensure canonical active-job uniqueness exists
CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_jobs_active_phase1_kind
ON public.evaluation_jobs (manuscript_id, job_type, policy_family, COALESCE(work_type, ''))
WHERE (phase = 'phase_1' AND status = ANY (ARRAY['queued','running','retry_pending']));
