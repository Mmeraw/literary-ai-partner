-- Phase C D2: Canonical Observability Event Store (v1)
-- Date: 2026-02-08
-- Contract: LOGGING_SCHEMA_v1 (append-only observability events)
--
-- Purpose:
--   - Append-only event store for job lifecycle + failure envelope events
--   - Audit-grade logging for D2–D5 (observability, dashboards, alerts)
--
-- Design:
--   - Immutability: no updates/deletes in normal operation
--   - Soft enums: text fields validated by contract + CI tests
--   - Idempotency: optional dedupe via idempotency_key

CREATE TABLE IF NOT EXISTS public.observability_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canonical typing
  event_type TEXT NOT NULL,           -- e.g., 'job.failed'
  schema_version TEXT NOT NULL DEFAULT 'v1',

  -- Entity binding
  entity_type TEXT NOT NULL,          -- e.g., 'job'
  entity_id TEXT NOT NULL,            -- canonical external ID (job_id as-is)

  -- Correlation / tracing
  correlation_id TEXT,
  parent_event_id UUID NULL REFERENCES public.observability_events(event_id),

  -- Source & severity
  source_phase TEXT NOT NULL,         -- phase_1 | phase_2 | api | admin | system
  severity TEXT NOT NULL DEFAULT 'info', -- debug|info|warn|error|critical

  -- Time
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Actor (optional)
  actor_id UUID,
  actor_type TEXT,                    -- user | service | system

  -- Idempotency (optional)
  idempotency_key TEXT NULL,

  -- Payload
  payload JSONB NOT NULL,

  -- Governance / integrity
  source_hash TEXT,
  is_redacted BOOLEAN NOT NULL DEFAULT TRUE
);

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_obs_events_entity
  ON public.observability_events(entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_events_type_time
  ON public.observability_events(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_events_phase_time
  ON public.observability_events(source_phase, occurred_at DESC);

-- Optional JSON search (payload keys)
CREATE INDEX IF NOT EXISTS idx_obs_events_payload_gin
  ON public.observability_events USING GIN (payload);

-- Optional idempotency (only when key present)
CREATE UNIQUE INDEX IF NOT EXISTS uq_obs_events_idempotency
  ON public.observability_events (event_type, entity_type, entity_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- RLS: write-only for service role (reads via server/admin)
ALTER TABLE public.observability_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY observability_events_insert_service ON public.observability_events
  FOR INSERT TO service_role
  WITH CHECK (true);

COMMENT ON TABLE public.observability_events IS
'Append-only observability event store (LOGGING_SCHEMA_v1). Canonical job lifecycle + failure envelope events.';

COMMENT ON COLUMN public.observability_events.schema_version IS
'Contract version for event schema (v1).';

COMMENT ON COLUMN public.observability_events.payload IS
'Event payload (JSONB). MUST NOT include secrets or PII. Enforced by contract + CI tests.';
