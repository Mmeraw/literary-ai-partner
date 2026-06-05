-- CostOps revenue and document generation ledgers
-- Admin-only reads; writes are expected from service-role server endpoints/webhooks.

create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('stripe', 'manual', 'internal_checkout')),
  event_type text not null check (event_type in ('checkout_completed', 'payment_succeeded', 'refund', 'dispute_created', 'manual_adjustment')),
  stripe_event_id text unique,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  user_id uuid,
  job_id uuid,
  manuscript_id uuid,
  product_code text,
  tier text,
  gross_revenue_cents integer not null default 0,
  stripe_fee_cents integer not null default 0,
  refund_cents integer not null default 0,
  net_revenue_cents integer generated always as (gross_revenue_cents - stripe_fee_cents - refund_cents) stored,
  currency text not null default 'usd',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists revenue_events_created_at_idx on public.revenue_events (created_at desc);
create index if not exists revenue_events_job_id_idx on public.revenue_events (job_id);
create index if not exists revenue_events_manuscript_id_idx on public.revenue_events (manuscript_id);
create index if not exists revenue_events_source_idx on public.revenue_events (source, event_type);

alter table public.revenue_events enable row level security;

drop policy if exists revenue_events_no_client_access on public.revenue_events;
create policy revenue_events_no_client_access on public.revenue_events
  for all
  using (false)
  with check (false);

create table if not exists public.document_generation_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid,
  manuscript_id uuid,
  event_type text not null check (event_type in ('pdf_export', 'word_export', 'txt_export', 'other_export')),
  cost_cents integer not null default 0,
  estimated boolean not null default false,
  provider text,
  detail text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists document_generation_events_created_at_idx on public.document_generation_events (created_at desc);
create index if not exists document_generation_events_job_id_idx on public.document_generation_events (job_id);
create index if not exists document_generation_events_manuscript_id_idx on public.document_generation_events (manuscript_id);

alter table public.document_generation_events enable row level security;

drop policy if exists document_generation_events_no_client_access on public.document_generation_events;
create policy document_generation_events_no_client_access on public.document_generation_events
  for all
  using (false)
  with check (false);
