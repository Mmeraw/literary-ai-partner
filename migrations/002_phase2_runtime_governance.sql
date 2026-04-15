BEGIN;
CREATE TABLE IF NOT EXISTS transition_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES evaluation_jobs(id),
  from_state text NOT NULL,
  to_state text NOT NULL,
  trigger text NOT NULL DEFAULT 'worker',
  lease_token uuid,
  idempotency_key text,
  worker_id text,
  metadata jsonb DEFAULT '{}',
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transition_log_job_id ON transition_log(job_id);
CREATE INDEX IF NOT EXISTS idx_transition_log_created_at ON transition_log(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transition_log_idempotency ON transition_log(job_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS error_policy_registry (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  error_code text NOT NULL UNIQUE,
  severity text NOT NULL DEFAULT 'transient' CHECK (severity IN ('transient','permanent','quarantine','unknown')),
  max_retries int NOT NULL DEFAULT 2,
  retry_delay_ms int NOT NULL DEFAULT 5000,
  action text NOT NULL DEFAULT 'retry' CHECK (action IN ('retry','fail','quarantine','alert','ignore')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO error_policy_registry (error_code, severity, max_retries, retry_delay_ms, action, description) VALUES
  ('PASS1_FAILED','transient',2,10000,'retry','Pass 1 OpenAI failure'),
  ('PASS2_FAILED','transient',2,10000,'retry','Pass 2 OpenAI failure'),
  ('PASS3_FAILED','transient',2,10000,'retry','Pass 3 synthesis failure'),
  ('PASS1_JSON_PARSE_FAILED_TRUNCATED','transient',1,5000,'retry','Pass 1 truncated'),
  ('QG_DUPLICATE_REC','permanent',0,0,'fail','Quality gate duplicate recs'),
  ('QG_INDEPENDENCE_VIOLATION','permanent',0,0,'fail','Quality gate independence violation'),
  ('MANUSCRIPT_UNAVAILABLE','permanent',0,0,'fail','Manuscript text not found'),
  ('OPENAI_TIMEOUT','transient',3,15000,'retry','OpenAI API timeout'),
  ('OPENAI_RATE_LIMIT','transient',3,30000,'retry','OpenAI rate limit'),
  ('OPENAI_SERVER_ERROR','transient',2,10000,'retry','OpenAI 500 error'),
  ('WORKER_LEASE_EXPIRED','transient',1,5000,'retry','Worker lease expired'),
  ('UNKNOWN_ERROR','unknown',1,10000,'quarantine','Unclassified error')
ON CONFLICT (error_code) DO NOTHING;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS lease_token uuid;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS lease_worker_id text;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS current_state text DEFAULT 'ingested';
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS previous_state text;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS state_changed_at timestamptz DEFAULT now();
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS max_retries_allowed int DEFAULT 3;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS quarantine_reason text;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS quarantine_at timestamptz;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS failure_code text;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS failure_count int DEFAULT 0;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS last_failure_at timestamptz;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS environment text DEFAULT 'production';
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS provenance_hash text;
CREATE INDEX IF NOT EXISTS idx_eval_jobs_current_state ON evaluation_jobs(current_state);
CREATE INDEX IF NOT EXISTS idx_eval_jobs_lease_expires ON evaluation_jobs(lease_expires_at) WHERE lease_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eval_jobs_quarantine ON evaluation_jobs(quarantine_at) WHERE quarantine_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eval_jobs_environment ON evaluation_jobs(environment);
COMMIT;
