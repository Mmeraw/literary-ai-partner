import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260718050000_create_held_recovery_retry_schedule_writer.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

describe('held recovery retry schedule writer migration contract', () => {
  it('creates a dedicated retry schedule authority with service-role RLS', () => {
    expect(sql).toContain('create table if not exists public.held_recovery_retry_schedules')
    expect(sql).toContain('alter table public.held_recovery_retry_schedules enable row level security')
    expect(sql).toContain('to service_role')
    expect(sql).not.toContain('create table if not exists public.evaluation_jobs')
  })

  it('defines a service-role-only atomic schedule RPC', () => {
    expect(sql).toContain('create or replace function public.apply_held_recovery_retry_schedule_atomic')
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public')
    expect(sql).toContain('revoke all on function public.apply_held_recovery_retry_schedule_atomic(jsonb) from public')
    expect(sql).toContain('grant execute on function public.apply_held_recovery_retry_schedule_atomic(jsonb) to service_role')
  })

  it('verifies the decision is still current before writing and rejects stale decisions', () => {
    expect(sql).toMatch(/select\s+a\.id::text\s+into\s+v_latest_attempt_id[\s\S]*from\s+public\.held_recovery_attempts\s+a[\s\S]*where\s+a\.held_item_id\s*=\s*v_held_item_id/i)
    expect(sql).toMatch(/select\s+e\.id::text\s+into\s+v_latest_transition_event_id[\s\S]*from\s+public\.held_recovery_queue_transition_events\s+e[\s\S]*where\s+e\.held_item_id\s*=\s*v_held_item_id/i)
    expect(sql).toContain('status\', \'rejected_stale')
    expect(sql).toContain('superseded_by_later_attempt_or_transition')
  })

  it('classifies duplicate idempotency strictly and fails closed on conflicting key reuse', () => {
    expect(sql).toContain('where s.schedule_idempotency_key = v_schedule_idempotency_key')
    expect(sql).toContain('status\', \'already_scheduled')
    expect(sql).toContain('status\', \'persistence_failed')
    expect(sql).toContain('idempotency_conflict')
  })

  it('does not claim schedules, execute retries, or mutate downstream artifacts', () => {
    expect(sql).not.toMatch(/claim_due|dispatch|execute_recovery|candidate_mutation|manuscript_mutation|final_review/i)
    expect(sql).not.toMatch(/update\s+public\.held_recovery_queue_items/i)
    expect(sql).not.toMatch(/insert\s+into\s+public\.held_recovery_queue_transition_events/i)
    expect(sql).toContain('does not execute retries')
  })
})