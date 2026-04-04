-- User activity history (cross-device)
-- Purpose: Persist user-facing activity events so users can revisit prior actions.

create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  detail text,
  route text,
  href text,
  link_label text,
  created_at timestamptz not null default now(),

  constraint fk_user_activity_user
    foreign key (user_id)
    references auth.users(id)
    on delete cascade,

  constraint chk_user_activity_event_type_nonempty
    check (char_length(trim(event_type)) > 0)
);

create index if not exists idx_user_activity_events_user_created
  on public.user_activity_events(user_id, created_at desc);

alter table public.user_activity_events enable row level security;

-- Users can read only their own activity.
drop policy if exists user_activity_events_select_own on public.user_activity_events;
create policy user_activity_events_select_own
  on public.user_activity_events
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert only their own activity.
drop policy if exists user_activity_events_insert_own on public.user_activity_events;
create policy user_activity_events_insert_own
  on public.user_activity_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can delete only their own activity (for history clear action).
drop policy if exists user_activity_events_delete_own on public.user_activity_events;
create policy user_activity_events_delete_own
  on public.user_activity_events
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.user_activity_events is
'User-facing activity history for cross-device revisit actions.';
