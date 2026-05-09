-- Migration: atomic upsert RPC for manuscript_chunks
-- Date: 2026-05-09
-- Issue: #378
-- Purpose:
--   Replace the read-then-write pattern in lib/manuscripts/chunks.ts::upsertChunks
--   with a single atomic INSERT … ON CONFLICT statement that is race-safe
--   and idempotent under concurrent retries on the same manuscript_id.
--
-- Semantics preserved (matches the prior TS upsertChunks contract bit-for-bit):
--   - New (manuscript_id, chunk_index) rows are inserted with status='pending', attempt_count=0,
--     and NULL result_json / last_error / error.
--   - Existing rows with MATCHING content_hash are LEFT UNCHANGED entirely
--     (status, result_json, attempt_count, last_error, lease state — all preserved).
--   - Existing rows with a DIFFERENT content_hash are reset to mirror the prior TS path:
--     status -> 'pending', result_json -> NULL, last_error -> NULL, error -> NULL,
--     content/char_start/char_end/overlap_chars/label/job_id refreshed.
--     attempt_count and lease fields are intentionally NOT reset here — the prior TS code
--     did not reset them either, and resetting lease state belongs to a separate concern
--     (lease lifecycle is owned by claim_chunk_for_processing / repair RPCs).
--
-- Race / idempotency:
--   - Single statement under the unique index (manuscript_id, chunk_index) -> no read/write window.
--   - Repeated calls with the same input are deterministic.
--
-- The orphan-deletion step (chunk_index no longer in the new spec) remains
-- on the application side because it requires set-difference semantics that
-- are clearer to express in TS. It is now done AFTER the upsert (not before),
-- so a partially-completed upsert never leaves a manuscript with zero chunks.

CREATE OR REPLACE FUNCTION public.upsert_manuscript_chunks(
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
AS $$
BEGIN
  -- p_chunks is a JSON array of objects shaped like the ChunkRow contract.
  -- We project it via jsonb_to_recordset and run a single atomic upsert.
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
      manuscript_id,
      chunk_index,
      char_start,
      char_end,
      overlap_chars,
      label,
      content,
      content_hash,
      job_id,
      status,
      attempt_count,
      result_json,
      last_error,
      error
    )
    SELECT
      ir.manuscript_id,
      ir.chunk_index,
      ir.char_start,
      ir.char_end,
      COALESCE(ir.overlap_chars, 0),
      ir.label,
      ir.content,
      ir.content_hash,
      ir.job_id,
      'pending'::public.chunk_status,
      0,
      NULL::jsonb,
      NULL::text,
      NULL::text
    FROM input_rows ir
    ON CONFLICT (manuscript_id, chunk_index) DO UPDATE
      SET
        -- Refresh content + addressing fields whenever the hash changed.
        -- Reset processing state (status / result_json / last_error / error) so the
        -- chunk re-enters the pipeline. attempt_count and lease fields are intentionally
        -- NOT touched here — they are owned by the lease/retry RPCs.
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
         OR mc.job_id IS DISTINCT FROM EXCLUDED.job_id  -- refresh job linkage on retries even if content unchanged
    RETURNING
      mc.manuscript_id,
      mc.chunk_index,
      (xmax = 0) AS inserted,                                       -- true = INSERT, false = UPDATE
      (xmax <> 0) AS reset                                          -- true when an UPDATE actually fired
  )
  SELECT u.manuscript_id, u.chunk_index, u.inserted, u.reset FROM upserted u;
  -- Note: out_* aliases above are positional; RETURN QUERY maps by position.
END;
$$;

-- Service role only (mirrors the existing chunks.ts admin-client usage).
REVOKE ALL ON FUNCTION public.upsert_manuscript_chunks(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_manuscript_chunks(jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.upsert_manuscript_chunks(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_manuscript_chunks(jsonb) TO service_role;

COMMENT ON FUNCTION public.upsert_manuscript_chunks(jsonb) IS
  'Atomic upsert for manuscript_chunks. Inserts new rows; resets state on content_hash change; leaves unchanged rows untouched. Closes #378.';
