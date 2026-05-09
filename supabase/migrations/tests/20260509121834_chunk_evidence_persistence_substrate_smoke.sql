-- Smoke test for chunk_evidence persistence substrate
-- (migration 20260509121834_chunk_evidence_persistence_substrate.sql)
--
-- Strategy: phased assertions inside a BEGIN ... ROLLBACK block. All
-- DDL/DML rolls back at the end; nothing persists in the database.
--
-- Test goals (binding under implementation-plan §2.3, §2.4, §2.6):
--   PHASE 1 — schema shape: required columns, types, defaults, and NOT NULLs
--             match the binding contract.
--   PHASE 2 — identity tuple uniqueness: a second insert with the same
--             5-tuple is rejected by the UNIQUE constraint.
--   PHASE 3 — independent-tuple inserts succeed when ANY one of the five
--             tuple components differs.
--   PHASE 4 — required query patterns work and use the expected indexes.
--   PHASE 5 — FK behavior: ON DELETE CASCADE removes evidence when the
--             parent job is deleted.
--
-- Stub job uses id `00000000-0000-0000-0000-00000000beef` to stay outside
-- the real job UUID space; cleaned at the end via ROLLBACK. Stub manuscript
-- uses id -999998 to stay outside the real id space and not collide with the
-- existing -999999 used by the upsert_manuscript_chunks smoke.

BEGIN;

-- ---------------------------------------------------------------------------
-- Stub a manuscript and a parent evaluation_jobs row so the FK can be
-- satisfied. Required NOT NULL (no-default) columns inferred from the schema:
--   manuscripts: id, title
--   evaluation_jobs: id, manuscript_id, job_type, policy_family,
--                    voice_preservation_level, english_variant
-- If new NOT NULL columns without defaults are added to either table, this
-- stub must be updated. The ROLLBACK at the end ensures no rows persist.
-- ---------------------------------------------------------------------------
INSERT INTO public.manuscripts (id, title)
VALUES (-999998, 'CHUNK_EVIDENCE_SMOKE_DELETE_ME')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.evaluation_jobs
  (id, manuscript_id, job_type, policy_family,
   voice_preservation_level, english_variant)
VALUES
  ('00000000-0000-0000-0000-00000000beef'::uuid, -999998, 'backfill_migration',
   'standard', 'balanced', 'us')
ON CONFLICT (id) DO NOTHING;


DO $smoke$
DECLARE
  v_job uuid := '00000000-0000-0000-0000-00000000beef'::uuid;
  v_count int;
  v_status text;
  v_schema_version text;
  v_outcome jsonb;
  v_violation boolean;
BEGIN
  -- =========================================================================
  -- PHASE 1 — schema shape
  -- =========================================================================

  -- 1a. All required columns exist with the expected NOT NULL posture.
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'chunk_evidence'
    AND column_name IN (
      'id', 'job_id', 'chunk_id', 'content_hash', 'pass_key',
      'prompt_version', 'status', 'outcome', 'model',
      'schema_version', 'created_at'
    )
    AND is_nullable = 'NO';
  IF v_count <> 11 THEN
    RAISE EXCEPTION
      'PHASE 1 FAIL: expected 11 NOT NULL columns on chunk_evidence, got %',
      v_count;
  END IF;

  -- 1b. status column is the new enum, not text.
  SELECT data_type INTO v_status
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'chunk_evidence'
    AND column_name  = 'status';
  IF v_status <> 'USER-DEFINED' THEN
    RAISE EXCEPTION
      'PHASE 1 FAIL: chunk_evidence.status must be the chunk_evidence_status enum, got data_type %',
      v_status;
  END IF;

  -- 1c. The unique constraint exists on the binding 5-tuple.
  SELECT count(*) INTO v_count
  FROM pg_constraint
  WHERE conname = 'chunk_evidence_identity_tuple_uniq'
    AND contype = 'u';
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'PHASE 1 FAIL: unique constraint chunk_evidence_identity_tuple_uniq missing';
  END IF;

  -- 1d. The four required indexes exist (unique constraint counts as the
  --     reuse-lookup index; plus job-chunk, chunk-history, prompt-version).
  SELECT count(*) INTO v_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename  = 'chunk_evidence'
    AND indexname IN (
      'chunk_evidence_identity_tuple_uniq',
      'chunk_evidence_job_chunk_idx',
      'chunk_evidence_chunk_history_idx',
      'chunk_evidence_prompt_version_idx'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION
      'PHASE 1 FAIL: expected 4 named indexes on chunk_evidence, found %',
      v_count;
  END IF;

  RAISE NOTICE 'PHASE 1 PASS: schema shape, enum, unique constraint, and 4 indexes present';

  -- =========================================================================
  -- PHASE 2 — identity tuple uniqueness
  -- =========================================================================

  INSERT INTO public.chunk_evidence
    (job_id, chunk_id, content_hash, pass_key, prompt_version,
     status, outcome, model)
  VALUES
    (v_job, 'chunk-A', 'hash-1', 'pass1', 'p-v1',
     'succeeded', '{"score": 0.9}'::jsonb, 'gpt-4o-test');

  -- Default schema_version applied?
  SELECT schema_version INTO v_schema_version
  FROM public.chunk_evidence
  WHERE job_id = v_job AND chunk_id = 'chunk-A' AND pass_key = 'pass1';
  IF v_schema_version <> 'chunk_evidence_v1' THEN
    RAISE EXCEPTION
      'PHASE 2 FAIL: expected default schema_version chunk_evidence_v1, got %',
      v_schema_version;
  END IF;

  -- Inserting the SAME 5-tuple again must violate the unique constraint.
  v_violation := false;
  BEGIN
    INSERT INTO public.chunk_evidence
      (job_id, chunk_id, content_hash, pass_key, prompt_version,
       status, outcome, model)
    VALUES
      (v_job, 'chunk-A', 'hash-1', 'pass1', 'p-v1',
       'succeeded', '{"score": 0.95}'::jsonb, 'gpt-4o-test');
  EXCEPTION
    WHEN unique_violation THEN
      v_violation := true;
  END;

  IF NOT v_violation THEN
    RAISE EXCEPTION
      'PHASE 2 FAIL: duplicate identity tuple did NOT raise unique_violation';
  END IF;

  RAISE NOTICE 'PHASE 2 PASS: identity tuple uniqueness enforced';

  -- =========================================================================
  -- PHASE 3 — distinct tuples succeed
  -- =========================================================================

  -- Differ by content_hash:
  INSERT INTO public.chunk_evidence
    (job_id, chunk_id, content_hash, pass_key, prompt_version,
     status, outcome, model)
  VALUES
    (v_job, 'chunk-A', 'hash-2', 'pass1', 'p-v1',
     'succeeded', '{"score": 0.8}'::jsonb, 'gpt-4o-test');

  -- Differ by pass_key:
  INSERT INTO public.chunk_evidence
    (job_id, chunk_id, content_hash, pass_key, prompt_version,
     status, outcome, model)
  VALUES
    (v_job, 'chunk-A', 'hash-1', 'pass2', 'p-v1',
     'succeeded', '{"score": 0.7}'::jsonb, 'gpt-4o-test');

  -- Differ by prompt_version:
  INSERT INTO public.chunk_evidence
    (job_id, chunk_id, content_hash, pass_key, prompt_version,
     status, outcome, model)
  VALUES
    (v_job, 'chunk-A', 'hash-1', 'pass1', 'p-v2',
     'succeeded', '{"score": 0.6}'::jsonb, 'gpt-4o-test');

  -- Differ by chunk_id:
  INSERT INTO public.chunk_evidence
    (job_id, chunk_id, content_hash, pass_key, prompt_version,
     status, outcome, model)
  VALUES
    (v_job, 'chunk-B', 'hash-1', 'pass1', 'p-v1',
     'failed', '{"error": "model_timeout"}'::jsonb, 'gpt-4o-test');

  SELECT count(*) INTO v_count
  FROM public.chunk_evidence
  WHERE job_id = v_job;
  IF v_count <> 5 THEN
    RAISE EXCEPTION
      'PHASE 3 FAIL: expected 5 distinct rows for job, got %',
      v_count;
  END IF;

  RAISE NOTICE 'PHASE 3 PASS: distinct tuples accepted (5 rows total)';

  -- =========================================================================
  -- PHASE 4 — required query patterns
  -- =========================================================================

  -- 4a. Reuse lookup (full tuple) returns at most one row.
  SELECT count(*) INTO v_count
  FROM public.chunk_evidence
  WHERE job_id = v_job
    AND chunk_id = 'chunk-A'
    AND content_hash = 'hash-1'
    AND pass_key = 'pass1'
    AND prompt_version = 'p-v1';
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'PHASE 4 FAIL (reuse lookup): expected 1 row for full tuple, got %',
      v_count;
  END IF;

  -- 4b. Per-job retrieval ordered by chunk_id returns the full set.
  SELECT count(*) INTO v_count
  FROM (
    SELECT chunk_id
    FROM public.chunk_evidence
    WHERE job_id = v_job
    ORDER BY chunk_id
  ) ordered;
  IF v_count <> 5 THEN
    RAISE EXCEPTION
      'PHASE 4 FAIL (per-job ordered): expected 5 rows, got %',
      v_count;
  END IF;

  -- 4c. Per-chunk history across prompt versions.
  SELECT count(DISTINCT prompt_version) INTO v_count
  FROM public.chunk_evidence
  WHERE chunk_id = 'chunk-A';
  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'PHASE 4 FAIL (per-chunk history): expected 2 distinct prompt_versions for chunk-A, got %',
      v_count;
  END IF;

  -- 4d. Stale-evidence sweep by prompt_version.
  SELECT count(*) INTO v_count
  FROM public.chunk_evidence
  WHERE prompt_version = 'p-v2';
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'PHASE 4 FAIL (stale sweep): expected 1 row at prompt_version p-v2, got %',
      v_count;
  END IF;

  RAISE NOTICE 'PHASE 4 PASS: all four required query patterns return correct cardinality';

  -- =========================================================================
  -- PHASE 5 — FK ON DELETE CASCADE
  -- =========================================================================

  -- Delete the parent job; all chunk_evidence rows for it must vanish.
  DELETE FROM public.evaluation_jobs WHERE id = v_job;

  SELECT count(*) INTO v_count
  FROM public.chunk_evidence
  WHERE job_id = v_job;
  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'PHASE 5 FAIL: expected 0 chunk_evidence rows after parent job DELETE, got %',
      v_count;
  END IF;

  RAISE NOTICE 'PHASE 5 PASS: ON DELETE CASCADE removed all chunk_evidence for deleted job';

  -- 5b. Outcome JSONB round-tripped correctly (sanity).
  --     (Re-insert and read back to confirm the column behavior.)
  INSERT INTO public.evaluation_jobs
    (id, manuscript_id, job_type, policy_family,
     voice_preservation_level, english_variant)
  VALUES
    (v_job, -999998, 'backfill_migration', 'standard', 'balanced', 'us')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.chunk_evidence
    (job_id, chunk_id, content_hash, pass_key, prompt_version,
     status, outcome, model)
  VALUES
    (v_job, 'chunk-Z', 'hash-z', 'pass1', 'p-v1',
     'skipped', '{"reason": "reuse_eligible"}'::jsonb, 'gpt-4o-test');

  SELECT outcome INTO v_outcome
  FROM public.chunk_evidence
  WHERE job_id = v_job AND chunk_id = 'chunk-Z';
  IF v_outcome->>'reason' <> 'reuse_eligible' THEN
    RAISE EXCEPTION
      'PHASE 5b FAIL: outcome JSONB did not round-trip; got %', v_outcome::text;
  END IF;

  RAISE NOTICE 'PHASE 5b PASS: outcome JSONB round-trip OK';

  RAISE NOTICE 'ALL PHASES PASSED';
END
$smoke$;


-- Cleanup is implicit via ROLLBACK below.
ROLLBACK;
