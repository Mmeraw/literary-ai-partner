-- Migration: Held Recovery deterministic reconstruction work items + atomic handoff RPCs
-- Purpose: Provide the durable model for the deterministic-follow-up path that begins when
--          the canonical resolve_anchor executor returns deferred_work
--          (ANCHOR_RECONSTRUCTION_REQUIRED). This path is NOT retry scheduling and MUST NOT
--          overload public.held_recovery_retry_schedules or the retry outcome model.
--
-- Scope (design draft — worker/adapter/caller integration are NOT in this migration):
--   - one durable reconstruction work item per originating deferred attempt
--   - immutable continuation payload (typed identity/version columns, not a JSON authority blob)
--   - ONE transaction-owning RPC that records the deferred attempt AND enqueues the work item
--   - atomic claim-with-lease RPC (FOR UPDATE SKIP LOCKED)
--   - lease renewal RPC
--   - idempotent completion RPC (compare-and-set on claim token + lease + canonical version)
--   - terminal-failure and supersession RPCs
--   - RLS, service-role-only grants, indexes, immutable-column guard trigger
--
-- MANUSCRIPT IDENTITY (PR #1340 contract): manuscript_id is stored as a canonical decimal
--   TEXT string, NOT bigint. A manuscripts.id can exceed 2^53, and any numeric round-trip
--   (in SQL, PostgREST, or JS) would silently corrupt the identity. A check constraint enforces
--   the canonical decimal shape, and every RPC returns manuscript_id verbatim as text. Because
--   the value is canonical decimal text, the paired held_recovery_attempts insert relies on
--   Postgres' text->bigint assignment cast for that (separate, out-of-scope) table only.
--
-- Authority boundary (mirrors held_recovery_attempts / queue_transition writer):
--   Nothing here manufactures producer, reasonCode, recoveryAction, cardType, finalDecision,
--   classification result, or a queue destination. Canonical re-admission/classification and the
--   already-characterized row-locked queue transition remain SEPARATE authority-bearing steps.

begin;

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: held_recovery_reconstruction_work_items
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.held_recovery_reconstruction_work_items (
  id uuid primary key default gen_random_uuid(),

  -- Originating deferred attempt (strong FK; retry_schedules used a loose text ref, we tighten it here).
  originating_attempt_id uuid not null
    references public.held_recovery_attempts(id) on delete restrict,
  -- The attempt's own idempotency key, carried so enqueue idempotency is anchored to the
  -- same identity the attempt table already uniquely enforces.
  originating_attempt_idempotency_key text not null,

  -- Canonical identity of the held item this continuation is bound to (immutable after enqueue).
  held_item_id text not null,
  opportunity_id text not null,
  -- Canonical decimal manuscript id as TEXT (bigint fidelity; never numeric). A manuscripts.id
  -- can exceed 2^53, so this is deliberately NOT bigint and carries no numeric FK. The check
  -- constraint below enforces the canonical decimal shape.
  manuscript_id text not null,
  manuscript_version_sha text not null,
  held_item_persisted_version text not null,

  -- Immutable deterministic reconstruction payload produced by executeResolveAnchor's
  -- deferred_work result (recoveryMethod is fixed to source-text location only).
  source_hash text not null,
  source_start_offset integer not null,
  source_end_offset integer not null,
  recovery_method text not null
    check (recovery_method = 'source_text_location_only'),

  -- Deterministic-follow-up status model (narrow; constrained text, matching repo convention).
  status text not null default 'pending'
    check (status in (
      'pending',
      'running',
      'completed',
      'failed_terminal',
      'superseded'
    )),

  -- Claim / lease bookkeeping (only meaningful while running).
  claim_token uuid,
  claimed_by text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),

  -- Terminal / lifecycle timestamps and reason.
  completed_at timestamptz,
  failed_at timestamptz,
  superseded_at timestamptz,
  terminal_reason text,

  -- Optional supplementary diagnostics ONLY. Never the authority payload.
  details jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One work item per originating attempt / attempt idempotency key.
  constraint held_recovery_reconstruction_work_items_originating_attempt_unique
    unique (originating_attempt_id),
  constraint held_recovery_reconstruction_work_items_attempt_idem_unique
    unique (originating_attempt_idempotency_key),

  -- Manuscript id must be a canonical decimal string ("0" or a leading-non-zero digit run).
  -- Preserves bigint fidelity as text and rejects numeric-coercion artifacts / junk.
  constraint held_recovery_reconstruction_work_items_manuscript_id_canonical
    check (manuscript_id ~ '^(0|[1-9][0-9]*)$'),

  -- Offset sanity.
  constraint held_recovery_reconstruction_work_items_start_nonneg
    check (source_start_offset >= 0),
  constraint held_recovery_reconstruction_work_items_end_ge_start
    check (source_end_offset >= source_start_offset),

  -- details is diagnostics-only: enforce it stays an object so it can never be mistaken for a list authority.
  constraint held_recovery_reconstruction_work_items_details_object
    check (jsonb_typeof(details) = 'object'),

  -- Status/lease consistency: a running item MUST carry a full lease triple; a non-running item
  -- MUST NOT retain a lease (prevents "running with no lease" and "leased but not running").
  constraint held_recovery_reconstruction_work_items_running_lease_consistency
    check (
      (status = 'running'
        and claim_token is not null
        and claimed_by is not null
        and lease_expires_at is not null)
      or
      (status <> 'running'
        and claim_token is null
        and claimed_by is null
        and lease_expires_at is null)
    ),

  -- Terminal timestamps correspond to their statuses (and only their statuses).
  constraint held_recovery_reconstruction_work_items_completed_ts
    check ((status = 'completed') = (completed_at is not null)),
  constraint held_recovery_reconstruction_work_items_failed_ts
    check ((status = 'failed_terminal') = (failed_at is not null)),
  constraint held_recovery_reconstruction_work_items_superseded_ts
    check ((status = 'superseded') = (superseded_at is not null)),
  -- terminal_reason only for the two adverse terminals.
  constraint held_recovery_reconstruction_work_items_terminal_reason
    check (
      (terminal_reason is null and status not in ('failed_terminal', 'superseded'))
      or (terminal_reason is not null and status in ('failed_terminal', 'superseded'))
    )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: service-role only (matches held_recovery_attempts / queue_items / retry_schedules)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.held_recovery_reconstruction_work_items enable row level security;

revoke all on table public.held_recovery_reconstruction_work_items from public;
revoke all on table public.held_recovery_reconstruction_work_items from anon;
revoke all on table public.held_recovery_reconstruction_work_items from authenticated;

-- Direct table writes are NOT granted to service_role: all mutation flows through the RPCs below,
-- so the immutable-authority guarantee and the atomic handoff cannot be bypassed by a client write.
-- (Reads are allowed for observability.)
grant select on table public.held_recovery_reconstruction_work_items to service_role;

drop policy if exists "Service role: read" on public.held_recovery_reconstruction_work_items;
create policy "Service role: read"
  on public.held_recovery_reconstruction_work_items
  for select
  to service_role
  using (true);

-- The RPCs are SECURITY DEFINER (owner = migration/postgres), so they can insert/update even
-- though service_role holds no direct DML grant. This is the enforcement point for immutability.

-- ─────────────────────────────────────────────────────────────────────────────
-- Defense-in-depth: immutable-column guard on UPDATE
--   Identity + version + payload columns can never change after enqueue, even via a
--   SECURITY DEFINER RPC bug. updated_at always advances (reuses repo touch semantics inline).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.held_recovery_reconstruction_work_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- created_at + all identity/version/payload columns are immutable after insert.
  new.created_at := old.created_at;
  new.originating_attempt_id := old.originating_attempt_id;
  new.originating_attempt_idempotency_key := old.originating_attempt_idempotency_key;
  new.held_item_id := old.held_item_id;
  new.opportunity_id := old.opportunity_id;
  new.manuscript_id := old.manuscript_id;
  new.manuscript_version_sha := old.manuscript_version_sha;
  new.held_item_persisted_version := old.held_item_persisted_version;
  new.source_hash := old.source_hash;
  new.source_start_offset := old.source_start_offset;
  new.source_end_offset := old.source_end_offset;
  new.recovery_method := old.recovery_method;

  -- Terminal states are absorbing: once completed/failed_terminal/superseded, may not go back
  -- to pending or running. (Completion replay handled idempotently in the RPC before UPDATE runs.)
  if old.status in ('completed', 'failed_terminal', 'superseded')
     and new.status in ('pending', 'running') then
    raise exception
      'Held Recovery reconstruction guard: cannot move terminal item % from % back to %',
      old.id, old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_held_recovery_reconstruction_work_items_guard
  on public.held_recovery_reconstruction_work_items;

create trigger trg_held_recovery_reconstruction_work_items_guard
before update on public.held_recovery_reconstruction_work_items
for each row
execute function public.held_recovery_reconstruction_work_items_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Unique indexes are already created by the UNIQUE constraints above
-- (originating_attempt_id, originating_attempt_idempotency_key).

-- Claim scan support: pending by age, and running-with-expired-lease.
create index if not exists idx_hr_reconstruction_status_created_at
  on public.held_recovery_reconstruction_work_items(status, created_at);
create index if not exists idx_hr_reconstruction_status_lease
  on public.held_recovery_reconstruction_work_items(status, lease_expires_at);

-- Held-item history and manuscript-version supersession lookups.
create index if not exists idx_hr_reconstruction_held_item_created_at
  on public.held_recovery_reconstruction_work_items(held_item_id, created_at desc);
create index if not exists idx_hr_reconstruction_manuscript_version
  on public.held_recovery_reconstruction_work_items(manuscript_id, manuscript_version_sha);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 1 (ATOMIC HANDOFF): record deferred attempt AND enqueue reconstruction item
--   The single most important property: for a canonical ANCHOR_RECONSTRUCTION_REQUIRED result,
--     deferred attempt exists  ⇔  reconstruction work item exists.
--   Both rows are written inside ONE function transaction. There is no client-side
--   "insert attempt, then insert work item" sequence.
--
--   Enqueue lock is keyed on held_item_id ONLY (deliberate deviation from the two-key lock in
--   the queue/retry writers) so that competing continuations for the SAME held item serialize.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- attempt fields (subset of held_recovery_attempts required to persist the audit row)
  v_attempt jsonb;
  v_idempotency_key text;
  v_held_item_id text;
  v_opportunity_id text;
  -- Canonical decimal manuscript id as TEXT (bigint fidelity; never numeric coercion).
  v_manuscript_id text;
  v_manuscript_version_sha text;
  v_held_item_persisted_version text;
  v_runtime_outcome_status text;
  v_executor_result jsonb;
  v_series_key jsonb;
  v_recovery_input_fingerprint text;
  v_attempt_number integer;
  v_max_attempts integer;
  v_attempt_status text;
  v_attempt_outcome text;
  v_snapshot jsonb;

  -- continuation payload fields
  v_continuation jsonb;
  v_source_hash text;
  v_source_start_offset integer;
  v_source_end_offset integer;
  v_recovery_method text;

  -- executor-result validation fields
  v_result_kind text;
  v_result_code text;

  v_attempt_id uuid;
  v_existing_attempt public.held_recovery_attempts%rowtype;
  v_existing_item public.held_recovery_reconstruction_work_items%rowtype;
  v_new_item public.held_recovery_reconstruction_work_items%rowtype;
  -- Referential-consistency guard: the originating attempt's manuscript, rendered as
  -- canonical text, MUST equal the work item's stored manuscript_id. The work-items
  -- table carries text (no numeric FK), so this is enforced explicitly here rather than
  -- by a FOREIGN KEY. See the paired assertion after both inserts.
  v_attempt_manuscript_id_text text;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Held Recovery deferred handoff blocked: p_request must be a JSON object';
  end if;

  v_attempt := p_request -> 'attempt';
  v_continuation := p_request -> 'continuation';

  if v_attempt is null or jsonb_typeof(v_attempt) <> 'object'
     or v_continuation is null or jsonb_typeof(v_continuation) <> 'object' then
    raise exception 'Held Recovery deferred handoff blocked: attempt and continuation objects are required';
  end if;

  -- ── attempt identity/version ──
  v_idempotency_key := nullif(btrim(v_attempt ->> 'idempotency_key'), '');
  v_held_item_id := nullif(btrim(v_attempt ->> 'held_item_id'), '');
  v_opportunity_id := nullif(btrim(v_attempt ->> 'opportunity_id'), '');
  -- Carried verbatim as TEXT (NO ::bigint / numeric coercion). Canonical shape enforced below.
  v_manuscript_id := nullif(btrim(v_attempt ->> 'manuscript_id'), '');
  v_manuscript_version_sha := nullif(btrim(v_attempt ->> 'manuscript_version_sha'), '');
  v_held_item_persisted_version := nullif(btrim(v_attempt ->> 'held_item_persisted_version'), '');
  v_runtime_outcome_status := nullif(btrim(v_attempt ->> 'runtime_outcome_status'), '');
  v_executor_result := v_attempt -> 'executor_result';
  v_series_key := coalesce(v_attempt -> 'series_key', '{}'::jsonb);
  v_recovery_input_fingerprint := nullif(btrim(v_attempt ->> 'recovery_input_fingerprint'), '');
  v_attempt_number := (v_attempt ->> 'attempt_number')::integer;
  v_max_attempts := (v_attempt ->> 'max_attempts')::integer;
  v_attempt_status := nullif(btrim(v_attempt ->> 'status'), '');
  v_attempt_outcome := nullif(btrim(v_attempt ->> 'outcome'), '');
  v_snapshot := coalesce(v_attempt -> 'snapshot', '{}'::jsonb);

  -- ── continuation payload ──
  v_source_hash := nullif(btrim(v_continuation ->> 'source_hash'), '');
  v_source_start_offset := (v_continuation ->> 'source_start_offset')::integer;
  v_source_end_offset := (v_continuation ->> 'source_end_offset')::integer;
  v_recovery_method := nullif(btrim(v_continuation ->> 'recovery_method'), '');

  if v_idempotency_key is null
     or v_held_item_id is null
     or v_opportunity_id is null
     or v_manuscript_id is null
     or v_manuscript_version_sha is null
     or v_held_item_persisted_version is null
     or v_runtime_outcome_status is null
     or v_executor_result is null or jsonb_typeof(v_executor_result) <> 'object'
     or v_recovery_input_fingerprint is null
     or v_attempt_number is null
     or v_max_attempts is null
     or v_attempt_status is null
     or v_attempt_outcome is null
     or v_source_hash is null
     or v_source_start_offset is null
     or v_source_end_offset is null
     or v_recovery_method is null then
    raise exception 'Held Recovery deferred handoff blocked: required attempt/continuation fields are missing';
  end if;

  -- ── manuscript id must be a canonical decimal string (bigint fidelity; never numeric) ──
  if v_manuscript_id !~ '^(0|[1-9][0-9]*)$' then
    raise exception 'Held Recovery deferred handoff blocked: manuscript_id must be a canonical decimal string';
  end if;

  -- ── VALIDATE that this is EXACTLY the permitted deferred continuation ──
  -- runtime outcome must be deferred; executor result kind deferred_work; code ANCHOR_RECONSTRUCTION_REQUIRED;
  -- recovery method source_text_location_only. Anything else is rejected WITHOUT writing.
  v_result_kind := nullif(btrim(v_executor_result ->> 'kind'), '');
  v_result_code := coalesce(
    nullif(btrim(v_executor_result ->> 'code'), ''),
    nullif(btrim(v_executor_result #>> '{error,code}'), '')
  );

  if v_runtime_outcome_status <> 'deferred'
     or v_result_kind is distinct from 'deferred_work'
     or v_result_code is distinct from 'ANCHOR_RECONSTRUCTION_REQUIRED'
     or v_recovery_method <> 'source_text_location_only' then
    return jsonb_build_object(
      'status', 'rejected_stale',
      'reason', 'not_permitted_deferred_continuation',
      'runtime_outcome_status', v_runtime_outcome_status,
      'executor_result_kind', v_result_kind,
      'executor_result_code', v_result_code,
      'recovery_method', v_recovery_method
    );
  end if;

  -- ── serialize competing continuations for the SAME held item ──
  perform pg_advisory_xact_lock(hashtext(v_held_item_id));

  -- ── idempotency: has this exact attempt already been recorded? ──
  select *
  into v_existing_attempt
  from public.held_recovery_attempts a
  where a.idempotency_key = v_idempotency_key;

  if found then
    -- Attempt already exists. The paired work item must exist and match; otherwise conflict.
    select *
    into v_existing_item
    from public.held_recovery_reconstruction_work_items w
    where w.originating_attempt_id = v_existing_attempt.id;

    if not found then
      -- Attempt exists but no work item: earlier partial write or a non-continuation attempt reused
      -- the key. This violates the ⇔ invariant for a continuation key; report conflict, do not write.
      return jsonb_build_object(
        'status', 'idempotency_conflict',
        'reason', 'attempt_exists_without_reconstruction_item',
        'attempt_id', v_existing_attempt.id
      );
    end if;

    -- Same key must carry identical immutable continuation data. manuscript_id compared as TEXT.
    if v_existing_item.held_item_id is distinct from v_held_item_id
       or v_existing_item.opportunity_id is distinct from v_opportunity_id
       or v_existing_item.manuscript_id is distinct from v_manuscript_id
       or v_existing_item.manuscript_version_sha is distinct from v_manuscript_version_sha
       or v_existing_item.held_item_persisted_version is distinct from v_held_item_persisted_version
       or v_existing_item.source_hash is distinct from v_source_hash
       or v_existing_item.source_start_offset is distinct from v_source_start_offset
       or v_existing_item.source_end_offset is distinct from v_source_end_offset
       or v_existing_item.recovery_method is distinct from v_recovery_method
       or v_existing_item.originating_attempt_idempotency_key is distinct from v_idempotency_key then
      return jsonb_build_object(
        'status', 'idempotency_conflict',
        'reason', 'immutable_payload_mismatch',
        'attempt_id', v_existing_attempt.id,
        'work_item_id', v_existing_item.id
      );
    end if;

    return jsonb_build_object(
      'status', 'already_enqueued',
      'attempt_id', v_existing_attempt.id,
      'work_item_id', v_existing_item.id,
      'work_item_status', v_existing_item.status
    );
  end if;

  -- ── ONE TRANSACTION: insert the deferred attempt row ... ──
  -- held_recovery_attempts.manuscript_id remains bigint (out of scope for this migration); the
  -- canonical decimal text value is assignment-cast to bigint by Postgres for THAT insert only.
  insert into public.held_recovery_attempts (
    idempotency_key,
    held_item_id,
    opportunity_id,
    manuscript_id,
    manuscript_version_sha,
    held_item_persisted_version,
    runtime_outcome_status,
    runtime_rejection_reason,
    executor_result,
    series_key,
    recovery_input_fingerprint,
    attempt_number,
    max_attempts,
    status,
    outcome,
    snapshot
  ) values (
    v_idempotency_key,
    v_held_item_id,
    v_opportunity_id,
    v_manuscript_id::bigint,
    v_manuscript_version_sha,
    v_held_item_persisted_version,
    v_runtime_outcome_status,
    null,
    v_executor_result,
    v_series_key,
    v_recovery_input_fingerprint,
    v_attempt_number,
    v_max_attempts,
    v_attempt_status,
    v_attempt_outcome,
    v_snapshot
  )
  returning id into v_attempt_id;

  -- ── ... and enqueue the paired reconstruction work item in the SAME transaction ──
  -- manuscript_id inserted as canonical TEXT (no numeric coercion).
  insert into public.held_recovery_reconstruction_work_items (
    originating_attempt_id,
    originating_attempt_idempotency_key,
    held_item_id,
    opportunity_id,
    manuscript_id,
    manuscript_version_sha,
    held_item_persisted_version,
    source_hash,
    source_start_offset,
    source_end_offset,
    recovery_method,
    status
  ) values (
    v_attempt_id,
    v_idempotency_key,
    v_held_item_id,
    v_opportunity_id,
    v_manuscript_id,
    v_manuscript_version_sha,
    v_held_item_persisted_version,
    v_source_hash,
    v_source_start_offset,
    v_source_end_offset,
    v_recovery_method,
    'pending'
  )
  returning * into v_new_item;

  -- ── REFERENTIAL-CONSISTENCY ASSERTION (defense in depth) ──
  -- The work-items table stores manuscript_id as canonical TEXT and carries NO numeric
  -- foreign key to manuscripts(id) (a text column cannot FK a bigint PK). The
  -- originating_attempt_id FK therefore gives transitive manuscript existence ONLY IF the
  -- work item's manuscript_id equals the originating attempt's manuscript. Both rows are
  -- written here from the same v_manuscript_id, so equality holds by construction — but we
  -- assert it explicitly so a future refactor that sources the two independently can never
  -- silently persist a work item whose manuscript disagrees with its originating attempt.
  select a.manuscript_id::text
    into v_attempt_manuscript_id_text
  from public.held_recovery_attempts a
  where a.id = v_attempt_id;

  if v_attempt_manuscript_id_text is distinct from v_new_item.manuscript_id then
    raise exception
      'Held Recovery deferred handoff blocked: work item manuscript_id (%) does not match originating attempt manuscript_id (%)',
      v_new_item.manuscript_id, v_attempt_manuscript_id_text;
  end if;

  return jsonb_build_object(
    'status', 'enqueued',
    'attempt_id', v_attempt_id,
    'work_item_id', v_new_item.id,
    'work_item_status', v_new_item.status
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 2 (CLAIM): atomic claim-with-lease
--   Selects one pending item OR one running item whose lease has expired, using
--   FOR UPDATE SKIP LOCKED, and flips it to running with a fresh claim token in ONE statement.
--   Possession of the work-item id is NOT enough to complete later — the worker must present
--   the returned claim_token.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.claim_held_recovery_reconstruction_work_atomic(
  p_worker_id text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id text;
  v_lease_seconds integer;
  v_now timestamptz := now();
  v_claim_token uuid := gen_random_uuid();
  v_claimed public.held_recovery_reconstruction_work_items%rowtype;
begin
  v_worker_id := nullif(btrim(p_worker_id), '');
  v_lease_seconds := p_lease_seconds;

  if v_worker_id is null then
    raise exception 'Held Recovery reconstruction claim blocked: worker_id is required';
  end if;
  if v_lease_seconds is null or v_lease_seconds <= 0 then
    raise exception 'Held Recovery reconstruction claim blocked: lease_seconds must be a positive integer';
  end if;

  with candidate as (
    select w.id
    from public.held_recovery_reconstruction_work_items w
    where w.status = 'pending'
       or (w.status = 'running' and w.lease_expires_at is not null and w.lease_expires_at < v_now)
    order by w.created_at asc
    for update skip locked
    limit 1
  )
  update public.held_recovery_reconstruction_work_items w
  set status = 'running',
      claim_token = v_claim_token,
      claimed_by = v_worker_id,
      lease_expires_at = v_now + make_interval(secs => v_lease_seconds),
      attempt_count = w.attempt_count + 1
  from candidate
  where w.id = candidate.id
  returning w.* into v_claimed;

  if not found then
    return jsonb_build_object('status', 'no_work_available');
  end if;

  -- manuscript_id returned verbatim as TEXT (canonical decimal string; never numeric).
  return jsonb_build_object(
    'status', 'claimed',
    'work_item_id', v_claimed.id,
    'claim_token', v_claimed.claim_token,
    'claimed_by', v_claimed.claimed_by,
    'lease_expires_at', v_claimed.lease_expires_at,
    'attempt_count', v_claimed.attempt_count,
    'held_item_id', v_claimed.held_item_id,
    'opportunity_id', v_claimed.opportunity_id,
    'manuscript_id', v_claimed.manuscript_id,
    'manuscript_version_sha', v_claimed.manuscript_version_sha,
    'held_item_persisted_version', v_claimed.held_item_persisted_version,
    'source_hash', v_claimed.source_hash,
    'source_start_offset', v_claimed.source_start_offset,
    'source_end_offset', v_claimed.source_end_offset,
    'recovery_method', v_claimed.recovery_method
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 3 (LEASE RENEWAL): extend the lease for a still-valid claim
--   Only the holder of the exact claim_token may renew, and only while the lease is unexpired.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.renew_held_recovery_reconstruction_lease_atomic(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_item_id uuid;
  v_claim_token uuid;
  v_lease_seconds integer;
  v_now timestamptz := now();
  v_row public.held_recovery_reconstruction_work_items%rowtype;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Held Recovery reconstruction lease renewal blocked: p_request must be a JSON object';
  end if;

  v_work_item_id := nullif(btrim(p_request ->> 'work_item_id'), '')::uuid;
  v_claim_token := nullif(btrim(p_request ->> 'claim_token'), '')::uuid;
  v_lease_seconds := (p_request ->> 'lease_seconds')::integer;

  if v_work_item_id is null or v_claim_token is null then
    raise exception 'Held Recovery reconstruction lease renewal blocked: work_item_id and claim_token are required';
  end if;
  if v_lease_seconds is null or v_lease_seconds <= 0 then
    raise exception 'Held Recovery reconstruction lease renewal blocked: lease_seconds must be a positive integer';
  end if;

  select *
  into v_row
  from public.held_recovery_reconstruction_work_items
  where id = v_work_item_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_row.status <> 'running'
     or v_row.claim_token is distinct from v_claim_token
     or v_row.lease_expires_at is null
     or v_row.lease_expires_at < v_now then
    return jsonb_build_object(
      'status', 'lease_lost',
      'work_item_status', v_row.status
    );
  end if;

  update public.held_recovery_reconstruction_work_items
  set lease_expires_at = v_now + make_interval(secs => v_lease_seconds)
  where id = v_work_item_id
    and claim_token = v_claim_token
  returning * into v_row;

  return jsonb_build_object(
    'status', 'renewed',
    'work_item_id', v_row.id,
    'lease_expires_at', v_row.lease_expires_at
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 4 (COMPLETION): compare-and-set completion (idempotent)
--   Completes ONLY when: status = running; claim_token matches; lease unexpired; canonical
--   manuscript/version identity still current; originating attempt not superseded; held item
--   not advanced beyond expected persisted version. This RPC does NOT manufacture finalDecision
--   or cardType — its permissible responsibility is to mark the item completed and RETURN the
--   authority/version needed for the SEPARATE canonical re-admission + queue-transition steps.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.complete_held_recovery_reconstruction_work_atomic(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_item_id uuid;
  v_claim_token uuid;
  v_expected_manuscript_version_sha text;
  v_expected_held_item_persisted_version text;
  v_completion_fingerprint text;
  v_now timestamptz := now();
  v_row public.held_recovery_reconstruction_work_items%rowtype;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Held Recovery reconstruction completion blocked: p_request must be a JSON object';
  end if;

  v_work_item_id := nullif(btrim(p_request ->> 'work_item_id'), '')::uuid;
  v_claim_token := nullif(btrim(p_request ->> 'claim_token'), '')::uuid;
  v_expected_manuscript_version_sha := nullif(btrim(p_request ->> 'manuscript_version_sha'), '');
  v_expected_held_item_persisted_version := nullif(btrim(p_request ->> 'held_item_persisted_version'), '');
  -- Optional stable fingerprint of the reconstructed authority payload, used to distinguish
  -- identical completion replay from a conflicting replay.
  v_completion_fingerprint := nullif(btrim(p_request ->> 'completion_fingerprint'), '');

  if v_work_item_id is null or v_claim_token is null then
    raise exception 'Held Recovery reconstruction completion blocked: work_item_id and claim_token are required';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_work_item_id::text));

  select *
  into v_row
  from public.held_recovery_reconstruction_work_items
  where id = v_work_item_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- ── idempotent replay: already completed ──
  if v_row.status = 'completed' then
    if v_completion_fingerprint is not null
       and (v_row.details ->> 'completion_fingerprint') is distinct from v_completion_fingerprint then
      return jsonb_build_object(
        'status', 'idempotency_conflict',
        'reason', 'completion_fingerprint_mismatch',
        'work_item_id', v_row.id
      );
    end if;
    return jsonb_build_object(
      'status', 'already_completed',
      'work_item_id', v_row.id,
      'manuscript_id', v_row.manuscript_id,
      'manuscript_version_sha', v_row.manuscript_version_sha,
      'held_item_persisted_version', v_row.held_item_persisted_version,
      'source_hash', v_row.source_hash,
      'source_start_offset', v_row.source_start_offset,
      'source_end_offset', v_row.source_end_offset
    );
  end if;

  -- ── terminal-but-not-completed: cannot complete ──
  if v_row.status in ('failed_terminal', 'superseded') then
    return jsonb_build_object(
      'status', 'rejected_terminal',
      'work_item_status', v_row.status,
      'terminal_reason', v_row.terminal_reason
    );
  end if;

  -- ── claim + lease ──
  if v_row.status <> 'running'
     or v_row.claim_token is distinct from v_claim_token
     or v_row.lease_expires_at is null
     or v_row.lease_expires_at < v_now then
    return jsonb_build_object(
      'status', 'lease_lost',
      'work_item_status', v_row.status
    );
  end if;

  -- ── canonical version still current ──
  if (v_expected_manuscript_version_sha is not null
        and v_expected_manuscript_version_sha is distinct from v_row.manuscript_version_sha)
     or (v_expected_held_item_persisted_version is not null
        and v_expected_held_item_persisted_version is distinct from v_row.held_item_persisted_version) then
    return jsonb_build_object(
      'status', 'rejected_stale',
      'reason', 'canonical_version_moved',
      'expected_manuscript_version_sha', v_expected_manuscript_version_sha,
      'actual_manuscript_version_sha', v_row.manuscript_version_sha,
      'expected_held_item_persisted_version', v_expected_held_item_persisted_version,
      'actual_held_item_persisted_version', v_row.held_item_persisted_version
    );
  end if;

  -- ── a later attempt for the same held item supersedes this continuation ──
  if exists (
    select 1
    from public.held_recovery_attempts a
    where a.held_item_id = v_row.held_item_id
      and a.created_at > (
        select o.created_at from public.held_recovery_attempts o
        where o.id = v_row.originating_attempt_id
      )
  ) then
    return jsonb_build_object(
      'status', 'rejected_stale',
      'reason', 'superseded_by_later_attempt'
    );
  end if;

  update public.held_recovery_reconstruction_work_items
  set status = 'completed',
      completed_at = v_now,
      claim_token = null,
      claimed_by = null,
      lease_expires_at = null,
      details = case
        when v_completion_fingerprint is null then details
        else jsonb_set(details, '{completion_fingerprint}', to_jsonb(v_completion_fingerprint), true)
      end
  where id = v_work_item_id
    and claim_token = v_claim_token
    and status = 'running'
  returning * into v_row;

  if not found then
    return jsonb_build_object('status', 'lease_lost', 'reason', 'row_changed_under_completion');
  end if;

  -- manuscript_id returned verbatim as TEXT (canonical decimal string; never numeric).
  return jsonb_build_object(
    'status', 'completed',
    'work_item_id', v_row.id,
    'manuscript_id', v_row.manuscript_id,
    'manuscript_version_sha', v_row.manuscript_version_sha,
    'held_item_persisted_version', v_row.held_item_persisted_version,
    'source_hash', v_row.source_hash,
    'source_start_offset', v_row.source_start_offset,
    'source_end_offset', v_row.source_end_offset,
    'recovery_method', v_row.recovery_method
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 5 (TERMINAL FAILURE): mark a running item failed_terminal (compare-and-set)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fail_held_recovery_reconstruction_work_atomic(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_item_id uuid;
  v_claim_token uuid;
  v_terminal_reason text;
  v_now timestamptz := now();
  v_row public.held_recovery_reconstruction_work_items%rowtype;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Held Recovery reconstruction failure blocked: p_request must be a JSON object';
  end if;

  v_work_item_id := nullif(btrim(p_request ->> 'work_item_id'), '')::uuid;
  v_claim_token := nullif(btrim(p_request ->> 'claim_token'), '')::uuid;
  v_terminal_reason := nullif(btrim(p_request ->> 'terminal_reason'), '');

  if v_work_item_id is null or v_claim_token is null or v_terminal_reason is null then
    raise exception 'Held Recovery reconstruction failure blocked: work_item_id, claim_token, terminal_reason are required';
  end if;

  select *
  into v_row
  from public.held_recovery_reconstruction_work_items
  where id = v_work_item_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_row.status = 'failed_terminal' then
    return jsonb_build_object('status', 'already_failed_terminal', 'work_item_id', v_row.id);
  end if;

  if v_row.status <> 'running'
     or v_row.claim_token is distinct from v_claim_token
     or v_row.lease_expires_at is null
     or v_row.lease_expires_at < v_now then
    return jsonb_build_object('status', 'lease_lost', 'work_item_status', v_row.status);
  end if;

  update public.held_recovery_reconstruction_work_items
  set status = 'failed_terminal',
      failed_at = v_now,
      terminal_reason = v_terminal_reason,
      claim_token = null,
      claimed_by = null,
      lease_expires_at = null
  where id = v_work_item_id
    and claim_token = v_claim_token
    and status = 'running'
  returning * into v_row;

  if not found then
    return jsonb_build_object('status', 'lease_lost', 'reason', 'row_changed_under_failure');
  end if;

  return jsonb_build_object('status', 'failed_terminal', 'work_item_id', v_row.id, 'terminal_reason', v_row.terminal_reason);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 6 (SUPERSESSION): mark an item superseded when canonical identity has moved
--   Supersession does NOT require the claim token (a newer authority, not the worker, drives it),
--   but it may only act on non-terminal items, and it never yields completion.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.supersede_held_recovery_reconstruction_work_atomic(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_item_id uuid;
  v_reason text;
  v_now timestamptz := now();
  v_row public.held_recovery_reconstruction_work_items%rowtype;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Held Recovery reconstruction supersession blocked: p_request must be a JSON object';
  end if;

  v_work_item_id := nullif(btrim(p_request ->> 'work_item_id'), '')::uuid;
  v_reason := coalesce(nullif(btrim(p_request ->> 'reason'), ''), 'canonical_identity_moved');

  if v_work_item_id is null then
    raise exception 'Held Recovery reconstruction supersession blocked: work_item_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_work_item_id::text));

  select *
  into v_row
  from public.held_recovery_reconstruction_work_items
  where id = v_work_item_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_row.status = 'superseded' then
    return jsonb_build_object('status', 'already_superseded', 'work_item_id', v_row.id);
  end if;

  -- Completed / failed_terminal items are absorbing; do not overwrite them.
  if v_row.status in ('completed', 'failed_terminal') then
    return jsonb_build_object('status', 'rejected_terminal', 'work_item_status', v_row.status);
  end if;

  update public.held_recovery_reconstruction_work_items
  set status = 'superseded',
      superseded_at = v_now,
      terminal_reason = v_reason,
      claim_token = null,
      claimed_by = null,
      lease_expires_at = null
  where id = v_work_item_id
    and status in ('pending', 'running')
  returning * into v_row;

  if not found then
    return jsonb_build_object('status', 'rejected_terminal', 'reason', 'row_changed_under_supersession');
  end if;

  return jsonb_build_object('status', 'superseded', 'work_item_id', v_row.id, 'terminal_reason', v_row.terminal_reason);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants: RPC execution is service-role only (matches queue/retry writers).
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic(jsonb) from public;
revoke all on function public.record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic(jsonb) from anon;
revoke all on function public.record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic(jsonb) from authenticated;
grant execute on function public.record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic(jsonb) to service_role;

revoke all on function public.claim_held_recovery_reconstruction_work_atomic(text, integer) from public;
revoke all on function public.claim_held_recovery_reconstruction_work_atomic(text, integer) from anon;
revoke all on function public.claim_held_recovery_reconstruction_work_atomic(text, integer) from authenticated;
grant execute on function public.claim_held_recovery_reconstruction_work_atomic(text, integer) to service_role;

revoke all on function public.renew_held_recovery_reconstruction_lease_atomic(jsonb) from public;
revoke all on function public.renew_held_recovery_reconstruction_lease_atomic(jsonb) from anon;
revoke all on function public.renew_held_recovery_reconstruction_lease_atomic(jsonb) from authenticated;
grant execute on function public.renew_held_recovery_reconstruction_lease_atomic(jsonb) to service_role;

revoke all on function public.complete_held_recovery_reconstruction_work_atomic(jsonb) from public;
revoke all on function public.complete_held_recovery_reconstruction_work_atomic(jsonb) from anon;
revoke all on function public.complete_held_recovery_reconstruction_work_atomic(jsonb) from authenticated;
grant execute on function public.complete_held_recovery_reconstruction_work_atomic(jsonb) to service_role;

revoke all on function public.fail_held_recovery_reconstruction_work_atomic(jsonb) from public;
revoke all on function public.fail_held_recovery_reconstruction_work_atomic(jsonb) from anon;
revoke all on function public.fail_held_recovery_reconstruction_work_atomic(jsonb) from authenticated;
grant execute on function public.fail_held_recovery_reconstruction_work_atomic(jsonb) to service_role;

revoke all on function public.supersede_held_recovery_reconstruction_work_atomic(jsonb) from public;
revoke all on function public.supersede_held_recovery_reconstruction_work_atomic(jsonb) from anon;
revoke all on function public.supersede_held_recovery_reconstruction_work_atomic(jsonb) from authenticated;
grant execute on function public.supersede_held_recovery_reconstruction_work_atomic(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────────────────────────────────────

comment on table public.held_recovery_reconstruction_work_items is
  'Durable deterministic-follow-up work items for the resolve_anchor deferred_work (ANCHOR_RECONSTRUCTION_REQUIRED) path. One item per originating deferred attempt; immutable identity/version/payload columns. manuscript_id is canonical decimal TEXT (bigint fidelity; never numeric). This table does NOT schedule retries, invoke recovery, classify, or transition queue state; canonical re-admission and the row-locked queue transition remain separate authority-bearing steps. WORKER BOUNDARY: the reconstruction worker MUST NOT derive or persist producer, recovery action, admission result, classification result, queue destination, or final decision; it may only reconstruct canonical anchor authority and return it. Admission, classification, and the existing queue-transition RPC are the only components allowed to move a held item into another queue.';

comment on function public.record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic(jsonb) is
  'Transaction-owning atomic handoff: validates the result is exactly a permitted ANCHOR_RECONSTRUCTION_REQUIRED deferred_work continuation, then records the deferred attempt AND enqueues its paired reconstruction work item in ONE transaction (deferred attempt exists iff reconstruction item exists). manuscript_id carried verbatim as canonical decimal TEXT (never numeric coercion). Held-item-scoped advisory lock serializes competing continuations. Never derives producer/reason/recoveryAction/cardType/finalDecision/queue destination.';

comment on function public.claim_held_recovery_reconstruction_work_atomic(text, integer) is
  'Atomic claim-with-lease using FOR UPDATE SKIP LOCKED. Claims one pending item or one running item with an expired lease, flips it to running with a fresh claim_token in one statement, and returns the token (and manuscript_id as canonical decimal text). Work-item id alone does not authorize completion.';

comment on function public.renew_held_recovery_reconstruction_lease_atomic(jsonb) is
  'Extends the lease for a running item only when the exact claim_token matches and the lease is unexpired.';

comment on function public.complete_held_recovery_reconstruction_work_atomic(jsonb) is
  'Idempotent compare-and-set completion. Completes only when running, claim_token matches, lease unexpired, canonical manuscript/held-item versions still current, and no later attempt supersedes. Returns the authority/version (manuscript_id as canonical decimal text) for separate canonical re-admission + queue transition. Identical replay -> already_completed; conflicting replay -> idempotency_conflict. Does not manufacture finalDecision or cardType.';

comment on function public.fail_held_recovery_reconstruction_work_atomic(jsonb) is
  'Compare-and-set terminal failure for a running item holding the exact claim_token. Idempotent on replay.';

comment on function public.supersede_held_recovery_reconstruction_work_atomic(jsonb) is
  'Marks a non-terminal item superseded when canonical identity has moved (newer attempt, changed held-item/manuscript/queue authority version). Superseded is absorbing and never yields completion; does not require the claim token.';

commit;
