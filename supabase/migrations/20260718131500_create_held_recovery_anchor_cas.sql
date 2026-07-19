-- Migration: Held Recovery anchor-repair CAS on the canonical revision opportunity ledger artifact
-- Purpose: Provide the SINGLE atomic compare-and-swap primitive the SEPARATE canonical
--          re-admission stage uses to persist a reconstructed anchor onto the canonical
--          opportunity. Reconstruction completion returns authority/version only; re-admission
--          repairs anchor grounding and then runs admission. This RPC is that anchor repair.
--
-- WHY JSON-BACKED (not a typed opportunity table): the repository proves the canonical
--   revision opportunity ledger is stored as JSON in public.evaluation_artifacts
--   (artifact_type = 'revision_opportunity_ledger_v1', one row per (job_id, artifact_type),
--   content->'opportunities' is an array keyed by opportunity_id). There is NO typed
--   per-opportunity anchor table to CAS against, so this RPC compare-and-swaps the anchor
--   sub-fields of exactly one opportunity inside that JSON. It is an anchor-repair CAS, NOT a
--   general artifact writer.
--
-- NARROWNESS FENCE (do not widen in this migration):
--   Updates ONLY the anchor-bearing JSON fields of the targeted opportunity:
--     - opportunities[i].evidence_anchor
--     - opportunities[i].manuscript_coordinates
--   plus a derived per-opportunity anchor version token returned to the caller and the
--   artifact updated_at. It MUST NOT write: decision_state, criterion, severity, rationale,
--   provenance, confidence, finalDecision, cardType, readiness, producer, diagnostics, retry
--   state, or queue state. Every OTHER opportunity in the array and every non-anchor field of
--   the target opportunity is preserved unchanged.
--
-- CONCURRENCY: locks the single artifact row FOR UPDATE, verifies the supplied expected
--   artifact source_hash AND expected opportunity anchor version against what is currently
--   stored, then writes. Any mismatch fails closed via RAISE EXCEPTION (matches the recovery
--   writer convention: fail-closed rollback, no one-off response vocabulary). Zero matches or
--   duplicate opportunity_ids also fail closed. Conflicts are surfaced to the caller as a
--   persistence_conflict discriminant.
--
-- AUTHORITY BOUNDARY (mirrors held_recovery_attempts / reconstruction_work / queue_transition):
--   Nothing here manufactures producer, reasonCode, recoveryAction, cardType, finalDecision,
--   classification result, or a queue destination. Canonical re-admission/classification and
--   the row-locked queue transition remain SEPARATE authority-bearing steps.

begin;

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Derived per-opportunity anchor version token.
--
-- Mirrors the application helper revisionOpportunityVersionFor(opportunityId, ledgerSourceHash)
-- which is sha256(JSON.stringify({ opportunityId, ledgerSourceHash })) via sourceHashFor. We do
-- NOT invent a second version scheme: the token is a deterministic hash over the opportunity
-- identity + the artifact source_hash + the two anchor fields, so any anchor change moves the
-- token and any concurrent artifact source_hash change is detected.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.held_recovery_anchor_version(
  p_opportunity_id text,
  p_ledger_source_hash text,
  p_evidence_anchor text,
  p_manuscript_coordinates text
) returns text
language sql
immutable
as $$
  select encode(
    digest(
      json_build_object(
        'boundary', 'held_recovery_anchor_version_v1',
        'opportunity_id', p_opportunity_id,
        'ledger_source_hash', p_ledger_source_hash,
        'evidence_anchor', p_evidence_anchor,
        'manuscript_coordinates', p_manuscript_coordinates
      )::text,
      'sha256'
    ),
    'hex'
  );
$$;

comment on function public.held_recovery_anchor_version(text, text, text, text) is
  'Deterministic per-opportunity anchor version token for held-recovery anchor CAS. Hash over opportunity identity + artifact ledger source_hash + the two anchor-bearing fields. Does NOT encode decision/classification/queue state.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: apply_held_recovery_anchor_cas_atomic
--
-- Request JSON (all required, non-empty):
--   { job_id, opportunity_id,
--     expected_ledger_source_hash,        -- artifact-level source_hash the caller loaded under
--     expected_anchor_version,            -- held_recovery_anchor_version(...) for the CURRENT stored anchor
--     new_evidence_anchor,
--     new_manuscript_coordinates }
--
-- Returns JSON on success:
--   { status:'anchor_updated', job_id, opportunity_id,
--     previous_anchor_version, anchor_version,
--     ledger_source_hash, evidence_anchor, manuscript_coordinates }
--   OR (semantically-equal replay, no write):
--   { status:'unchanged', job_id, opportunity_id, anchor_version, ledger_source_hash }
--
-- Fail-closed (RAISE EXCEPTION -> caller maps to rejected_stale / persistence_conflict):
--   artifact_not_found, opportunity_not_found, duplicate_opportunity_id,
--   ledger_source_hash_conflict, anchor_version_conflict, malformed_request
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.apply_held_recovery_anchor_cas_atomic(
  p_request jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id text;
  v_opportunity_id text;
  v_expected_source_hash text;
  v_expected_anchor_version text;
  v_new_evidence_anchor text;
  v_new_manuscript_coordinates text;

  v_artifact_id uuid;
  v_content jsonb;
  v_current_source_hash text;
  v_match_count int;
  v_idx int;
  v_current_opp jsonb;
  v_current_evidence_anchor text;
  v_current_manuscript_coordinates text;
  v_current_anchor_version text;
  v_previous_anchor_version text;
  v_new_anchor_version text;
  v_new_opp jsonb;
begin
  -- ── Parse + validate request (fail closed on any malformed field) ──────────
  v_job_id := nullif(btrim(p_request ->> 'job_id'), '');
  v_opportunity_id := nullif(btrim(p_request ->> 'opportunity_id'), '');
  v_expected_source_hash := nullif(btrim(p_request ->> 'expected_ledger_source_hash'), '');
  v_expected_anchor_version := nullif(btrim(p_request ->> 'expected_anchor_version'), '');
  -- Anchor content may legitimately be any non-null string; require presence (a repair that
  -- clears an anchor is not this RPC's job) but allow whitespace-bearing prose. Reject NULL/missing.
  v_new_evidence_anchor := p_request ->> 'new_evidence_anchor';
  v_new_manuscript_coordinates := p_request ->> 'new_manuscript_coordinates';

  if v_job_id is null
     or v_opportunity_id is null
     or v_expected_source_hash is null
     or v_expected_anchor_version is null
     or v_new_evidence_anchor is null
     or v_new_manuscript_coordinates is null
     or btrim(v_new_evidence_anchor) = ''
     or btrim(v_new_manuscript_coordinates) = '' then
    raise exception 'held_recovery_anchor_cas malformed_request: job_id, opportunity_id, expected_ledger_source_hash, expected_anchor_version, new_evidence_anchor, new_manuscript_coordinates are all required and non-empty'
      using errcode = 'check_violation';
  end if;

  -- ── Lock the SINGLE canonical ledger artifact row ─────────────────────────
  select id, content
    into v_artifact_id, v_content
  from public.evaluation_artifacts
  where job_id = v_job_id
    and artifact_type = 'revision_opportunity_ledger_v1'
  for update;

  if v_artifact_id is null then
    raise exception 'held_recovery_anchor_cas artifact_not_found for job_id %', v_job_id
      using errcode = 'no_data_found';
  end if;

  v_current_source_hash := nullif(btrim(v_content ->> 'source_hash'), '');
  if v_current_source_hash is null then
    raise exception 'held_recovery_anchor_cas malformed_artifact: content.source_hash missing for job_id %', v_job_id
      using errcode = 'check_violation';
  end if;

  -- ── CAS guard #1: artifact-level source_hash must match what the caller loaded ─
  if v_current_source_hash is distinct from v_expected_source_hash then
    raise exception 'held_recovery_anchor_cas ledger_source_hash_conflict for job_id % opportunity %: expected % but found %',
      v_job_id, v_opportunity_id, v_expected_source_hash, v_current_source_hash
      using errcode = 'serialization_failure';
  end if;

  -- ── Locate EXACTLY ONE opportunity by id (reject zero / duplicates) ───────
  select count(*)
    into v_match_count
  from jsonb_array_elements(coalesce(v_content -> 'opportunities', '[]'::jsonb)) as opp
  where opp ->> 'opportunity_id' = v_opportunity_id;

  if v_match_count = 0 then
    raise exception 'held_recovery_anchor_cas opportunity_not_found: % in job %', v_opportunity_id, v_job_id
      using errcode = 'no_data_found';
  elsif v_match_count > 1 then
    raise exception 'held_recovery_anchor_cas duplicate_opportunity_id: % appears % times in job %',
      v_opportunity_id, v_match_count, v_job_id
      using errcode = 'cardinality_violation';
  end if;

  -- Find its array index + current object.
  select (ord - 1), elem
    into v_idx, v_current_opp
  from jsonb_array_elements(coalesce(v_content -> 'opportunities', '[]'::jsonb))
       with ordinality as t(elem, ord)
  where elem ->> 'opportunity_id' = v_opportunity_id;

  v_current_evidence_anchor := coalesce(v_current_opp ->> 'evidence_anchor', '');
  v_current_manuscript_coordinates := coalesce(v_current_opp ->> 'manuscript_coordinates', '');

  -- ── CAS guard #2: expected opportunity anchor version must match the stored anchor ─
  v_current_anchor_version := public.held_recovery_anchor_version(
    v_opportunity_id,
    v_current_source_hash,
    v_current_evidence_anchor,
    v_current_manuscript_coordinates
  );

  if v_current_anchor_version is distinct from v_expected_anchor_version then
    raise exception 'held_recovery_anchor_cas anchor_version_conflict for job_id % opportunity %: expected % but found %',
      v_job_id, v_opportunity_id, v_expected_anchor_version, v_current_anchor_version
      using errcode = 'serialization_failure';
  end if;

  v_previous_anchor_version := v_current_anchor_version;

  -- ── Idempotent no-op: semantically-equal anchor -> no write ───────────────
  if v_current_evidence_anchor = v_new_evidence_anchor
     and v_current_manuscript_coordinates = v_new_manuscript_coordinates then
    return jsonb_build_object(
      'status', 'unchanged',
      'job_id', v_job_id,
      'opportunity_id', v_opportunity_id,
      'anchor_version', v_current_anchor_version,
      'ledger_source_hash', v_current_source_hash
    );
  end if;

  -- ── Update ONLY the two anchor fields of the target opportunity ───────────
  v_new_opp := v_current_opp
    || jsonb_build_object(
         'evidence_anchor', v_new_evidence_anchor,
         'manuscript_coordinates', v_new_manuscript_coordinates
       );

  v_new_anchor_version := public.held_recovery_anchor_version(
    v_opportunity_id,
    v_current_source_hash,
    v_new_evidence_anchor,
    v_new_manuscript_coordinates
  );

  -- Splice the single element back at its index; all other opportunities untouched.
  update public.evaluation_artifacts
     set content = jsonb_set(
           v_content,
           array['opportunities', v_idx::text],
           v_new_opp,
           false
         ),
         updated_at = now()
   where id = v_artifact_id;

  return jsonb_build_object(
    'status', 'anchor_updated',
    'job_id', v_job_id,
    'opportunity_id', v_opportunity_id,
    'previous_anchor_version', v_previous_anchor_version,
    'anchor_version', v_new_anchor_version,
    'ledger_source_hash', v_current_source_hash,
    'evidence_anchor', v_new_evidence_anchor,
    'manuscript_coordinates', v_new_manuscript_coordinates
  );
end;
$$;

comment on function public.apply_held_recovery_anchor_cas_atomic(jsonb) is
  'Atomic anchor-repair compare-and-swap for one opportunity inside the JSON-backed revision_opportunity_ledger_v1 artifact. Locks the artifact FOR UPDATE, verifies expected ledger source_hash + expected per-opportunity anchor version, updates ONLY evidence_anchor + manuscript_coordinates for exactly one opportunity_id, and preserves all other opportunities and all non-anchor fields. Fail-closed on mismatch/zero/duplicate. Does NOT write decision_state, classification, cardType, finalDecision, readiness, producer, diagnostics, retry, or queue state. Anchor-repair CAS only, not a general artifact writer.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants: RPC-only. No direct table DML granted here; all mutation flows through the
-- SECURITY DEFINER function above. (evaluation_artifacts DML grants are governed by
-- their own prior migrations; this migration adds none.)
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.held_recovery_anchor_version(text, text, text, text) from public;
revoke all on function public.apply_held_recovery_anchor_cas_atomic(jsonb) from public;

grant execute on function public.held_recovery_anchor_version(text, text, text, text) to service_role;
grant execute on function public.apply_held_recovery_anchor_cas_atomic(jsonb) to service_role;

commit;
