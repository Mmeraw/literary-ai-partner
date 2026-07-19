import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260719040000_create_held_recovery_manuscript_chunks_read_rpc.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

describe('held recovery manuscript_chunks read RPC migration contract', () => {
  it('defines a service-role-only, security-definer read RPC', () => {
    expect(sql).toContain(
      'create or replace function public.get_held_recovery_manuscript_chunks',
    )
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public')
    expect(sql).toContain(
      'revoke all on function public.get_held_recovery_manuscript_chunks(bigint) from public',
    )
    expect(sql).toContain(
      'revoke all on function public.get_held_recovery_manuscript_chunks(bigint) from authenticated',
    )
    expect(sql).toContain(
      'revoke all on function public.get_held_recovery_manuscript_chunks(bigint) from anon',
    )
    expect(sql).toContain(
      'grant execute on function public.get_held_recovery_manuscript_chunks(bigint) to service_role',
    )
  })

  it('projects manuscript_id as text at the database boundary', () => {
    // The precision boundary lives here: the bigint identity is cast to text in
    // SQL so it never passes through a JS number. This is the single assertion
    // that makes the end-to-end fidelity fix real rather than cosmetic.
    expect(sql).toMatch(/mc\.manuscript_id::text\s+as\s+manuscript_id_text/i)
    // The returned column is text-typed.
    expect(sql).toMatch(/manuscript_id_text\s+text/i)
  })

  it('returns exactly the nine columns the Held Recovery reads consume', () => {
    // Scope fence: this is the read model the two consumers already use, no more.
    // manuscript_id is exposed only as text (manuscript_id_text).
    const returnedColumns = [
      'id uuid',
      'manuscript_id_text text',
      'chunk_index integer',
      'char_start integer',
      'char_end integer',
      'overlap_chars integer',
      'label text',
      'content text',
      'content_hash text',
    ]
    for (const column of returnedColumns) {
      expect(sql).toContain(column)
    }
    // The raw numeric manuscript_id column is never returned by name.
    expect(sql).not.toMatch(/returns table[\s\S]*\bmanuscript_id\s+bigint/i)
  })

  it('filters by the requested manuscript and orders by chunk_index', () => {
    expect(sql).toMatch(/where\s+mc\.manuscript_id\s*=\s*p_manuscript_id/i)
    expect(sql).toMatch(/order\s+by\s+mc\.chunk_index\s+asc/i)
  })

  it('is a read-only function that performs no mutation', () => {
    expect(sql).toMatch(/language\s+sql/i)
    expect(sql).toMatch(/\bstable\b/i)
    expect(sql).not.toMatch(/insert\s+into/i)
    expect(sql).not.toMatch(/update\s+public\./i)
    expect(sql).not.toMatch(/delete\s+from/i)
    expect(sql).not.toMatch(/create\s+table/i)
  })
})
