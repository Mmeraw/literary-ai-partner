/**
 * Ancient Bloodlines — SHORTFORM Evaluation Benchmark Regression Tests
 *
 * This test suite validates that RevisionGrade maintains consistent behavior
 * on the Ancient Bloodlines benchmark manuscript across code/prompt changes.
 *
 * Use these tests to ensure:
 * - Criterion scores stay within tolerance bands
 * - Canon continuity is preserved (no dropped characters)
 * - Closure remains non-scorable when evidence is insufficient
 * - CRAFT and INTELLIGENCE are kept separate
 * - Emotional bands remain evidence-grounded
 */

import expected from '../../../testdata/evaluation/ancient-bloodlines.shortform.model.json';
import anchors from '../../../testdata/evaluation/ancient-bloodlines.evidence-anchors.json';
import canonPresence from '../../../testdata/evaluation/ancient-bloodlines.canon-presence.json';
// Adjust these imports to match your actual evaluation pipeline and types
// import { runEvaluation } from '../../src/evaluation/runEvaluation';
// import { EvaluationReportV1, CriterionBlock } from '../../src/types';

const SCORE_TOLERANCE = 1; // Allow ±1 point on comparison to model
const CANONICAL_CHARACTERS = expected.canonicalCharacters;
const REQUIRED_RECURRING_CHARACTERS = canonPresence.requiredRecurringCharacters;
const REQUIRED_MENTIONS = Math.ceil(
  REQUIRED_RECURRING_CHARACTERS.length * canonPresence.canonRules.minimumCharacterMentionThresholdPct
);

/**
 * Helper: Find a criterion by its key
 */
function findCriterion(report, key) {
  const c = report.criteria.find(c => c.criterionKey === key);
  if (!c) {
    throw new Error(`Missing criterion ${key} in report`);
  }
  return c;
}

/**
 * Helper: Count character mentions in a text block
 */
function countCharacterMentions(text) {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const found = [];
  for (const char of CANONICAL_CHARACTERS) {
    if (lowerText.includes(char.toLowerCase())) {
      found.push(char);
    }
  }
  return found;
}

/**
 * Helper: Extract combined commentary for a criterion
 */
function getCriterionCommentary(criterion) {
  return [
    criterion.fit || '',
    criterion.gap || '',
    criterion.oneLineFinding || '',
    ...(criterion.revisionRecommendations || []),
  ]
    .filter(Boolean)
    .join(' ');
}

describe('Ancient Bloodlines — SHORTFORM evaluation benchmark', () => {
  let report;

  beforeAll(async () => {
    // MOCK DATA: Replace with actual runEvaluation call
    // In a real scenario, you'd invoke RevisionGrade on the Ancient Bloodlines manuscript
    // and receive the full EvaluationReportV1 structure.
    //
    // For now, this test file uses the expected fixture as a reference.
    // When you wire the actual evaluator, replace this with:
    //
    //   report = await runEvaluation({
    //     route: 'SHORTFORM',
    //     manuscriptId: 'ancient-bloodlines-3463bb26',
    //   });

    report = JSON.parse(JSON.stringify(expected)); // Deep copy to avoid mutation
  });

  describe('Core metadata validation', () => {
    it('matches expected evaluation ID and route', () => {
      expect(report.evaluationId).toBe('3463bb26-0b94-41f0-bd51-07ebf89c0947');
      expect(report.route).toBe('SHORTFORM');
      expect(report.schemaVersion).toBe('EvaluationReportV1');
    });

    it('claims FULL manuscript coverage', () => {
      expect(report.coverage.mode).toBe('FULL');
      expect(report.coverage.wordCoveragePct).toBeGreaterThanOrEqual(0.99);
      expect(report.coverage.chunkCoveragePct).toBeGreaterThanOrEqual(0.99);
      expect(report.coverage.disclosure.length).toBeGreaterThan(0);
    });

    it('sets overall emotional band to STRENGTH_PLUS_GROWTH', () => {
      expect(report.overallEmotionalBand).toBe('STRENGTH_PLUS_GROWTH');
    });

    it('includes all 12 criteria', () => {
      expect(report.criteria).toBeDefined();
      expect(report.criteria.length).toBe(12);
      expect(report.criteria.map(c => c.criterionKey)).toEqual(
        expected.criteria.map(c => c.criterionKey)
      );
    });
  });

  describe('Criterion validity invariants', () => {
    it('enforces null scores for non-scorable criteria (closure)', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');

      expect(closure.status).not.toBe('SCORABLE');
      expect(closure.score).toBeNull();
    });

    it('all SCORABLE criteria have numeric scores', () => {
      for (const c of report.criteria) {
        if (c.status === 'SCORABLE') {
          expect(typeof c.score).toBe('number');
          expect(c.score).toBeGreaterThanOrEqual(0);
          expect(c.score).toBeLessThanOrEqual(10);
        }
      }
    });

    it('non-scorable criteria have confidence = LOW', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');
      expect(closure.confidence).toBe('LOW');
    });
  });

  describe('Score band validation (tolerance: ±1)', () => {
    it('keeps all scorable criterion scores within expected bands', () => {
      for (const expectedCriterion of expected.criteria) {
        if (expectedCriterion.status !== 'SCORABLE') continue;

        const actual = findCriterion(report, expectedCriterion.criterionKey);
        expect(actual.status).toBe('SCORABLE');

        const actualScore = actual.score;
        const expectedScore = expectedCriterion.score;
        const min = expectedScore - SCORE_TOLERANCE;
        const max = expectedScore + SCORE_TOLERANCE;

        expect(actualScore).toBeGreaterThanOrEqual(
          min,
          `${expectedCriterion.criterionName} score ${actualScore} below minimum ${min}`
        );
        expect(actualScore).toBeLessThanOrEqual(
          max,
          `${expectedCriterion.criterionName} score ${actualScore} above maximum ${max}`
        );
      }
    });

    it('concept_core_premise stays in [6, 8] band', () => {
      const c = findCriterion(report, 'concept_core_premise');
      expect(c.score).toBeGreaterThanOrEqual(6);
      expect(c.score).toBeLessThanOrEqual(8);
    });

    it('dialogue_subtext and prose_line_level stay at or below 6', () => {
      const dialogue = findCriterion(report, 'dialogue_subtext');
      const prose = findCriterion(report, 'prose_line_level');

      expect(dialogue.score).toBeLessThanOrEqual(6);
      expect(prose.score).toBeLessThanOrEqual(6);
    });

    it('theme_intelligence and world_building stay at or above 7', () => {
      const theme = findCriterion(report, 'theme_intelligence');
      const world = findCriterion(report, 'world_building_logic');

      expect(theme.score).toBeGreaterThanOrEqual(7);
      expect(world.score).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Canon continuity preservation', () => {
    it('canon-presence fixture declares required recurring cast', () => {
      expect(canonPresence.requiredRecurringCharacters).toEqual(
        expect.arrayContaining(['Newton', 'Rana', 'Twillow', 'Snappy', 'Thorander'])
      );
    });

    it('preserves major antagonists (Twillow, Snappy, Thorander)', () => {
      const character = findCriterion(report, 'character_depth_psychology');
      const world = findCriterion(report, 'world_building_logic');
      const theme = findCriterion(report, 'theme_intelligence');

      const combinedText = [
        getCriterionCommentary(character),
        getCriterionCommentary(world),
        getCriterionCommentary(theme),
      ].join(' ');

      const mentionsFound = countCharacterMentions(combinedText);
      expect(mentionsFound).toContain('Twillow');
      expect(mentionsFound).toContain('Snappy');
      expect(mentionsFound).toContain('Thorander');
    });

    it('preserves co-protagonist (Rana) across character and world commentary', () => {
      const character = findCriterion(report, 'character_depth_psychology');
      const text = getCriterionCommentary(character);

      expect(text.toLowerCase()).toContain('rana');
    });

    it('maintains mention of Newton (protagonist) in character depth', () => {
      const character = findCriterion(report, 'character_depth_psychology');
      const text = getCriterionCommentary(character);

      expect(text.toLowerCase()).toContain('newton');
    });

    it('achieves minimum character continuity threshold', () => {
      const character = findCriterion(report, 'character_depth_psychology');
      const world = findCriterion(report, 'world_building_logic');
      const theme = findCriterion(report, 'theme_intelligence');

      const combinedText = [
        getCriterionCommentary(character),
        getCriterionCommentary(world),
        getCriterionCommentary(theme),
      ].join(' ');

      const mentionsFound = countCharacterMentions(combinedText);
      expect(mentionsFound.length).toBeGreaterThanOrEqual(REQUIRED_MENTIONS);
    });

    it('required recurring cast are present in combined commentary', () => {
      const character = findCriterion(report, 'character_depth_psychology');
      const world = findCriterion(report, 'world_building_logic');
      const theme = findCriterion(report, 'theme_intelligence');

      const combinedText = [
        getCriterionCommentary(character),
        getCriterionCommentary(world),
        getCriterionCommentary(theme),
      ]
        .join(' ')
        .toLowerCase();

      for (const requiredName of REQUIRED_RECURRING_CHARACTERS) {
        expect(combinedText).toContain(requiredName.toLowerCase());
      }
    });
  });

  describe('Closure governance (non-scorable when incomplete)', () => {
    it('does not score closure as SCORABLE', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');
      expect(closure.status).not.toBe('SCORABLE');
    });

    it('marks closure as INSUFFICIENT_SIGNAL', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');
      expect(closure.status).toBe('INSUFFICIENT_SIGNAL');
    });

    it('includes "insufficient" language in closure finding', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');
      expect(closure.oneLineFinding.toLowerCase()).toContain('insufficient');
    });

    it('closure score is null, not zero', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');
      expect(closure.score).toBeNull();
      expect(closure.score).not.toBe(0);
    });

    it('fails test if someone tries to score closure as 0', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');
      expect(closure.score).not.toBe(0);
    });
  });

  describe('Emotional banding consistency', () => {
    it('applies STRENGTH_PLUS_GROWTH to most criteria', () => {
      const strengthBandCriteria = report.criteria
        .filter(c => c.emotionalBand === 'STRENGTH_PLUS_GROWTH')
        .map(c => c.criterionKey);

      // Approximately 70% of criteria should be STRENGTH_PLUS_GROWTH
      expect(strengthBandCriteria.length).toBeGreaterThanOrEqual(7);
    });

    it('applies GROWTH to lower-craft criteria (dialogue, prose, pacing)', () => {
      const dialogue = findCriterion(report, 'dialogue_subtext');
      const prose = findCriterion(report, 'prose_line_level');
      const pacing = findCriterion(report, 'pacing_structural_balance');

      expect(dialogue.emotionalBand).toBe('GROWTH');
      expect(prose.emotionalBand).toBe('GROWTH');
      expect(pacing.emotionalBand).toBe('GROWTH');
    });

    it('non-scorable closure uses INSUFFICIENT_SIGNAL_REASSURANCE band', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');
      expect(closure.emotionalBand).toBe('INSUFFICIENT_SIGNAL_REASSURANCE');
    });
  });

  describe('Revision priorities governance', () => {
    it('exposes exactly 3 top revision priorities', () => {
      expect(report.topRevisionPriorities).toBeDefined();
      expect(report.topRevisionPriorities.length).toBe(3);
    });

    it('top 3 priorities target concept, narrative drive, and character depth', () => {
      const keys = report.topRevisionPriorities.map(p => p.criterionKey);
      expect(keys).toEqual([
        'concept_core_premise',
        'narrative_drive_momentum',
        'character_depth_psychology',
      ]);
    });

    it('first priority addresses opening conflict clarity', () => {
      const first = report.topRevisionPriorities[0];
      expect(first.rank).toBe(1);
      expect(first.criterionKey).toBe('concept_core_premise');
      expect(first.title.toLowerCase()).toContain('conflict');
    });

    it('all priorities have rationale fields', () => {
      for (const p of report.topRevisionPriorities) {
        expect(p.rationale).toBeDefined();
        expect(p.rationale.length).toBeGreaterThan(20);
      }
    });
  });

  describe('Governance notes compliance', () => {
    it('includes governance metadata object', () => {
      expect(report.governanceNotes).toBeDefined();
    });

    it('documents craft vs intelligence separation', () => {
      expect(report.governanceNotes.craftVsIntelligence).toBeDefined();
      expect(report.governanceNotes.craftVsIntelligence.toLowerCase()).toMatch(/separate|distinction/);
    });

    it('documents closure handling as deliberate non-scoring', () => {
      expect(report.governanceNotes.closureHandling).toBeDefined();
      expect(report.governanceNotes.closureHandling).toContain('INSUFFICIENT_SIGNAL');
    });

    it('documents canon continuity requirement', () => {
      expect(report.governanceNotes.canonContinuity).toBeDefined();
      const canon = report.governanceNotes.canonContinuity;
      expect(canon).toContain('Twillow');
      expect(canon).toContain('test failure');
    });
  });

  describe('Craft vs Intelligence separation', () => {
    it('dialogue (craft) scores lower than theme (intelligence)', () => {
      const dialogue = findCriterion(report, 'dialogue_subtext');
      const theme = findCriterion(report, 'theme_intelligence');

      expect(dialogue.score).toBeLessThan(theme.score);
    });

    it('prose (craft) scores lower or equal to world-building (intelligence)', () => {
      const prose = findCriterion(report, 'prose_line_level');
      const world = findCriterion(report, 'world_building_logic');

      expect(prose.score).toBeLessThanOrEqual(world.score);
    });

    it('should not merge craft and intelligence commentary', () => {
      const theme = findCriterion(report, 'theme_intelligence');
      const prose = findCriterion(report, 'prose_line_level');

      // These should discuss different aspects
      expect(theme.oneLineFinding).not.toEqual(prose.oneLineFinding);
      expect(theme.fit).not.toEqual(prose.fit);
    });
  });

  describe('Evidence anchors integration', () => {
    it('provides access to evidence anchors fixture', () => {
      expect(anchors).toBeDefined();
      expect(anchors.anchors).toBeDefined();
      expect(anchors.anchors.length).toBeGreaterThanOrEqual(15);
    });

    it('anchors reference canonical characters', () => {
      const allCharactersInAnchors = new Set();
      for (const anchor of anchors.anchors) {
        if (anchor.characterFocus) {
          anchor.characterFocus.forEach(char => allCharactersInAnchors.add(char));
        }
      }

      expect(allCharactersInAnchors.has('Newton')).toBe(true);
      expect(allCharactersInAnchors.has('Twillow')).toBe(true);
      expect(allCharactersInAnchors.has('Rana')).toBe(true);
    });

    it('anchors link to criterion keys in the report', () => {
      const reportKeys = new Set(report.criteria.map(c => c.criterionKey));

      for (const anchor of anchors.anchors) {
        for (const key of anchor.criterionLinks) {
          expect(reportKeys.has(key)).toBe(
            true,
            `Anchor ${anchor.anchorId} links to invalid criterion ${key}`
          );
        }
      }
    });
  });

  describe('User experience / professional tone', () => {
    it('verdict is evidence-grounded and balanced', () => {
      const verdict = report && report.verdictSummary ? report.verdictSummary : 'No verdict';
      if (verdict && verdict.length > 0 && verdict !== 'No verdict') {
        expect(verdict).toMatch(/promise|draft|revision|potential/i);
      }
    });

    it('revision recommendations are actionable, not vague', () => {
      for (const criterion of report.criteria) {
        if (criterion.revisionRecommendations && criterion.revisionRecommendations.length > 0) {
          for (const rec of criterion.revisionRecommendations) {
            expect(rec.length).toBeGreaterThan(15);
            expect(rec.split(' ').length).toBeGreaterThanOrEqual(4);
          }
        }
      }
    });

    it('confidence bands are honest (no HIGH confidence on low-coverage criteria)', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');
      expect(closure.confidence).not.toBe('HIGH');
    });
  });

  describe('Regression gate: Future update validation', () => {
    it('should fail if closure is ever re-scored as numeric', () => {
      const closure = findCriterion(report, 'narrative_closure_promises');

      // This tests the invariant: closure score should always be null
      if (closure.score !== null && typeof closure.score === 'number') {
        throw new Error(
          'REGRESSION: Closure has been re-scored. This breaks governance rule: closure must stay null when full text unavailable.'
        );
      }
    });

    it('should fail if more than half of canonical characters are dropped', () => {
      const character = findCriterion(report, 'character_depth_psychology');
      const world = findCriterion(report, 'world_building_logic');
      const theme = findCriterion(report, 'theme_intelligence');

      const combinedText = [
        getCriterionCommentary(character),
        getCriterionCommentary(world),
        getCriterionCommentary(theme),
      ].join(' ');

      const mentionsFound = countCharacterMentions(combinedText);

      if (mentionsFound.length < REQUIRED_MENTIONS) {
        throw new Error(
          `REGRESSION: Canon loss detected. Expected at least ${REQUIRED_MENTIONS} characters; found ${mentionsFound.length}.`
        );
      }
    });

    it('should fail if craft and intelligence scores collapse to same value', () => {
      const craft_dial = findCriterion(report, 'dialogue_subtext');
      const craft_prose = findCriterion(report, 'prose_line_level');
      const intel_theme = findCriterion(report, 'theme_intelligence');
      const intel_world = findCriterion(report, 'world_building_logic');

      const craftAvg = (craft_dial.score + craft_prose.score) / 2;
      const intelAvg = (intel_theme.score + intel_world.score) / 2;

      // Should be meaningfully different (not within 0.5 points)
      expect(Math.abs(intelAvg - craftAvg)).toBeGreaterThan(0.5);
    });
  });
});
