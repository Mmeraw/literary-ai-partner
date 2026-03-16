begin;

alter table public.change_proposals
  add column if not exists anchor_start integer,
  add column if not exists anchor_end integer,
  add column if not exists anchor_context text;

create index if not exists idx_change_proposals_anchor_start
  on public.change_proposals(anchor_start);

create index if not exists idx_change_proposals_anchor_end
  on public.change_proposals(anchor_end);

comment on column public.change_proposals.anchor_start is
  '0-based character offset into the exact source text used when the proposal was generated.';

comment on column public.change_proposals.anchor_end is
  'Exclusive 0-based character offset into the exact source text used when the proposal was generated.';

comment on column public.change_proposals.anchor_context is
  'Short surrounding context captured at proposal-generation time for strict verification before apply.';

commit;
