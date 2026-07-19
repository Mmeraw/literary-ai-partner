import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260718090000_create_held_recovery_reconstructed_anchors.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

describe('held recovery reconstructed-anchor persistence migration contract', () => {
  it('creates a dedicated reconstructed-anchor authority table with RLS and a service-role-only policy', () => {
    expect(sql).toContain('create table if not exists public.held_recovery_reconstructed_anchors')
    expect(sql).toContain('alter table public.held_recovery_reconstructed_anchors enable row level security')
    expect(sql).toContain('"Service role: full access"')
    expect(sql).toContain('to service_role')
    expect(sql).toMatch(/for all\s+to service_role\s+using \(true\)\s+with check \(true\)/i)
  })

  it('declares the persisted authority columns from the merged reconstructed-anchor contract', () => {
    expect(sql).toMatch(/id\s+uuid\s+primary key\s+default\s+gen_random_uuid\(\)/i)
    expect(sql).toMatch(/held_item_id\s+text\s+not null/i)
    expect(sql).toMatch(/opportunity_id\s+text\s+not null/i)
    expect(sql).toMatch(/manuscript_version_sha\s+text\s+not null/i)
    expect(sql).toMatch(/held_item_persisted_version\s+text\s+not null/i)
    expect(sql).toMatch(/completion_fingerprint\s+text\s+not null/i)
    expect(sql).toMatch(/source_hash\s+text\s+not null/i)
    expect(sql).toMatch(/source_start_offset\s+integer\s+not null/i)
    expect(sql).toMatch(/source_end_offset\s+integer\s+not null/i)
    expect(sql).toMatch(/evidence_anchor\s+text\s+not null/i)
    expect(sql).toMatch(/manuscript_coordinates\s+text\s+not null/i)
    expect(sql).toMatch(/created_at\s+timestamptz\s+not null\s+default\s+now\(\)/i)
  })

  it('keys the manuscript foreign key to manuscripts with cascade delete', () => {
    expect(sql).toMatch(/manuscript_id\s+bigint\s+not null\s+references\s+public\.manuscripts\(id\)\s+on delete cascade/i)
  })

  it('enforces exactly one item-version authority constraint and persists the fingerprint without unique semantics', () => {
    // The one-authority-per-item-version invariant — the ONLY uniqueness constraint.
    expect(sql).toMatch(/unique\s*\(\s*held_item_id\s*,\s*held_item_persisted_version\s*\)/i)
    // completion_fingerprint is a required persisted value...
    expect(sql).toMatch(/completion_fingerprint\s+text\s+not null/i)
    // ...but carries NO uniqueness. It is not globally unique (the merged TS
    // authority contract does not guarantee global fingerprint namespacing)...
    expect(sql).not.toMatch(/unique\s*\(\s*completion_fingerprint\s*\)/i)
    expect(sql).not.toMatch(/completion_fingerprint\s+text\s+not null\s+unique/i)
    // ...and the redundant three-column fingerprint-scoped unique is absent: the
    // item-version constraint already rejects every second row in that scope, so
    // a three-column unique could never independently classify replay vs conflict.
    // Replay-versus-conflict is resolved by the later atomic RPC, not the schema.
    expect(sql).not.toMatch(/unique\s*\(\s*held_item_id\s*,\s*held_item_persisted_version\s*,\s*completion_fingerprint\s*\)/i)
  })

  it('enforces recovery-method allow-list, offset ordering, and non-empty reconstructed evidence', () => {
    expect(sql).toMatch(/check\s*\(\s*recovery_method\s*=\s*'source_text_location_only'\s*\)/i)
    expect(sql).toMatch(/check\s*\(\s*source_start_offset\s*>=\s*0\s*\)/i)
    expect(sql).toMatch(/check\s*\(\s*source_end_offset\s*>\s*source_start_offset\s*\)/i)
    expect(sql).toMatch(/check\s*\(\s*length\(btrim\(evidence_anchor\)\)\s*>\s*0\s*\)/i)
    expect(sql).toMatch(/check\s*\(\s*length\(btrim\(manuscript_coordinates\)\)\s*>\s*0\s*\)/i)
  })

  it('creates the read-path indexes required by later re-admission lookups', () => {
    expect(sql).toContain('create index if not exists idx_held_recovery_reconstructed_anchors_held_item_id')
    expect(sql).toContain('create index if not exists idx_held_recovery_reconstructed_anchors_opportunity_id')
    expect(sql).toContain('create index if not exists idx_held_recovery_reconstructed_anchors_manuscript_id')
    expect(sql).toContain('create index if not exists idx_held_recovery_reconstructed_anchors_created_at')
  })

  it('is forward-only and idempotent (safe to re-run on a populated database)', () => {
    expect(sql).toContain('create table if not exists')
    expect(sql).toContain('create index if not exists')
    expect(sql).toContain('drop policy if exists')
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
  })

  it('is table-only: no function, no CAS/stale-write logic, and no downstream mutation', () => {
    // This unit is the persistence substrate only. The atomic CAS insert RPC,
    // row lock, current-version comparison, and replay/conflict resolution
    // belong exclusively to the later separately-reviewed unit.
    expect(sql).not.toMatch(/create\s+or\s+replace\s+function/i)
    expect(sql).not.toMatch(/security definer/i)
    expect(sql).not.toMatch(/pg_advisory_xact_lock/i)
    expect(sql).not.toMatch(/for update/i)
    expect(sql).not.toMatch(/rejected_stale/i)
    // No coupling to or mutation of other held-recovery authorities.
    expect(sql).not.toContain('held_recovery_attempts')
    expect(sql).not.toContain('held_recovery_queue_items')
    expect(sql).not.toMatch(/retry_schedule|apply_held_recovery_queue_transition|final_review|candidate_mutation|manuscript_mutation/i)
  })
})
