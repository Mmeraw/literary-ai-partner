/**
 * Real-PostgreSQL behavioral test for the Held Recovery manuscript_chunks read RPC.
 *
 * Boots a disposable PostgreSQL cluster with initdb/pg_ctl (no root, no Docker,
 * private unix socket), creates a manuscript_chunks table whose manuscript_id is
 * a real bigint, seeds a chunk whose manuscript_id EXCEEDS 2^53, then calls the
 * RPC-under-test over a pg client and asserts the returned manuscript_id_text is
 * the exact canonical integer string — proving the bigint identity survives the
 * read boundary without IEEE-754 precision loss.
 *
 * The same test also demonstrates the failure mode the RPC exists to prevent: if
 * the same bigint is read back as a numeric column through the pg driver's default
 * (JS number) parser, it is silently rounded. That contrast is what makes the
 * ::text projection load-bearing rather than cosmetic.
 *
 * The test locates a PostgreSQL server binary set (initdb + pg_ctl). If none is
 * available it self-skips, so environments without a local PostgreSQL do not fail
 * — the SQL-text contract test still guards the migration shape there, and
 * CI/Supabase provides the applied-DDL proof. When REQUIRE_PG_BEHAVIORAL is set,
 * a missing PostgreSQL is a hard failure instead of a skip.
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
const readRpcSql = fs.readFileSync(
  path.join(migrationsDir, '20260719040000_create_held_recovery_manuscript_chunks_read_rpc.sql'),
  'utf8',
)

// Max signed 64-bit integer — the largest legal bigint. Far beyond 2^53, so a
// JS number cannot represent it exactly.
const BIG_MANUSCRIPT_ID = '9223372036854775807'
// A neighbouring bigint that COLLIDES with the one above once coerced to a JS
// number (both round to 9223372036854775808). Used to prove per-row fidelity.
const NEIGHBOUR_MANUSCRIPT_ID = '9223372036854775806'

describeOrSkip('held recovery manuscript_chunks read RPC — behavioral', () => {
  let dataDir: string | null = null
  let sockDir: string | null = null
  const port = 55433
  let client: Client

  jest.setTimeout(120_000)

  beforeAll(async () => {
    if (EXTERNAL_PG_URL) {
      client = new Client({ connectionString: EXTERNAL_PG_URL })
    } else {
      const bin = PG_BIN as string
      dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgread-data-'))
      sockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgread-sock-'))
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

    await client.query('create extension if not exists pgcrypto')
    for (const role of ['service_role', 'authenticated', 'anon']) {
      await client.query(
        `do $$ begin if not exists (select 1 from pg_roles where rolname='${role}') then create role ${role}; end if; end $$`,
      )
    }

    // manuscript_chunks with a real bigint manuscript_id, mirroring production
    // after 20260129000000_fix_manuscript_chunks_fk_type. Only the columns the
    // read RPC selects are required for this proof.
    await client.query(`create table if not exists public.manuscript_chunks (
        id uuid primary key default gen_random_uuid(),
        manuscript_id bigint not null,
        chunk_index integer not null,
        char_start integer not null,
        char_end integer not null,
        overlap_chars integer not null default 0,
        label text null,
        content text not null,
        content_hash text not null)`)

    // Apply the RPC-under-test exactly as committed.
    await client.query(readRpcSql)

    // Seed two chunks under the max-bigint manuscript and one under the
    // colliding neighbour, so the read must return each exact id.
    await client.query(
      `insert into public.manuscript_chunks
         (manuscript_id, chunk_index, char_start, char_end, overlap_chars, label, content, content_hash)
       values
         ($1::bigint, 0, 0, 10, 0, 'c0', 'first',  'h0'),
         ($1::bigint, 1, 10, 20, 0, 'c1', 'second', 'h1'),
         ($2::bigint, 0, 0, 5, 0, 'n0', 'neighbour', 'hn')`,
      [BIG_MANUSCRIPT_ID, NEIGHBOUR_MANUSCRIPT_ID],
    )
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

  it('returns manuscript_id_text as the exact max-bigint string (no precision loss)', async () => {
    const res = await client.query(
      'select manuscript_id_text, chunk_index from public.get_held_recovery_manuscript_chunks($1::bigint) order by chunk_index',
      [BIG_MANUSCRIPT_ID],
    )
    expect(res.rows.map((r) => r.chunk_index)).toEqual([0, 1])
    for (const row of res.rows) {
      expect(typeof row.manuscript_id_text).toBe('string')
      expect(row.manuscript_id_text).toBe(BIG_MANUSCRIPT_ID)
    }
  })

  it('preserves per-row identity for two bigints that collide as JS numbers', async () => {
    // Sanity: these two distinct bigints are indistinguishable once coerced to a
    // JS number — the exact hazard the text projection removes.
    expect(Number(BIG_MANUSCRIPT_ID)).toBe(Number(NEIGHBOUR_MANUSCRIPT_ID))

    const big = await client.query(
      'select manuscript_id_text from public.get_held_recovery_manuscript_chunks($1::bigint)',
      [BIG_MANUSCRIPT_ID],
    )
    const neighbour = await client.query(
      'select manuscript_id_text from public.get_held_recovery_manuscript_chunks($1::bigint)',
      [NEIGHBOUR_MANUSCRIPT_ID],
    )
    expect(new Set(big.rows.map((r) => r.manuscript_id_text))).toEqual(new Set([BIG_MANUSCRIPT_ID]))
    expect(new Set(neighbour.rows.map((r) => r.manuscript_id_text))).toEqual(
      new Set([NEIGHBOUR_MANUSCRIPT_ID]),
    )
    expect(big.rows[0].manuscript_id_text).not.toBe(neighbour.rows[0].manuscript_id_text)
  })

  it('demonstrates the precision loss that reading the raw bigint as a number would cause', async () => {
    // Read the SAME id back through the numeric column with the pg driver's
    // default number parser. This is the failure mode the RPC prevents: the two
    // distinct ids round to the same JS number.
    const raw = await client.query(
      'select manuscript_id from public.manuscript_chunks where manuscript_id in ($1::bigint, $2::bigint)',
      [BIG_MANUSCRIPT_ID, NEIGHBOUR_MANUSCRIPT_ID],
    )
    // pg returns bigint as a string by default; coercing to number is where the
    // loss happens. Prove the coercion is lossy and the text path is not.
    const asNumbers = raw.rows.map((r) => Number(r.manuscript_id))
    expect(asNumbers.every((n) => String(n) !== BIG_MANUSCRIPT_ID && String(n) !== NEIGHBOUR_MANUSCRIPT_ID)).toBe(true)
  })

  it('returns no rows for an unknown manuscript', async () => {
    const res = await client.query(
      'select manuscript_id_text from public.get_held_recovery_manuscript_chunks($1::bigint)',
      ['123456789'],
    )
    expect(res.rows).toEqual([])
  })
})
