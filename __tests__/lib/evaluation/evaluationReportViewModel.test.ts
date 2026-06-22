import { normalizeEvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import type { UnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';

/**
 * Minimal UED fixture — just enough fields to test the ViewModel normalization.
 * Does NOT recompute anything; tests that the VM passes through certified UED values.
 */
function buildMinimalUed(overrides: Partial<UnifiedEvaluationDocument> = {}): UnifiedEvaluationDocument {
  const base: UnifiedEvaluationDocument = {
    templateMode: 'short_form_evaluation',
    sectionOrder: ['title_block', 'one_paragraph_pitch', 'one_sentence_pitch', 'premise', 'content_warnings', 'revision_opportunity_summary', 'executive_summary', 'top_strengths', 'top_risks', 'top_recommendations', 'criteria_score_grid', 'criterion_rationales', 'confidence_explanation', 'author_facing_disclaimer'],
    title: 'Test Manuscript',
    titleBlock: {
      reportType: 'Short-Form Evaluation',
      overallScoreLabel: '82/100',
      marketReadiness: 'Near Market Ready',
      genre: 'Literary Fiction',
      submittedWordCount: '15,000',
      estimatedPages: '60',
      readingGradeLevel: 'Grade 8',
      dialogueNarrativeRatio: '35/65',
      dateGenerated: '2026-06-22',
      genreConfidenceLabel: 'High' as any,
      marketReadinessConfidenceLabel: 'Moderate' as any,
      overallScoreConfidenceLabel: 'High' as any,
      audienceConfidenceLabel: 'Moderate' as any,
      audienceTentative: false,
      headerContract: {} as any,
      genreExpectationContract: {
        contractSummary: 'Emphasis on prose quality and internal conflict',
        expectationProfileLabels: ['Prose-forward', 'Character-driven'],
        genreExpectationLabels: ['Literary Fiction'],
        diagnosedGenre: 'Literary Fiction',
      } as any,
      targetAudience: 'Adult literary fiction readers',
      shelf: null,
      shelfConfidenceLabel: null,
    },
    oneParagraphPitch: 'A compelling story about growth.',
    oneSentencePitch: 'Growth through adversity.',
    premise: 'A young teacher discovers hidden truths.',
    contentWarnings: ['Mild violence', 'Grief'],
    revisionOpportunitySummary: { total: 12, high: 4, medium: 5, low: 3 },
    executiveSummary: 'Strong prose with structural risks in pacing.',
    topStrengths: ['Vivid prose', 'Complex characters'],
    topRisks: ['Pacing inconsistency', 'Weak middle act'],
    topRecommendations: ['Tighten pacing in chapters 4-7', 'Strengthen midpoint reversal'],
    canonicalOpportunityLedger: undefined as any,
    criteriaScoreGrid: [
      { label: 'Prose & Voice', scoreLabel: '9/10', confidenceLabel: 'High' },
      { label: 'Pacing & Structure', scoreLabel: '6/10', confidenceLabel: 'Moderate' },
    ] as any,
    criterionDetails: [
      {
        key: 'prose_voice',
        label: 'Prose & Voice',
        scoreLabel: '9/10',
        confidenceLabel: 'High',
        supportLabel: null,
        rationaleText: 'Excellent sentence-level craft throughout.',
        recommendations: [
          { opportunity_id: 'OPP-001', priority: 'medium', action: 'Consider varying sentence openings in chapter 3.', reader_effect: 'Reduces monotony' },
        ],
      },
      {
        key: 'pacing_structure',
        label: 'Pacing & Structure',
        scoreLabel: '6/10',
        confidenceLabel: 'Moderate',
        supportLabel: null,
        rationaleText: 'Middle act loses momentum.',
        recommendations: [
          { opportunity_id: 'OPP-002', priority: 'high', action: 'Restructure chapters 4-7 with rising tension.', reader_effect: 'Maintains engagement' },
        ],
      },
    ] as any,
    actionItems: { quickWins: [], strategicRevisions: [] },
    modeSpecific: {
      manuscriptScaleContinuityFindings: ['Arc 1 bridges cleanly to Act 2.'],
      revisionPriorityPlan: [
        { priority: 1, title: 'Fix pacing', location: 'Ch 4-7', operation: 'Edit', recommendation: 'Restructure for tension', rationale: 'Highest impact' },
      ],
      storyLedgerArchitectureMap: [],
      reviewGateReadinessSurface: [],
      governedLedgerAddenda: [],
      crossLayerSynthesis: ['Layer integration not applicable for short-form.'],
      layerAwareRevisionSequencing: ['Priority 1: Fix pacing — Edit (Ch 4-7)'],
      continuityCoverageProof: ['Continuity verified through arc map.'],
      readinessReleasabilityPosture: 'Near Market Ready. Prioritize high-impact revisions before submission.',
    },
  } as UnifiedEvaluationDocument;

  return { ...base, ...overrides };
}

function buildUedWithTitleBlock(titleBlockOverrides: Record<string, unknown>): UnifiedEvaluationDocument {
  const base = buildMinimalUed();
  return { ...base, titleBlock: { ...base.titleBlock, ...titleBlockOverrides } } as UnifiedEvaluationDocument;
}

describe('normalizeEvaluationReportViewModel', () => {
  describe('passes through certified UED values without recomputation', () => {
    const ued = buildMinimalUed();
    const vm = normalizeEvaluationReportViewModel(ued);

    it('preserves report type from UED', () => {
      expect(vm.titleBlock.reportType).toBe('Short-Form Evaluation');
    });

    it('preserves score label from UED (does not recompute)', () => {
      expect(vm.titleBlock.overallScoreLabel).toBe('82/100');
    });

    it('preserves market readiness from UED', () => {
      expect(vm.titleBlock.marketReadiness).toBe('Near Market Ready');
    });

    it('preserves genre from UED', () => {
      expect(vm.titleBlock.genre).toBe('Literary Fiction');
    });

    it('preserves target audience from UED', () => {
      expect(vm.titleBlock.targetAudience).toBe('Adult literary fiction readers');
    });

    it('preserves opportunity counts from UED (does not recount from criteria)', () => {
      expect(vm.revisionOpportunitySummary).toEqual({
        total: 12,
        recommended: 4,
        optional: 5,
        consider: 3,
      });
    });

    it('preserves top recommendations from UED', () => {
      expect(vm.topRecommendations).toHaveLength(2);
      expect(vm.topRecommendations[0]).toContain('Tighten pacing');
    });

    it('preserves criteria grid from UED', () => {
      expect(vm.criteriaScoreGrid).toHaveLength(2);
      expect(vm.criteriaScoreGrid[0].label).toBe('Prose & Voice');
      expect(vm.criteriaScoreGrid[0].scoreLabel).toBe('9/10');
    });

    it('preserves pitch/premise/warnings from UED', () => {
      expect(vm.oneParagraphPitch).toBe('A compelling story about growth.');
      expect(vm.oneSentencePitch).toBe('Growth through adversity.');
      expect(vm.premise).toBe('A young teacher discovers hidden truths.');
      expect(vm.contentWarnings).toEqual(['Mild violence', 'Grief']);
    });

    it('preserves criterion details from UED', () => {
      expect(vm.criterionDetails).toHaveLength(2);
      expect(vm.criterionDetails[0].key).toBe('prose_voice');
      expect(vm.criterionDetails[0].label).toBe('Prose & Voice');
      expect(vm.criterionDetails[0].scoreLabel).toBe('9/10');
    });
  });

  describe('derives palette classifications from certified values', () => {
    it('score palette: strong for 90+/100', () => {
      const vm = normalizeEvaluationReportViewModel(buildUedWithTitleBlock({ overallScoreLabel: '92/100' }));
      expect(vm.titleBlock.overallScorePalette).toBe('strong');
    });

    it('score palette: watch for 80-89/100', () => {
      const vm = normalizeEvaluationReportViewModel(buildMinimalUed());
      expect(vm.titleBlock.overallScorePalette).toBe('watch');
    });

    it('score palette: risk for <80/100', () => {
      const vm = normalizeEvaluationReportViewModel(buildUedWithTitleBlock({ overallScoreLabel: '65/100' }));
      expect(vm.titleBlock.overallScorePalette).toBe('risk');
    });

    it('score palette: strong for 9/10', () => {
      expect(normalizeEvaluationReportViewModel(buildMinimalUed()).criteriaScoreGrid[0].scorePalette).toBe('strong');
    });

    it('score palette: watch for 6/10', () => {
      expect(normalizeEvaluationReportViewModel(buildMinimalUed()).criteriaScoreGrid[1].scorePalette).toBe('watch');
    });

    it('readiness palette: ready for "Market Ready"', () => {
      const vm = normalizeEvaluationReportViewModel(buildUedWithTitleBlock({ marketReadiness: 'Market Ready' }));
      expect(vm.titleBlock.marketReadinessPalette).toBe('ready');
    });

    it('readiness palette: near for "Near Market Ready"', () => {
      const vm = normalizeEvaluationReportViewModel(buildMinimalUed());
      expect(vm.titleBlock.marketReadinessPalette).toBe('near');
    });

    it('readiness palette: not_ready for "Not Market Ready"', () => {
      const vm = normalizeEvaluationReportViewModel(buildUedWithTitleBlock({ marketReadiness: 'Not Market Ready' }));
      expect(vm.titleBlock.marketReadinessPalette).toBe('not_ready');
    });
  });

  describe('Web/Download parity: VM produces identical values for both surfaces', () => {
    const ued = buildMinimalUed();
    const vm1 = normalizeEvaluationReportViewModel(ued);
    const vm2 = normalizeEvaluationReportViewModel(ued);

    it('score value is stable across reads (no recomputation)', () => {
      expect(vm1.titleBlock.overallScoreLabel).toBe(vm2.titleBlock.overallScoreLabel);
      expect(vm1.titleBlock.overallScorePalette).toBe(vm2.titleBlock.overallScorePalette);
    });

    it('report type is stable across reads', () => {
      expect(vm1.titleBlock.reportType).toBe(vm2.titleBlock.reportType);
    });

    it('genre is stable across reads', () => {
      expect(vm1.titleBlock.genre).toBe(vm2.titleBlock.genre);
    });

    it('target audience is stable across reads', () => {
      expect(vm1.titleBlock.targetAudience).toBe(vm2.titleBlock.targetAudience);
    });

    it('market readiness is stable across reads', () => {
      expect(vm1.titleBlock.marketReadiness).toBe(vm2.titleBlock.marketReadiness);
      expect(vm1.titleBlock.marketReadinessPalette).toBe(vm2.titleBlock.marketReadinessPalette);
    });

    it('opportunity counts are stable across reads', () => {
      expect(vm1.revisionOpportunitySummary).toEqual(vm2.revisionOpportunitySummary);
    });

    it('top recommendations are stable across reads', () => {
      expect(vm1.topRecommendations).toEqual(vm2.topRecommendations);
    });

    it('criteria grid is stable across reads', () => {
      expect(vm1.criteriaScoreGrid).toEqual(vm2.criteriaScoreGrid);
    });
  });

  describe('long-form mode', () => {
    it('marks long-form multi-layer contract as partial', () => {
      const ued = buildMinimalUed({ templateMode: 'long_form_multi_layer_evaluation' });
      const vm = normalizeEvaluationReportViewModel(ued);
      expect(vm.templateMode).toBe('long_form_multi_layer_evaluation');
      expect(vm.contractStatus).toBe('partial');
    });

    it('marks short-form contract as complete', () => {
      const vm = normalizeEvaluationReportViewModel(buildMinimalUed());
      expect(vm.contractStatus).toBe('complete');
    });
  });

  describe('disclaimer', () => {
    it('includes standard RevisionGrade disclaimer', () => {
      const vm = normalizeEvaluationReportViewModel(buildMinimalUed());
      expect(vm.disclaimer).toContain('RevisionGrade');
      expect(vm.disclaimer).toContain('does not guarantee publication');
    });
  });
});
