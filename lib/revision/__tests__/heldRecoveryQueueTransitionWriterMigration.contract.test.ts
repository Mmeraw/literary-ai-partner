import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260718033000_create_held_recovery_queue_transition_writer.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

describe('held recovery queue transition writer migration contract', () => {
  it('creates a dedicated queue-state authority and transition audit substrate with RLS', () => {
    expect(sql).toContain('create table if not exists public.held_recovery_queue_items')
    expect(sql).toContain('create table if not exists public.held_recovery_queue_transition_events')
    expect(sql).toContain('alter table public.held_recovery_queue_items enable row level security')
    expect(sql).toContain('alter table public.held_recovery_queue_transition_events enable row level security')
    expect(sql).toContain('to service_role')
    expect(sql).not.toContain('held_recovery_attempts')
  })

  it('defines a service-role-only atomic compare-and-set RPC', () => {
    expect(sql).toContain('create or replace function public.apply_held_recovery_queue_transition_atomic')
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public')
    expect(sql).toContain('revoke all on function public.apply_held_recovery_queue_transition_atomic(jsonb) from public')
    expect(sql).toContain('grant execute on function public.apply_held_recovery_queue_transition_atomic(jsonb) to service_role')
  })

  it('persists state and provenance atomically using the declared from, to, and authority versions', () => {
    expect(sql).toContain('perform pg_advisory_xact_lock')
    expect(sql).toContain('hashtext(v_transition_idempotency_key)')
    expect(sql).toMatch(/update\s+public\.held_recovery_queue_items[\s\S]*set\s+queue_state\s*=\s*v_to_state[\s\S]*authority_version\s*=\s*v_next_authority_version[\s\S]*where\s+held_item_id\s*=\s*v_held_item_id[\s\S]*and\s+queue_state\s*=\s*v_from_state[\s\S]*and\s+authority_version\s*=\s*v_decision_authority_version/i)
    expect(sql).toMatch(/insert\s+into\s+public\.held_recovery_queue_transition_events[\s\S]*transition_idempotency_key[\s\S]*from_state[\s\S]*to_state[\s\S]*decision_authority_version[\s\S]*next_authority_version/i)
  })

  it('classifies duplicates only after verifying the existing event matches the requested transition', () => {
    expect(sql).toContain('v_existing_event public.held_recovery_queue_transition_events%rowtype')
    expect(sql).toContain('status\', \'already_applied')
    expect(sql).toContain('v_existing_event.held_item_id is distinct from v_held_item_id')
    expect(sql).toContain('v_existing_event.decision_authority_version is distinct from v_decision_authority_version')
  })

  it('does not schedule retries or mutate downstream artifacts', () => {
    expect(sql).not.toMatch(/retry_schedule|schedule_retry|candidate_mutation|manuscript_mutation|final_review/i)
    expect(sql).toContain('does not schedule retries')
  })
})