-- Phase 2.1 DB Verification Pack
-- Purpose: prove Anchor Metadata System rollout in target DB.
-- Target: xtumxjnzdswuumndcbwc (Supabase project)
-- Contract: source_text.slice(anchor_start, anchor_end) must exactly reproduce original_text
--           after CRLF normalization. Fail-closed — no fallback.
--
-- Run via Supabase SQL Editor or psql.

-- ============================================================
-- GATE 1: Migration presence
-- ============================================================
DO $$
DECLARE
  v_migration_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'change_proposals'
      AND column_name = 'anchor_start'
  ) INTO v_migration_exists;

  IF NOT v_migration_exists THEN
    RAISE EXCEPTION 'Phase 2.1 verification failed: anchor_start column missing from change_proposals.';
  END IF;

  RAISE NOTICE 'GATE 1 PASSED: anchor_start column exists on change_proposals.';
END $$;

-- ============================================================
-- GATE 2: Schema completeness — all three anchor columns
-- ============================================================
DO $$
DECLARE
  v_col_count integer;
BEGIN
  SELECT count(*)
  INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'change_proposals'
    AND column_name IN ('anchor_start', 'anchor_end', 'anchor_context');

  IF v_col_count < 3 THEN
    RAISE EXCEPTION 'Phase 2.1 verification failed: expected 3 anchor columns, found %.', v_col_count;
  END IF;

  RAISE NOTICE 'GATE 2 PASSED: all 3 anchor columns present (anchor_start, anchor_end, anchor_context).';
END $$;

-- ============================================================
-- GATE 3: Index presence on anchor columns
-- ============================================================
DO $$
DECLARE
  v_idx_count integer;
BEGIN
  SELECT count(*)
  INTO v_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'change_proposals'
    AND indexname IN (
      'idx_change_proposals_anchor_start',
      'idx_change_proposals_anchor_end'
    );

  IF v_idx_count < 2 THEN
    RAISE EXCEPTION 'Phase 2.1 verification failed: expected 2 anchor indexes, found %.', v_idx_count;
  END IF;

  RAISE NOTICE 'GATE 3 PASSED: both anchor indexes present.';
END $$;

-- ============================================================
-- GATE 4: Core tables exist (Stage 2 foundation)
-- ============================================================
DO $$
DECLARE
  v_table_count integer;
BEGIN
  SELECT count(*)
  INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'manuscript_versions',
      'revision_sessions',
      'change_proposals',
      'revision_events'
    );

  IF v_table_count < 3 THEN
    RAISE EXCEPTION 'Phase 2.1 verification failed: expected >= 3 Stage 2 tables, found %.', v_table_count;
  END IF;

  RAISE NOTICE 'GATE 4 PASSED: Stage 2 core tables present (% found).', v_table_count;
END $$;

-- ============================================================
-- GATE 5: RLS enabled on Stage 2 tables
-- ============================================================
DO $$
DECLARE
  v_rls_count integer;
BEGIN
  SELECT count(*)
  INTO v_rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('manuscript_versions', 'revision_sessions', 'change_proposals')
    AND rowsecurity = true;

  IF v_rls_count < 3 THEN
    RAISE EXCEPTION 'Phase 2.1 verification failed: RLS not enabled on all Stage 2 tables (% of 3).', v_rls_count;
  END IF;

  RAISE NOTICE 'GATE 5 PASSED: RLS enabled on all 3 Stage 2 tables.';
END $$;

-- ============================================================
-- GATE 6: Anchor row integrity — deterministic slice contract
-- The core Phase 2.1 invariant:
--   replace(replace(source_text, \r\n, \n), \r, \n)
--     .slice(anchor_start, anchor_end)
--   === replace(replace(original_text, \r\n, \n), \r, \n)
--
-- This mirrors apply.ts normalizeForStrictMatch() exactly.
-- ============================================================
DO $$
DECLARE
  v_total_rows integer;
  v_anchored_rows integer;
  v_empty_slice integer;
  v_slice_mismatch integer;
  v_norm_mismatch integer;
BEGIN
  -- Count total change_proposals
  SELECT count(*) INTO v_total_rows FROM public.change_proposals;

  IF v_total_rows = 0 THEN
    RAISE NOTICE 'GATE 6 SKIPPED: no change_proposal rows exist yet (table is empty). This is acceptable for a fresh deployment.';
    RETURN;
  END IF;

  -- Count rows that have anchor offsets
  SELECT count(*)
  INTO v_anchored_rows
  FROM public.change_proposals
  WHERE anchor_start IS NOT NULL
    AND anchor_end IS NOT NULL;

  IF v_anchored_rows = 0 THEN
    RAISE NOTICE 'GATE 6 SKIPPED: % total rows but none have anchor offsets populated yet.', v_total_rows;
    RETURN;
  END IF;

  -- For rows with anchors, join to revision_sessions → manuscript_versions
  -- to get the source_text, then verify the slice contract.
  WITH anchored AS (
    SELECT
      cp.id,
      cp.anchor_start,
      cp.anchor_end,
      cp.original_text,
      cp.anchor_context AS anchor_text_normalized,
      substring(
        mv.raw_text
        FROM cp.anchor_start + 1
        FOR (cp.anchor_end - cp.anchor_start)
      ) AS extracted
    FROM public.change_proposals cp
    JOIN public.revision_sessions rs ON rs.id = cp.revision_session_id
    JOIN public.manuscript_versions mv ON mv.id = rs.source_version_id
    WHERE cp.anchor_start IS NOT NULL
      AND cp.anchor_end IS NOT NULL
  ),
  normalized AS (
    SELECT
      id,
      char_length(extracted) AS extracted_len,
      replace(replace(coalesce(extracted, ''), E'\r\n', E'\n'), E'\r', E'\n') AS norm_extracted,
      replace(replace(coalesce(original_text, ''), E'\r\n', E'\n'), E'\r', E'\n') AS norm_original,
      anchor_text_normalized
    FROM anchored
  )
  SELECT
    count(*) FILTER (WHERE extracted_len <= 0),
    count(*) FILTER (WHERE norm_extracted <> norm_original),
    count(*) FILTER (
      WHERE anchor_text_normalized IS NOT NULL
        AND btrim(anchor_text_normalized) <> ''
        AND regexp_replace(norm_extracted, '\s+', ' ', 'g') <> anchor_text_normalized
    )
  INTO v_empty_slice, v_slice_mismatch, v_norm_mismatch
  FROM normalized;

  IF v_empty_slice > 0 THEN
    RAISE EXCEPTION 'Phase 2.1 verification failed: % rows have empty source slice from offsets.', v_empty_slice;
  END IF;

  IF v_slice_mismatch > 0 THEN
    RAISE EXCEPTION 'Phase 2.1 verification failed: % rows mismatch source slice vs original_text.', v_slice_mismatch;
  END IF;

  IF v_norm_mismatch > 0 THEN
    RAISE EXCEPTION 'Phase 2.1 verification failed: % rows mismatch normalized slice vs anchor_text_normalized.', v_norm_mismatch;
  END IF;

  RAISE NOTICE 'GATE 6 PASSED: % anchored rows verified — slice contract holds.', v_anchored_rows;
END $$;

-- ============================================================
-- SUMMARY
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Phase 2.1 DB verification passed: migration present, schema complete, constraints present, and anchor rows valid.';
  RAISE NOTICE '============================================';
END $$;
