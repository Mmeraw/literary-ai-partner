import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260718100000_create_held_recovery_reconstructed_anchor_insert_rpc.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

describe('held recovery reconstructed-anchor atomic insert RPC migration contract', () => {
  it('defines a service-role-only, security-definer atomic insert RPC', () => {
    expect(sql).toContain(
      'create or replace function public.insert_held_recovery_reconstructed_anchor_atomic',
    )
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public')
    expect(sql).toContain(
      'revoke all on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) from public',
    )
    expect(sql).toContain(
      'revoke all on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) from authenticated',
    )
    expect(sql).toContain(
      'revoke all on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) from anon',
    )
    expect(sql).toContain(
      'grant execute on function public.insert_held_recovery_reconstructed_anchor_atomic(jsonb) to service_role',
    )
  })

  it('locks the live held-item queue authority row under the shared held-item advisory namespace', () => {
    // Same held-item advisory-lock namespace used by the queue transition writer:
    // the primary key is hashtext(held_item_id).
    expect(sql).toContain('perform pg_advisory_xact_lock')
    expect(sql).toMatch(/pg_advisory_xact_lock\(\s*hashtext\(v_held_item_id\)/i)
    // Locks the queue authority row (not the attempts audit log).
    expect(sql).toMatch(
      /select\s+authority_version[\s\S]*from\s+public\.held_recovery_queue_items[\s\S]*where\s+held_item_id\s*=\s*v_held_item_id[\s\S]*for update/i,
    )
  })

  it('never compares held_item_persisted_version against authority_version', () => {
    // The persisted version and the queue CAS token are different value spaces.
    // The stale check compares expected_authority_version to the queue authority
    // version ONLY. Guard against a category-error direct comparison.
    expect(sql).not.toMatch(/held_item_persisted_version[\s\S]{0,40}=\s*[\s\S]{0,40}authority_version/i)
    expect(sql).not.toMatch(/authority_version[\s\S]{0,40}=\s*[\s\S]{0,40}held_item_persisted_version/i)
  })

  it('reads the existing reconstructed-anchor row keyed by (held_item_id, held_item_persisted_version)', () => {
    expect(sql).toMatch(
      /from\s+public\.held_recovery_reconstructed_anchors[\s\S]*where\s+held_item_id\s*=\s*v_held_item_id[\s\S]*held_item_persisted_version\s*=\s*v_held_item_persisted_version/i,
    )
  })

  it('classifies replay versus conflict by completion_fingerprint before evaluating staleness', () => {
    // Replay/conflict is decided from the existing anchor row's fingerprint.
    expect(sql).toContain('already_applied')
    expect(sql).toContain('rejected_conflict')
    expect(sql).toMatch(/completion_fingerprint\s+is distinct from\s+v_completion_fingerprint/i)
  })

  it('rejects a missing queue authority row as rejected_missing, never as stale', () => {
    expect(sql).toContain('rejected_missing')
    // A missing queue row must not be collapsed into the stale outcome: the
    // absent-queue branch resolves to rejected_missing and returns before the
    // staleness comparison is ever reached.
    expect(sql).toMatch(/if not v_queue_found then[\s\S]{0,200}rejected_missing/i)
  })

  it('compares expected_authority_version to the queue authority version only when inserting', () => {
    expect(sql).toContain('rejected_stale')
    expect(sql).toMatch(
      /v_current_authority_version\s+is distinct from\s+v_expected_authority_version/i,
    )
  })

  it('inserts exactly one authority row and returns inserted on the current, absent path', () => {
    expect(sql).toContain('inserted')
    expect(sql).toMatch(/insert\s+into\s+public\.held_recovery_reconstructed_anchors/i)
  })

  it('uses only the five deterministic outcome tokens', () => {
    const outcomes = ['inserted', 'already_applied', 'rejected_conflict', 'rejected_stale', 'rejected_missing']
    for (const token of outcomes) {
      expect(sql).toContain(`'${token}'`)
    }
  })

  it('does not mutate queue, attempts, candidate, manuscript, or re-admission substrate', () => {
    expect(sql).not.toMatch(/update\s+public\.held_recovery_queue_items/i)
    expect(sql).not.toMatch(/insert\s+into\s+public\.held_recovery_queue_transition_events/i)
    expect(sql).not.toMatch(/update\s+public\.held_recovery_attempts/i)
    expect(sql).not.toMatch(/insert\s+into\s+public\.held_recovery_attempts/i)
    // No feature flag, no new table.
    expect(sql).not.toMatch(/create\s+table/i)
  })
})
