-- Atomic reconstructed-anchor insert RPC for Held Recovery.
--
-- This RPC exclusively owns the compare-and-set decision for persisting exactly
-- one reconstructed-anchor authority row per (held_item_id,
-- held_item_persisted_version). It is the only unit permitted to:
--   * take the held-item advisory lock,
--   * lock the live queue authority row,
--   * read any existing reconstructed-anchor row under that lock,
--   * classify replay versus conflict by completion_fingerprint, and
--   * compare the caller-supplied expected_authority_version against the live
--     queue authority version to reject stale writes.
--
-- Authority model (verified against merged code):
--   * held_item_persisted_version identifies the held-item version whose
--     reconstructed content is being stored. It is NOT a queue CAS token.
--   * authority_version (public.held_recovery_queue_items.authority_version) is
--     the mutable queue compare-and-set token, derived as a composite hash and
--     re-hashed on every queue transition.
--   These two values live in different representations and are NEVER compared to
--   each other. The stale check compares expected_authority_version to the live
--   queue authority_version ONLY.
--
-- Ordering is deliberate: replay/conflict is classified BEFORE staleness so that
-- a genuine insert retried after a later queue transition still resolves as
-- already_applied rather than a false stale failure.
--
-- Scope fence: this migration adds only the RPC. It performs no queue mutation,
-- no attempt mutation, no candidate or manuscript mutation, no queue transition,
-- no retry scheduling, no re-admission, and no feature flag.

begin;

create or replace function public.insert_held_recovery_reconstructed_anchor_atomic(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_held_item_id text;
  v_held_item_persisted_version text;
  v_expected_authority_version text;
  v_completion_fingerprint text;
  v_opportunity_id text;
  v_manuscript_id bigint;
  v_manuscript_version_sha text;
  v_recovery_method text;
  v_source_hash text;
  v_source_start_offset integer;
  v_source_end_offset integer;
  v_evidence_anchor text;
  v_manuscript_coordinates text;
  v_current_authority_version text;
  v_queue_found boolean;
  v_existing public.held_recovery_reconstructed_anchors%rowtype;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Held Recovery reconstructed-anchor insert blocked: p_request must be a JSON object';
  end if;

  v_held_item_id := nullif(btrim(p_request ->> 'held_item_id'), '');
  v_held_item_persisted_version := nullif(btrim(p_request ->> 'held_item_persisted_version'), '');
  v_expected_authority_version := nullif(btrim(p_request ->> 'expected_authority_version'), '');
  v_completion_fingerprint := nullif(btrim(p_request ->> 'completion_fingerprint'), '');
  v_opportunity_id := nullif(btrim(p_request ->> 'opportunity_id'), '');
  v_manuscript_version_sha := nullif(btrim(p_request ->> 'manuscript_version_sha'), '');
  v_recovery_method := nullif(btrim(p_request ->> 'recovery_method'), '');
  v_source_hash := nullif(btrim(p_request ->> 'source_hash'), '');
  v_evidence_anchor := nullif(btrim(p_request ->> 'evidence_anchor'), '');
  v_manuscript_coordinates := nullif(btrim(p_request ->> 'manuscript_coordinates'), '');

  if v_held_item_id is null
     or v_held_item_persisted_version is null
     or v_expected_authority_version is null
     or v_completion_fingerprint is null
     or v_opportunity_id is null
     or v_manuscript_version_sha is null
     or v_recovery_method is null
     or v_source_hash is null
     or v_evidence_anchor is null
     or v_manuscript_coordinates is null
     or (p_request ->> 'manuscript_id') is null
     or (p_request ->> 'source_start_offset') is null
     or (p_request ->> 'source_end_offset') is null then
    raise exception 'Held Recovery reconstructed-anchor insert blocked: required request fields are missing';
  end if;

  v_manuscript_id := (p_request ->> 'manuscript_id')::bigint;
  v_source_start_offset := (p_request ->> 'source_start_offset')::integer;
  v_source_end_offset := (p_request ->> 'source_end_offset')::integer;

  -- Same held-item advisory-lock namespace used by the queue transition writer.
  -- The secondary key is a stable per-RPC boundary token so that reconstructed-
  -- anchor inserts serialise per held item without colliding with the queue
  -- transition writer's transition-idempotency-scoped lock.
  perform pg_advisory_xact_lock(
    hashtext(v_held_item_id),
    hashtext('held_recovery_reconstructed_anchor_insert_v1')
  );

  -- Lock the live queue authority row. This is the authoritative currency check
  -- surface; the attempts table is audit history and is intentionally not read.
  select authority_version
  into v_current_authority_version
  from public.held_recovery_queue_items
  where held_item_id = v_held_item_id
  for update;

  v_queue_found := found;

  if not v_queue_found then
    -- A missing queue authority row fails closed as rejected_missing. It is
    -- never collapsed into rejected_stale.
    return jsonb_build_object(
      'status', 'rejected_missing',
      'held_item_id', v_held_item_id
    );
  end if;

  -- Classify replay versus conflict BEFORE staleness. A genuine prior insert
  -- retried after a later queue transition must still resolve as already_applied.
  select *
  into v_existing
  from public.held_recovery_reconstructed_anchors
  where held_item_id = v_held_item_id
    and held_item_persisted_version = v_held_item_persisted_version;

  if found then
    if v_existing.completion_fingerprint is distinct from v_completion_fingerprint then
      return jsonb_build_object(
        'status', 'rejected_conflict',
        'held_item_id', v_held_item_id,
        'held_item_persisted_version', v_held_item_persisted_version,
        'existing_completion_fingerprint', v_existing.completion_fingerprint,
        'submitted_completion_fingerprint', v_completion_fingerprint
      );
    end if;

    return jsonb_build_object(
      'status', 'already_applied',
      'id', v_existing.id,
      'held_item_id', v_existing.held_item_id,
      'held_item_persisted_version', v_existing.held_item_persisted_version,
      'completion_fingerprint', v_existing.completion_fingerprint
    );
  end if;

  -- No existing row: only now compare the caller-supplied expected authority
  -- version against the live queue authority version. These are the same value
  -- space (both queue CAS tokens); held_item_persisted_version is not involved.
  if v_current_authority_version is distinct from v_expected_authority_version then
    return jsonb_build_object(
      'status', 'rejected_stale',
      'held_item_id', v_held_item_id,
      'expected_authority_version', v_expected_authority_version,
      'actual_authority_version', v_current_authority_version
    );
  end if;

  insert into public.held_recovery_reconstructed_anchors (
    held_item_id,
    opportunity_id,
    manuscript_id,
    manuscript_version_sha,
    held_item_persisted_version,
    completion_fingerprint,
    recovery_method,
    source_hash,
    source_start_offset,
    source_end_offset,
    evidence_anchor,
    manuscript_coordinates
  )
  values (
    v_held_item_id,
    v_opportunity_id,
    v_manuscript_id,
    v_manuscript_version_sha,
    v_held_item_persisted_version,
    v_completion_fingerprint,
    v_recovery_method,
    v_source_hash,
    v_source_start_offset,
    v_source_end_offset,
    v_evidence_anchor,
    v_manuscript_coordinates
  )
  returning * into v_existing;

  return jsonb_build_object(
    'status', 'inserted',
    'id', v_existing.id,
    'held_item_id', v_existing.held_item_id,
    'held_item_persisted_version', v_existing.held_item_persisted_version,
    'completion_fingerprint', v_existing.completion_fingerprint
  );
end;
$$;

revoke all on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) from public;
revoke all on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) from authenticated;
revoke all on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) from anon;
grant execute on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) to service_role;

comment on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) is
  'Atomic compare-and-set insert for Held Recovery reconstructed-anchor authority rows. Under the shared held-item advisory lock it locks the live queue authority row, classifies replay (equal completion_fingerprint) versus conflict (unequal) against any existing (held_item_id, held_item_persisted_version) row, then rejects stale writes by comparing the caller-supplied expected_authority_version to the live queue authority_version. Deterministic outcomes: inserted, already_applied, rejected_conflict, rejected_stale, rejected_missing. held_item_persisted_version and authority_version are never compared to each other. Performs no queue, attempt, candidate, manuscript, transition, retry, or re-admission mutation.';

commit;
