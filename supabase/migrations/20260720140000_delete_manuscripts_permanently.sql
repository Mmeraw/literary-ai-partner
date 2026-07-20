-- Migration: Atomic, user-scoped permanent deletion of manuscripts.
-- Date: 2026-07-20
-- Purpose:
--   Provide a single RPC, delete_manuscripts_permanently(p_user_id, p_manuscript_ids),
--   that removes all manuscript-owned content and operational derivatives in one
--   transaction while preserving or anonymizing billing, cost, security, and audit records.
--
-- Retention boundary:
--   - Delete: manuscript rows, versions, chunks, evaluation jobs/projects/stages/events,
--     artifacts, revision state, held-recovery data, final-review runs, generated document
--     events, and uploaded source storage objects.
--   - Preserve/anonymize: llm_cost_events, revenue_events, audit_entries, admin_actions,
--     evaluation_support_access_log, free_diagnostic_claims. These lose manuscript/job
--     linkage but the financial/audit/fraud history remains.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Let audit rows survive deletion of their parent job by making the job column
--    nullable. The FK action stays CASCADE for other callers; this function sets the
--    columns to NULL before deleting jobs.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.admin_actions') IS NOT NULL THEN
    ALTER TABLE public.admin_actions
      ALTER COLUMN job_id DROP NOT NULL;
  END IF;

  IF to_regclass('public.evaluation_support_access_log') IS NOT NULL THEN
    ALTER TABLE public.evaluation_support_access_log
      ALTER COLUMN evaluation_job_id DROP NOT NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_manuscripts_permanently(
  p_user_id uuid,
  p_manuscript_ids bigint[]
)
RETURNS TABLE(
  deleted_ids bigint[],
  deleted_count int,
  counts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owned bigint[];
  v_text_ids text[];
  v_count int;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = 'P0001';
  END IF;

  IF p_manuscript_ids IS NULL OR array_length(p_manuscript_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'manuscript_ids is required' USING ERRCODE = 'P0001';
  END IF;

  -- Determine which requested manuscripts belong to the authenticated user.
  -- Unknown/already-deleted IDs are silently ignored, making the call idempotent.
  SELECT
    array_agg(m.id ORDER BY m.id),
    array_agg(m.id::text ORDER BY m.id)
  INTO v_owned, v_text_ids
  FROM public.manuscripts m
  WHERE m.id = ANY(p_manuscript_ids)
    AND m.user_id = p_user_id;

  IF v_owned IS NULL OR array_length(v_owned, 1) IS NULL THEN
    RAISE EXCEPTION 'No manuscripts found or unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the selected manuscripts for the duration of the transaction.
  PERFORM 1
  FROM public.manuscripts
  WHERE id = ANY(v_owned)
  FOR UPDATE;

  -- ─── Preserve financial/audit/fraud ledgers, removing direct manuscript/job linkage ───

  IF to_regclass('public.llm_cost_events') IS NOT NULL THEN
    UPDATE public.llm_cost_events
    SET manuscript_id = NULL,
        evaluation_job_id = NULL
    WHERE manuscript_id = ANY(v_owned)
       OR evaluation_job_id IN (
            SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_owned)
          );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['llm_cost_events_anonymized'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.revenue_events') IS NOT NULL THEN
    UPDATE public.revenue_events
    SET manuscript_id = NULL,
        job_id = NULL
    WHERE manuscript_id::text = ANY(v_text_ids)
       OR job_id IN (
            SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_owned)
          );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['revenue_events_anonymized'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.audit_entries') IS NOT NULL THEN
    UPDATE public.audit_entries
    SET job_id = NULL
    WHERE job_id IN (
            SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_owned)
          );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['audit_entries_anonymized'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.admin_actions') IS NOT NULL THEN
    UPDATE public.admin_actions
    SET job_id = NULL
    WHERE job_id IN (
            SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_owned)
          );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['admin_actions_anonymized'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.evaluation_support_access_log') IS NOT NULL THEN
    UPDATE public.evaluation_support_access_log
    SET evaluation_job_id = NULL
    WHERE evaluation_job_id IN (
            SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_owned)
          );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['evaluation_support_access_log_anonymized'], to_jsonb(v_count));
  END IF;

  IF to_regclass('public.free_diagnostic_claims') IS NOT NULL THEN
    UPDATE public.free_diagnostic_claims
    SET manuscript_id = NULL,
        job_id = NULL
    WHERE manuscript_id = ANY(v_text_ids)
       OR job_id IN (
            SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_owned)
          );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['free_diagnostic_claims_anonymized'], to_jsonb(v_count));
  END IF;

  -- ─── Delete manuscript-owned operational derivatives in dependency order ───

  -- Document generation events are tied to evaluation jobs.
  IF to_regclass('public.document_generation_events') IS NOT NULL THEN
    DELETE FROM public.document_generation_events
    WHERE job_id IN (
            SELECT id FROM public.evaluation_jobs WHERE manuscript_id = ANY(v_owned)
          );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['document_generation_events_deleted'], to_jsonb(v_count));
  END IF;

  -- Held-recovery reconstruction work items reference held_recovery_attempts with
  -- ON DELETE RESTRICT, so they must be removed before the attempt/manuscript cascade.
  IF to_regclass('public.held_recovery_reconstruction_work_items') IS NOT NULL THEN
    DELETE FROM public.held_recovery_reconstruction_work_items
    WHERE manuscript_id = ANY(v_text_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['held_recovery_reconstruction_work_items_deleted'], to_jsonb(v_count));
  END IF;

  -- Retry schedules are loosely bound to attempts by text id.
  IF to_regclass('public.held_recovery_retry_schedules') IS NOT NULL THEN
    DELETE FROM public.held_recovery_retry_schedules
    WHERE attempt_id IN (
            SELECT id::text FROM public.held_recovery_attempts WHERE manuscript_id = ANY(v_owned)
          );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['held_recovery_retry_schedules_deleted'], to_jsonb(v_count));
  END IF;

  -- Queue items and their transition events are manuscript-scoped.
  IF to_regclass('public.held_recovery_queue_items') IS NOT NULL THEN
    DELETE FROM public.held_recovery_queue_items
    WHERE manuscript_id = ANY(v_text_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['held_recovery_queue_items_deleted'], to_jsonb(v_count));
  END IF;

  -- revision_events has manuscript_id set to NULL on manuscript delete, which would orphan
  -- them, so delete explicitly.
  IF to_regclass('public.revision_events') IS NOT NULL THEN
    DELETE FROM public.revision_events
    WHERE manuscript_id = ANY(v_owned);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['revision_events_deleted'], to_jsonb(v_count));
  END IF;

  -- Most manuscript-owned data lives under evaluation jobs; deleting them cascades to
  -- artifacts, chunks, provider calls, logs, diagnostics, stage runs, revision sessions,
  -- change proposals, agent-readiness artifacts, storygate submissions, etc.
  IF to_regclass('public.evaluation_jobs') IS NOT NULL THEN
    DELETE FROM public.evaluation_jobs
    WHERE manuscript_id = ANY(v_owned);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := jsonb_set(v_counts, ARRAY['evaluation_jobs_deleted'], to_jsonb(v_count));
  END IF;

  -- Finally delete the manuscripts. The FKs back to manuscripts CASCADE, removing
  -- evaluations, projects, versions, chunks, held-recovery attempts/anchors,
  -- revision ledger decisions, final review apply runs, etc.
  DELETE FROM public.manuscripts
  WHERE id = ANY(v_owned)
    AND user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := jsonb_set(v_counts, ARRAY['manuscripts_deleted'], to_jsonb(v_count));

  deleted_ids := v_owned;
  deleted_count := COALESCE(array_length(v_owned, 1), 0);
  counts := v_counts;
  RETURN NEXT;
END;
$$;

-- Only the service role (our server code) may invoke this RPC.
REVOKE ALL ON FUNCTION public.delete_manuscripts_permanently(uuid, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_manuscripts_permanently(uuid, bigint[]) TO service_role;

COMMENT ON FUNCTION public.delete_manuscripts_permanently(uuid, bigint[]) IS
  'Atomic permanent deletion of one or more user manuscripts. Removes all manuscript-owned content; preserves/anonymizes billing, cost, security, and audit records.';

COMMIT;
