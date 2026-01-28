-- Phase 2C-4: Audit-grade provider call persistence
-- Create evaluation_provider_calls table for forensics + audit trail
-- Canonical version: 2c1.v1

CREATE TABLE IF NOT EXISTS public.evaluation_provider_calls (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  phase               text NOT NULL,  -- e.g. 'phase_2'
  provider            text NOT NULL,  -- e.g. 'openai'
  provider_meta_version text NOT NULL DEFAULT '2c1.v1',

  request_meta        jsonb NOT NULL,  -- model, temperature, max_output_tokens, prompt_version_hash, input_chars
  response_meta       jsonb,           -- latency_ms, retries, status_code, output_chars, finish_reason
  error_meta          jsonb,           -- code, status_code, retryable, message (truncated)
  result_envelope     jsonb,           -- canonical result structure: overview, details, metadata, partial

  created_at          timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT check_phase_valid CHECK (phase IN ('phase_1', 'phase_2', 'phase_3')),
  CONSTRAINT check_provider_valid CHECK (provider IN ('openai', 'anthropic', 'simulated'))
);

CREATE INDEX IF NOT EXISTS idx_provider_calls_job_id
  ON public.evaluation_provider_calls(job_id);

CREATE INDEX IF NOT EXISTS idx_provider_calls_provider_phase
  ON public.evaluation_provider_calls(provider, phase);

CREATE INDEX IF NOT EXISTS idx_provider_calls_created_at
  ON public.evaluation_provider_calls(created_at DESC);

COMMENT ON TABLE public.evaluation_provider_calls IS
  'Audit-grade forensics table for provider calls (OpenAI, etc). Persists request/response/error metadata and canonical result envelope. Canonical version: 2c1.v1';

COMMENT ON COLUMN public.evaluation_provider_calls.provider_meta_version IS
  'Schema version tag (e.g. 2c1.v1). Enables safe evolution of request_meta/response_meta/error_meta structure.';

COMMENT ON COLUMN public.evaluation_provider_calls.request_meta IS
  'Request configuration: model, temperature, max_output_tokens, prompt_version_hash, input_chars. No secrets.';

COMMENT ON COLUMN public.evaluation_provider_calls.response_meta IS
  'Response telemetry: latency_ms, retries, status_code (if error), output_chars, finish_reason. No raw output.';

COMMENT ON COLUMN public.evaluation_provider_calls.error_meta IS
  'Error details: code, status_code, retryable, truncated message. Safe for long-term retention.';

COMMENT ON COLUMN public.evaluation_provider_calls.result_envelope IS
  'Canonical result: {overview, details, metadata, partial}. This is the exact structure returned to the job.';
