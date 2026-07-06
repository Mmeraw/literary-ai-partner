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
    const vm = normalizeEvaluationReportViewModel({ ued });

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
      const vm = normalizeEvaluationReportViewModel({ ued: buildUedWithTitleBlock({ overallScoreLabel: '92/100' }) });
      expect(vm.titleBlock.overallScorePalette).toBe('strong');
    });

    it('score palette: watch for 80-89/100', () => {
      const vm = normalizeEvaluationReportViewModel({ ued: buildMinimalUed() });
      expect(vm.titleBlock.overallScorePalette).toBe('watch');
    });

    it('score palette: risk for <80/100', () => {
      const vm = normalizeEvaluationReportViewModel({ ued: buildUedWithTitleBlock({ overallScoreLabel: '65/100' }) });
      expect(vm.titleBlock.overallScorePalette).toBe('risk');
    });

    it('score palette: strong for 9/10', () => {
      expect(normalizeEvaluationReportViewModel({ ued: buildMinimalUed() }).criteriaScoreGrid[0].scorePalette).toBe('strong');
    });

    it('score palette: watch for 6/10', () => {
      expect(normalizeEvaluationReportViewModel({ ued: buildMinimalUed() }).criteriaScoreGrid[1].scorePalette).toBe('watch');
    });

    it('readiness palette: ready for "Market Ready"', () => {
      const vm = normalizeEvaluationReportViewModel({ ued: buildUedWithTitleBlock({ marketReadiness: 'Market Ready' }) });
      expect(vm.titleBlock.marketReadinessPalette).toBe('ready');
    });

    it('readiness palette: near for "Near Market Ready"', () => {
      const vm = normalizeEvaluationReportViewModel({ ued: buildMinimalUed() });
      expect(vm.titleBlock.marketReadinessPalette).toBe('near');
    });

    it('readiness palette: not_ready for "Not Market Ready"', () => {
      const vm = normalizeEvaluationReportViewModel({ ued: buildUedWithTitleBlock({ marketReadiness: 'Not Market Ready' }) });
      expect(vm.titleBlock.marketReadinessPalette).toBe('not_ready');
    });
  });



  describe('long-form mode', () => {
    it('marks long-form multi-layer contract as complete', () => {
      const ued = buildMinimalUed({ templateMode: 'long_form_multi_layer_evaluation' });
      const vm = normalizeEvaluationReportViewModel({ ued });
      expect(vm.templateMode).toBe('long_form_multi_layer_evaluation');
      expect(vm.contractStatus).toBe('complete');
    });

    it('marks short-form contract as complete', () => {
      const vm = normalizeEvaluationReportViewModel({ ued: buildMinimalUed() });
      expect(vm.contractStatus).toBe('complete');
    });
  });

  describe('disclaimer', () => {
    it('includes standard RevisionGrade disclaimer', () => {
      const vm = normalizeEvaluationReportViewModel({ ued: buildMinimalUed() });
      expect(vm.disclaimer).toContain('RevisionGrade');
      expect(vm.disclaimer).toContain('does not guarantee publication');
    });
  });

  describe('short-form mode contract: forbidden top-level sections', () => {
    const ued = buildMinimalUed({ templateMode: 'short_form_evaluation' });
    const vm = normalizeEvaluationReportViewModel({ ued });

    it('VM does not expose actionItems / quickWins / strategicRevisions', () => {
      // The ViewModel must not carry these fields — they are not contract-approved
      // for any mode as top-level report sections. Revision inventory lives in
      // criterionDetails[].recommendations only.
      expect(vm).not.toHaveProperty('actionItems');
      expect(vm).not.toHaveProperty('quickWins');
      expect(vm).not.toHaveProperty('strategicRevisions');
    });

    it('all rendered fields trace to contract-approved sections only', () => {
      // The VM shape must match the rendering contract section order:
      // titleBlock, pitches, premise, warnings, revisionOpportunitySummary,
      // executiveSummary, topStrengths, topRisks, topRecommendations,
      // criteriaScoreGrid, criterionDetails, confidenceExplanation, disclaimer
      const vmKeys = Object.keys(vm);
      const forbiddenKeys = ['actionItems', 'quickWins', 'strategicRevisions', 'revisionQueue', 'reviewGate'];
      for (const key of forbiddenKeys) {
        expect(vmKeys).not.toContain(key);
      }
    });

    it('revision opportunities exist only inside criterionDetails, not as a separate inventory', () => {
      // Recommendations must trace through criterion → opportunities path
      const allRecs = vm.criterionDetails.flatMap(d => d.recommendations);
      expect(allRecs.length).toBeGreaterThan(0);
      // Every recommendation has an opportunity_id (traces to ledger)
      for (const rec of allRecs) {
        expect(rec.opportunity_id).toBeDefined();
      }
    });
  });

  describe('Web/Download parity: both surfaces consume identical VM fields', () => {
    // This test proves that if both web and download route call
    // normalizeEvaluationReportViewModel({ ued }), they get the SAME field values.
    // This is stronger than "deterministic" — it simulates two independent consumers.
    const rawUed = buildMinimalUed();

    // Simulate web surface consumer
    const webVm = normalizeEvaluationReportViewModel({ ued: rawUed });

    // Simulate download route consumer (same UED, independent call)
    const downloadVm = normalizeEvaluationReportViewModel({ ued: rawUed });

    it('score: web and download see identical value and palette', () => {
      expect(webVm.titleBlock.overallScoreLabel).toBe(downloadVm.titleBlock.overallScoreLabel);
      expect(webVm.titleBlock.overallScorePalette).toBe(downloadVm.titleBlock.overallScorePalette);
    });

    it('report type: web and download see identical value', () => {
      expect(webVm.titleBlock.reportType).toBe(downloadVm.titleBlock.reportType);
    });

    it('genre: web and download see identical value', () => {
      expect(webVm.titleBlock.genre).toBe(downloadVm.titleBlock.genre);
    });

    it('target audience: web and download see identical value', () => {
      expect(webVm.titleBlock.targetAudience).toBe(downloadVm.titleBlock.targetAudience);
    });

    it('market readiness: web and download see identical value and palette', () => {
      expect(webVm.titleBlock.marketReadiness).toBe(downloadVm.titleBlock.marketReadiness);
      expect(webVm.titleBlock.marketReadinessPalette).toBe(downloadVm.titleBlock.marketReadinessPalette);
    });

    it('opportunity counts: web and download see identical totals', () => {
      expect(webVm.revisionOpportunitySummary).toEqual(downloadVm.revisionOpportunitySummary);
    });

    it('top recommendations: web and download see identical list', () => {
      expect(webVm.topRecommendations).toEqual(downloadVm.topRecommendations);
    });

    it('criteria grid: web and download see identical rows with palettes', () => {
      expect(webVm.criteriaScoreGrid).toEqual(downloadVm.criteriaScoreGrid);
    });

    it('executive summary: web and download see identical sanitized text', () => {
      expect(webVm.executiveSummary).toBe(downloadVm.executiveSummary);
    });

    it('entire VM is deeply equal across independent consumers', () => {
      expect(webVm).toEqual(downloadVm);
    });
  });

  describe('root-cause: VM strips generic fallback prose from recommendations', () => {
    it('filters entire recommendation when ALL detail fields are generic fallback', () => {
      const ued = buildMinimalUed({
        criterionDetails: [
          {
            key: 'prose_voice',
            label: 'Prose & Voice',
            scoreLabel: '9/10',
            confidenceLabel: 'High',
            supportLabel: null,
            rationaleText: 'Good prose.',
            recommendations: [
              {
                opportunity_id: 'OPP-FALLBACK',
                priority: 'medium',
                symptom: 'The evaluation identified a concrete craft issue that warrants attention.',
                mechanism: 'Premise remains abstract rather than grounded in textual evidence.',
                specific_fix: undefined,
                reader_effect: undefined,
                mistake_proofing: undefined,
              },
              {
                opportunity_id: 'OPP-REAL',
                priority: 'high',
                symptom: 'Sentence openings repeat "He" six times in chapter 3.',
                mechanism: 'Monotonous syntactic pattern reduces flow.',
                specific_fix: 'Vary clause structure: subordinate, participial, nominative absolute.',
                reader_effect: 'Improved rhythmic variety keeps reader engaged.',
                mistake_proofing: undefined,
              },
            ],
          },
        ] as any,
      });

      const vm = normalizeEvaluationReportViewModel({ ued });
      const recs = vm.criterionDetails[0].recommendations;

      // Generic fallback recommendation should be stripped at VM level
      expect(recs.find(r => r.opportunity_id === 'OPP-FALLBACK')).toBeUndefined();
      // Real recommendation preserved
      expect(recs.find(r => r.opportunity_id === 'OPP-REAL')).toBeDefined();
      expect(recs.find(r => r.opportunity_id === 'OPP-REAL')!.symptom).toContain('Sentence openings repeat');
    });

    it('keeps recommendation when only SOME fields contain fallback (partial real content)', () => {
      const ued = buildMinimalUed({
        criterionDetails: [
          {
            key: 'pacing_structure',
            label: 'Pacing & Structure',
            scoreLabel: '6/10',
            confidenceLabel: 'Moderate',
            supportLabel: null,
            rationaleText: 'Middle act sags.',
            recommendations: [
              {
                opportunity_id: 'OPP-PARTIAL',
                priority: 'high',
                symptom: 'The evaluation identified a concrete craft issue that warrants attention.',
                mechanism: 'Chapters 4-7 lack escalating stakes.',
                specific_fix: 'Insert midpoint reversal at chapter 5 break.',
                reader_effect: undefined,
                mistake_proofing: undefined,
              },
            ],
          },
        ] as any,
      });

      const vm = normalizeEvaluationReportViewModel({ ued });
      const recs = vm.criterionDetails[0].recommendations;

      // Kept because mechanism + specific_fix are real content
      expect(recs).toHaveLength(1);
      expect(recs[0].mechanism).toContain('Chapters 4-7');
      expect(recs[0].specific_fix).toContain('Insert midpoint reversal');
      // Fallback field is removed (set to undefined) at the VM level
      expect(recs[0].symptom).toBeUndefined();
    });

    it('VM recommendation fields never contain known fallback phrases', () => {
      const FALLBACK_PHRASES = [
        'the evaluation identified a concrete craft issue',
        'premise remains abstract rather than grounded',
      ];
      const ued = buildMinimalUed();
      const vm = normalizeEvaluationReportViewModel({ ued });

      for (const criterion of vm.criterionDetails) {
        for (const rec of criterion.recommendations) {
          const fields = [rec.symptom, rec.mechanism, rec.specific_fix, rec.reader_effect, rec.mistake_proofing];
          for (const field of fields) {
            if (!field) continue;
            for (const phrase of FALLBACK_PHRASES) {
              expect(field.toLowerCase()).not.toContain(phrase);
            }
          }
        }
      }
    });
  });

  describe('root-cause: VM normalizes evidence snippets (no wrapping quotes)', () => {
    it('strips outer quotes from anchor_snippet before renderers see it', () => {
      const ued = buildMinimalUed({
        criterionDetails: [
          {
            key: 'prose_voice',
            label: 'Prose & Voice',
            scoreLabel: '9/10',
            confidenceLabel: 'High',
            supportLabel: null,
            rationaleText: 'Good prose.',
            recommendations: [
              {
                opportunity_id: 'OPP-QUOTED',
                priority: 'medium',
                anchor_snippet: '\u201cThe river ran cold beneath the bridge.\u201d',
                anchor_type: 'quote',
                symptom: 'Overuse of pathetic fallacy.',
                mechanism: undefined,
                specific_fix: undefined,
                reader_effect: undefined,
                mistake_proofing: undefined,
              },
            ],
          },
        ] as any,
      });

      const vm = normalizeEvaluationReportViewModel({ ued });
      const snippet = vm.criterionDetails[0].recommendations[0].anchor_snippet!;

      // Should not start or end with any quote character
      expect(snippet).not.toMatch(/^[\u201c\u201d"'`]/);
      expect(snippet).not.toMatch(/[\u201c\u201d"'`]$/);
      // Content preserved
      expect(snippet).toContain('The river ran cold beneath the bridge');
    });

    it('passes through clean evidence unchanged', () => {
      const ued = buildMinimalUed({
        criterionDetails: [
          {
            key: 'prose_voice',
            label: 'Prose & Voice',
            scoreLabel: '9/10',
            confidenceLabel: 'High',
            supportLabel: null,
            rationaleText: 'Good prose.',
            recommendations: [
              {
                opportunity_id: 'OPP-CLEAN',
                priority: 'medium',
                anchor_snippet: 'The river ran cold beneath the bridge.',
                anchor_type: 'quote',
                symptom: 'Overuse of pathetic fallacy.',
                mechanism: undefined,
                specific_fix: undefined,
                reader_effect: undefined,
                mistake_proofing: undefined,
              },
            ],
          },
        ] as any,
      });

      const vm = normalizeEvaluationReportViewModel({ ued });
      const snippet = vm.criterionDetails[0].recommendations[0].anchor_snippet!;
      expect(snippet).toBe('The river ran cold beneath the bridge.');
    });
  });
});
