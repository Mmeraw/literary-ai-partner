-- Gate A7: Report Shares table for secure, revocable share links
-- Fail-closed design: tokens are hashed, never stored plaintext

create table if not exists public.report_shares (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.evaluation_jobs(id) on delete cascade,
  artifact_type text not null default 'one_page_summary',

  -- Store only a hash (never store token plaintext)
  token_hash text not null,

  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  revoked_at timestamptz null,
  expires_at timestamptz null,

  -- optional counters (safe if you want lightweight metrics)
  last_viewed_at timestamptz null,
  view_count bigint not null default 0,

  constraint report_shares_token_hash_len check (char_length(token_hash) >= 32),
  constraint report_shares_artifact_type_nonempty check (char_length(artifact_type) > 0)
);

-- Unique token hash (fail-closed: no duplicate tokens)
create unique index if not exists report_shares_token_hash_uidx
  on public.report_shares(token_hash);

-- Query by job_id for owner list
create index if not exists report_shares_job_idx
  on public.report_shares(job_id);

-- Query by owner
create index if not exists report_shares_created_by_idx
  on public.report_shares(created_by);

-- Recommended: at most one active share per (job_id, artifact_type)
-- This prevents share link proliferation and simplifies revocation
create unique index if not exists report_shares_one_active_per_job_uidx
  on public.report_shares(job_id, artifact_type)
  where revoked_at is null;

-- Enable RLS (fail-closed by default)
alter table public.report_shares enable row level security;

-- Owner can insert (must own job)
create policy "report_shares_insert_owner_only"
  on public.report_shares
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.evaluation_jobs j
        join public.manuscripts m on m.id = j.manuscript_id
      where j.id = report_shares.job_id
        and m.user_id = auth.uid()
    )
  );

-- Owner can select their shares
create policy "report_shares_select_owner_only"
  on public.report_shares
  for select
  to authenticated
  using (created_by = auth.uid());

-- Owner can revoke/update their shares
create policy "report_shares_update_owner_only"
  on public.report_shares
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Important: Do NOT allow anon select on report_shares
-- Token validation happens server-side via admin client
