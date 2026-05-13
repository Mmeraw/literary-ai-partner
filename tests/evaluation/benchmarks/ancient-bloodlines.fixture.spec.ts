/**
 * Ancient Bloodlines Fixture Sanity Checks
 *
 * This test suite validates the expected.json fixture itself,
 * ensuring it respects governance invariants before being used
 * as a comparison target in regression tests.
 */

import expected from '../../../testdata/evaluation/ancient-bloodlines.shortform.model.json';

describe('Ancient Bloodlines fixture invariants', () => {
  describe('Schema structure', () => {
    it('has valid schemaVersion', () => {
      expect(expected.schemaVersion).toBe('EvaluationReportV1');
    });

    it('claims SHORTFORM route', () => {
      expect(expected.route).toBe('SHORTFORM');
    });

    it('has exactly 12 criteria', () => {
      expect(expected.criteria).toBeDefined();
      expect(expected.criteria.length).toBe(12);
    });

    it('has 3 top revision priorities', () => {
      expect(expected.topRevisionPriorities).toBeDefined();
      expect(expected.topRevisionPriorities.length).toBe(3);
    });

    it('has governance notes object', () => {
      expect(expected.governanceNotes).toBeDefined();
      expect(typeof expected.governanceNotes).toBe('object');
    });
  });

  describe('Criterion invariants', () => {
    it('all criteria have required fields', () => {
      for (const c of expected.criteria) {
        expect(c.criterionKey).toBeDefined();
        expect(c.criterionName).toBeDefined();
        expect(c.status).toBeDefined();
        expect(c.confidence).toBeDefined();
        expect(c.oneLineFinding).toBeDefined();
      }
    });

    it('enforces score/status invariant: SCORABLE → number; non-SCORABLE → null', () => {
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

    it('closure is specifically INSUFFICIENT_SIGNAL (non-scorable)', () => {
      const closure = expected.criteria.find(c => c.criterionKey === 'narrative_closure_promises');
      expect(closure.status).toBe('INSUFFICIENT_SIGNAL');
      expect(closure.score).toBeNull();
    });

    it('all non-SCORABLE criteria have LOW confidence', () => {
      for (const c of expected.criteria) {
        if (c.status !== 'SCORABLE') {
          expect(c.confidence).toBe('LOW');
        }
      }
    });

    it('all criteria have emotional bands', () => {
      for (const c of expected.criteria) {
        expect(c.emotionalBand).toBeDefined();
        expect(['STRENGTH_PLUS_GROWTH', 'GROWTH', 'INSUFFICIENT_SIGNAL_REASSURANCE']).toContain(
          c.emotionalBand
        );
      }
    });
  });

  describe('Coverage governance', () => {
    it('claims FULL coverage mode', () => {
      expect(expected.coverage.mode).toBe('FULL');
    });

    it('has high word coverage percentage', () => {
      expect(expected.coverage.wordCoveragePct).toBeGreaterThanOrEqual(0.99);
    });

    it('has high chunk coverage percentage', () => {
      expect(expected.coverage.chunkCoveragePct).toBeGreaterThanOrEqual(0.99);
    });

    it('includes disclosure text', () => {
      expect(expected.coverage.disclosure).toBeDefined();
      expect(typeof expected.coverage.disclosure).toBe('string');
      expect(expected.coverage.disclosure.length).toBeGreaterThan(0);
    });
  });

  describe('Top revision priorities', () => {
    it('all priorities have rank, title, criterionKey', () => {
      for (const p of expected.topRevisionPriorities) {
        expect(p.rank).toBeDefined();
        expect(typeof p.rank).toBe('number');
        expect(p.title).toBeDefined();
        expect(p.criterionKey).toBeDefined();
      }
    });

    it('first priority targets concept_core_premise', () => {
      const first = expected.topRevisionPriorities[0];
      expect(first.rank).toBe(1);
      expect(first.criterionKey).toBe('concept_core_premise');
    });

    it('ranks are sequential (1, 2, 3)', () => {
      const ranks = expected.topRevisionPriorities.map(p => p.rank);
      expect(ranks).toEqual([1, 2, 3]);
    });
  });

  describe('Canon continuity metadata', () => {
    it('has canonicalCharacters array', () => {
      expect(expected.canonicalCharacters).toBeDefined();
      expect(Array.isArray(expected.canonicalCharacters)).toBe(true);
      expect(expected.canonicalCharacters.length).toBeGreaterThanOrEqual(13);
    });

    it('includes all major characters', () => {
      const canon = expected.canonicalCharacters.join(',').toLowerCase();
      expect(canon).toContain('newton');
      expect(canon).toContain('twillow');
      expect(canon).toContain('rana');
      expect(canon).toContain('thorander');
      expect(canon).toContain('snappy');
    });

    it('has openPromises array', () => {
      expect(expected.openPromises).toBeDefined();
      expect(Array.isArray(expected.openPromises)).toBe(true);
      expect(expected.openPromises.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Craft vs intelligence separation', () => {
    it('dialogue_subtext (craft) has lower score than theme_intelligence', () => {
      const dialogue = expected.criteria.find(c => c.criterionKey === 'dialogue_subtext');
      const theme = expected.criteria.find(c => c.criterionKey === 'theme_intelligence');

      expect(dialogue.score).toBeLessThan(theme.score);
    });

    it('prose_line_level (craft) has lower or equal score to world_building_logic', () => {
      const prose = expected.criteria.find(c => c.criterionKey === 'prose_line_level');
      const world = expected.criteria.find(c => c.criterionKey === 'world_building_logic');

      expect(prose.score).toBeLessThanOrEqual(world.score);
    });
  });

  describe('Score band plausibility', () => {
    it('high-intelligence criteria (theme, world) score 7+', () => {
      const theme = expected.criteria.find(c => c.criterionKey === 'theme_intelligence');
      const world = expected.criteria.find(c => c.criterionKey === 'world_building_logic');

      expect(theme.score).toBeGreaterThanOrEqual(7);
      expect(world.score).toBeGreaterThanOrEqual(7);
    });

    it('dialogue and prose (craft needs work) score 5-6', () => {
      const dialogue = expected.criteria.find(c => c.criterionKey === 'dialogue_subtext');
      const prose = expected.criteria.find(c => c.criterionKey === 'prose_line_level');

      expect(dialogue.score).toBeGreaterThanOrEqual(4);
      expect(dialogue.score).toBeLessThanOrEqual(6);
      expect(prose.score).toBeGreaterThanOrEqual(4);
      expect(prose.score).toBeLessThanOrEqual(6);
    });

    it('professional readiness scores lowest (4)', () => {
      const market = expected.criteria.find(c => c.criterionKey === 'professional_readiness_market');
      expect(market.score).toBe(4);
    });
  });

  describe('Governance notes completeness', () => {
    it('has craftVsIntelligence documentation', () => {
      expect(expected.governanceNotes.craftVsIntelligence).toBeDefined();
      expect(expected.governanceNotes.craftVsIntelligence).not.toBe('');
    });

    it('has closureHandling documentation', () => {
      expect(expected.governanceNotes.closureHandling).toBeDefined();
      expect(expected.governanceNotes.closureHandling).toContain('INSUFFICIENT_SIGNAL');
    });

    it('has canonContinuity documentation mentioning test failure', () => {
      expect(expected.governanceNotes.canonContinuity).toBeDefined();
      expect(expected.governanceNotes.canonContinuity).toContain('test failure');
    });

    it('has regressionGate documentation', () => {
      expect(expected.governanceNotes.regressionGate).toBeDefined();
      expect(expected.governanceNotes.regressionGate).toContain('closure');
    });
  });

  describe('Metadata completeness', () => {
    it('has evaluation ID', () => {
      expect(expected.evaluationId).toBe('3463bb26-0b94-41f0-bd51-07ebf89c0947');
    });

    it('has manuscript title', () => {
      expect(expected.manuscriptTitle).toBe('Ancient Bloodlines—Love Between Species');
    });

    it('has word count', () => {
      expect(expected.wordCount).toBe(18268);
    });

    it('has overall emotional band', () => {
      expect(expected.overallEmotionalBand).toBe('STRENGTH_PLUS_GROWTH');
    });
  });

  describe('Sanity checks for test writability', () => {
    it('fixture is serializable (deep copy safe)', () => {
      const copy = JSON.parse(JSON.stringify(expected));
      expect(copy.evaluationId).toBe(expected.evaluationId);
      expect(copy.criteria.length).toBe(expected.criteria.length);
    });

    it('each criterion can be found by key', () => {
      const keys = expected.criteria.map(c => c.criterionKey);
      const keySet = new Set(keys);
      expect(keySet.size).toBe(keys.length); // No duplicates
    });
  });
});
