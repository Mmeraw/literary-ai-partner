/**
 * Real-PostgreSQL behavioral test for the atomic reconstructed-anchor insert RPC.
 *
 * Boots a disposable PostgreSQL cluster with initdb/pg_ctl (no root, no Docker,
 * private unix socket), applies the minimum authority substrate plus the merged
 * reconstructed-anchor table and the RPC-under-test migration, then drives every
 * deterministic outcome through the real function over a pg client.
 *
 * The test locates a PostgreSQL server binary set (initdb + pg_ctl + psql). If
 * none is available it self-skips, so environments without a local PostgreSQL
 * (e.g. plain CI runners) do not fail — the SQL-text contract test still guards
 * the migration shape there, and CI/Supabase provides the applied-DDL proof.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client } from 'pg'

function findPgBinDir(): string | null {
  const candidates: string[] = []
  for (const base of ['/usr/lib/postgresql', '/usr/local/lib/postgresql', '/opt/homebrew/opt']) {
    if (!fs.existsSync(base)) continue
    for (const entry of fs.readdirSync(base)) {
      candidates.push(path.join(base, entry, 'bin'))
      candidates.push(path.join(base, entry)) // homebrew layout
    }
  }
  candidates.push('/usr/bin', '/usr/local/bin')
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'initdb')) && fs.existsSync(path.join(dir, 'pg_ctl'))) {
      return dir
    }
  }
  return null
}

// Two run modes:
//   * External Postgres: when PG_BEHAVIORAL_URL is set, connect to it directly
//     (used by CI, which starts a real postgres service container). No initdb.
//   * Self-booted cluster: otherwise boot a disposable cluster via initdb/pg_ctl.
//
// Fail-not-skip contract: when REQUIRE_PG_BEHAVIORAL is set, a missing Postgres
// (no URL and no local server binary) is a hard failure instead of a skip, so an
// environment that is expected to provide Postgres cannot silently pass by
// skipping. Otherwise the suite self-skips where no Postgres is available.
const EXTERNAL_PG_URL = process.env.PG_BEHAVIORAL_URL ?? null
const PG_BIN = findPgBinDir()
const REQUIRE_PG = /^(1|true|yes)$/i.test(process.env.REQUIRE_PG_BEHAVIORAL ?? '')
const PG_AVAILABLE = Boolean(EXTERNAL_PG_URL) || Boolean(PG_BIN)

if (REQUIRE_PG && !PG_AVAILABLE) {
  throw new Error(
    'REQUIRE_PG_BEHAVIORAL is set but no PostgreSQL is available: set PG_BEHAVIORAL_URL to an external server or install a local PostgreSQL (initdb/pg_ctl).',
  )
}

const describeOrSkip = PG_AVAILABLE ? describe : describe.skip

const migrationsDir = path.join(process.cwd(), 'supabase/migrations')
const anchorTableSql = fs.readFileSync(
  path.join(migrationsDir, '20260718090000_create_held_recovery_reconstructed_anchors.sql'),
  'utf8',
)
const rpcSql = fs.readFileSync(
  path.join(migrationsDir, '20260718100000_create_held_recovery_reconstructed_anchor_insert_rpc.sql'),
  'utf8',
)

const HELD = 'held-item-behavioral-1'
const PV = 'persisted-version-A'
const AUTHORITY = 'authority-token-current'
const FP = 'fingerprint-original'

function anchorRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    held_item_id: HELD,
    held_item_persisted_version: PV,
    expected_authority_version: AUTHORITY,
    completion_fingerprint: FP,
    opportunity_id: 'opp-1',
    manuscript_id: 1,
    manuscript_version_sha: 'sha-1',
    recovery_method: 'source_text_location_only',
    source_hash: 'src-hash-1',
    source_start_offset: 0,
    source_end_offset: 10,
    evidence_anchor: 'anchor text',
    manuscript_coordinates: 'coords',
    ...overrides,
  }
}

describeOrSkip('held recovery reconstructed-anchor atomic insert RPC — behavioral', () => {
  let dataDir: string | null = null
  let sockDir: string | null = null
  const port = 55432
  let client: Client

  jest.setTimeout(120_000)

  async function callRpc(request: Record<string, unknown>): Promise<{ status: string }> {
    const res = await client.query(
      'select public.insert_held_recovery_reconstructed_anchor_atomic($1::jsonb) as result',
      [JSON.stringify(request)],
    )
    return res.rows[0].result
  }

  beforeAll(async () => {
    if (EXTERNAL_PG_URL) {
      client = new Client({ connectionString: EXTERNAL_PG_URL })
    } else {
      const bin = PG_BIN as string
      dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgrpc-data-'))
      sockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgrpc-sock-'))
      execFileSync(path.join(bin, 'initdb'), ['-D', dataDir, '-U', 'postgres', '--auth=trust'], {
        stdio: 'ignore',
      })
      spawnSync(
        path.join(bin, 'pg_ctl'),
        ['-D', dataDir, '-o', `-p ${port} -k ${sockDir} -c listen_addresses=''`, '-w', 'start'],
        { stdio: 'ignore' },
      )
      client = new Client({ host: sockDir, port, user: 'postgres', database: 'postgres' })
    }
    await client.connect()

    // Minimum authority substrate (scaffolding — not committed as schema).
    await client.query('create extension if not exists pgcrypto')
    // Supabase always provides these roles; the RPC migration's revoke/grant
    // statements reference them, so create them for the isolated cluster.
    for (const role of ['service_role', 'authenticated', 'anon']) {
      await client.query(
        `do $$ begin if not exists (select 1 from pg_roles where rolname='${role}') then create role ${role}; end if; end $$`,
      )
    }
    await client.query(
      'create table if not exists public.manuscripts (id bigint primary key generated always as identity)',
    )
    await client.query('insert into public.manuscripts default values')
    await client.query(`create table if not exists public.held_recovery_queue_items (
        held_item_id text primary key,
        queue_state text not null,
        authority_version text not null,
        last_transition_idempotency_key text null,
        updated_at timestamptz not null default now(),
        created_at timestamptz not null default now())`)

    // Apply the merged anchor table and the RPC-under-test exactly as committed.
    await client.query(anchorTableSql)
    await client.query(rpcSql)
  })

  afterAll(async () => {
    if (client) await client.end().catch(() => undefined)
    if (dataDir && PG_BIN) {
      spawnSync(path.join(PG_BIN, 'pg_ctl'), ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], {
        stdio: 'ignore',
      })
      fs.rmSync(dataDir, { recursive: true, force: true })
    }
    if (sockDir) fs.rmSync(sockDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await client.query('delete from public.held_recovery_reconstructed_anchors')
    await client.query('delete from public.held_recovery_queue_items')
  })

  async function seedQueue(authority = AUTHORITY): Promise<void> {
    await client.query(
      "insert into public.held_recovery_queue_items (held_item_id, queue_state, authority_version) values ($1, 'recovered_pending_reclassification', $2)",
      [HELD, authority],
    )
  }

  it('inserts exactly one authority row on the current, absent path', async () => {
    await seedQueue()
    const out = await callRpc(anchorRequest())
    expect(out.status).toBe('inserted')
    const count = await client.query(
      'select count(*)::int as n from public.held_recovery_reconstructed_anchors where held_item_id=$1',
      [HELD],
    )
    expect(count.rows[0].n).toBe(1)
  })

  it('returns already_applied on identical replay (same fingerprint)', async () => {
    await seedQueue()
    expect((await callRpc(anchorRequest())).status).toBe('inserted')
    // Even after a later queue transition (authority moved), identical replay
    // must still resolve as already_applied — replay is checked before stale.
    await client.query(
      'update public.held_recovery_queue_items set authority_version=$2 where held_item_id=$1',
      [HELD, 'authority-token-moved'],
    )
    const out = await callRpc(anchorRequest({ expected_authority_version: AUTHORITY }))
    expect(out.status).toBe('already_applied')
    const count = await client.query(
      'select count(*)::int as n from public.held_recovery_reconstructed_anchors where held_item_id=$1',
      [HELD],
    )
    expect(count.rows[0].n).toBe(1)
  })

  it('returns rejected_conflict on a differing-fingerprint replay', async () => {
    await seedQueue()
    expect((await callRpc(anchorRequest())).status).toBe('inserted')
    const out = await callRpc(anchorRequest({ completion_fingerprint: 'fingerprint-different' }))
    expect(out.status).toBe('rejected_conflict')
    const count = await client.query(
      'select count(*)::int as n from public.held_recovery_reconstructed_anchors where held_item_id=$1',
      [HELD],
    )
    expect(count.rows[0].n).toBe(1)
  })

  it('returns rejected_stale when the queue authority version has moved and no row exists', async () => {
    await seedQueue('authority-token-moved')
    const out = await callRpc(anchorRequest({ expected_authority_version: AUTHORITY }))
    expect(out.status).toBe('rejected_stale')
    const count = await client.query(
      'select count(*)::int as n from public.held_recovery_reconstructed_anchors where held_item_id=$1',
      [HELD],
    )
    expect(count.rows[0].n).toBe(0)
  })

  it('returns rejected_missing (never stale) when the queue authority row is absent', async () => {
    // No seedQueue — the held item has no queue authority row.
    const out = await callRpc(anchorRequest())
    expect(out.status).toBe('rejected_missing')
    const count = await client.query(
      'select count(*)::int as n from public.held_recovery_reconstructed_anchors where held_item_id=$1',
      [HELD],
    )
    expect(count.rows[0].n).toBe(0)
  })

  it('does not let anon or authenticated roles execute the RPC', async () => {
    for (const role of ['anon', 'authenticated']) {
      await client.query('begin')
      // set local role only takes effect inside an explicit transaction.
      await client.query(`set local role ${role}`)
      await expect(
        client.query('select public.insert_held_recovery_reconstructed_anchor_atomic($1::jsonb)', [
          JSON.stringify(anchorRequest()),
        ]),
      ).rejects.toThrow(/permission denied/i)
      await client.query('rollback')
    }
  })
})
