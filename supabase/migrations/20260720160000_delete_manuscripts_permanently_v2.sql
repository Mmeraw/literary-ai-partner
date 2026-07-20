-- Migration: delete_manuscripts_permanently v2
--
-- Enforces the contract from docs/governance/MANUSCRIPT_DELETION_CONTRACT.md:
-- - one internal, service-role-only RPC;
-- - atomic rejection when any requested id is unauthorized, not found, or not owned;
-- - idempotent replay for ids the same user has already deleted (via tombstone log);
-- - explicit deletion of dependent operational records in dependency order;
-- - anonymization/preservation of billing, cost, audit, and fraud ledgers.

-- Allow audit rows to survive the deletion of their associated evaluation job.
ALTER TABLE IF EXISTS public.admin_actions
  ALTER COLUMN job_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.evaluation_support_access_log
  ALTER COLUMN evaluation_job_id DROP NOT NULL;

-- Tombstone log for idempotent replay and durable deletion evidence.
-- This table is append-only; service_role may read and insert.
CREATE TABLE IF NOT EXISTS public.manuscript_deletion_log (
  manuscript_id bigint PRIMARY KEY,
  user_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manuscript_deletion_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, DELETE ON TABLE public.manuscript_deletion_log TO service_role;
  END IF;
END
$$;

-- Durable queue for storage objects that could not be removed immediately.
-- A background worker can retry rows with status = 'pending'.
CREATE TABLE IF NOT EXISTS public.manuscript_storage_cleanup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id bigint,
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manuscript_storage_cleanup_queue_status
  ON public.manuscript_storage_cleanup_queue (status, updated_at);

ALTER TABLE public.manuscript_storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.manuscript_storage_cleanup_queue TO service_role;
  END IF;
END
$$;

-- Internal, service-role-only RPC for permanently deleting one or more manuscripts.
--
-- p_user_id is the *server-authorized* owner identity. This function is never
-- exposed to unauthenticated clients; it is called only by a server-side route
-- that has already verified the session. Authorization inside the function uses
-- row-level locks and an exact requested-vs-owned count comparison.

-- Drop the previous signature so the return type can change from the v1 contract.
DROP FUNCTION IF EXISTS public.delete_manuscripts_permanently(uuid, bigint[]) CASCADE;

CREATE FUNCTION public.delete_manuscripts_permanently(
  p_user_id uuid,
  p_manuscript_ids bigint[]
)
RETURNS TABLE(
  deleted_ids bigint[],
  already_absent_ids bigint[],
  deleted_count int,
  counts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested bigint[];
  v_to_delete bigint[] := '{}';
  v_already_absent bigint[] := '{}';
  v_unauthorized bigint[] := '{}';
  v_not_found bigint[] := '{}';
  v_text_ids text[];
  v_count int;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  -- Validate input.
  IF p_manuscript_ids IS NULL OR array_length(p_manuscript_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'manuscript_ids cannot be empty' USING ERRCODE = '22023';
  END IF;

  -- Deduplicate and sort so the requested-vs-owned comparison is exact.
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_requested
  FROM unnest(p_manuscript_ids) x;

  -- Lock any existing manuscripts and classify them in a single pass.
  CREATE TEMP TABLE _locked_manuscripts (
    id bigint PRIMARY KEY,
    user_id uuid
  ) ON COMMIT DROP;

  INSERT INTO _locked_manuscripts (id, user_id)
  SELECT m.id, m.user_id
  FROM public.manuscripts m
  WHERE m.id = ANY(v_requested)
  ORDER BY m.id
  FOR UPDATE OF m;

  SELECT array_agg(l.id ORDER BY l.id) INTO v_to_delete
  FROM _locked_manuscripts l
  WHERE l.user_id = p_user_id;

  SELECT array_agg(l.id ORDER BY l.id) INTO v_unauthorized
  FROM _locked_manuscripts l
  WHERE l.user_id IS DISTINCT FROM p_user_id;

  -- Missing IDs are either already deleted by this user (idempotent) or not found.
  SELECT array_agg(i.id ORDER BY i.id) INTO v_already_absent
  FROM unnest(v_requested) i(id)
  LEFT JOIN public.manuscripts m ON m.id = i.id
  LEFT JOIN public.manuscript_deletion_log d ON d.manuscript_id = i.id AND d.user_id = p_user_id
  WHERE m.id IS NULL AND d.manuscript_id IS NOT NULL;

  SELECT array_agg(i.id ORDER BY i.id) INTO v_not_found
  FROM unnest(v_requested) i(id)
  LEFT JOIN public.manuscripts m ON m.id = i.id
  LEFT JOIN public.manuscript_deletion_log d ON d.manuscript_id = i.id AND d.user_id = p_user_id
  WHERE m.id IS NULL AND d.manuscript_id IS NULL;

  -- Reject before any mutation. Never delete a subset from a mixed-owner request.
  IF v_unauthorized IS NOT NULL OR v_not_found IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized or unknown manuscript ids. unauthorized=%, not_found=%',
      COALESCE(v_unauthorized, '{}'::bigint[]),
      COALESCE(v_not_found, '{}'::bigint[])
      USING ERRCODE = 'P0001';
  END IF;

  -- All requested ids are already gone for this user. This is a successful no-op.
  IF v_to_delete IS NULL OR array_length(v_to_delete, 1) IS NULL THEN
    RETURN QUERY SELECT
      '{}'::bigint[] AS deleted_ids,
      COALESCE(v_already_absent, '{}'::bigint[]) AS already_absent_ids,
      0 AS deleted_count,
      '{}'::jsonb AS counts;
    RETURN;
  END IF;

  SELECT array_agg(x::text ORDER BY x) INTO v_text_ids FROM unnest(v_to_delete) x;

  -- 1. Anonymize financial/audit/fraud ledgers first.
  --    These tables have no direct FK cascade to manuscripts/jobs, so we clear
  --    manuscript and job linkage while preserving the financial/audit history.

  UPDATE public.llm_cost_events
  SET manuscript_id = NULL, evaluation_job_id = NULL
  WHERE manuscript_id = ANY(v_to_delete)
     OR evaluation_job_id IN (SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_to_delete));

  UPDATE public.revenue_events
  SET manuscript_id = NULL, job_id = NULL
  WHERE manuscript_id::text = ANY(v_text_ids)
     OR job_id IN (SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_to_delete));

  UPDATE public.free_diagnostic_claims
  SET manuscript_id = NULL, job_id = NULL
  WHERE manuscript_id = ANY(v_text_ids)
     OR job_id IN (SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_to_delete));

  IF to_regclass('public.audit_entries') IS NOT NULL THEN
    UPDATE public.audit_entries
    SET job_id = NULL
    WHERE job_id IN (SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_to_delete));
  END IF;

  UPDATE public.admin_actions
  SET job_id = NULL
  WHERE job_id IN (SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_to_delete));

  UPDATE public.evaluation_support_access_log
  SET evaluation_job_id = NULL
  WHERE evaluation_job_id IN (SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_to_delete));

  -- 2. Delete operational generation events.
  DELETE FROM public.document_generation_events
  WHERE job_id IN (SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_to_delete));

  -- 3. Held Recovery: delete children before their parents.
  IF to_regclass('public.held_recovery_reconstruction_work_items') IS NOT NULL THEN
    DELETE FROM public.held_recovery_reconstruction_work_items
    WHERE manuscript_id = ANY(v_text_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['held_recovery_reconstruction_work_items'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.held_recovery_retry_schedules') IS NOT NULL THEN
    DELETE FROM public.held_recovery_retry_schedules
    WHERE attempt_id IN (SELECT id::text FROM public.held_recovery_attempts WHERE manuscript_id = ANY(v_text_ids));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['held_recovery_retry_schedules'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.held_recovery_queue_transition_events') IS NOT NULL THEN
    DELETE FROM public.held_recovery_queue_transition_events
    WHERE held_item_id IN (
      SELECT held_item_id FROM public.held_recovery_queue_items WHERE manuscript_id = ANY(v_text_ids)
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['held_recovery_queue_transition_events'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.held_recovery_queue_items') IS NOT NULL THEN
    DELETE FROM public.held_recovery_queue_items
    WHERE manuscript_id = ANY(v_text_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['held_recovery_queue_items'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.held_recovery_reconstructed_anchors') IS NOT NULL THEN
    DELETE FROM public.held_recovery_reconstructed_anchors
    WHERE attempt_id IN (SELECT id::text FROM public.held_recovery_attempts WHERE manuscript_id = ANY(v_text_ids));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['held_recovery_reconstructed_anchors'], to_jsonb(v_count));
  END IF;

  -- 4. Revision events have manuscript_id SET NULL, so delete them explicitly
  --    before dropping the manuscript to avoid orphan rows.
  IF to_regclass('public.revision_events') IS NOT NULL THEN
    DELETE FROM public.revision_events
    WHERE manuscript_id = ANY(v_text_ids)
       OR evaluation_job_id IN (SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_to_delete));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['revision_events'], to_jsonb(v_count));
  END IF;

  -- 5. Evaluation jobs cascade to artifacts, stage runs, etc.
  DELETE FROM public.evaluation_jobs
  WHERE manuscript_id = ANY(v_to_delete);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := jsonb_set(v_counts, ARRAY['evaluation_jobs'], to_jsonb(v_count));

  -- 6. Manuscript versions and chunks are cascade-deleted with the manuscript.
  DELETE FROM public.manuscripts
  WHERE id = ANY(v_to_delete) AND user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := jsonb_set(v_counts, ARRAY['manuscripts'], to_jsonb(v_count));

  -- Record successful deletions for idempotent replay and durable evidence.
  INSERT INTO public.manuscript_deletion_log (manuscript_id, user_id)
  SELECT x, p_user_id
  FROM unnest(v_to_delete) x
  ON CONFLICT (manuscript_id) DO NOTHING;

  RETURN QUERY SELECT
    v_to_delete AS deleted_ids,
    COALESCE(v_already_absent, '{}'::bigint[]) AS already_absent_ids,
    COALESCE(array_length(v_to_delete, 1), 0)::int AS deleted_count,
    v_counts AS counts;
END;
$$;

-- Only the service role can invoke the destructive RPC. It is not exposed to
-- authenticated users directly; the application server validates the session
-- and then calls this function on behalf of the verified user.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.delete_manuscripts_permanently(uuid, bigint[]) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.delete_manuscripts_permanently(uuid, bigint[]) TO service_role;
  END IF;
END
$$;
