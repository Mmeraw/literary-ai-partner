import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260718140000_correct_held_recovery_anchor_version_parity.sql',
)

const sql = fs.readFileSync(migrationPath, 'utf8')

const sqlCode = sql
  .replace(/--[^\n]*/g, ' ')
  .replace(/'(?:[^']|'')*'/g, "''")

function functionBody(fnName: string, signature = ''): string {
  const needle = `create or replace function public.${fnName}${signature ? '(' + signature : ''}`
  const start = sql.indexOf(`create or replace function public.${fnName}`)
  if (start === -1) throw new Error(`function public.${fnName} not found`)
  const bodyOpen = sql.indexOf('$$', start)
  const bodyClose = sql.indexOf('$$;', bodyOpen + 2)
  if (bodyOpen === -1 || bodyClose === -1) throw new Error(`could not delimit body of public.${fnName}`)
  return sql.slice(bodyOpen + 2, bodyClose)
}

function functionBodyCode(fnName: string): string {
  return functionBody(fnName)
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

const VERSION_FN = 'held_recovery_opportunity_version'
const FINGERPRINT_FN = 'held_recovery_anchor_fingerprint'
const CAS_FN = 'apply_held_recovery_anchor_cas_atomic'

const grantRevokeStatements = (sqlCode.match(/(?:grant|revoke)\b[^;]*;/gi) || []).map((s) =>
  s.replace(/\s+/g, ' ').trim(),
)

describe('held recovery anchor version corrective migration contract', () => {
  describe('transaction + no-new-table', () => {
    it('wraps in begin/commit and creates no table', () => {
      expect(sqlCode).toMatch(/\bbegin\s*;/i)
      expect(sqlCode).toMatch(/\bcommit\s*;/i)
      expect(sqlCode).not.toMatch(/create\s+table/i)
    })
  })

  describe('retires the misnamed prior helper', () => {
    it('drops the old four-input held_recovery_anchor_version', () => {
      expect(sqlCode).toMatch(
        /drop\s+function\s+if\s+exists\s+public\.held_recovery_anchor_version\s*\(\s*text\s*,\s*text\s*,\s*text\s*,\s*text\s*\)/i,
      )
    })

    it('does not re-create a function named held_recovery_anchor_version', () => {
      expect(sqlCode).not.toMatch(/create\s+or\s+replace\s+function\s+public\.held_recovery_anchor_version\b/i)
    })
  })

  describe('canonical opportunity version — parity construction', () => {
    it('defines a TWO-input opportunity version function', () => {
      expect(sql).toMatch(
        new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${VERSION_FN}\\s*\\(\\s*\\n?\\s*p_opportunity_id\\s+text\\s*,\\s*\\n?\\s*p_ledger_source_hash\\s+text\\s*\\n?\\s*\\)`, 'i'),
      )
    })

    it('is IMMUTABLE', () => {
      const sig = sql.slice(
        sql.indexOf(`create or replace function public.${VERSION_FN}`),
        sql.indexOf('$$', sql.indexOf(`create or replace function public.${VERSION_FN}`)),
      )
      expect(sig).toMatch(/\bimmutable\b/i)
    })

    it('reproduces the sorted-key JSON exactly (ledgerSourceHash then opportunityId) via to_json', () => {
      const body = functionBody(VERSION_FN)
      // literal framing must be present in RAW body
      expect(body).toContain('"ledgerSourceHash":')
      expect(body).toContain('"opportunityId":')
      expect(body.indexOf('"ledgerSourceHash":')).toBeLessThan(body.indexOf('"opportunityId":'))
      // uses to_json for value escaping + sha256 over utf8 bytes
      const code = functionBodyCode(VERSION_FN)
      expect(code).toMatch(/to_json\s*\(\s*p_ledger_source_hash\s*\)/i)
      expect(code).toMatch(/to_json\s*\(\s*p_opportunity_id\s*\)/i)
      expect(code).toMatch(/convert_to\s*\([\s\S]*utf8|convert_to/i)
      expect(code).toMatch(/digest\s*\(/i)
      expect(sql).toMatch(/sha256/i)
    })

    it('does NOT hash anchor fields into the opportunity version', () => {
      const code = functionBodyCode(VERSION_FN)
      expect(code).not.toContain('p_evidence_anchor')
      expect(code).not.toContain('p_manuscript_coordinates')
    })
  })

  describe('anchor fingerprint — renamed four-input guard', () => {
    it('defines the four-input fingerprint function', () => {
      expect(sql).toMatch(
        new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${FINGERPRINT_FN}\\s*\\(`, 'i'),
      )
      const code = functionBodyCode(FINGERPRINT_FN)
      expect(code).toContain('p_opportunity_id')
      expect(code).toContain('p_ledger_source_hash')
      expect(code).toContain('p_evidence_anchor')
      expect(code).toContain('p_manuscript_coordinates')
    })
  })

  describe('corrected CAS RPC vocabulary', () => {
    it('guards on expected_anchor_fingerprint (not expected_anchor_version)', () => {
      const code = functionBodyCode(CAS_FN)
      expect(code).toContain('expected_anchor_fingerprint')
      expect(code).not.toContain('expected_anchor_version')
    })

    it('calls the fingerprint fn as the CAS guard and raises anchor_fingerprint_conflict', () => {
      const code = functionBodyCode(CAS_FN)
      expect(code).toMatch(new RegExp(`public\\.${FINGERPRINT_FN}\\s*\\(`, 'i'))
      const body = functionBody(CAS_FN)
      expect(body).toContain('anchor_fingerprint_conflict')
      expect(body).not.toContain('anchor_version_conflict')
    })

    it('returns the canonical opportunity_version separately in both success and unchanged results', () => {
      const body = functionBody(CAS_FN)
      const code = functionBodyCode(CAS_FN)
      expect(code).toMatch(new RegExp(`public\\.${VERSION_FN}\\s*\\(`, 'i'))
      // both result branches include opportunity_version
      expect(body).toContain("'opportunity_version'")
      const unchangedIdx = body.indexOf("'unchanged'")
      const updatedIdx = body.indexOf("'anchor_updated'")
      const versionMatches = (body.match(/'opportunity_version'/g) || []).length
      expect(versionMatches).toBeGreaterThanOrEqual(2)
      expect(unchangedIdx).toBeGreaterThan(-1)
      expect(updatedIdx).toBeGreaterThan(-1)
    })

    it('is SECURITY DEFINER with pinned search_path and still FOR UPDATE locks', () => {
      const header = sql.slice(
        sql.indexOf(`create or replace function public.${CAS_FN}`),
        sql.indexOf('$$', sql.indexOf(`create or replace function public.${CAS_FN}`)),
      )
      expect(header).toMatch(/security\s+definer/i)
      expect(header).toMatch(/set\s+search_path\s*=\s*public/i)
      expect(functionBodyCode(CAS_FN)).toMatch(/for\s+update/i)
    })

    it('preserves the narrow mutation: only evidence_anchor + manuscript_coordinates, jsonb_set at index', () => {
      const body = functionBody(CAS_FN)
      const patchMatch = body.match(/jsonb_build_object\(\s*\n?\s*'evidence_anchor'[\s\S]*?\)/i)
      expect(patchMatch).not.toBeNull()
      const patch = patchMatch![0]
      expect(patch).toContain("'evidence_anchor'")
      expect(patch).toContain("'manuscript_coordinates'")
      for (const forbidden of ['decision_state', 'criterion', 'severity', 'rationale', 'provenance', 'confidence']) {
        expect(patch).not.toContain(`'${forbidden}'`)
      }
      expect(functionBodyCode(CAS_FN)).toMatch(/jsonb_set/i)
    })

    it('preserves fail-closed vocabulary and single UPDATE target', () => {
      const body = functionBody(CAS_FN)
      for (const token of [
        'malformed_request',
        'artifact_not_found',
        'opportunity_not_found',
        'duplicate_opportunity_id',
        'ledger_source_hash_conflict',
      ]) {
        expect(body).toContain(token)
      }
      const code = functionBodyCode(CAS_FN)
      const updates = code.match(/update\s+public\.\w+/gi) || []
      expect(updates.length).toBe(1)
      expect(updates[0]).toMatch(/update\s+public\.evaluation_artifacts/i)
      expect(code).not.toMatch(/\binsert\s+into\b/i)
      expect(code).not.toMatch(/\bdelete\s+from\b/i)
    })

    it('writes no decision/classification/queue/final-decision state', () => {
      const code = functionBodyCode(CAS_FN)
      for (const forbidden of [
        'revision_ledger_decisions',
        'change_proposals',
        'held_recovery_queue',
        'final_review',
        'finalDecision',
        'cardType',
        'card_type',
      ]) {
        expect(code).not.toContain(forbidden)
      }
    })
  })

  describe('grants are RPC-only for all three functions', () => {
    it('revokes public + grants service_role execute for version, fingerprint, and CAS', () => {
      const joined = grantRevokeStatements.join('\n')
      for (const fn of [VERSION_FN, FINGERPRINT_FN, CAS_FN]) {
        expect(joined).toMatch(new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`, 'i'))
        expect(joined).toMatch(new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*from public`, 'i'))
      }
    })

    it('grants no direct table DML', () => {
      const joined = grantRevokeStatements.join('\n')
      expect(joined).not.toMatch(/grant\s+(insert|update|delete)\b/i)
    })
  })
})
