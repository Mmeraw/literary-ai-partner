-- Phase 2.1 Anchor Metadata Contract
-- Canonical anchor fields for deterministic location-aware apply.

begin;

alter table public.change_proposals
  add column if not exists start_offset integer,
  add column if not exists end_offset integer,
  add column if not exists before_context text not null default '',
  add column if not exists after_context text not null default '',
  add column if not exists anchor_text_normalized text,
  add column if not exists anchor_version text not null default 'v1';

-- Backfill from legacy anchor columns when present.
update public.change_proposals
set
  start_offset = coalesce(start_offset, anchor_start),
  end_offset = coalesce(end_offset, anchor_end),
  before_context = coalesce(before_context, ''),
  after_context = coalesce(after_context, ''),
  anchor_text_normalized = coalesce(anchor_text_normalized, nullif(trim(regexp_replace(original_text, '\\s+', ' ', 'g')), ''))
where
  start_offset is null
  or end_offset is null
  or before_context is null
  or after_context is null
  or anchor_text_normalized is null;

create index if not exists idx_change_proposals_start_offset
  on public.change_proposals(start_offset);

create index if not exists idx_change_proposals_end_offset
  on public.change_proposals(end_offset);

-- NOT VALID enforces for new writes immediately while allowing safe rollout
-- even if legacy rows remain and need remediation.
alter table public.change_proposals
  add constraint change_proposals_anchor_contract_required
    check (
      start_offset is not null
      and end_offset is not null
      and before_context is not null
      and after_context is not null
    ) not valid,
  add constraint change_proposals_start_offset_nonnegative
    check (start_offset >= 0) not valid,
  add constraint change_proposals_end_offset_gt_start
    check (end_offset > start_offset) not valid;

comment on column public.change_proposals.start_offset is
  '0-based character start offset into source text used for deterministic apply.';

comment on column public.change_proposals.end_offset is
  'Exclusive 0-based character end offset into source text used for deterministic apply.';

comment on column public.change_proposals.before_context is
  'Deterministic context window immediately before start_offset.';

comment on column public.change_proposals.after_context is
  'Deterministic context window immediately after end_offset.';

comment on column public.change_proposals.anchor_text_normalized is
  'Whitespace-normalized anchor text derived from source_text.slice(start_offset, end_offset).';

comment on column public.change_proposals.anchor_version is
  'Anchor metadata version tag for forward-compatible anchor evolution.';

commit;
