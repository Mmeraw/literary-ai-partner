/**
 * Ancient Bloodlines Legacy Fixture Sanity Checks
 *
 * This suite validates a preserved historical fixture. It is intentionally
 * EvaluationReportV1 and intentionally 12-criterion. It is not current
 * production-output authority.
 *
 * Current production shape is governed by:
 * - schemas/criteria-keys.ts
 * - lib/evaluation/signal/scopePolicy.ts
 * - docs/governance/evaluation-output-mode-contract.md
 */

import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import { SCOPE_POLICY_VERSION } from '@/lib/evaluation/signal/scopePolicy';
import { classifySubmissionScope } from '@/lib/evaluation/pipeline/submissionScope';
import expected from '../../../testdata/evaluation/ancient-bloodlines.shortform.model.json';

const LEGACY_CRITERION_COUNT = 12;
const LEGACY_TO_CANONICAL: Record<string, string> = {
  concept_core_premise: 'concept',
  narrative_drive_momentum: 'narrativeDrive',
  character_depth_psychology: 'character',
  pov_voice_tone: 'voice',
  scene_construction_function: 'sceneConstruction',
  dialogue_subtext: 'dialogue',
  theme_intelligence: 'theme',
  world_building_logic: 'worldbuilding',
  pacing_structural_balance: 'pacing',
  prose_line_level: 'proseControl',
  narrative_closure_promises: 'narrativeClosure',
  professional_readiness_market: 'marketability',
};

function makeWordText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, index) => `word${index}`).join(' ');
}

describe('Ancient Bloodlines legacy fixture invariants', () => {
  describe('Legacy classification', () => {
    it('is explicitly preserved as an EvaluationReportV1 legacy fixture', () => {
      expect(expected.schemaVersion).toBe('EvaluationReportV1');
      expect(expected.route).toBe('SHORTFORM');
      expect(expected.criteria.length).toBe(LEGACY_CRITERION_COUNT);
      expect(CRITERIA_KEYS.length).toBe(13);
    });

    it('documents the current natural scope for the 18k-word historical fixture', () => {
      const scope = classifySubmissionScope(makeWordText(expected.wordCount), 13, 'standalone');

      expect(scope.inputScale).toBe('novelette');
      expect(scope.scopePolicyVersion).toBe(SCOPE_POLICY_VERSION);
      expect(scope.wordCount).toBe(expected.wordCount);
    });

    it('maps legacy criterion keys to the current canonical registry where possible', () => {
      const currentKeys = new Set<string>(CRITERIA_KEYS);

      for (const c of expected.criteria) {
        const mapped = LEGACY_TO_CANONICAL[c.criterionKey];
        expect(mapped).toBeDefined();
        expect(currentKeys.has(mapped)).toBe(true);
      }

      expect(Object.values(LEGACY_TO_CANONICAL)).not.toContain('tone');
      expect(currentKeys.has('tone')).toBe(true);
    });
  });

  describe('Legacy score/status invariants', () => {
    it('keeps SCORABLE criteria numeric and non-SCORABLE criteria null', () => {
      for (const c of expected.criteria) {
        if (c.status === 'SCORABLE') {
          expect(typeof c.score).toBe('number');
          expect(c.score).toBeGreaterThanOrEqual(0);
          expect(c.score).toBeLessThanOrEqual(10);
        } else {
          expect(c.score).toBeNull();
        }
      }
    });

    it('keeps closure as insufficient signal rather than a zero score', () => {
      const closure = expected.criteria.find((c) => c.criterionKey === 'narrative_closure_promises');
      expect(closure?.status).toBe('INSUFFICIENT_SIGNAL');
      expect(closure?.score).toBeNull();
      expect(closure?.score).not.toBe(0);
    });
  });

  describe('Preserved regression lessons', () => {
    it('preserves major recurring cast metadata', () => {
      const canon = expected.canonicalCharacters.join(',').toLowerCase();
      expect(canon).toContain('newton');
      expect(canon).toContain('twillow');
      expect(canon).toContain('rana');
      expect(canon).toContain('thorander');
      expect(canon).toContain('snappy');
    });

    it('preserves craft versus intelligence separation', () => {
      const dialogue = expected.criteria.find((c) => c.criterionKey === 'dialogue_subtext');
      const prose = expected.criteria.find((c) => c.criterionKey === 'prose_line_level');
      const theme = expected.criteria.find((c) => c.criterionKey === 'theme_intelligence');
      const world = expected.criteria.find((c) => c.criterionKey === 'world_building_logic');

      expect(dialogue?.score).toBeLessThan(theme?.score ?? 0);
      expect(prose?.score).toBeLessThanOrEqual(world?.score ?? 0);
    });

    it('keeps governance notes explicit', () => {
      expect(expected.governanceNotes.craftVsIntelligence).not.toBe('');
      expect(expected.governanceNotes.closureHandling).toContain('INSUFFICIENT_SIGNAL');
      expect(expected.governanceNotes.canonContinuity).toContain('test failure');
    });
  });
});
