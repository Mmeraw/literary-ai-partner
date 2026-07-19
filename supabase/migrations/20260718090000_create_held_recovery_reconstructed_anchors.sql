begin;

-- Held Recovery reconstructed-anchor persistence substrate.
--
-- This migration is TABLE-ONLY. It provides durable, immutable, version-scoped
-- authority storage for reconstructed anchor content. It deliberately does NOT
-- implement compare-and-set, row locking, current-version comparison, or
-- stale-write rejection: this table cannot read or lock the live held-item
-- authority row, so it cannot judge whether held_item_persisted_version is
-- still current. That behavior belongs exclusively to a later, separately
-- reviewed atomic insert RPC, which will own the row lock, current-version
-- comparison, insert, and deterministic replay/conflict resolution in one
-- transaction. No function, adapter, caller, queue/attempt mutation, worker,
-- or re-admission wiring is introduced here.
--
-- Replay-versus-conflict is NOT distinguishable by this schema. The single
-- one-authority-per-item-version constraint rejects every second row in an
-- item-version scope regardless of fingerprint, so it can never classify an
-- identical replay against a conflicting completion. completion_fingerprint is
-- persisted as a required value so the later atomic RPC can read the existing
-- row under lock and compare the stored fingerprint against the submitted one:
-- an equal fingerprint is an idempotent replay, an unequal fingerprint is a
-- conflict, and (against the live held-item authority) a matching current
-- version with no existing row inserts while an out-of-date current version is
-- refused. Those decision outcomes are the RPC's exclusive responsibility, not
-- the table's; this migration introduces none of that logic.

create table if not exists public.held_recovery_reconstructed_anchors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  held_item_id text not null,
  opportunity_id text not null,
  manuscript_id bigint not null references public.manuscripts(id) on delete cascade,
  manuscript_version_sha text not null,
  held_item_persisted_version text not null,
  completion_fingerprint text not null,

  recovery_method text not null check (recovery_method = 'source_text_location_only'),
  source_hash text not null,
  source_start_offset integer not null check (source_start_offset >= 0),
  source_end_offset integer not null check (source_end_offset > source_start_offset),
  evidence_anchor text not null check (length(btrim(evidence_anchor)) > 0),
  manuscript_coordinates text not null check (length(btrim(manuscript_coordinates)) > 0),

  -- One authoritative reconstructed anchor per (held item, persisted version).
  -- This is the item-version authority invariant the later re-admission read
  -- path depends on. It is the ONLY uniqueness constraint on this table: it
  -- already rejects every second row in an item-version scope, so no further
  -- fingerprint-scoped uniqueness could add independent meaning. The
  -- completion_fingerprint is intentionally NOT globally unique (the merged
  -- TypeScript authority contract does not establish a globally namespaced,
  -- collision-proof fingerprint), and it is intentionally NOT part of any
  -- uniqueness key here — replay-versus-conflict is resolved by the later
  -- atomic RPC via a locked read-and-compare, not by this schema.
  constraint held_recovery_reconstructed_anchors_item_version_authority
    unique (held_item_id, held_item_persisted_version)
);

alter table public.held_recovery_reconstructed_anchors enable row level security;

drop policy if exists "Service role: full access" on public.held_recovery_reconstructed_anchors;
create policy "Service role: full access"
  on public.held_recovery_reconstructed_anchors
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists idx_held_recovery_reconstructed_anchors_held_item_id
  on public.held_recovery_reconstructed_anchors(held_item_id);

create index if not exists idx_held_recovery_reconstructed_anchors_opportunity_id
  on public.held_recovery_reconstructed_anchors(opportunity_id);

create index if not exists idx_held_recovery_reconstructed_anchors_manuscript_id
  on public.held_recovery_reconstructed_anchors(manuscript_id);

create index if not exists idx_held_recovery_reconstructed_anchors_created_at
  on public.held_recovery_reconstructed_anchors(created_at);

comment on table public.held_recovery_reconstructed_anchors is
  'Durable, immutable, version-scoped authority storage for Held Recovery reconstructed anchor content. Write-once per (held_item_id, held_item_persisted_version), enforced by the single item-version unique constraint. This table is the persistence substrate only: it does not perform compare-and-set, row locking, current-version comparison, stale-write rejection, or replay-versus-conflict classification (the later atomic RPC reads the existing row under lock and compares completion_fingerprint: an equal fingerprint is an idempotent replay, an unequal fingerprint is a conflict). It does not drive queue transitions, retry scheduling, attempt mutation, candidate persistence, manuscript mutation, re-admission, or Final Review.';

commit;
