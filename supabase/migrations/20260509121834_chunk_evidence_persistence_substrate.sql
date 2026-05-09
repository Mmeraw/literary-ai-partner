-- ============================================================================
-- PR-C Step 1 — Chunk-Evidence Persistence Substrate (additive)
--
-- Doctrine anchors:
--   - pr-c/design-doc.md §0, §1.6 (cognition substrate doctrine)
--   - pr-c/design-doc.md §5.2  (idempotency tuple)
--   - pr-c/design-doc.md §6.2.R (Path B ratification)
--   - pr-c/design-doc.md §6.3, §6.4, §6.5 (additive / parity / rollback contracts)
--   - pr-c/design-doc.md §9.4.R (reduce-stage arbitration)
--   - pr-c/implementation-plan.md §2.3, §2.4, §2.5, §2.6, §2.7 (binding shape)
--
-- Migration class: ADDITIVE ONLY.
--   - Creates new table `chunk_evidence` and supporting types/indexes.
--   - Does NOT alter, drop, or rename any pre-PR-C table or column.
--   - Does NOT modify `evaluation_jobs`, `manuscript_chunks`, `evaluation_artifacts`,
--     `manuscripts`, or any other existing object.
--   - Does NOT change the `JobStatus` vocabulary.
--
-- Runtime coupling:
--   - This migration ONLY makes the persistence substrate available.
--   - No runtime caller writes to or reads from `chunk_evidence` in this PR.
--   - Persistence path will be wired in PR-C Step 2 behind the
--     `EVAL_CHUNK_MAP_REDUCE_ENABLED` feature flag (per design-doc §4.5, §7.2 of plan).
--   - Until that flag flips ON, this table remains empty in all environments.
--
-- Forward-readability:
--   - Pre-PR-C records (in `evaluation_artifacts`, `manuscript_chunks`, etc.)
--     are not touched. They remain readable by all legacy consumers.
--   - This migration adds capacity; it does not redefine existing semantics.
--
-- Reversibility (rollback) — see end-of-file ROLLBACK NOTES block.
--
-- Schema version of records produced under this migration: 'chunk_evidence_v1'
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Outcome status enum
--
-- Per implementation-plan §2.4: outcome status ∈ { succeeded, failed, skipped }.
-- An enum is used (not a free-form text column) so that:
--   - The set of valid outcomes is enforced at the database layer.
--   - Future expansion is an explicit ALTER TYPE ... ADD VALUE (additive only).
--   - Index selectivity on `status` is a small fixed cardinality.
--
-- Naming: `chunk_evidence_status` (not `evaluation_chunk_status`) so it cannot
-- be confused with the existing `chunk_status` enum used by `manuscript_chunks`,
-- which represents pipeline pending/done state — a different semantic axis.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'chunk_evidence_status'
  ) THEN
    CREATE TYPE public.chunk_evidence_status AS ENUM (
      'succeeded',
      'failed',
      'skipped'
    );
  END IF;
END$$;


-- ----------------------------------------------------------------------------
-- 2. chunk_evidence table
--
-- Identity tuple per implementation-plan §2.3 (binding):
--   (job_id, chunk_id, content_hash, pass_key, prompt_version)
--
-- Unique constraint on this 5-tuple is the durable form of the §5 idempotency
-- contract: at most one chunk-evidence record per (job, chunk, content, pass,
-- prompt) combination. Reuse lookup is therefore O(log N) by btree.
--
-- All other columns are required logical fields per implementation-plan §2.4.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chunk_evidence (
  -- Surrogate primary key. Identity is asserted by the unique tuple below;
  -- the surrogate exists so application code can reference a record by a
  -- single stable id without serializing the full tuple.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ----- Identity tuple (binding under implementation-plan §2.3) -----------

  -- Job linkage. ON DELETE CASCADE follows the precedent established by
  -- `evaluation_provider_calls`, `evaluation_artifacts`, `report_shares`,
  -- and `admin_actions_audit`: when a job is deleted, its derived evidence
  -- is deleted with it. JobStatus semantics remain authoritative; this FK
  -- guarantees chunk-evidence records cannot orphan their parent job
  -- (implementation-plan §2.4, last bullet).
  job_id UUID NOT NULL
    REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,

  -- Chunk identity (chunker-assigned, stable for the lifetime of a chunk
  -- under a given content hash). Stored as TEXT to avoid coupling this
  -- substrate to the integer surrogate id of `manuscript_chunks` — chunk
  -- evidence may, in future, be produced for chunks that do not have a
  -- row in `manuscript_chunks` (e.g. ephemeral re-chunkings during repair),
  -- and we want this table to remain semantically about the chunk
  -- _identity_, not the row id. The implementation PR (Step 2) is
  -- responsible for choosing the canonical chunk_id encoding.
  chunk_id TEXT NOT NULL,

  -- Hash of the chunk content at evaluation time. Per
  -- implementation-plan §2.3: any change to chunk content invalidates
  -- reuse eligibility.
  content_hash TEXT NOT NULL,

  -- Which pass produced this evidence. Stored as TEXT for forward
  -- compatibility (e.g. 'pass1', 'pass2', or future canonical pass keys).
  -- Exact accepted values are policed at the application layer in Step 2;
  -- the database does not enumerate them here so future canonical pass
  -- additions remain additive and migration-free.
  pass_key TEXT NOT NULL,

  -- Prompt version that produced this evidence. Per
  -- implementation-plan §2.3: prompt changes invalidate reuse eligibility.
  prompt_version TEXT NOT NULL,

  -- ----- Required logical fields (implementation-plan §2.4) ---------------

  -- Outcome status. The arbiter of how this record participates in
  -- reduce-stage arbitration (§4.2 of plan, §9.4.R of design doc).
  status public.chunk_evidence_status NOT NULL,

  -- Structured outcome payload. Holds either the structured pass output
  -- (for status = 'succeeded') OR canonical error context (for status =
  -- 'failed') OR the canonical reason struct (for status = 'skipped').
  -- The exact JSON schema for each status is reserved for Step 2 per
  -- implementation-plan §10. JSONB chosen (not JSON) so the database can
  -- index keys via GIN if Step 2 needs criterion-key lookups — that index
  -- is intentionally NOT created here; this PR adds substrate, not query
  -- optimization for unwritten code paths.
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Model identifier (e.g. 'gpt-4o-2024-08-06', 'claude-3-5-sonnet').
  -- Required: every successful chunk-evidence record must carry the model
  -- that produced it for audit and reuse-policy purposes.
  model TEXT NOT NULL,

  -- Schema version of the chunk-evidence record _shape itself_ (not the
  -- prompt_version, not the model). Per implementation-plan §2.5 and
  -- §6.2.R of design doc, every chunk-evidence record carries an explicit
  -- shape version so future evolution is traceable and reversible.
  schema_version TEXT NOT NULL DEFAULT 'chunk_evidence_v1',

  -- Created-at. Updated-at is intentionally omitted: chunk-evidence
  -- records are immutable once written. A new evaluation produces a new
  -- record; existing records are not mutated. This is consistent with
  -- the §5.5 retention policy (prior records retained for audit).
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ----- Constraints ------------------------------------------------------

  -- Idempotency tuple uniqueness — the durable form of design-doc §5.2.
  CONSTRAINT chunk_evidence_identity_tuple_uniq
    UNIQUE (job_id, chunk_id, content_hash, pass_key, prompt_version)
);


-- ----------------------------------------------------------------------------
-- 3. Indexes (binding under implementation-plan §2.6)
--
-- §2.6 enumerates four required query patterns. Each gets an explicit index.
-- Additional indexes may be added in Step 2 if profiling demonstrates need.
-- ----------------------------------------------------------------------------

-- (a) Reuse lookup — already covered by the UNIQUE constraint
--     `chunk_evidence_identity_tuple_uniq`. No additional index needed:
--     the unique btree IS the reuse-lookup index. O(log N) guaranteed.

-- (b) Per-job evidence retrieval, ordered by chunk_id (for reduce consumption).
--     Composite (job_id, chunk_id) index supports the canonical reduce-stage
--     query: "all chunk-evidence for this job, in chunk order".
CREATE INDEX IF NOT EXISTS chunk_evidence_job_chunk_idx
  ON public.chunk_evidence (job_id, chunk_id);

-- (c) Per-chunk history across jobs and prompt versions.
--     Used by reuse-policy and audit queries that ask "show me every
--     evidence record we have for this chunk identity".
CREATE INDEX IF NOT EXISTS chunk_evidence_chunk_history_idx
  ON public.chunk_evidence (chunk_id, created_at DESC);

-- (d) Stale-evidence sweeps by prompt_version.
--     Used by retention/cleanup jobs that ask "which records use a
--     prompt_version that is no longer in active use".
CREATE INDEX IF NOT EXISTS chunk_evidence_prompt_version_idx
  ON public.chunk_evidence (prompt_version);


-- ----------------------------------------------------------------------------
-- 4. Row-level security
--
-- Mirroring the canon_* table precedent: enable RLS, add no public anon
-- policies. Service-role callers bypass RLS; that is the intended access
-- pattern for evaluation pipeline writes/reads. Step 2 will wire the
-- service-role client; this PR does not introduce any caller.
-- ----------------------------------------------------------------------------
ALTER TABLE public.chunk_evidence ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 5. Documentation
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.chunk_evidence IS
  'PR-C Path B chunk-level evidence substrate. One row per (job, chunk, content_hash, pass, prompt_version). '
  'Immutable once written. Schema-versioned for forward evolution. '
  'Anchors: pr-c/design-doc.md §6.2.R; pr-c/implementation-plan.md §2. '
  'Population occurs only when EVAL_CHUNK_MAP_REDUCE_ENABLED=true (Step 2+).';

COMMENT ON COLUMN public.chunk_evidence.job_id IS
  'FK to evaluation_jobs.id. ON DELETE CASCADE — chunk evidence is owned by its job.';

COMMENT ON COLUMN public.chunk_evidence.chunk_id IS
  'Chunker-assigned stable identity. TEXT (not int FK to manuscript_chunks) so the substrate '
  'can outlive any single manuscript_chunks row layout.';

COMMENT ON COLUMN public.chunk_evidence.content_hash IS
  'Hash of chunk content at evaluation time. Component of idempotency tuple (design-doc §5.2).';

COMMENT ON COLUMN public.chunk_evidence.pass_key IS
  'Which pass produced this evidence (e.g. "pass1", "pass2"). Application-layer policed.';

COMMENT ON COLUMN public.chunk_evidence.prompt_version IS
  'Prompt version that produced this evidence. Component of idempotency tuple. '
  'NOT the same as schema_version.';

COMMENT ON COLUMN public.chunk_evidence.status IS
  'Outcome status. succeeded | failed | skipped per implementation-plan §2.4.';

COMMENT ON COLUMN public.chunk_evidence.outcome IS
  'Structured outcome payload. Exact JSON schema per status reserved for Step 2 (plan §10).';

COMMENT ON COLUMN public.chunk_evidence.model IS
  'Model identifier that produced this evidence (e.g. "gpt-4o-2024-08-06").';

COMMENT ON COLUMN public.chunk_evidence.schema_version IS
  'Version of the chunk-evidence record shape itself. Default "chunk_evidence_v1". '
  'Independent of prompt_version. Supports versioned shape evolution per design-doc §6.2.R.';

COMMENT ON CONSTRAINT chunk_evidence_identity_tuple_uniq ON public.chunk_evidence IS
  'Idempotency tuple uniqueness (design-doc §5.2 expanded by implementation-plan §2.3 with job_id, pass_key). '
  'This is the canonical reuse-lookup index.';


-- ============================================================================
-- ROLLBACK NOTES (design-doc §6.5, implementation-plan §1.4)
--
-- This migration is fully reversible. To roll back:
--
--   1. Confirm `EVAL_CHUNK_MAP_REDUCE_ENABLED=false` in all environments.
--      With the flag OFF, the runtime path does not write to chunk_evidence,
--      so dropping it is loss-free for all certified job outputs (those live
--      in `evaluation_artifacts`, untouched by this migration).
--
--   2. Apply, in a single transaction:
--
--        BEGIN;
--          DROP TABLE IF EXISTS public.chunk_evidence;
--          DROP TYPE  IF EXISTS public.chunk_evidence_status;
--        COMMIT;
--
--      Indexes, comments, and the unique constraint drop with the table.
--
--   3. No other migration depends on these objects. Pre-PR-C tables
--      (`evaluation_jobs`, `manuscript_chunks`, `evaluation_artifacts`, etc.)
--      are not modified by this migration and require no rollback work.
--
--   4. Forward re-application is also loss-free: re-running this migration
--      after rollback restores the substrate empty; any historical
--      chunk_evidence rows that existed pre-rollback are gone, but per design
--      doc §5.5 such records are audit-only and per §6.5 rollback explicitly
--      does not require preserving them.
--
-- This rollback procedure is the complete §6.5 contract for this migration.
-- It is intentionally a manual procedure, not an automated DOWN script:
-- destructive ops on production must be authorized, not auto-runnable.
-- ============================================================================
