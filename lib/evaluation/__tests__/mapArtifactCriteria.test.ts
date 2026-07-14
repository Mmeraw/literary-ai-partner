import { mapArtifactCriteria } from '@/lib/evaluation/mapArtifactCriteria';
import { validateEvaluationArtifact } from '@/lib/evaluation/pipeline/validateEvaluationArtifact';
import { buildScoreLedger } from '@/lib/evaluation/pipeline/buildScoreLedger';
import { buildExcellenceFilter } from '@/lib/evaluation/pipeline/buildExcellenceFilter';
import { CRITERIA_KEYS, type CriterionKey } from '@/schemas/criteria-keys';
import type {
  EvaluationResultV2,
  ScorableCriterionV2,
  NonScorableCriterionV2,
} from '@/schemas/evaluation-result-v2';

type SourceCriterion = EvaluationResultV2['criteria'][number];

function makeScorableCriterion(
  key: CriterionKey,
  overrides: Partial<ScorableCriterionV2> = {},
): ScorableCriterionV2 {
  return {
    key,
    scorable: true,
    status: 'SCORABLE',
    signal_present: true,
    signal_strength: 'SUFFICIENT',
    confidence_band: 'HIGH',
    score_0_10: 7,
    rationale: `The ${key} criterion is supported by specific manuscript evidence.`,
    evidence: [{ snippet: `"The opening scene provides anchored evidence for ${key}."` }],
    recommendations: [],
    ...overrides,
  };
}

function makeNonScorableCriterion(
  key: CriterionKey,
  overrides: Partial<NonScorableCriterionV2> = {},
): NonScorableCriterionV2 {
  return {
    key,
    scorable: false,
    status: 'NO_SIGNAL',
    signal_present: false,
    signal_strength: 'NONE',
    confidence_band: 'LOW',
    score_0_10: null,
    rationale: `No usable signal was found for ${key}.`,
    evidence: [],
    recommendations: [],
    insufficient_signal_reason: { looked_for: [], not_found: [] },
    ...overrides,
  };
}

/**
 * Rebuilds the ArtifactGate input exactly as processor.ts does: mapped criteria
 * plus the deterministic ledger and excellence filter derived from their scores.
 */
function buildArtifactFromSource(criteria: SourceCriterion[]) {
  const mapped = mapArtifactCriteria(criteria);
  const ledgerInput = mapped.map((criterion) => ({
    key: criterion.key,
    final_score_0_10: criterion.final_score_0_10,
  }));
  return {
    criteria: mapped,
    ledger: buildScoreLedger({ criteria: ledgerInput }),
    efg: buildExcellenceFilter({ criteria: ledgerInput }),
  };
}

describe('mapArtifactCriteria', () => {
  it('maps rationale into both reasoning and interpretation and preserves score/evidence exactly', () => {
    const rationale = 'Concept rationale text.';
    const source = [
      makeScorableCriterion('concept', {
        rationale,
        score_0_10: 7,
        evidence: [{ snippet: 'first snippet' }, { snippet: 'second snippet' }],
      }),
    ];

    expect(mapArtifactCriteria(source)).toEqual([
      {
        key: 'concept',
        final_score_0_10: 7,
        reasoning: rationale,
        evidence: 'first snippet | second snippet',
        interpretation: rationale,
      },
    ]);
  });

  it('preserves criterion order (no sorting or deduplication)', () => {
    const source = [
      makeScorableCriterion('concept'),
      makeScorableCriterion('voice'),
      makeScorableCriterion('character'),
    ];

    expect(mapArtifactCriteria(source).map((c) => c.key)).toEqual([
      'concept',
      'voice',
      'character',
    ]);
  });

  it('drops empty/falsy snippets when joining evidence', () => {
    const source = [
      makeScorableCriterion('voice', {
        evidence: [{ snippet: 'kept snippet' }, { snippet: '' }, { snippet: 'also kept' }],
      }),
    ];

    expect(mapArtifactCriteria(source)[0].evidence).toBe('kept snippet | also kept');
  });

  it('passes a null score through unchanged (no coercion to 0)', () => {
    // Isolated from the validator on purpose: validateEvaluationArtifact treats a
    // null score as both non-integer and out-of-range. This asserts only that the
    // PR preserves the existing nullable-score passthrough behavior.
    const source = [makeNonScorableCriterion('marketability')];

    const mapped = mapArtifactCriteria(source);

    expect(mapped[0].final_score_0_10).toBeNull();
    expect(mapped[0].interpretation).toBe(source[0].rationale);
    expect(mapped[0].reasoning).toBe(source[0].rationale);
  });

  describe('ArtifactGate integration', () => {
    it('yields PASS with no missing-text codes when every rationale is populated', () => {
      const source = CRITERIA_KEYS.map((key) => makeScorableCriterion(key));

      const result = validateEvaluationArtifact(buildArtifactFromSource(source), {
        mode: 'enforce',
      });

      expect(result.result).toBe('PASS');
      expect(result.reasonCodes).toEqual([]);
      expect(result.reasonCodes).not.toContain('INTERP-MISSING-1');
      expect(result.reasonCodes).not.toContain('REASONING-MISSING-1');
    });

    it('yields HOLD with both missing-text codes when one rationale is empty', () => {
      const source = CRITERIA_KEYS.map((key, idx) =>
        makeScorableCriterion(key, idx === 0 ? { rationale: '' } : {}),
      );

      const result = validateEvaluationArtifact(buildArtifactFromSource(source), {
        mode: 'enforce',
      });

      expect(result.result).toBe('HOLD');
      // The helper maps both reasoning and interpretation from rationale, so an
      // empty rationale must surface both codes.
      expect(result.reasonCodes).toEqual(
        expect.arrayContaining(['INTERP-MISSING-1', 'REASONING-MISSING-1']),
      );
      // The HOLD must come only from the empty rationale, not a malformed fixture.
      expect(result.reasonCodes).not.toContain('CRIT-MISSING-1');
      expect(result.reasonCodes).not.toContain('SCORE-NORM-1');
      expect(result.reasonCodes).not.toContain('EFG-MISMATCH-1');
      expect(result.reasonCodes).not.toContain('EVIDENCE-MISSING-1');
    });
  });
});
