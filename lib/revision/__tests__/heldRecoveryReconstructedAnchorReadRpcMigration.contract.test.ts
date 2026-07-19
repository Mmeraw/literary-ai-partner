import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260719190000_create_held_recovery_reconstructed_anchor_read_rpc.sql',
)
const sql = fs.readFileSync(migrationPath, 'utf8')

describe('Held Recovery reconstructed-anchor read RPC migration', () => {
  it('defines a stable, service-role-only security-definer read seam', () => {
    expect(sql).toContain(
      'create or replace function public.get_held_recovery_reconstructed_anchor',
    )
    expect(sql).toContain('language sql')
    expect(sql).toContain('stable')
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public')
    expect(sql).toContain(
      'grant execute on function public.get_held_recovery_reconstructed_anchor(text, text) to service_role',
    )
    for (const role of ['public', 'authenticated', 'anon']) {
      expect(sql).toContain(
        `revoke all on function public.get_held_recovery_reconstructed_anchor(text, text) from ${role}`,
      )
    }
  })

  it('reads only the unique item-version authority row', () => {
    expect(sql).toMatch(/from public\.held_recovery_reconstructed_anchors as anchor_row/i)
    expect(sql).toMatch(/held_item_id = p_held_item_id/i)
    expect(sql).toMatch(/held_item_persisted_version = p_held_item_persisted_version/i)
  })

  it('projects bigint manuscript identity as text', () => {
    expect(sql).toContain("'manuscript_id_text', anchor_row.manuscript_id::text")
    expect(sql).not.toContain("'manuscript_id', anchor_row.manuscript_id")
  })

  it('is read-only and does not activate downstream behavior', () => {
    expect(sql).not.toMatch(/\b(?:insert|update|delete)\s+(?:into|public\.|from)/i)
    expect(sql).not.toMatch(/apply_held_recovery_anchor_cas_atomic/i)
    expect(sql).not.toMatch(/held_recovery_queue_transition/i)
  })
})
