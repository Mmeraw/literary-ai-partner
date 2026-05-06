-- User display preferences for localized UI rendering.
-- Canonical storage, logs, governance timestamps, and audit trails remain UTC.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text,
  updated_at timestamptz not null default now(),

  constraint user_preferences_timezone_format check (
    timezone is null
    or timezone ~ '^[A-Za-z_]+/[A-Za-z0-9_+.-]+(/[A-Za-z0-9_+.-]+)?$'
  )
);

alter table public.user_preferences enable row level security;

create policy "Users can read their own preferences"
  on public.user_preferences
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_preferences_updated_at
  on public.user_preferences;

create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_user_preferences_updated_at();
