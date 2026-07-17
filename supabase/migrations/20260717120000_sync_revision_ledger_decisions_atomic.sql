-- Atomic compare-and-swap persistence for Revise Workbench author decisions.
-- The application validates canonical queue eligibility before calling this RPC;
-- this function owns the persistence race boundary.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_revision_ledger_decisions_atomic(
  p_rows jsonb
)
RETURNS SETOF public.revision_ledger_decisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_metadata jsonb;
  v_user_id uuid;
  v_manuscript_id bigint;
  v_evaluation_job_id uuid;
  v_opportunity_id text;
  v_expected_current_local_id text;
  v_actual_current_local_id text;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Ledger sync blocked: p_rows must be a JSON array';
  END IF;

  -- Serialize by author/manuscript/evaluation/opportunity. Locks are acquired
  -- in deterministic order so multi-row batches cannot deadlock each other.
  FOR v_row IN
    SELECT value
    FROM jsonb_array_elements(p_rows)
    ORDER BY
      value ->> 'user_id',
      value ->> 'manuscript_id',
      value ->> 'evaluation_job_id',
      value ->> 'opportunity_id'
  LOOP
    IF COALESCE((v_row ->> 'is_undo')::boolean, false) THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtext(concat_ws(':',
        v_row ->> 'user_id',
        v_row ->> 'manuscript_id',
        v_row ->> 'evaluation_job_id'
      )),
      hashtext(v_row ->> 'opportunity_id')
    );
  END LOOP;

  -- Compare the expected head and write the new row in the same transaction.
  -- This closes the read-check-upsert window where two tabs could both pass
  -- against the same stale local_id and silently overwrite each other.
  FOR v_row IN
    SELECT value
    FROM jsonb_array_elements(p_rows)
  LOOP
    IF COALESCE((v_row ->> 'is_undo')::boolean, false) THEN
      CONTINUE;
    END IF;

    v_metadata := COALESCE(v_row -> 'metadata', '{}'::jsonb);
    IF NOT (v_metadata ? 'expectedCurrentLocalId') THEN
      CONTINUE;
    END IF;

    v_user_id := (v_row ->> 'user_id')::uuid;
    v_manuscript_id := (v_row ->> 'manuscript_id')::bigint;
    v_evaluation_job_id := (v_row ->> 'evaluation_job_id')::uuid;
    v_opportunity_id := v_row ->> 'opportunity_id';
    v_expected_current_local_id := NULLIF(btrim(v_metadata ->> 'expectedCurrentLocalId'), '');

    SELECT decisions.local_id
    INTO v_actual_current_local_id
    FROM public.revision_ledger_decisions AS decisions
    WHERE decisions.user_id = v_user_id
      AND decisions.manuscript_id = v_manuscript_id
      AND decisions.evaluation_job_id = v_evaluation_job_id
      AND decisions.opportunity_id = v_opportunity_id
      AND decisions.is_undo = false
    ORDER BY decisions.created_at DESC, decisions.updated_at DESC, decisions.id DESC
    LIMIT 1;

    IF v_expected_current_local_id IS DISTINCT FROM v_actual_current_local_id THEN
      RAISE EXCEPTION 'Ledger stale write blocked: expected current localId % but found % for opportunity %.',
        COALESCE(v_expected_current_local_id, 'null'),
        COALESCE(v_actual_current_local_id, 'null'),
        v_opportunity_id;
    END IF;
  END LOOP;

  RETURN QUERY
  WITH input_rows AS (
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS x(
      user_id uuid,
      manuscript_id bigint,
      evaluation_job_id uuid,
      finding_id uuid,
      opportunity_id text,
      opportunity_title text,
      decision text,
      selected_option text,
      custom_text text,
      selected_text text,
      source_excerpt text,
      source_location text,
      local_id text,
      client_created_at timestamptz,
      client_synced_at timestamptz,
      is_undo boolean,
      undone_local_id text,
      metadata jsonb,
      updated_at timestamptz
    )
  )
  INSERT INTO public.revision_ledger_decisions AS decisions (
    user_id,
    manuscript_id,
    evaluation_job_id,
    finding_id,
    opportunity_id,
    opportunity_title,
    decision,
    selected_option,
    custom_text,
    selected_text,
    source_excerpt,
    source_location,
    local_id,
    client_created_at,
    client_synced_at,
    is_undo,
    undone_local_id,
    metadata,
    updated_at
  )
  SELECT
    input_rows.user_id,
    input_rows.manuscript_id,
    input_rows.evaluation_job_id,
    input_rows.finding_id,
    input_rows.opportunity_id,
    input_rows.opportunity_title,
    input_rows.decision,
    input_rows.selected_option,
    input_rows.custom_text,
    input_rows.selected_text,
    input_rows.source_excerpt,
    input_rows.source_location,
    input_rows.local_id,
    input_rows.client_created_at,
    COALESCE(input_rows.client_synced_at, now()),
    COALESCE(input_rows.is_undo, false),
    input_rows.undone_local_id,
    COALESCE(input_rows.metadata, '{}'::jsonb),
    COALESCE(input_rows.updated_at, now())
  FROM input_rows
  ON CONFLICT (user_id, evaluation_job_id, local_id) DO UPDATE
    SET
      manuscript_id = EXCLUDED.manuscript_id,
      finding_id = EXCLUDED.finding_id,
      opportunity_id = EXCLUDED.opportunity_id,
      opportunity_title = EXCLUDED.opportunity_title,
      decision = EXCLUDED.decision,
      selected_option = EXCLUDED.selected_option,
      custom_text = EXCLUDED.custom_text,
      selected_text = EXCLUDED.selected_text,
      source_excerpt = EXCLUDED.source_excerpt,
      source_location = EXCLUDED.source_location,
      client_created_at = EXCLUDED.client_created_at,
      client_synced_at = EXCLUDED.client_synced_at,
      is_undo = EXCLUDED.is_undo,
      undone_local_id = EXCLUDED.undone_local_id,
      metadata = EXCLUDED.metadata,
      updated_at = EXCLUDED.updated_at
  RETURNING decisions.*;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_revision_ledger_decisions_atomic(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_revision_ledger_decisions_atomic(jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.sync_revision_ledger_decisions_atomic(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_revision_ledger_decisions_atomic(jsonb) TO service_role;

COMMENT ON FUNCTION public.sync_revision_ledger_decisions_atomic(jsonb) IS
  'Atomic compare-and-swap persistence for revision_ledger_decisions. Serializes by opportunity and rejects stale expectedCurrentLocalId writes in the database transaction.';

COMMIT;