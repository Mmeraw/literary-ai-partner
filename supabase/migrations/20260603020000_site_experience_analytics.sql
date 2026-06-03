-- Site Experience Analytics
-- Privacy-safe first-party telemetry for admin-only product analytics.
-- Do not store manuscript text, pasted text, query letters, synopses, report prose, or editor contents.

create extension if not exists pgcrypto;

create table if not exists public.site_analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text not null,
  user_id uuid null,
  user_email text null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz null,
  landing_path text null,
  referrer text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  device_type text null,
  browser text null,
  os text null,
  country text null,
  region text null,
  city text null,
  timezone text null,
  is_admin_traffic boolean not null default false,
  is_bot boolean not null default false
);

create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.site_analytics_sessions(id) on delete cascade,
  anonymous_id text not null,
  user_id uuid null,
  event_name text not null,
  path text not null,
  page_title text null,
  occurred_at timestamptz not null default now(),
  duration_ms integer null,
  target text null,
  metadata jsonb not null default '{}'::jsonb,
  is_admin_traffic boolean not null default false,
  is_bot boolean not null default false,
  constraint site_analytics_event_name_reasonable check (length(event_name) between 2 and 96),
  constraint site_analytics_path_reasonable check (length(path) between 1 and 2048)
);

create index if not exists site_analytics_events_occurred_at_idx
  on public.site_analytics_events (occurred_at desc);

create index if not exists site_analytics_events_event_name_occurred_at_idx
  on public.site_analytics_events (event_name, occurred_at desc);

create index if not exists site_analytics_events_path_occurred_at_idx
  on public.site_analytics_events (path, occurred_at desc);

create index if not exists site_analytics_sessions_started_at_idx
  on public.site_analytics_sessions (started_at desc);

create index if not exists site_analytics_sessions_country_started_at_idx
  on public.site_analytics_sessions (country, started_at desc);

create index if not exists site_analytics_sessions_anon_last_seen_idx
  on public.site_analytics_sessions (anonymous_id, last_seen_at desc);

alter table public.site_analytics_sessions enable row level security;
alter table public.site_analytics_events enable row level security;

-- Browser clients do not read these tables directly. Server routes use the service role.
revoke all on public.site_analytics_sessions from anon, authenticated;
revoke all on public.site_analytics_events from anon, authenticated;

comment on table public.site_analytics_sessions is
  'Privacy-safe site experience sessions. No manuscript, editor, pasted, query, synopsis, or report text.';

comment on table public.site_analytics_events is
  'Privacy-safe site experience events. Metadata must be sanitized and allowlisted by server route.';
