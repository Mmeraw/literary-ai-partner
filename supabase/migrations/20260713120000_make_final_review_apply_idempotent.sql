-- Make Final Review Apply atomic and idempotent.
-- One fingerprint maps to one derived manuscript version, including concurrent retries.

BEGIN;

ALTER TABLE public.final_review_apply_runs
  ADD COLUMN IF NOT EXISTS apply_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_final_review_apply_runs_apply_fingerprint
  ON public.final_review_apply_runs (
    user_id,
    manuscript_id,
    evaluation_job_id,
    source_version_id,
    apply_fingerprint
  )
  WHERE mode = 'apply' AND apply_fingerprint IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_final_review_once(
  p_user_id uuid,
  p_manuscript_id bigint,
  p_evaluation_job_id uuid,
  p_source_version_id uuid,
  p_apply_fingerprint text,
  p_raw_text text,
  p_word_count integer,
  p_applied_decision_ids uuid[],
  p_skipped_decision_ids uuid[],
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  revised_version_id uuid,
  reused_existing_version boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_version_id uuid;
  v_source_manuscript_id bigint;
  v_next_version_number integer;
  v_revised_version_id uuid;
BEGIN
  IF p_apply_fingerprint IS NULL OR btrim(p_apply_fingerprint) = '' THEN
    RAISE EXCEPTION 'Apply fingerprint is required';
  END IF;

  -- Serialize all derived-version allocation for this manuscript. This protects
  -- both the idempotency claim and manuscript version_number allocation.
  PERFORM pg_advisory_xact_lock(p_manuscript_id);

  SELECT runs.revised_version_id
  INTO v_existing_version_id
  FROM public.final_review_apply_runs AS runs
  WHERE runs.user_id = p_user_id
    AND runs.manuscript_id = p_manuscript_id
    AND runs.evaluation_job_id = p_evaluation_job_id
    AND runs.source_version_id = p_source_version_id
    AND runs.mode = 'apply'
    AND runs.status = 'applied'
    AND runs.apply_fingerprint = p_apply_fingerprint
  LIMIT 1;

  IF v_existing_version_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_version_id, true;
    RETURN;
  END IF;

  SELECT versions.manuscript_id
  INTO v_source_manuscript_id
  FROM public.manuscript_versions AS versions
  WHERE versions.id = p_source_version_id;

  IF v_source_manuscript_id IS NULL THEN
    RAISE EXCEPTION 'Source manuscript version not found: %', p_source_version_id;
  END IF;

  IF v_source_manuscript_id <> p_manuscript_id THEN
    RAISE EXCEPTION 'Source version % does not belong to manuscript %', p_source_version_id, p_manuscript_id;
  END IF;

  SELECT COALESCE(MAX(versions.version_number), 0) + 1
  INTO v_next_version_number
  FROM public.manuscript_versions AS versions
  WHERE versions.manuscript_id = p_manuscript_id;

  INSERT INTO public.manuscript_versions (
    manuscript_id,
    version_number,
    source_version_id,
    raw_text,
    word_count,
    created_by
  ) VALUES (
    p_manuscript_id,
    v_next_version_number,
    p_source_version_id,
    COALESCE(p_raw_text, ''),
    GREATEST(COALESCE(p_word_count, 0), 0),
    p_user_id
  )
  RETURNING id INTO v_revised_version_id;

  INSERT INTO public.final_review_apply_runs (
    user_id,
    manuscript_id,
    evaluation_job_id,
    source_version_id,
    revised_version_id,
    status,
    mode,
    apply_fingerprint,
    applied_decision_ids,
    skipped_decision_ids,
    metadata
  ) VALUES (
    p_user_id,
    p_manuscript_id,
    p_evaluation_job_id,
    p_source_version_id,
    v_revised_version_id,
    'applied',
    'apply',
    p_apply_fingerprint,
    COALESCE(p_applied_decision_ids, '{}'::uuid[]),
    COALESCE(p_skipped_decision_ids, '{}'::uuid[]),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN QUERY SELECT v_revised_version_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_final_review_once(
  uuid, bigint, uuid, uuid, text, text, integer, uuid[], uuid[], jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_final_review_once(
  uuid, bigint, uuid, uuid, text, text, integer, uuid[], uuid[], jsonb
) TO service_role;

COMMIT;
