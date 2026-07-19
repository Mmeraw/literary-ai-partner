-- Migration: Correct Held Recovery anchor-CAS version semantics (forward corrective)
-- Corrects: 20260718131500_create_held_recovery_anchor_cas.sql (commit 5b6f1df) — NOT edited.
--
-- DEFECT BEING CORRECTED:
--   The prior migration defined held_recovery_anchor_version(opportunity_id, ledger_source_hash,
--   evidence_anchor, manuscript_coordinates) and represented that four-input hash AS IF it were
--   the canonical opportunity version. It is not. The repository's authoritative identity is:
--       revisionOpportunityVersionFor(opportunityId, ledgerSourceHash)
--         = sourceHashFor({ opportunityId, ledgerSourceHash })
--         = sha256( stableStringify({ opportunityId, ledgerSourceHash }) )  (hex)
--   which depends ONLY on opportunity identity + ledger source hash. The four-input hash is a
--   useful FINE-GRAINED ANCHOR-STATE FINGERPRINT, but must not masquerade as the opportunity
--   version. This corrective migration separates the two concepts:
--     1. Canonical opportunity version  -> held_recovery_opportunity_version  (EXACT parity)
--     2. Anchor-state fingerprint       -> held_recovery_anchor_fingerprint   (4-input, renamed)
--   and replaces the CAS RPC contract so request/result vocabulary cannot conflate them.
--
-- PARITY REQUIREMENT (canonical opportunity version):
--   stableStringify sorts object keys by localeCompare, so { opportunityId, ledgerSourceHash }
--   serializes as: {"ledgerSourceHash":<json>,"opportunityId":<json>} where <json> is the JS
--   JSON.stringify of each string value. Postgres to_json(text)::text produces the identical
--   escaping for ", \, control chars, leaves '/' and non-ASCII (UTF-8) unescaped — matching
--   JS JSON.stringify. We therefore reconstruct the exact serialized bytes and sha256 them.
--
-- SCOPE: version/fingerprint helpers + corrected CAS RPC contract only. Still an anchor-repair
--   CAS on the JSON-backed revision_opportunity_ledger_v1 artifact. Does NOT introduce a typed
--   opportunity table, and does NOT write decisions, classification, cardType, finalDecision,
--   readiness, producer, diagnostics, retry, or queue state.

begin;

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Canonical opportunity version — EXACT parity with revisionOpportunityVersionFor.
--
--    revisionOpportunityVersionFor(opportunityId, ledgerSourceHash)
--      = sha256( stableStringify({ opportunityId, ledgerSourceHash }) )
--    stableStringify sorts keys (ledgerSourceHash < opportunityId), quotes keys, and
--    JSON.stringify()s string values. to_json(text)::text reproduces the value escaping.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.held_recovery_opportunity_version(
  p_opportunity_id text,
  p_ledger_source_hash text
) returns text
language sql
immutable
as $$
  select encode(
    digest(
      convert_to(
        '{"ledgerSourceHash":' || to_json(p_ledger_source_hash)::text
          || ',"opportunityId":' || to_json(p_opportunity_id)::text || '}',
        'utf8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

comment on function public.held_recovery_opportunity_version(text, text) is
  'Canonical opportunity version with EXACT parity to TypeScript revisionOpportunityVersionFor(opportunityId, ledgerSourceHash) = sha256(stableStringify({opportunityId, ledgerSourceHash})). Sorted-key JSON serialization reproduced via to_json. Depends ONLY on opportunity identity + ledger source hash.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Anchor-state fingerprint — the (renamed) four-input hash. Fine-grained CAS guard over
--    the CURRENTLY stored anchor fields. NOT the canonical opportunity version.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.held_recovery_anchor_fingerprint(
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
      convert_to(
        json_build_object(
          'boundary', 'held_recovery_anchor_fingerprint_v1',
          'opportunity_id', p_opportunity_id,
          'ledger_source_hash', p_ledger_source_hash,
          'evidence_anchor', p_evidence_anchor,
          'manuscript_coordinates', p_manuscript_coordinates
        )::text,
        'utf8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

comment on function public.held_recovery_anchor_fingerprint(text, text, text, text) is
  'Fine-grained anchor-state fingerprint over opportunity identity + ledger source hash + the two anchor-bearing fields. Used as the optimistic-concurrency CAS guard against concurrent anchor mutation. This is NOT the canonical opportunity version (see held_recovery_opportunity_version).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Retire the misnamed prior helper so nothing can bind the wrong concept.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.held_recovery_anchor_version(text, text, text, text);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Corrected CAS RPC. Replaces apply_held_recovery_anchor_cas_atomic with disambiguated
--    request/result vocabulary:
--      expected_ledger_source_hash   -> artifact-level source_hash the caller loaded under
--      expected_anchor_fingerprint   -> held_recovery_anchor_fingerprint(...) of CURRENT anchor
--    and it RETURNS both the canonical opportunity version AND the anchor fingerprint so the
--    caller never has to conflate them.
--
--    Success:  { status:'anchor_updated', job_id, opportunity_id,
--                opportunity_version, previous_anchor_fingerprint, anchor_fingerprint,
--                ledger_source_hash, evidence_anchor, manuscript_coordinates }
--    No-op:    { status:'unchanged', job_id, opportunity_id,
--                opportunity_version, anchor_fingerprint, ledger_source_hash }
--    Fail-closed RAISE EXCEPTION: malformed_request, artifact_not_found, opportunity_not_found,
--      duplicate_opportunity_id, ledger_source_hash_conflict, anchor_fingerprint_conflict.
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
  v_expected_anchor_fingerprint text;
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
  v_current_anchor_fingerprint text;
  v_previous_anchor_fingerprint text;
  v_new_anchor_fingerprint text;
  v_opportunity_version text;
  v_new_opp jsonb;
begin
  -- ── Parse + validate request (fail closed on any malformed field) ──────────
  v_job_id := nullif(btrim(p_request ->> 'job_id'), '');
  v_opportunity_id := nullif(btrim(p_request ->> 'opportunity_id'), '');
  v_expected_source_hash := nullif(btrim(p_request ->> 'expected_ledger_source_hash'), '');
  v_expected_anchor_fingerprint := nullif(btrim(p_request ->> 'expected_anchor_fingerprint'), '');
  v_new_evidence_anchor := p_request ->> 'new_evidence_anchor';
  v_new_manuscript_coordinates := p_request ->> 'new_manuscript_coordinates';

  if v_job_id is null
     or v_opportunity_id is null
     or v_expected_source_hash is null
     or v_expected_anchor_fingerprint is null
     or v_new_evidence_anchor is null
     or v_new_manuscript_coordinates is null
     or btrim(v_new_evidence_anchor) = ''
     or btrim(v_new_manuscript_coordinates) = '' then
    raise exception 'held_recovery_anchor_cas malformed_request: job_id, opportunity_id, expected_ledger_source_hash, expected_anchor_fingerprint, new_evidence_anchor, new_manuscript_coordinates are all required and non-empty'
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

  select (ord - 1), elem
    into v_idx, v_current_opp
  from jsonb_array_elements(coalesce(v_content -> 'opportunities', '[]'::jsonb))
       with ordinality as t(elem, ord)
  where elem ->> 'opportunity_id' = v_opportunity_id;

  v_current_evidence_anchor := coalesce(v_current_opp ->> 'evidence_anchor', '');
  v_current_manuscript_coordinates := coalesce(v_current_opp ->> 'manuscript_coordinates', '');

  -- Canonical opportunity version (parity with revisionOpportunityVersionFor) — returned, not a guard.
  v_opportunity_version := public.held_recovery_opportunity_version(
    v_opportunity_id,
    v_current_source_hash
  );

  -- ── CAS guard #2: expected anchor FINGERPRINT must match the stored anchor ──
  v_current_anchor_fingerprint := public.held_recovery_anchor_fingerprint(
    v_opportunity_id,
    v_current_source_hash,
    v_current_evidence_anchor,
    v_current_manuscript_coordinates
  );

  if v_current_anchor_fingerprint is distinct from v_expected_anchor_fingerprint then
    raise exception 'held_recovery_anchor_cas anchor_fingerprint_conflict for job_id % opportunity %: expected % but found %',
      v_job_id, v_opportunity_id, v_expected_anchor_fingerprint, v_current_anchor_fingerprint
      using errcode = 'serialization_failure';
  end if;

  v_previous_anchor_fingerprint := v_current_anchor_fingerprint;

  -- ── Idempotent no-op: semantically-equal anchor -> no write ───────────────
  if v_current_evidence_anchor = v_new_evidence_anchor
     and v_current_manuscript_coordinates = v_new_manuscript_coordinates then
    return jsonb_build_object(
      'status', 'unchanged',
      'job_id', v_job_id,
      'opportunity_id', v_opportunity_id,
      'opportunity_version', v_opportunity_version,
      'anchor_fingerprint', v_current_anchor_fingerprint,
      'ledger_source_hash', v_current_source_hash
    );
  end if;

  -- ── Update ONLY the two anchor fields of the target opportunity ───────────
  v_new_opp := v_current_opp
    || jsonb_build_object(
         'evidence_anchor', v_new_evidence_anchor,
         'manuscript_coordinates', v_new_manuscript_coordinates
       );

  v_new_anchor_fingerprint := public.held_recovery_anchor_fingerprint(
    v_opportunity_id,
    v_current_source_hash,
    v_new_evidence_anchor,
    v_new_manuscript_coordinates
  );

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
    'opportunity_version', v_opportunity_version,
    'previous_anchor_fingerprint', v_previous_anchor_fingerprint,
    'anchor_fingerprint', v_new_anchor_fingerprint,
    'ledger_source_hash', v_current_source_hash,
    'evidence_anchor', v_new_evidence_anchor,
    'manuscript_coordinates', v_new_manuscript_coordinates
  );
end;
$$;

comment on function public.apply_held_recovery_anchor_cas_atomic(jsonb) is
  'Atomic anchor-repair compare-and-swap for one opportunity inside the JSON-backed revision_opportunity_ledger_v1 artifact. CAS guard is the anchor FINGERPRINT (expected_anchor_fingerprint); returns the canonical opportunity_version separately (parity with revisionOpportunityVersionFor). Updates ONLY evidence_anchor + manuscript_coordinates for exactly one opportunity_id, preserving all other opportunities and non-anchor fields. Fail-closed on mismatch/zero/duplicate. Anchor-repair CAS only, not a general artifact writer.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grants: RPC-only. All mutation flows through the SECURITY DEFINER RPC.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.held_recovery_opportunity_version(text, text) from public;
revoke all on function public.held_recovery_anchor_fingerprint(text, text, text, text) from public;
revoke all on function public.apply_held_recovery_anchor_cas_atomic(jsonb) from public;

grant execute on function public.held_recovery_opportunity_version(text, text) to service_role;
grant execute on function public.held_recovery_anchor_fingerprint(text, text, text, text) to service_role;
grant execute on function public.apply_held_recovery_anchor_cas_atomic(jsonb) to service_role;

commit;
