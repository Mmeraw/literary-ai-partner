import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260718131500_create_held_recovery_anchor_cas.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

/**
 * Executable SQL only: strip `--` line comments AND single-quoted string/comment
 * literals so forbidden-token negative assertions target real SQL identifiers and are
 * NOT tripped by the migration's own prohibitive prose (comments that name the very
 * fields the RPC must NOT write, e.g. "never writes finalDecision/cardType").
 */
const sqlCode = sql
  .replace(/--[^\n]*/g, ' ') // line comments
  .replace(/'(?:[^']|'')*'/g, "''") // single-quoted literals (incl. comment bodies + jsonb keys)

/**
 * Extract the body of a `create or replace function public.<name>(...) ... $$ <body> $$;`
 * so assertions are scoped to ONE function and cannot pass because another function happens
 * to contain the matched text. Returns raw body (with comments) — callers that need
 * code-only can strip themselves.
 */
function functionBody(fnName: string): string {
  const start = sql.indexOf(`create or replace function public.${fnName}`)
  if (start === -1) {
    throw new Error(`function public.${fnName} not found in migration`)
  }
  const bodyOpen = sql.indexOf('$$', start)
  const bodyClose = sql.indexOf('$$;', bodyOpen + 2)
  if (bodyOpen === -1 || bodyClose === -1) {
    throw new Error(`could not delimit body of public.${fnName}`)
  }
  return sql.slice(bodyOpen + 2, bodyClose)
}

function functionBodyCode(fnName: string): string {
  return functionBody(fnName)
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

const VERSION_FN = 'held_recovery_anchor_version'
const CAS_FN = 'apply_held_recovery_anchor_cas_atomic'

/**
 * Grant/revoke statements, built from sqlCode (comments stripped) so a preceding comment
 * without a `;` cannot let a `[^;]*` match reach backwards into prose.
 */
const grantRevokeStatements = (
  sqlCode.match(/(?:grant|revoke)\b[^;]*;/gi) || []
).map((s) => s.replace(/\s+/g, ' ').trim())

describe('held recovery anchor CAS migration contract', () => {
  // ── Transaction envelope ────────────────────────────────────────────────────
  describe('transaction envelope', () => {
    it('wraps the migration in a single begin/commit', () => {
      expect(sqlCode).toMatch(/\bbegin\s*;/i)
      expect(sqlCode).toMatch(/\bcommit\s*;/i)
    })

    it('creates NO new table (JSON-backed; must not invent a typed opportunity table)', () => {
      expect(sqlCode).not.toMatch(/create\s+table/i)
    })
  })

  // ── Version helper ──────────────────────────────────────────────────────────
  describe('derived anchor version helper', () => {
    it('defines the per-opportunity anchor version function', () => {
      expect(sql).toMatch(
        new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${VERSION_FN}`, 'i'),
      )
    })

    it('is IMMUTABLE (deterministic token, safe to recompute)', () => {
      const sig = sql.slice(
        sql.indexOf(`create or replace function public.${VERSION_FN}`),
        sql.indexOf('$$', sql.indexOf(`create or replace function public.${VERSION_FN}`)),
      )
      expect(sig).toMatch(/\bimmutable\b/i)
    })

    it('hashes over opportunity identity + ledger source_hash + BOTH anchor fields', () => {
      // Use the raw body: the parameter identifiers are passed as VALUES to json_build_object,
      // but the accompanying keys are string literals that functionBodyCode() would strip.
      const body = functionBody(VERSION_FN)
      expect(body).toMatch(/sha256/i)
      expect(body).toMatch(/p_opportunity_id/)
      expect(body).toMatch(/p_ledger_source_hash/)
      expect(body).toMatch(/p_evidence_anchor/)
      expect(body).toMatch(/p_manuscript_coordinates/)
    })
  })

  // ── CAS RPC: identity + posture ─────────────────────────────────────────────
  describe('anchor CAS RPC posture', () => {
    it('defines exactly the anchor CAS function', () => {
      expect(sql).toMatch(
        new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${CAS_FN}\\s*\\(`, 'i'),
      )
    })

    it('is SECURITY DEFINER with a pinned search_path', () => {
      const header = sql.slice(
        sql.indexOf(`create or replace function public.${CAS_FN}`),
        sql.indexOf('$$', sql.indexOf(`create or replace function public.${CAS_FN}`)),
      )
      expect(header).toMatch(/security\s+definer/i)
      expect(header).toMatch(/set\s+search_path\s*=\s*public/i)
    })

    it('targets the JSON-backed revision_opportunity_ledger_v1 artifact', () => {
      const body = functionBodyCode(CAS_FN)
      expect(body).toMatch(/from\s+public\.evaluation_artifacts/i)
      expect(body).toMatch(/artifact_type\s*=\s*revision_opportunity_ledger_v1|artifact_type\s*=\s*''/i)
      // ensure the literal artifact type string is present (in raw sql, since we stripped literals in code)
      expect(sql).toMatch(/revision_opportunity_ledger_v1/)
    })
  })

  // ── CAS RPC: concurrency + fail-closed guards ───────────────────────────────
  describe('compare-and-swap concurrency guards', () => {
    it('locks the single artifact row FOR UPDATE', () => {
      const body = functionBodyCode(CAS_FN)
      expect(body).toMatch(/for\s+update/i)
    })

    it('verifies the expected ledger source_hash (CAS guard #1)', () => {
      const body = functionBodyCode(CAS_FN)
      expect(body).toMatch(/expected_ledger_source_hash|v_expected_source_hash/)
      expect(body).toMatch(/is\s+distinct\s+from/i)
    })

    it('verifies the expected per-opportunity anchor version (CAS guard #2)', () => {
      const body = functionBodyCode(CAS_FN)
      expect(body).toMatch(/expected_anchor_version|v_expected_anchor_version/)
      expect(body).toMatch(new RegExp(`public\\.${VERSION_FN}\\s*\\(`, 'i'))
    })

    it('fails closed via RAISE EXCEPTION on every mismatch/degenerate case', () => {
      const body = functionBody(CAS_FN)
      for (const token of [
        'malformed_request',
        'artifact_not_found',
        'opportunity_not_found',
        'duplicate_opportunity_id',
        'ledger_source_hash_conflict',
        'anchor_version_conflict',
      ]) {
        expect(body).toContain(token)
      }
      // each is raised, not returned
      expect(body).toMatch(/raise\s+exception[\s\S]*ledger_source_hash_conflict/i)
      expect(body).toMatch(/raise\s+exception[\s\S]*anchor_version_conflict/i)
    })

    it('rejects zero matches AND duplicate opportunity_ids', () => {
      const body = functionBodyCode(CAS_FN)
      expect(body).toMatch(/count\s*\(\s*\*\s*\)/i)
      expect(body).toMatch(/v_match_count\s*=\s*0/)
      expect(body).toMatch(/v_match_count\s*>\s*1/)
    })
  })

  // ── CAS RPC: narrowness fence (updates ONLY anchor fields) ───────────────────
  describe('narrowness fence — updates only anchor fields', () => {
    it('updates exactly one opportunity element in place via jsonb_set at its index', () => {
      // jsonb_set + v_idx are executable identifiers; the 'opportunities' path segment is a
      // string literal, so assert it against the raw body (functionBodyCode strips literals).
      const bodyCode = functionBodyCode(CAS_FN)
      const bodyRaw = functionBody(CAS_FN)
      expect(bodyCode).toMatch(/jsonb_set/i)
      expect(bodyCode).toMatch(/v_idx/)
      expect(bodyRaw).toMatch(/array\[\s*'opportunities'\s*,\s*v_idx/i)
    })

    it('writes ONLY evidence_anchor + manuscript_coordinates into the new opportunity object', () => {
      const body = functionBody(CAS_FN)
      // The jsonb_build_object that constructs the replacement patch must contain exactly
      // the two anchor keys and nothing else authority-bearing.
      const patchMatch = body.match(/jsonb_build_object\(\s*\n?\s*'evidence_anchor'[\s\S]*?\)/i)
      expect(patchMatch).not.toBeNull()
      const patch = patchMatch![0]
      expect(patch).toMatch(/'evidence_anchor'/)
      expect(patch).toMatch(/'manuscript_coordinates'/)
      // No decision/classification/queue vocabulary in the write patch.
      for (const forbidden of [
        'decision_state',
        'criterion',
        'severity',
        'rationale',
        'provenance',
        'confidence',
      ]) {
        expect(patch).not.toContain(`'${forbidden}'`)
      }
    })

    it('touches only evaluation_artifacts.content + updated_at (no other UPDATE targets)', () => {
      const body = functionBodyCode(CAS_FN)
      const updates = body.match(/update\s+public\.\w+/gi) || []
      expect(updates.length).toBe(1)
      expect(updates[0]).toMatch(/update\s+public\.evaluation_artifacts/i)
      // the SET clause assigns content and updated_at only
      expect(body).toMatch(/set\s+content\s*=/i)
      expect(body).toMatch(/updated_at\s*=\s*now\(\)/i)
    })
  })

  // ── CAS RPC: authority boundary (must NOT write foreign state) ───────────────
  describe('authority boundary — no foreign state writes', () => {
    it('does not write decision / classification / queue / final-decision state', () => {
      const body = functionBodyCode(CAS_FN)
      // These must not appear as write targets in executable code (comments/literals stripped).
      for (const forbidden of [
        'revision_ledger_decisions',
        'change_proposals',
        'held_recovery_queue',
        'final_review',
        'finalDecision',
        'cardType',
        'card_type',
        'sync_revision_ledger_decisions_atomic',
      ]) {
        expect(body).not.toContain(forbidden)
      }
    })

    it('performs no INSERT and no DELETE (CAS-in-place only)', () => {
      const body = functionBodyCode(CAS_FN)
      expect(body).not.toMatch(/\binsert\s+into\b/i)
      expect(body).not.toMatch(/\bdelete\s+from\b/i)
    })
  })

  // ── CAS RPC: idempotent replay ──────────────────────────────────────────────
  describe('idempotent replay', () => {
    it('returns unchanged (no write) when the new anchor equals the stored anchor', () => {
      const body = functionBody(CAS_FN)
      expect(body).toContain("'unchanged'")
      // the unchanged branch returns BEFORE the update statement
      const unchangedIdx = body.indexOf("'unchanged'")
      const updateIdx = body.search(/update\s+public\.evaluation_artifacts/i)
      expect(unchangedIdx).toBeGreaterThan(-1)
      expect(updateIdx).toBeGreaterThan(-1)
      expect(unchangedIdx).toBeLessThan(updateIdx)
    })

    it('returns anchor_updated with previous + new version tokens on success', () => {
      const body = functionBody(CAS_FN)
      expect(body).toContain("'anchor_updated'")
      expect(body).toContain('previous_anchor_version')
      expect(body).toContain('anchor_version')
    })
  })

  // ── Grants: RPC-only ────────────────────────────────────────────────────────
  describe('grants are RPC-only', () => {
    it('revokes public execute and grants execute to service_role for both functions', () => {
      const joined = grantRevokeStatements.join('\n')
      expect(joined).toMatch(
        new RegExp(`revoke all on function public\\.${CAS_FN}[\\s\\S]*from public`, 'i'),
      )
      expect(joined).toMatch(
        new RegExp(`grant execute on function public\\.${CAS_FN}[\\s\\S]*to service_role`, 'i'),
      )
      expect(joined).toMatch(
        new RegExp(`grant execute on function public\\.${VERSION_FN}[\\s\\S]*to service_role`, 'i'),
      )
    })

    it('grants NO direct table DML (all mutation flows through the SECURITY DEFINER RPC)', () => {
      const joined = grantRevokeStatements.join('\n')
      expect(joined).not.toMatch(/grant\s+(insert|update|delete)\b/i)
    })
  })
})
