import { createHash } from 'node:crypto'
import { revisionOpportunityVersionFor } from '@/lib/revision/heldRecoveryVersioning'

/**
 * PARITY CONTRACT: the corrective migration's SQL function
 *   held_recovery_opportunity_version(p_opportunity_id, p_ledger_source_hash)
 * MUST produce byte-for-byte the same digest as the authoritative TypeScript
 *   revisionOpportunityVersionFor(opportunityId, ledgerSourceHash)
 *     = sha256( stableStringify({ opportunityId, ledgerSourceHash }) ).hex
 *
 * The SQL builds the serialized string as:
 *   '{"ledgerSourceHash":' || to_json(p_ledger_source_hash)::text
 *     || ',"opportunityId":' || to_json(p_opportunity_id)::text || '}'
 * then sha256s its UTF-8 bytes.
 *
 * HONEST SCOPE / LIMITATION: this repo has no live Postgres in CI (migration suites are
 * grammar/text-verified, never DB-executed). We prove parity two ways that do NOT require a
 * database:
 *   1. Ground-truth pinning: assert revisionOpportunityVersionFor against hashes captured from
 *      the authoritative helper (regression lock — any TS drift breaks this).
 *   2. SQL-serialization emulation: reproduce the EXACT string the SQL concatenates, using a
 *      faithful port of Postgres to_json(text) escaping, sha256 it, and assert byte-equality
 *      with the TS helper. The emulator's escaping is itself cross-checked against JS
 *      JSON.stringify so drift in either direction surfaces.
 * This does not replace executing the real function against Postgres, but it proves the
 * serialization the migration reproduces is exactly equivalent for representative and edge
 * inputs. If a live-DB harness is added later, the same cases replay against the real RPC.
 */

/**
 * Faithful port of Postgres `to_json(text)::text` escaping. Escapes: " \ \b \t \n \f \r and
 * other control chars (<0x20) as \u00XX; does NOT escape '/' and does NOT escape non-ASCII.
 * These rules are identical to ECMAScript JSON.stringify, which is why to_json gives parity.
 */
function pgToJsonText(value: string): string {
  let out = '"'
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    switch (ch) {
      case '"':
        out += '\\"'
        break
      case '\\':
        out += '\\\\'
        break
      case '\b':
        out += '\\b'
        break
      case '\t':
        out += '\\t'
        break
      case '\n':
        out += '\\n'
        break
      case '\f':
        out += '\\f'
        break
      case '\r':
        out += '\\r'
        break
      default:
        if (code < 0x20) {
          out += '\\u' + code.toString(16).padStart(4, '0')
        } else {
          out += ch
        }
    }
  }
  return out + '"'
}

function sqlSerialized(opportunityId: string, ledgerSourceHash: string): string {
  return (
    '{"ledgerSourceHash":' +
    pgToJsonText(ledgerSourceHash) +
    ',"opportunityId":' +
    pgToJsonText(opportunityId) +
    '}'
  )
}

function sqlOpportunityVersion(opportunityId: string, ledgerSourceHash: string): string {
  return createHash('sha256').update(sqlSerialized(opportunityId, ledgerSourceHash), 'utf8').digest('hex')
}

const CASES: Array<[opportunityId: string, ledgerSourceHash: string, label: string]> = [
  ['workbench:1', 'rol:abc123', 'representative workbench id'],
  ['opp-plain', 'sourcehash-plain', 'plain ascii'],
  ['has "quote" and \\backslash', 'rol:with\ttab\nnewline', 'quotes backslash tab newline'],
  ['unicode-café-☃', 'ledger-λ-源', 'non-ascii accents cjk emoji greek'],
  ['', '', 'empty strings'],
  ['a/b/c slashes', 'x/y/z', 'forward slashes not escaped'],
  ['{"opportunityId":"x"}', '{"ledgerSourceHash":"y"}', 'json-shaped content cannot break framing'],
  ['\u0000\u0001\u001f', 'ctrl\u0007chars', 'low control chars'],
]

const GROUND_TRUTH: Record<string, string> = {
  'workbench:1|rol:abc123': '0d2cf454f88034e07fd45a498986e325442d8c3e193bf97223a8932b651b1753',
  'opp-plain|sourcehash-plain': '2d26969fa46460a531037f7cd5471e658c5ccd2bae6edd903ad74a6fd49bb499',
  'unicode-café-☃|ledger-λ-源': '98a690cd2c809ab1fb9ced88a8ca41c9fbf22b11a818559d9cc1bc4d9b05e298',
  '|': 'f939398356d947f4c33b69ba21ae5b3ad3ddca2e3ec3813db49a1c4986c31262',
  'a/b/c slashes|x/y/z': 'dd81847c0b253b9f5ab573971a788b4c4d0a0ea42133dbd0320eca8dd41d534d',
}

describe('held recovery anchor version — SQL/TS byte-for-byte parity', () => {
  it('pgToJsonText emulator matches JS JSON.stringify for all case fields (escaping cross-check)', () => {
    for (const [opp, ledger] of CASES) {
      expect(pgToJsonText(opp)).toBe(JSON.stringify(opp))
      expect(pgToJsonText(ledger)).toBe(JSON.stringify(ledger))
    }
  })

  it('canonical TS helper matches pinned ground-truth hashes (regression lock)', () => {
    for (const [opp, ledger] of CASES) {
      const key = `${opp}|${ledger}`
      if (key in GROUND_TRUTH) {
        expect(revisionOpportunityVersionFor(opp, ledger)).toBe(GROUND_TRUTH[key])
      }
    }
  })

  it('SQL serialization sorts keys as {ledgerSourceHash, opportunityId}', () => {
    const serialized = sqlSerialized('OPP', 'LEDGER')
    expect(serialized).toBe('{"ledgerSourceHash":"LEDGER","opportunityId":"OPP"}')
    expect(serialized.indexOf('ledgerSourceHash')).toBeLessThan(serialized.indexOf('opportunityId'))
  })

  it('SQL-emulated version equals revisionOpportunityVersionFor byte-for-byte (representative + edge)', () => {
    for (const [opp, ledger, label] of CASES) {
      const ts = revisionOpportunityVersionFor(opp, ledger)
      const sql = sqlOpportunityVersion(opp, ledger)
      expect(`${label}: ${sql}`).toBe(`${label}: ${ts}`)
    }
  })

  it('produces a 64-char lowercase hex sha256 digest', () => {
    for (const [opp, ledger] of CASES) {
      expect(revisionOpportunityVersionFor(opp, ledger)).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('anchor fingerprint is a DISTINCT concept from opportunity version (must not collide)', () => {
    const opp = 'workbench:1'
    const ledger = 'rol:abc123'
    const fingerprintSerialized = JSON.stringify({
      boundary: 'held_recovery_anchor_fingerprint_v1',
      opportunity_id: opp,
      ledger_source_hash: ledger,
      evidence_anchor: 'the quick brown fox',
      manuscript_coordinates: 'para:3;sent:2',
    })
    const fingerprint = createHash('sha256').update(fingerprintSerialized, 'utf8').digest('hex')
    expect(fingerprint).not.toBe(revisionOpportunityVersionFor(opp, ledger))
  })
})
