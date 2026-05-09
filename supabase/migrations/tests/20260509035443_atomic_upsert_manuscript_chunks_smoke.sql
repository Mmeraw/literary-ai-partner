-- Smoke test for upsert_manuscript_chunks RPC
-- Strategy: single DO block creates a _smoke_-prefixed copy of the function,
-- runs 4 phases of assertions inside a temp-manuscript scope, drops function.
-- All DDL is transactional in Postgres; if any assertion fails the whole block
-- aborts and no schema changes commit. The final DROP runs in a fresh statement.
--
-- We use manuscript_id = -999999 to stay outside the real id space.
-- We insert a stub manuscripts row in the same transaction and clean it up
-- explicitly at the end.

BEGIN;

-- Stub manuscript so FK (if any) is satisfied; cleaned up at the end.
INSERT INTO public.manuscripts (id, title) VALUES (-999999, 'SMOKE_TEST_DELETE_ME')
ON CONFLICT (id) DO NOTHING;

-- Install the smoke copy with the same body as the migration but a different name.
CREATE OR REPLACE FUNCTION public._smoke_upsert_manuscript_chunks(
  p_chunks jsonb
)
RETURNS TABLE (
  out_manuscript_id integer,
  out_chunk_index integer,
  out_inserted boolean,
  out_reset boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY
  WITH input_rows AS (
    SELECT *
    FROM jsonb_to_recordset(p_chunks) AS x(
      manuscript_id integer,
      chunk_index integer,
      char_start integer,
      char_end integer,
      overlap_chars integer,
      label text,
      content text,
      content_hash text,
      job_id uuid
    )
  ),
  upserted AS (
    INSERT INTO public.manuscript_chunks AS mc (
      manuscript_id, chunk_index, char_start, char_end, overlap_chars,
      label, content, content_hash, job_id,
      status, attempt_count, result_json, last_error, error
    )
    SELECT
      ir.manuscript_id, ir.chunk_index, ir.char_start, ir.char_end,
      COALESCE(ir.overlap_chars, 0), ir.label, ir.content, ir.content_hash, ir.job_id,
      'pending'::public.chunk_status, 0, NULL::jsonb, NULL::text, NULL::text
    FROM input_rows ir
    ON CONFLICT (manuscript_id, chunk_index) DO UPDATE
      SET
        char_start    = EXCLUDED.char_start,
        char_end      = EXCLUDED.char_end,
        overlap_chars = EXCLUDED.overlap_chars,
        label         = EXCLUDED.label,
        content       = EXCLUDED.content,
        content_hash  = EXCLUDED.content_hash,
        job_id        = EXCLUDED.job_id,
        status        = 'pending'::public.chunk_status,
        result_json   = NULL,
        last_error    = NULL,
        error         = NULL
      WHERE mc.content_hash IS DISTINCT FROM EXCLUDED.content_hash
         OR mc.job_id IS DISTINCT FROM EXCLUDED.job_id
    RETURNING
      mc.manuscript_id,
      mc.chunk_index,
      (xmax = 0) AS inserted,
      (xmax <> 0) AS reset
  )
  SELECT u.manuscript_id, u.chunk_index, u.inserted, u.reset FROM upserted u;
END;
$func$;

-- ============================================================================
-- 4-phase assertion block
-- ============================================================================
DO $smoke$
DECLARE
  v_job1 uuid := gen_random_uuid();
  v_job2 uuid := gen_random_uuid();
  v_input jsonb;
  v_returned_count int;
  v_total_count int;
  v_status text;
  v_done_count int;
  v_pending_count int;
  v_result_json jsonb;
  v_attempt_count int;
BEGIN
  -- ---------------- PHASE 1: insert-new -----------------------------------
  v_input := jsonb_build_array(
    jsonb_build_object(
      'manuscript_id', -999999, 'chunk_index', 0,
      'char_start', 0, 'char_end', 100, 'overlap_chars', 0,
      'label', 'phase1', 'content', 'aaaa', 'content_hash', 'h1',
      'job_id', v_job1
    ),
    jsonb_build_object(
      'manuscript_id', -999999, 'chunk_index', 1,
      'char_start', 100, 'char_end', 200, 'overlap_chars', 0,
      'label', 'phase1', 'content', 'bbbb', 'content_hash', 'h2',
      'job_id', v_job1
    )
  );

  SELECT count(*) INTO v_returned_count
  FROM public._smoke_upsert_manuscript_chunks(v_input)
  WHERE out_inserted = true;
  IF v_returned_count <> 2 THEN
    RAISE EXCEPTION 'PHASE 1 FAIL: expected 2 inserts, got %', v_returned_count;
  END IF;

  SELECT count(*) INTO v_total_count
  FROM public.manuscript_chunks WHERE manuscript_id = -999999;
  IF v_total_count <> 2 THEN
    RAISE EXCEPTION 'PHASE 1 FAIL: expected 2 rows in table, got %', v_total_count;
  END IF;
  RAISE NOTICE 'PHASE 1 PASS: insert-new produced 2 rows';

  -- Simulate a chunk having been processed: mark chunk_index=0 as done.
  UPDATE public.manuscript_chunks
  SET status = 'done'::public.chunk_status,
      result_json = '{"score": 99}'::jsonb,
      attempt_count = 2
  WHERE manuscript_id = -999999 AND chunk_index = 0;

  -- ---------------- PHASE 2: hash-unchanged-skip --------------------------
  -- Same exact input, same job_id => function should return ZERO rows
  -- and the 'done' row must remain untouched (status, result_json, attempts).
  SELECT count(*) INTO v_returned_count
  FROM public._smoke_upsert_manuscript_chunks(v_input);
  IF v_returned_count <> 0 THEN
    RAISE EXCEPTION 'PHASE 2 FAIL: expected 0 affected rows on no-op upsert, got %', v_returned_count;
  END IF;

  SELECT status::text, result_json, attempt_count
  INTO v_status, v_result_json, v_attempt_count
  FROM public.manuscript_chunks
  WHERE manuscript_id = -999999 AND chunk_index = 0;
  IF v_status <> 'done' THEN
    RAISE EXCEPTION 'PHASE 2 FAIL: status changed from done to %', v_status;
  END IF;
  IF v_result_json->>'score' <> '99' THEN
    RAISE EXCEPTION 'PHASE 2 FAIL: result_json was wiped';
  END IF;
  IF v_attempt_count <> 2 THEN
    RAISE EXCEPTION 'PHASE 2 FAIL: attempt_count was reset from 2 to %', v_attempt_count;
  END IF;
  RAISE NOTICE 'PHASE 2 PASS: hash-unchanged left done-row state untouched';

  -- ---------------- PHASE 3: job_id-changed-refresh -----------------------
  -- Same content_hash but new job_id => row must be refreshed
  -- (state reset to pending) per the WHERE clause.
  v_input := jsonb_build_array(
    jsonb_build_object(
      'manuscript_id', -999999, 'chunk_index', 0,
      'char_start', 0, 'char_end', 100, 'overlap_chars', 0,
      'label', 'phase3', 'content', 'aaaa', 'content_hash', 'h1',
      'job_id', v_job2
    ),
    jsonb_build_object(
      'manuscript_id', -999999, 'chunk_index', 1,
      'char_start', 100, 'char_end', 200, 'overlap_chars', 0,
      'label', 'phase3', 'content', 'bbbb', 'content_hash', 'h2',
      'job_id', v_job2
    )
  );

  SELECT count(*) INTO v_returned_count
  FROM public._smoke_upsert_manuscript_chunks(v_input)
  WHERE out_reset = true;
  IF v_returned_count <> 2 THEN
    RAISE EXCEPTION 'PHASE 3 FAIL: expected 2 resets on job_id change, got %', v_returned_count;
  END IF;

  SELECT status::text, result_json
  INTO v_status, v_result_json
  FROM public.manuscript_chunks
  WHERE manuscript_id = -999999 AND chunk_index = 0;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'PHASE 3 FAIL: chunk 0 status not reset to pending, got %', v_status;
  END IF;
  IF v_result_json IS NOT NULL THEN
    RAISE EXCEPTION 'PHASE 3 FAIL: chunk 0 result_json should be NULL after job_id change';
  END IF;

  SELECT attempt_count INTO v_attempt_count
  FROM public.manuscript_chunks
  WHERE manuscript_id = -999999 AND chunk_index = 0;
  IF v_attempt_count <> 2 THEN
    RAISE EXCEPTION 'PHASE 3 FAIL: attempt_count was unexpectedly reset to %', v_attempt_count;
  END IF;
  RAISE NOTICE 'PHASE 3 PASS: job_id change reset processing state but preserved attempt_count';

  -- ---------------- PHASE 4: content_hash-changed-reset -------------------
  -- Mark chunk 1 as done with attempts, then change its content_hash.
  UPDATE public.manuscript_chunks
  SET status = 'done'::public.chunk_status,
      result_json = '{"score": 88}'::jsonb,
      attempt_count = 1
  WHERE manuscript_id = -999999 AND chunk_index = 1;

  v_input := jsonb_build_array(
    jsonb_build_object(
      'manuscript_id', -999999, 'chunk_index', 1,
      'char_start', 100, 'char_end', 250, 'overlap_chars', 5,
      'label', 'phase4', 'content', 'bbbb-DIFFERENT', 'content_hash', 'h2_NEW',
      'job_id', v_job2
    )
  );

  SELECT count(*) INTO v_returned_count
  FROM public._smoke_upsert_manuscript_chunks(v_input)
  WHERE out_reset = true;
  IF v_returned_count <> 1 THEN
    RAISE EXCEPTION 'PHASE 4 FAIL: expected 1 reset on hash change, got %', v_returned_count;
  END IF;

  SELECT status::text, result_json, attempt_count
  INTO v_status, v_result_json, v_attempt_count
  FROM public.manuscript_chunks
  WHERE manuscript_id = -999999 AND chunk_index = 1;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'PHASE 4 FAIL: status not reset to pending after hash change, got %', v_status;
  END IF;
  IF v_result_json IS NOT NULL THEN
    RAISE EXCEPTION 'PHASE 4 FAIL: result_json should be NULL after hash change';
  END IF;
  IF v_attempt_count <> 1 THEN
    RAISE EXCEPTION 'PHASE 4 FAIL: attempt_count must NOT be touched on hash change, got %', v_attempt_count;
  END IF;
  RAISE NOTICE 'PHASE 4 PASS: content_hash change reset state, preserved attempt_count';

  RAISE NOTICE 'ALL PHASES PASSED';
END
$smoke$;

-- Cleanup: drop the smoke function and the test data.
DROP FUNCTION public._smoke_upsert_manuscript_chunks(jsonb);
DELETE FROM public.manuscript_chunks WHERE manuscript_id = -999999;
DELETE FROM public.manuscripts WHERE id = -999999;

ROLLBACK;
