# Stage 2 Anchored Telemetry SQL (2026-03-16)

## Anchor coverage rate

select
  date_trunc('day', created_at) as day,
  count(*) filter (where event_code = 'PROPOSAL_GENERATED') as proposals_generated,
  count(*) filter (where event_code = 'PROPOSAL_ANCHOR_CREATED') as anchors_created,
  round(
    100.0 * count(*) filter (where event_code = 'PROPOSAL_ANCHOR_CREATED')
    / nullif(count(*) filter (where event_code = 'PROPOSAL_GENERATED'), 0),
    2
  ) as anchor_coverage_rate
from public.revision_events
group by 1
order by 1 desc;

## Finalize success rate

select
  date_trunc('day', created_at) as day,
  count(*) filter (where event_code = 'REVISION_SESSION_FINALIZED') as finalized,
  count(*) filter (where event_code = 'REVISION_SESSION_FINALIZE_FAILED') as finalize_failed,
  round(
    100.0 * count(*) filter (where event_code = 'REVISION_SESSION_FINALIZED')
    / nullif(
      count(*) filter (
        where event_code in ('REVISION_SESSION_FINALIZED', 'REVISION_SESSION_FINALIZE_FAILED')
      ),
      0
    ),
    2
  ) as finalize_success_rate
from public.revision_events
group by 1
order by 1 desc;

## Failure breakdown

select
  event_code,
  count(*) as total
from public.revision_events
where severity in ('warn', 'error', 'critical')
group by event_code
order by total desc;

## Source immutability monitor

select
  count(*) filter (where event_code = 'SOURCE_IMMUTABLE_CONFIRMED') as immutable_confirmed,
  count(*) filter (where event_code = 'SOURCE_IMMUTABILITY_VIOLATION') as immutability_violations,
  round(
    100.0 * count(*) filter (where event_code = 'SOURCE_IMMUTABLE_CONFIRMED')
    / nullif(
      count(*) filter (
        where event_code in ('SOURCE_IMMUTABLE_CONFIRMED', 'SOURCE_IMMUTABILITY_VIOLATION')
      ),
      0
    ),
    2
  ) as source_unchanged_rate
from public.revision_events;

## Legacy fallback rate

select
  date_trunc('day', created_at) as day,
  count(*) filter (where event_code = 'APPLY_LEGACY_FALLBACK_SUCCESS') as legacy_success,
  count(*) filter (where event_code = 'APPLY_ANCHORED_SUCCESS') as anchored_success,
  round(
    100.0 * count(*) filter (where event_code = 'APPLY_LEGACY_FALLBACK_SUCCESS')
    / nullif(
      count(*) filter (
        where event_code in ('APPLY_LEGACY_FALLBACK_SUCCESS', 'APPLY_ANCHORED_SUCCESS')
      ),
      0
    ),
    2
  ) as legacy_fallback_rate
from public.revision_events
group by 1
order by 1 desc;

## Worst manuscripts

select
  manuscript_id,
  count(*) filter (where severity in ('error', 'critical')) as failures,
  count(*) filter (where event_code = 'PROPOSAL_GENERATED') as proposals_generated,
  count(*) filter (where event_code = 'PROPOSAL_ANCHOR_CREATED') as anchors_created
from public.revision_events
where manuscript_id is not null
group by manuscript_id
order by failures desc
limit 20;
