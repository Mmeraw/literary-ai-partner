/**
 * hardFailTriageGate.test.ts
 *
 * Regression tests for the refined hard-fail triage logic in
 * buildLedgerQualityReport.  Each test corresponds to one of the
 * five observed production failures plus the positive-control case.
 *
 * Acceptance criteria (verbatim from the engineering handoff):
 *   1. No LLM-declared WARN becomes hard_fail.
 *   2. No contaminated entity can create an ending-accountability hard-fail.
 *   3. No short-form job requires accepted_story_ledger_v1 (tested in processor).
 *   4. No content hard-fail is emitted when preflight authority is unavailable.
 *   5. True long-form primary-character hard-fails remain possible when
 *      evidence authority is clean.
 *   6. Fresh eval jobs complete or route to a correct retryable technical
 *      state; they do not enter watchdog/requeue loops.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLedgerEntry(
  name: string,
  role: Pass1aRoleSignal = 'secondary',
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
    narrative_weight_band: role === 'protagonist' || role === 'co_protagonist' ? 'primary' : 'supporting',
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

/** Build minimal clean story layers so identity dependency assessment
 *  does not produce hard-fails unrelated to triage logic under test. */
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
  entries?: CharacterArcLedgerEntry[];
  hardFailTriggers?: string[];
  protagonists?: string[];
}): Pass1aCharacterLedger {
  return {
    schema_version: 'pass1a_character_ledger_v1',
    prompt_version: 'test-triage-v1',
    job_id: 'job-triage-test',
    generated_at: '2026-06-01T00:00:00.000Z',
    total_chunks_processed: 1,
    entries: opts.entries ?? [makeLedgerEntry('Test Protagonist', 'protagonist')],
    coverage_summary: {
      ...coverageSummaryBase,
      protagonists: opts.protagonists ?? ['Test Protagonist'],
      hard_fail_triggers: opts.hardFailTriggers ?? [],
    },
  };
}

function makeV2(names: string[]): CharacterLedgerV2 {
  return {
    schema_version: 'character_ledger_v2',
    prompt_version: 'test-triage-v1',
    job_id: 'job-triage-test',
    generated_at: '2026-06-01T00:00:00.000Z',
    total_chunks_processed: 1,
    identityLedger: names.map(makeIdentityEntry),
    stateTimelines: [],
    relationshipLedger: [],
    psychologyLedger: [],
    objectLedger: [],
    terminalLedger: [],
    validationQueries: {
      characterPresenceIndex: {},
      coPresenceIndex: {},
      nameStateIndex: {},
      copingIndex: {},
      objectPresenceIndex: {},
      symbolPayoffIndex: {},
      unresolvedPromisesIndex: {},
    },
    activeBlockers: [],
    negativeKnowledge: [],
    stateConflicts: [],
    characterCoverage: {},
    coverage_summary: {
      protagonists: [],
      co_protagonists: [],
      antagonists: [],
      major_secondary_characters: [],
      missing_or_underweighted: [],
      unresolved_promises: [],
      symbol_payoff_items: [],
      hard_fail_triggers: [],
      ending_accountability_warnings: [],
      high_value_objects: [],
      low_confidence_entities: [],
      tracker: {
        targets: {
          protagonists_required: 1,
          co_protagonist_required: false,
          unresolved_promises_required: 0,
          antagonist_pressure_required: 1,
          symbol_payoff_required: 0,
          major_secondary_required: 0,
          relational_engine_required: 0,
        },
        observed: {
          protagonists: 1,
          co_protagonists: 0,
          unresolved_promises: 0,
          antagonist_pressure: 1,
          symbol_payoff_items: 0,
          major_secondary_characters: 0,
          relational_engines: 0,
        },
        hard_fail_triggers: [],
        warning_triggers: [],
        coverage_ratio: 1,
        coverage_grade: 'complete',
      },
    },
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('hard-fail triage gate — pipeline unblock regression tests', () => {
  // ── Test 1: WARN in hard_fail_triggers must not block ────────────────────
  // Modeled on job 6ed06df1 (281 words, micro excerpt).
  // LLM produced: "WARN: No co-protagonist detected"
  it('WARN-prefixed LLM item in hard_fail_triggers does not become hard_fail', () => {
    const ledger = makeLedger({
      hardFailTriggers: ['WARN: No co-protagonist detected'],
      protagonists: ['Narrator'],
      entries: [makeLedgerEntry('Narrator', 'protagonist')],
    });
    const v2 = makeV2(['Narrator']);
    const report = buildLedgerQualityReport(ledger, v2, makeCleanLayers(['Narrator']));

    expect(report.hard_fail_present).toBe(false);
    expect(report.gate_ready_status).not.toBe('blocked');
    // The WARN should appear as a warning, not a hard-fail.
    const allMessages = Object.values(report.grouped_warning_summary).flat();
    expect(allMessages.some((m) => /WARN.*co-protagonist/i.test(m))).toBe(true);
  });

  // ── Test 2: Contaminated pseudo-entities suppressed ──────────────────────
  // Modeled on job 37a3ca7e (37,810 words) with garbage IDs:
  // "Primary He", "Unknown Character", "She_main_unnamed", etc.
  it('entity-typing contamination is suppressed before accountability checks', () => {
    const contaminatedTriggers = [
      'HARD_FAIL: Major character "Primary He" has no ending accountability',
      'HARD_FAIL: Major character "Unknown Character" has no ending accountability',
      'HARD_FAIL: Major character "She_main_unnamed" has no ending accountability',
      'HARD_FAIL: Major character "central_woman" has no ending accountability',
    ];
    const ledger = makeLedger({
      hardFailTriggers: contaminatedTriggers,
      entries: [makeLedgerEntry('Real Protagonist', 'protagonist')],
      protagonists: ['Real Protagonist'],
    });
    const v2 = makeV2(['Real Protagonist']);
    const report = buildLedgerQualityReport(ledger, v2, makeCleanLayers(['Real Protagonist']));

    expect(report.hard_fail_present).toBe(false);
    expect(report.gate_ready_status).not.toBe('blocked');
  });

  // ── Test 3: Short-form bypass ────────────────────────────────────────────
  // Short-form bypass is tested in processor.ts tests; here we verify that
  // a 7,261-word job's hard-fail triggers are triaged correctly in the
  // quality report even before the processor bypass kicks in.
  // Modeled on job f5751af0 (7,261 words).
  it('short-form content findings with reducer failure route to retryable technical block', () => {
    const ledger = makeLedger({
      hardFailTriggers: [
        'HARD_FAIL: Major character "Elena" has no ending accountability',
      ],
      entries: [makeLedgerEntry('Elena', 'protagonist')],
      protagonists: ['Elena'],
    });
    const v2 = makeV2(['Elena']);
    const report = buildLedgerQualityReport(ledger, v2, makeCleanLayers(['Elena']), {
      preflightReducer: {
        reducer_status: 'failed',
        preflight_authority: 'unavailable',
      },
    });

    // Reducer failure takes precedence — routes to retryable technical.
    expect(report.gate_ready_status).toBe('blocked_retryable_technical');
    expect(report.recommended_review_action).toBe('retry_phase1a_technical_recovery');
  });

  // ── Test 4: Degraded authority blocks content certainty ──────────────────
  // Modeled on job f2c4d953 (26,345 words).
  // When preflight authority is degraded (not full), content hard-fails
  // must route to insufficient_evidence, not terminal block.
  it('no content hard-fail when preflight authority is reduced/advisory', () => {
    const ledger = makeLedger({
      hardFailTriggers: [
        'HARD_FAIL: Major character "Marcus" has no ending accountability',
      ],
      entries: [makeLedgerEntry('Marcus', 'protagonist')],
      protagonists: ['Marcus'],
    });
    const v2 = makeV2(['Marcus']);

    // Authority is "reduced" (not "full") — content certainty insufficient.
    const report = buildLedgerQualityReport(ledger, v2, makeCleanLayers(['Marcus']), {
      preflightReducer: {
        reducer_status: 'ok',
        preflight_authority: 'reduced',
      },
    });

    // Must not be a content hard-fail when authority is degraded.
    expect(report.hard_fail_present).toBe(false);
    expect(report.gate_ready_status).not.toBe('blocked');
    const allMessages = Object.values(report.grouped_warning_summary).flat();
    expect(allMessages.some((m) => /INSUFFICIENT_EVIDENCE/i.test(m))).toBe(true);
  });

  // ── Test 5: Supporting-character ending accountability → warning ─────────
  // Modeled on job 35d19440 (49,702 words, The Awakening).
  // "Madame Lebrun has no ending accountability" — she's a secondary
  // character, so this is a craft finding, not a pipeline block.
  it('supporting-character ending accountability is a warning, not a hard-fail', () => {
    const ledger = makeLedger({
      hardFailTriggers: [
        'HARD_FAIL: Major character "Madame Lebrun" has no ending accountability',
        'HARD_FAIL: Major character "Edna\'s father" has no ending accountability',
      ],
      entries: [
        makeLedgerEntry('Edna Pontellier', 'protagonist'),
        makeLedgerEntry('Madame Lebrun', 'secondary'),
        makeLedgerEntry("Edna's father", 'secondary'),
      ],
      protagonists: ['Edna Pontellier'],
    });
    const v2 = makeV2(['Edna Pontellier', 'Madame Lebrun', "Edna's father"]);
    const report = buildLedgerQualityReport(ledger, v2, makeCleanLayers(['Edna Pontellier', 'Madame Lebrun', "Edna's father"]));

    // Supporting characters' ending accountability is a craft finding.
    expect(report.hard_fail_present).toBe(false);
    expect(report.gate_ready_status).not.toBe('blocked');
    const allMessages = Object.values(report.grouped_warning_summary).flat();
    expect(allMessages.some((m) => /ENDING_NOTE.*Madame Lebrun/i.test(m))).toBe(true);
    expect(allMessages.some((m) => /ENDING_NOTE.*father/i.test(m))).toBe(true);
  });

  // ── Test 6: Verified primary character in long-form CAN hard-fail ───────
  // Positive control: a protagonist in long-form with clean authority
  // and ending accountability failure must remain a genuine hard-fail.
  it('verified primary character with clean authority triggers genuine hard-fail', () => {
    const ledger = makeLedger({
      hardFailTriggers: [
        'HARD_FAIL: Major character "Edna Pontellier" has no ending accountability',
      ],
      entries: [makeLedgerEntry('Edna Pontellier', 'protagonist')],
      protagonists: ['Edna Pontellier'],
    });
    const v2 = makeV2(['Edna Pontellier']);
    // Clean authority (full or not specified = assumed full).
    const report = buildLedgerQualityReport(ledger, v2, makeCleanLayers(['Edna Pontellier']));

    expect(report.hard_fail_present).toBe(true);
    expect(report.gate_ready_status).toBe('blocked_content_hard_fail');
    expect(report.recommended_review_action).toBe('operator_review_required');
    expect(report.blocking_reasons.some((r) => /Edna Pontellier/i.test(r))).toBe(true);
  });
});
