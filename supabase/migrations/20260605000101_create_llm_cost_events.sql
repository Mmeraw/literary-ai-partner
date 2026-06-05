CREATE TABLE IF NOT EXISTS public.llm_cost_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_area text NOT NULL CHECK (feature_area IN ('evaluation', 'agent_readiness', 'revise_queue')),
  workflow_id uuid NULL,
  job_id uuid NULL,
  manuscript_id uuid NULL,
  user_id uuid NULL,
  phase text NULL,
  operation text NULL,
  model text NULL,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cost_cents integer DEFAULT 0,
  called_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_llm_cost_events_feature_area ON public.llm_cost_events (feature_area);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_called_at ON public.llm_cost_events (called_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_job_id ON public.llm_cost_events (job_id);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_workflow_id ON public.llm_cost_events (workflow_id);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_manuscript_id ON public.llm_cost_events (manuscript_id);
CREATE INDEX IF NOT EXISTS idx_llm_cost_events_user_id ON public.llm_cost_events (user_id);
