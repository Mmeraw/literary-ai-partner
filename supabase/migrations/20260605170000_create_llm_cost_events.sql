-- Canonical LLM cost event ledger for non-evaluation surfaces
-- (Agent Readiness Package, Revise Queue activity, and future scoped workloads).
--
-- Privacy guardrail: this table stores cost telemetry only. Do not persist
-- manuscript prose, query letter text, synopsis text, or bio text.

CREATE TABLE IF NOT EXISTS public.llm_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  activity text NOT NULL,
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_cents numeric(12,4) NOT NULL DEFAULT 0,
  user_id uuid NULL,
  evaluation_job_id uuid NULL,
  manuscript_id bigint NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT llm_cost_events_source_check CHECK (source IN ('evaluation', 'revise_queue', 'agent_readiness')),
  CONSTRAINT llm_cost_events_nonnegative_tokens CHECK (input_tokens >= 0 AND output_tokens >= 0),
  CONSTRAINT llm_cost_events_nonnegative_cost CHECK (cost_cents >= 0)
);

-- Backward-compatibility hardening:
-- If an earlier migration created llm_cost_events with legacy columns
-- (feature_area, operation, job_id, manuscript_id uuid, etc.), converge to
-- the canonical contract expected by application writers/readers.
DO $$
BEGIN
  -- source (legacy: feature_area)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'source'
  ) THEN
    EXECUTE 'ALTER TABLE public.llm_cost_events ADD COLUMN source text';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'feature_area'
  ) THEN
    EXECUTE $stmt$
      UPDATE public.llm_cost_events
      SET source = feature_area
      WHERE source IS NULL
    $stmt$;
  END IF;

  EXECUTE $stmt$
    UPDATE public.llm_cost_events
    SET source = 'evaluation'
    WHERE source IS NULL
  $stmt$;

  EXECUTE 'ALTER TABLE public.llm_cost_events ALTER COLUMN source SET DEFAULT ''evaluation''';
  EXECUTE 'ALTER TABLE public.llm_cost_events ALTER COLUMN source SET NOT NULL';

  -- activity (legacy: operation)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'activity'
  ) THEN
    EXECUTE 'ALTER TABLE public.llm_cost_events ADD COLUMN activity text';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'operation'
  ) THEN
    EXECUTE $stmt$
      UPDATE public.llm_cost_events
      SET activity = operation
      WHERE activity IS NULL
    $stmt$;
  END IF;

  EXECUTE $stmt$
    UPDATE public.llm_cost_events
    SET activity = 'unknown'
    WHERE activity IS NULL
  $stmt$;

  EXECUTE 'ALTER TABLE public.llm_cost_events ALTER COLUMN activity SET DEFAULT ''unknown''';
  EXECUTE 'ALTER TABLE public.llm_cost_events ALTER COLUMN activity SET NOT NULL';

  -- provider
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'provider'
  ) THEN
    EXECUTE 'ALTER TABLE public.llm_cost_events ADD COLUMN provider text';
  END IF;

  EXECUTE $stmt$
    UPDATE public.llm_cost_events
    SET provider = 'openai'
    WHERE provider IS NULL
  $stmt$;

  EXECUTE 'ALTER TABLE public.llm_cost_events ALTER COLUMN provider SET DEFAULT ''openai''';
  EXECUTE 'ALTER TABLE public.llm_cost_events ALTER COLUMN provider SET NOT NULL';

  -- evaluation_job_id (legacy: job_id)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'evaluation_job_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.llm_cost_events ADD COLUMN evaluation_job_id uuid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'job_id'
  ) THEN
    EXECUTE $stmt$
      UPDATE public.llm_cost_events
      SET evaluation_job_id = job_id
      WHERE evaluation_job_id IS NULL
    $stmt$;
  END IF;

  -- manuscript_id must be bigint for canonical writes.
  -- Legacy schema used uuid; preserve it under manuscript_id_legacy_uuid.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'manuscript_id'
      AND udt_name = 'uuid'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'llm_cost_events'
        AND column_name = 'manuscript_id_legacy_uuid'
    ) THEN
      EXECUTE 'ALTER TABLE public.llm_cost_events RENAME COLUMN manuscript_id TO manuscript_id_legacy_uuid';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'llm_cost_events'
      AND column_name = 'manuscript_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.llm_cost_events ADD COLUMN manuscript_id bigint';
  END IF;

  -- canonical source constraint (idempotent)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'llm_cost_events_source_check'
      AND conrelid = 'public.llm_cost_events'::regclass
  ) THEN
    EXECUTE $stmt$
      ALTER TABLE public.llm_cost_events
      ADD CONSTRAINT llm_cost_events_source_check
      CHECK (source IN ('evaluation', 'revise_queue', 'agent_readiness'))
    $stmt$;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_llm_cost_events_created_at ON public.llm_cost_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_cost_events_source_created_at ON public.llm_cost_events (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_activity_created_at ON public.llm_cost_events (activity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_eval_job_id ON public.llm_cost_events (evaluation_job_id);
