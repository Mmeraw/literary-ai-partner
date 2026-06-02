import { buildStoryLayerFromLedger } from '@/lib/evaluation/phase1a/buildStoryLayerFromLedger';
import { buildLedgerQualityReport } from '@/lib/evaluation/phase1a/buildLedgerQualityReport';
import type {
  CharacterIdentityLedgerEntry,
  CharacterLedgerV2,
  Pass1aCharacterLedger,
} from '@/lib/evaluation/pipeline/types';

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

function makeLedgerWithNoCharacters(): Pass1aCharacterLedger {
  return {
    schema_version: 'pass1a_character_ledger_v1',
    prompt_version: 'test-fail-closed',
    job_id: 'job-fail-closed',
    generated_at: '2026-06-01T00:00:00.000Z',
    entries: [],
    coverage_summary: {
      protagonists: [],
      co_protagonists: [],
      antagonists: [],
      major_secondary_characters: [],
      missing_or_underweighted: [],
      relational_engines: [],
      unresolved_promises: [],
      ending_accountability_warnings: [],
      hard_fail_triggers: [],
      symbol_payoff_items: [],
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
          protagonists: 0,
          co_protagonists: 0,
          unresolved_promises: 0,
          antagonist_pressure: 0,
          symbol_payoff_items: 0,
          relational_engines: 0,
          major_secondary_characters: 0,
        },
        hard_fail_triggers: [],
        warning_triggers: [],
        coverage_ratio: 0,
        coverage_grade: 'incomplete',
      },
    },
    total_chunks: 1,
  };
}

function makePollutedV2(): CharacterLedgerV2 {
  return {
    schema_version: 'character_ledger_v2',
    prompt_version: 'test-fail-closed',
    job_id: 'job-fail-closed',
    generated_at: '2026-06-01T00:00:00.000Z',
    total_chunks_processed: 1,
    identityLedger: [
      makeIdentityEntry('The narrator'),
      makeIdentityEntry('I_narrator'),
      makeIdentityEntry('The river'),
    ],
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
          protagonists: 0,
          co_protagonists: 0,
          unresolved_promises: 0,
          antagonist_pressure: 0,
          symbol_payoff_items: 0,
          major_secondary_characters: 0,
          relational_engines: 0,
        },
        hard_fail_triggers: [],
        warning_triggers: [],
        coverage_ratio: 0,
        coverage_grade: 'incomplete',
      },
    },
  };
}

describe('fail-closed Story Ledger consistency guards', () => {
  it('blocks identity projection when v1 character ledger is empty', () => {
    const payload = buildStoryLayerFromLedger(makeLedgerWithNoCharacters(), makePollutedV2());

    const canonical = payload.canonical_identity_layer as Record<string, unknown>;
    const sourceIntegrity = payload.source_integrity_layer as Record<string, unknown>;

    expect(canonical.identity_group_count).toBe(0);
    expect(canonical.identity_merge_status).toBe('FAILED_INTERNAL_CONSISTENCY');
    expect(sourceIntegrity.story_layer_status).toBe('failed_internal_consistency');
  });

  it('marks quality report blocked/operator-required on v1 empty + v2 non-empty inconsistency', () => {
    const ledger = makeLedgerWithNoCharacters();
    const ledgerV2 = makePollutedV2();
    const layers = buildStoryLayerFromLedger(ledger, ledgerV2);
    const report = buildLedgerQualityReport(ledger, ledgerV2, layers);

    expect(report.gate_ready_status).toBe('blocked_content_hard_fail');
    expect(report.hard_fail_present).toBe(true);
    expect(report.recommended_review_action).toBe('operator_review_required');
    expect(report.blocking_reasons.join(' ')).toContain('HARD_FAIL');
    expect(report.blocking_reasons.join(' ')).toContain('zero verified characters');
  });

  it('classifies reducer failure as retryable technical block before content blockers', () => {
    const ledger = makeLedgerWithNoCharacters();
    const ledgerV2 = makePollutedV2();
    const layers = buildStoryLayerFromLedger(ledger, ledgerV2);
    const report = buildLedgerQualityReport(
      ledger,
      ledgerV2,
      layers,
      {
        chunkCoverage: {
          chunks_expected: 13,
          chunks_completed: 10,
        },
        preflightReducer: {
          reducer_status: 'failed',
          preflight_authority: 'unavailable',
        },
      },
    );

    expect(report.gate_ready_status).toBe('blocked_retryable_technical');
    expect(report.recommended_review_action).toBe('retry_phase1a_technical_recovery');
    expect(report.blocking_reasons.join(' ')).toContain('TECHNICAL_BLOCK');
    expect(report.blocking_reasons.join(' ')).toContain('chunk coverage incomplete');
  });
});
