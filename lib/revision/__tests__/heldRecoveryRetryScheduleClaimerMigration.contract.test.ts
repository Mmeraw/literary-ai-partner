import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260718070000_create_held_recovery_retry_schedule_claim_lease_runtime.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

describe('held recovery retry schedule claim/lease migration contract', () => {
  it('extends the authoritative retry schedule table with lease fields only', () => {
    expect(sql).toContain('alter table public.held_recovery_retry_schedules')
    expect(sql).toContain('add column if not exists claimed_by text')
    expect(sql).toContain('add column if not exists claimed_at timestamptz')
    expect(sql).toContain('add column if not exists lease_token uuid')
    expect(sql).toContain('add column if not exists lease_until timestamptz')
    expect(sql).toContain('add column if not exists completed_at timestamptz')
    expect(sql).toContain('add column if not exists updated_at timestamptz')
    expect(sql).not.toMatch(/create table if not exists public\.held_recovery_retry_schedule_claims/i)
  })

  it('defines service-role-only atomic claim, renew, release, and complete RPCs', () => {
    expect(sql).toContain('create or replace function public.claim_held_recovery_retry_schedule_atomic')
    expect(sql).toContain('create or replace function public.renew_held_recovery_retry_schedule_lease_atomic')
    expect(sql).toContain('create or replace function public.release_held_recovery_retry_schedule_lease_atomic')
    expect(sql).toContain('create or replace function public.complete_held_recovery_retry_schedule_atomic')
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public')
    expect(sql).toContain('grant execute on function public.claim_held_recovery_retry_schedule_atomic(jsonb) to service_role')
    expect(sql).toContain('grant execute on function public.renew_held_recovery_retry_schedule_lease_atomic(jsonb) to service_role')
    expect(sql).toContain('grant execute on function public.release_held_recovery_retry_schedule_lease_atomic(jsonb) to service_role')
    expect(sql).toContain('grant execute on function public.complete_held_recovery_retry_schedule_atomic(jsonb) to service_role')
  })

  it('uses row-level locking and due eligibility inside the database claim operation', () => {
    expect(sql).toMatch(/from\s+public\.held_recovery_retry_schedules\s+s[\s\S]*where\s+s\.id\s*=\s*v_schedule_id[\s\S]*for update/i)
    expect(sql).toContain('v_schedule.retry_at > now()')
    expect(sql).toContain('retry_at_future')
    expect(sql).toMatch(/update\s+public\.held_recovery_retry_schedules[\s\S]*where\s+id\s*=\s+v_schedule_id/i)
  })

  it('enforces stale attempt, stale transition, and retryable queue-state checks at claim time', () => {
    expect(sql).toMatch(/select\s+a\.id::text\s+into\s+v_latest_attempt_id[\s\S]*from\s+public\.held_recovery_attempts\s+a/i)
    expect(sql).toMatch(/select\s+e\.id::text\s+into\s+v_latest_transition_event_id[\s\S]*from\s+public\.held_recovery_queue_transition_events\s+e/i)
    expect(sql).toContain('superseded_by_later_attempt_or_transition')
    expect(sql).toMatch(/select\s+q\.queue_state\s+into\s+v_queue_state[\s\S]*from\s+public\.held_recovery_queue_items\s+q/i)
    expect(sql).toContain('recovery_attempt_failed_retryable')
    expect(sql).toContain('rejected_state_mismatch')
  })

  it('proves active lease uniqueness, replay, expiry reclaim, and stale-owner rejection', () => {
    expect(sql).toContain('active_lease_owned_by_another_runtime')
    expect(sql).toContain("status', 'already_claimed")
    expect(sql).toContain('v_schedule.lease_until > now()')
    expect(sql).toContain('lease_conflict')
    expect(sql).toContain('stale_or_not_owner')
    expect(sql).toMatch(/where\s+id\s*=\s+v_schedule_id[\s\S]*and\s+claimed_by\s*=\s+v_claimed_by[\s\S]*and\s+lease_token\s*=\s+v_lease_token/i)
  })

  it('does not dispatch, execute recovery, add worker routes, or mutate downstream artifacts', () => {
    expect(sql).not.toMatch(/perform\s+.*dispatch|select\s+.*dispatch|execute_recovery|worker_route|create\s+cron|candidate_mutation|manuscript_mutation|final_review/i)
    expect(sql).not.toMatch(/update\s+public\.held_recovery_queue_items/i)
    expect(sql).not.toMatch(/insert\s+into\s+public\.held_recovery_queue_transition_events/i)
  })
})