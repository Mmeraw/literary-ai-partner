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

CREATE INDEX IF NOT EXISTS idx_llm_cost_events_created_at ON public.llm_cost_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_source_created_at ON public.llm_cost_events (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_activity_created_at ON public.llm_cost_events (activity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_eval_job_id ON public.llm_cost_events (evaluation_job_id);
