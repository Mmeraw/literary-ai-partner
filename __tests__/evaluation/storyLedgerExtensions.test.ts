/**
 * Tests for canon_correction_playbook_v1 wiring:
 *   - Phase 0 governance block injection
 *   - Story Layer / Story Ledger extension type fields
 *   - validateClosureScore Phase 2 guard
 *   - RecommendationValidity union
 */

import fs from 'fs';
import path from 'path';
import {
  RECOMMENDATION_VALIDITY_VALUES,
  shouldFlagStoryLedgerLaneMapWarning,
  validateClosureScore,
  type RecommendationValidity,
  type RecommendationValidityFields,
  type StoryLedgerCoverageRisk,
  type StoryLedgerExtensions,
  type StoryLedgerLane,
  type StoryLedgerVocabNote,
} from '../../lib/evaluation/phase1a/storyLedgerExtensions';

describe('canon_correction_playbook_v1 — Phase 0 governance block', () => {
  // We string-check the source of processor.ts rather than executing it; the
  // Phase 0 prompt is a runtime concatenation through OpenAI and importing the
  // processor would pull in Supabase + OpenAI clients in the test env.
  const processorSrc = fs.readFileSync(
    path.resolve(__dirname, '../../lib/evaluation/processor.ts'),
    'utf8',
  );

  it('includes the canonical pass1a_story_layer_v1 artifact name in the governance block', () => {
    expect(processorSrc).toContain('pass1a_story_layer_v1');
  });

  it('does not introduce the non-canonical pass1a_story_ledger_v1 artifact name in the governance block', () => {
    expect(processorSrc).not.toContain('pass1a_story_ledger_v1');
  });

  it('includes the ALREADY_PRESENT recommendation validity in the governance block', () => {
    expect(processorSrc).toContain('ALREADY_PRESENT');
  });

  it('includes the Narrative Closure scoring prohibition in the governance block', () => {
    expect(processorSrc).toContain('Narrative Closure');
  });
});

describe('canon_correction_playbook_v1 — Story Ledger extension types', () => {
  it('accepts an extension payload with all three optional layers populated', () => {
    const lane: StoryLedgerLane = {
      lane_type: 'medicine_object',
      name: 'Healing relic chain',
      key_entities: ['relic_a', 'relic_b'],
      evidence_strength: 'strong',
      included: true,
    };
    const risk: StoryLedgerCoverageRisk = {
      entity: 'Rana',
      entity_type: 'character',
      risk: 'Relationship spine arc under-mapped',
      evidence_note: 'Chunks 12-18 not surfaced',
    };
    const vocab: StoryLedgerVocabNote = {
      candidate_label: 'poaching',
      source_supported: false,
      recommended_replacement: 'unauthorized harvest',
    };
    const ext: StoryLedgerExtensions = {
      story_ledger_lane_map: [lane],
      coverage_risk_register: [risk],
      vocabulary_extraction_note: [vocab],
    };

    expect(ext.story_ledger_lane_map).toHaveLength(1);
    expect(ext.coverage_risk_register).toHaveLength(1);
    expect(ext.vocabulary_extraction_note).toHaveLength(1);
  });

  it('accepts an empty extension payload — all three fields are optional', () => {
    const ext: StoryLedgerExtensions = {};
    expect(ext.story_ledger_lane_map).toBeUndefined();
    expect(ext.coverage_risk_register).toBeUndefined();
    expect(ext.vocabulary_extraction_note).toBeUndefined();
  });

  it('shouldFlagStoryLedgerLaneMapWarning returns true when lane map is empty or missing', () => {
    expect(shouldFlagStoryLedgerLaneMapWarning(null)).toBe(true);
    expect(shouldFlagStoryLedgerLaneMapWarning(undefined)).toBe(true);
    expect(shouldFlagStoryLedgerLaneMapWarning({})).toBe(true);
    expect(shouldFlagStoryLedgerLaneMapWarning({ story_ledger_lane_map: [] })).toBe(true);
  });

  it('shouldFlagStoryLedgerLaneMapWarning returns false when lane map is populated', () => {
    expect(
      shouldFlagStoryLedgerLaneMapWarning({
        story_ledger_lane_map: [
          {
            lane_type: 'plot',
            name: 'Lane',
            key_entities: ['x'],
            evidence_strength: 'strong',
            included: true,
          },
        ],
      }),
    ).toBe(false);
  });
});

describe('canon_correction_playbook_v1 — validateClosureScore', () => {
  it('invalidates when the Relationship Spine Layer is empty', () => {
    const result = validateClosureScore(4.0, []);
    expect(result.invalidated).toBe(true);
    expect(result.score).toBe(4.0);
    expect(result.reason).toMatch(/relationship_spine_layer/);
  });

  it('invalidates when the Relationship Spine Layer is null or undefined', () => {
    expect(validateClosureScore(4.0, null).invalidated).toBe(true);
    expect(validateClosureScore(4.0, undefined).invalidated).toBe(true);
  });

  it('does NOT invalidate when the Relationship Spine Layer has entries', () => {
    const result = validateClosureScore(4.0, [{ name: 'Rana-Newton' }]);
    expect(result.invalidated).toBe(false);
    expect(result.score).toBe(4.0);
    expect(result.reason).toBeUndefined();
  });
});

describe('canon_correction_playbook_v1 — RecommendationValidity union', () => {
  it('includes all six canonical validity values', () => {
    expect(RECOMMENDATION_VALIDITY_VALUES).toEqual([
      'VALID',
      'PARTIALLY_VALID',
      'ALREADY_PRESENT',
      'CANON_FALSE',
      'SOURCE_UNSUPPORTED',
      'VOICE_RISK',
    ]);
  });

  it('compiles as an optional field on a recommendation-shaped object', () => {
    const sample: RecommendationValidityFields = { validity: 'ALREADY_PRESENT' };
    const validity: RecommendationValidity = sample.validity!;
    expect(validity).toBe('ALREADY_PRESENT');
  });
});
