import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260719120000_create_held_recovery_reconstruction_work.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

describe('held recovery reconstruction-work migration contract', () => {
  it('creates the dedicated reconstruction work-items table with RLS and a service-role read policy', () => {
    expect(sql).toContain(
      'create table if not exists public.held_recovery_reconstruction_work_items',
    )
    expect(sql).toContain(
      'alter table public.held_recovery_reconstruction_work_items enable row level security',
    )
    expect(sql).toContain('"Service role: read"')
    expect(sql).toContain('to service_role')
  })

  it('stores manuscript_id as canonical decimal TEXT — never bigint, never a numeric FK', () => {
    // The PR #1340 contract: a manuscripts.id can exceed 2^53, so persisting it as a
    // number (bigint here, or Number in JS) would silently corrupt identity.
    expect(sql).toMatch(/manuscript_id\s+text\s+not null/i)
    // The manuscript id column must NOT be a bigint...
    expect(sql).not.toMatch(/manuscript_id\s+bigint/i)
    // ...and must NOT carry a numeric FK to public.manuscripts.
    expect(sql).not.toMatch(/manuscript_id\s+bigint\s+not null\s+references\s+public\.manuscripts/i)
    expect(sql).not.toMatch(/manuscript_id[^\n]*references\s+public\.manuscripts/i)
  })

  it('enforces the canonical decimal shape of manuscript_id with a check constraint', () => {
    expect(sql).toMatch(
      /constraint\s+held_recovery_reconstruction_work_items_manuscript_id_canonical\s+check\s*\(\s*manuscript_id\s*~\s*'\^\(0\|\[1-9\]\[0-9\]\*\)\$'\s*\)/i,
    )
  })

  it('declares the immutable identity / version / continuation columns', () => {
    expect(sql).toMatch(/id\s+uuid\s+primary key\s+default\s+gen_random_uuid\(\)/i)
    expect(sql).toMatch(/originating_attempt_id\s+uuid\s+not null/i)
    expect(sql).toMatch(/references\s+public\.held_recovery_attempts\(id\)\s+on delete restrict/i)
    expect(sql).toMatch(/held_item_id\s+text\s+not null/i)
    expect(sql).toMatch(/opportunity_id\s+text\s+not null/i)
    expect(sql).toMatch(/manuscript_version_sha\s+text\s+not null/i)
    expect(sql).toMatch(/held_item_persisted_version\s+text\s+not null/i)
    expect(sql).toMatch(/source_hash\s+text\s+not null/i)
    expect(sql).toMatch(/source_start_offset\s+integer\s+not null/i)
    expect(sql).toMatch(/source_end_offset\s+integer\s+not null/i)
    expect(sql).toMatch(/check\s*\(\s*recovery_method\s*=\s*'source_text_location_only'\s*\)/i)
  })

  it('defines the six atomic handoff / lifecycle RPCs as SECURITY DEFINER functions', () => {
    for (const fn of [
      'record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic',
      'claim_held_recovery_reconstruction_work_atomic',
      'renew_held_recovery_reconstruction_lease_atomic',
      'complete_held_recovery_reconstruction_work_atomic',
      'fail_held_recovery_reconstruction_work_atomic',
      'supersede_held_recovery_reconstruction_work_atomic',
    ]) {
      expect(sql).toContain(`create or replace function public.${fn}`)
    }
    expect(sql).toMatch(/security definer/i)
  })

  it('claims atomically with FOR UPDATE SKIP LOCKED and returns manuscript_id verbatim (text)', () => {
    expect(sql).toMatch(/for update skip locked/i)
    // The claim + complete RPCs surface manuscript_id straight from the row (no cast).
    expect(sql).toMatch(/'manuscript_id',\s*v_claimed\.manuscript_id/i)
    expect(sql).toMatch(/'manuscript_id',\s*v_row\.manuscript_id/i)
    // There is no ::bigint (or numeric) cast applied to manuscript_id on any read/return path.
    expect(sql).not.toMatch(/v_(row|claimed)\.manuscript_id\s*::/i)
  })

  it('preserves the completion idempotency-conflict discriminator', () => {
    expect(sql).toContain("'status', 'idempotency_conflict'")
    expect(sql).toContain("'reason', 'completion_fingerprint_mismatch'")
  })

  it('grants RPC execution to service_role only', () => {
    for (const sig of [
      'record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic(jsonb)',
      'claim_held_recovery_reconstruction_work_atomic(text, integer)',
      'renew_held_recovery_reconstruction_lease_atomic(jsonb)',
      'complete_held_recovery_reconstruction_work_atomic(jsonb)',
      'fail_held_recovery_reconstruction_work_atomic(jsonb)',
      'supersede_held_recovery_reconstruction_work_atomic(jsonb)',
    ]) {
      expect(sql).toContain(`grant execute on function public.${sig} to service_role`)
    }
  })

  it('installs an immutable-column guard trigger that freezes manuscript_id', () => {
    expect(sql).toContain(
      'create or replace function public.held_recovery_reconstruction_work_items_guard()',
    )
    expect(sql).toMatch(/new\.manuscript_id\s*:=\s*old\.manuscript_id/i)
    expect(sql).toContain('before update on public.held_recovery_reconstruction_work_items')
  })

  it('enforces referential consistency between the work item and its originating attempt manuscript', () => {
    // Because the work-items table carries text (no numeric FK to manuscripts), the
    // originating_attempt_id FK only yields transitive manuscript existence if the work
    // item's manuscript_id equals the originating attempt's manuscript. The enqueue RPC
    // must assert that equality explicitly (rendering the attempt's bigint manuscript_id
    // as ::text) and fail the transaction on any mismatch.
    expect(sql).toMatch(/a\.manuscript_id::text/i)
    expect(sql).toMatch(
      /v_attempt_manuscript_id_text\s+is distinct from\s+v_new_item\.manuscript_id/i,
    )
    expect(sql).toMatch(/does not match originating attempt manuscript_id/i)
  })

  it('is forward-only and idempotent (safe to re-run)', () => {
    expect(sql).toContain('create table if not exists')
    expect(sql).toContain('create index if not exists')
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
  })
})
