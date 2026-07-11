/**
 * ledgerQualityRepairReasons.test.ts
 *
 * PR beta — additive producer observability for ledger_quality_report_v1.
 *
 * Regression coverage for the "repair_required + empty blocking_reasons"
 * observability gap seen in production ("Let the River Decide", job 9ee70f12):
 * gate_ready_status was a legitimate repair_required driven by 11 real
 * root-cause warnings, yet blocking_reasons was [] because that field is
 * reserved for hard-fails and no_pov_detected only. These tests lock in that
 * the contributing warnings are now disclosed via repair_reasons /
 * root_cause_warning_count WITHOUT altering the >3 threshold,
 * gate_ready_status, or blocking_reasons semantics.
 */

import { buildLedgerQualityReport } from '@/lib/evaluation/phase1a/buildLedgerQualityReport';
import { STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';
import type {
  CharacterArcLedgerEntry,
  CharacterIdentityLedgerEntry,
  CharacterLedgerV2,
  Pass1aCharacterLedger,
  Pass1aRoleSignal,
} from '@/lib/evaluation/pipeline/types';

// ── Fixture helpers (kept minimal and local; mirror hardFailTriageGate) ──────

function makeLedgerEntry(
  name: string,
  role: Pass1aRoleSignal = 'protagonist',
): CharacterArcLedgerEntry {
  return {
    canonical_name: name,
    aliases: [],
    pronouns: ['she/her'],
    age_exact_first: null,
    age_exact_last: null,
    age_signal: 'adult',
    gender_identity: 'woman',
    lgbtq_signals: [],
    racial_ethnic_signals: [],
    skin_tone_signals: [],
    language_signals: [],
    religion_signals: [],
    socioeconomic_signals: [],
    nationality_signals: [],
    disability_neuro_signals: [],
    role,
    narrative_weight_band:
      role === 'protagonist' || role === 'co_protagonist' ? 'primary' : 'supporting',
    is_named: true,
    presence_type: 'present',
    who_is_this: `${name} test character`,
    what_do_they_want: null,
    primary_locations: [],
    why_signal: null,
    how_signal: null,
    arc_start: 'present',
    arc_pressure: '',
    arc_turning_points: [],
    arc_end_state: 'present',
    ending_status: 'intentionally_unresolved',
    symbolic_objects: [],
    relational_engines: [],
    evidence_anchors: [],
    report_acknowledgement_status: 'adequately_accounted_for',
    warnings: [],
    first_chunk_index: 0,
    last_chunk_index: 0,
    mention_count: 5,
    nameStates: [{ name, validFromChunk: 0, validUntilChunk: null }],
    copingMechanisms: [],
    coPresenceMap: {},
  };
}

function makeIdentityEntry(name: string): CharacterIdentityLedgerEntry {
  return {
    characterId: name.toLowerCase().replace(/\s+/g, '_'),
    canonicalName: name,
    aliases: [],
    nameHistory: [{ name, validFromChunk: 0, validUntilChunk: null, confidence: 'explicit' }],
    narrativeRole: 'protagonist',
    importanceLevel: 'primary',
    firstAppearance: { label: 'chunk 0', chunkIndex: 0 },
    lastAppearance: { label: 'chunk 0', chunkIndex: 0 },
    firstChunkIndex: 0,
    lastChunkIndex: 0,
    finalStatus: 'alive',
    contradictions: [],
    recommendationBlockers: [],
  };
}

function makeCleanLayers(names: string[]) {
  return Object.fromEntries(
    STORY_LAYER_KEYS.map((key) => [
      key,
      key === 'canonical_identity_layer'
        ? {
            schema_version: 'canonical_identity_layer_v1',
            identity_groups: names.map((n) => ({
              character_id: n.toLowerCase().replace(/\s+/g, '_'),
              canonical_name: n,
              aliases: [],
            })),
          }
        : { schema_version: `${key}_v1`, extracted_claims: [`claim:${key}`] },
    ]),
  ) as Record<(typeof STORY_LAYER_KEYS)[number], Record<string, unknown>>;
}

const coverageSummaryBase = {
  protagonists: [] as string[],
  co_protagonists: [] as string[],
  antagonists: [] as string[],
  major_secondary_characters: [] as string[],
  animal_companions: [] as string[],
  missing_or_underweighted: [] as string[],
  relational_engines: [] as string[],
  unresolved_promises: [] as string[],
  ending_accountability_warnings: [] as string[],
  symbol_payoff_items: [] as Array<{
    object: string;
    attached_characters: string[];
    first_chunk: number;
    last_chunk: number;
    first_function: string;
    later_payoff: string | null;
    status: 'resolved' | 'active' | 'dropped' | 'intentionally_unresolved';
    traced: boolean;
  }>,
  tracker: {
    targets: {
      protagonists_required: 1,
      co_protagonist_required: false,
      unresolved_promises_required: 0,
      antagonist_pressure_required: 1,
      symbol_payoff_required: 0,
      relational_engine_required: 0,
      major_secondary_required: 0,
    },
    observed: {
      protagonists: 1,
      co_protagonists: 0,
      unresolved_promises: 0,
      antagonist_pressure: 1,
      symbol_payoff_items: 0,
      relational_engines: 0,
      major_secondary_characters: 0,
    },
    hard_fail_triggers: [] as string[],
    warning_triggers: [] as string[],
    coverage_ratio: 1,
    coverage_grade: 'complete' as const,
  },
};

function makeLedger(opts: {
  endingAccountabilityWarnings?: string[];
  protagonists?: string[];
}): Pass1aCharacterLedger {
  return {
    schema_version: 'pass1a_character_ledger_v1',
    prompt_version: 'test-repair-reasons-v1',
    job_id: 'job-repair-reasons-test',
    generated_at: '2026-06-01T00:00:00.000Z',
    total_chunks_processed: 1,
    entries: [makeLedgerEntry('Test Protagonist', 'protagonist')],
    coverage_summary: {
      ...coverageSummaryBase,
      protagonists: opts.protagonists ?? ['Test Protagonist'],
      ending_accountability_warnings: opts.endingAccountabilityWarnings ?? [],
    },
  };
}

function makeV2(names: string[]): CharacterLedgerV2 {
  return {
    schema_version: 'character_ledger_v2',
    prompt_version: 'test-repair-reasons-v1',
    job_id: 'job-repair-reasons-test',
    generated_at: '2026-06-01T00:00:00.000Z',
    total_chunks_processed: 1,
    identityLedger: names.map(makeIdentityEntry),
    relationshipLedger: [],
    objectLedger: [],
    activeBlockers: [],
  };
}

// Four distinct ending-accountability warnings deterministically produce four
// 'ending_accountability' root-cause warnings → count > 3 → repair_required.
const FOUR_WARNINGS = [
  'Major character "Fritz" has no ending accountability',
  'Major character "Schultz" has no ending accountability',
  'Major character "Martin" has no ending accountability',
  'Major character "Robin" has no ending accountability',
];

describe('ledger_quality_report_v1 repair-reason observability', () => {
  it('more than three root-cause warnings produces repair_required', () => {
    const report = buildLedgerQualityReport(
      makeLedger({ endingAccountabilityWarnings: FOUR_WARNINGS }),
      makeV2(['Test Protagonist']),
      makeCleanLayers(['Test Protagonist']),
    );
    expect(report.gate_ready_status).toBe('repair_required');
  });

  it('repair_reasons discloses the exact contributing root-cause warnings and reconciles with the count', () => {
    const report = buildLedgerQualityReport(
      makeLedger({ endingAccountabilityWarnings: FOUR_WARNINGS }),
      makeV2(['Test Protagonist']),
      makeCleanLayers(['Test Protagonist']),
    );

    // Invariant: count === array length.
    expect(report.root_cause_warning_count).toBe(report.repair_reasons.length);
    expect(report.repair_reasons.length).toBeGreaterThan(3);

    // The four ending-accountability warnings are present with full detail.
    const messages = report.repair_reasons.map((r) => r.message);
    for (const warn of FOUR_WARNINGS) {
      expect(messages).toContain(warn);
    }
    const endingReason = report.repair_reasons.find((r) => r.key === 'ending_accountability');
    expect(endingReason).toBeDefined();
    expect(endingReason!.layer).toBe('threat_antagonist_ending_layer');
    expect(endingReason!.evidence_reference).toBe(
      'pass1a_character_ledger_v1.coverage_summary.ending_accountability_warnings',
    );
  });

  it('excludes identity_dependency:* cascade warnings from repair_reasons', () => {
    const report = buildLedgerQualityReport(
      makeLedger({ endingAccountabilityWarnings: FOUR_WARNINGS }),
      makeV2(['Test Protagonist']),
      makeCleanLayers(['Test Protagonist']),
    );
    expect(report.repair_reasons.some((r) => r.key.startsWith('identity_dependency:'))).toBe(false);
  });

  it('keeps blocking_reasons reserved for true blocks (empty under advisory repair_required)', () => {
    const report = buildLedgerQualityReport(
      makeLedger({ endingAccountabilityWarnings: FOUR_WARNINGS }),
      makeV2(['Test Protagonist']),
      makeCleanLayers(['Test Protagonist']),
    );
    // Reproduces the production shape: repair_required + empty blocking_reasons,
    // now explained by repair_reasons rather than looking evidence-free.
    expect(report.gate_ready_status).toBe('repair_required');
    expect(report.blocking_reasons).toEqual([]);
    expect(report.root_cause_warning_count).toBeGreaterThan(3);
  });

  it('a reviewable report carries fewer advisory repair reasons without being repair_required', () => {
    const report = buildLedgerQualityReport(
      makeLedger({
        endingAccountabilityWarnings: ['Major character "Fritz" has no ending accountability'],
      }),
      makeV2(['Test Protagonist']),
      makeCleanLayers(['Test Protagonist']),
    );
    expect(report.gate_ready_status).toBe('reviewable');
    expect(report.root_cause_warning_count).toBeLessThanOrEqual(3);
    expect(report.root_cause_warning_count).toBe(report.repair_reasons.length);
  });
});
