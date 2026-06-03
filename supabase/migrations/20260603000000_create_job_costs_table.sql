-- Create the job_costs table for CostOps dashboard
-- Tracks per-call LLM spend during evaluation pipeline execution.
-- Cost is stored in integer USD cents to avoid floating-point drift.

CREATE TABLE IF NOT EXISTS public.job_costs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL,
  phase text,
  model text,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cost_cents integer DEFAULT 0,
  called_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_costs_job_id ON public.job_costs (job_id);
CREATE INDEX IF NOT EXISTS idx_job_costs_called_at ON public.job_costs (called_at DESC);

-- RLS: only service_role (admin client) can read/write
ALTER TABLE public.job_costs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_costs' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.job_costs
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END
$$;
