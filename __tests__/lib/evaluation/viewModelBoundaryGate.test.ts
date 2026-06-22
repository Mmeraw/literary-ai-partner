/**
 * ViewModel Boundary Gate Tests
 *
 * These tests enforce the architectural invariant:
 *
 *   Certified UED → normalizeEvaluationReportViewModel() → renderer adapters
 *
 * The VM is the ONE AND ONLY author-facing text sanitization boundary.
 * No renderer may re-sanitize, re-correct, or re-interpret VM-owned fields.
 *
 * Web/PDF/DOCX/TXT may FORMAT only (CSS, layout, pagination, typography).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeEvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import type { UnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';

const PAGE_TSX_PATH = join(process.cwd(), 'app/reports/[jobId]/page.tsx');

function readPageTsx(): string {
  return readFileSync(PAGE_TSX_PATH, 'utf8');
}

function buildMinimalUed(): UnifiedEvaluationDocument {
  return {
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
      manuscriptScaleContinuityFindings: [],
      revisionPriorityPlan: [],
      storyLedgerArchitectureMap: [],
      reviewGateReadinessSurface: [],
      governedLedgerAddenda: [],
      crossLayerSynthesis: [],
      layerAwareRevisionSequencing: [],
      continuityCoverageProof: [],
      readinessReleasabilityPosture: '',
    },
  } as UnifiedEvaluationDocument;
}

describe('VM Boundary Gate: Static Guard', () => {
  const source = readPageTsx();
  const sourceNoComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('documents TEMPORARY_DREAM_RENDERER_EXCEPTION for non-VM DREAM helpers', () => {
    expect(source).toMatch(/TEMPORARY_DREAM_RENDERER_EXCEPTION/);
  });

  it('page.tsx must NOT import mistakeProofText (VM owns all sanitization)', () => {
    // mistakeProofText is internal to the VM — renderers must never call it directly
    const importMatch = sourceNoComments.match(/import\s*\{[^}]*mistakeProofText[^}]*\}/s);
    expect(importMatch).toBeNull();
  });

  it('page.tsx must NOT define or reference sanitizeAuthorFacingDisplayValue', () => {
    // This function was the legacy double-sanitization layer — completely banned
    expect(sourceNoComments).not.toMatch(/sanitizeAuthorFacingDisplayValue\s*[(<]/);
    expect(sourceNoComments).not.toMatch(/function\s+sanitizeAuthorFacingDisplayValue/);
  });

  it('page.tsx must NOT call correctScopeLanguage or mistakeProofText on vm.* fields', () => {
    // Pattern: correctScopeLanguage(vm. or mistakeProofText(vm.
    expect(sourceNoComments).not.toMatch(/correctScopeLanguage\s*\(\s*vm\./);
    expect(sourceNoComments).not.toMatch(/mistakeProofText\s*\(\s*vm\./);
  });

  it('page.tsx must NOT call DREAM helper family on vm.* fields', () => {
    // Non-VM DREAM field exceptions are allowed temporarily, but vm.* is forbidden.
    expect(sourceNoComments).not.toMatch(/getDisplayDream\w*\s*\(\s*vm\./);
    expect(sourceNoComments).not.toMatch(/filterAuthorFacingTextList\s*\(\s*vm\./);
    expect(sourceNoComments).not.toMatch(/getRenumberedAuthorFacingRevisionPlan\s*\(\s*vm\./);
  });

  it('page.tsx may temporarily call DREAM helpers for dream.* fields only', () => {
    // Temporary technical-debt exception marker must remain visible.
    expect(sourceNoComments).toMatch(/correctScopeLanguage\s*\(\s*dream/);
    expect(sourceNoComments).toMatch(/getDisplayDream\w*\s*\(\s*dream/);
    expect(sourceNoComments).toMatch(/filterAuthorFacingTextList\s*\(\s*analysis\./);
  });

  it('page.tsx must NOT reference canonicalDoc.actionItems', () => {
    expect(sourceNoComments).not.toMatch(/canonicalDoc\.actionItems/);
  });

  it('page.tsx must NOT render canonicalDoc for VM-owned fields', () => {
    // VM-owned fields that must never be read from canonicalDoc in JSX:
    const vmOwnedPatterns = [
      /canonicalDoc\.titleBlock\.reportType/,
      /canonicalDoc\.titleBlock\.overallScoreLabel/,
      /canonicalDoc\.titleBlock\.marketReadiness/,
      /canonicalDoc\.titleBlock\.genre/,
      /canonicalDoc\.titleBlock\.targetAudience/,
      /canonicalDoc\.executiveSummary/,
      /canonicalDoc\.topStrengths/,
      /canonicalDoc\.topRisks/,
      /canonicalDoc\.topRecommendations/,
      /canonicalDoc\.criteriaScoreGrid/,
      /canonicalDoc\.criterionDetails/,
      /canonicalDoc\.revisionOpportunitySummary/,
      /canonicalDoc\.confidenceExplanation/,
      /canonicalDoc\.disclaimer/,
      /canonicalDoc\.pitch/,
      /canonicalDoc\.premise/,
      /canonicalDoc\.contentWarnings/,
    ];
    for (const pattern of vmOwnedPatterns) {
      expect(sourceNoComments).not.toMatch(pattern);
    }
  });
});

describe('VM Boundary Gate: Contract Preservation', () => {
  const ued = buildMinimalUed();
  const vm = normalizeEvaluationReportViewModel(ued);

  it('preserves score label exactly from UED (no recomputation)', () => {
    expect(vm.titleBlock.overallScoreLabel).toBe(ued.titleBlock.overallScoreLabel);
  });

  it('preserves genre exactly from UED (no inference)', () => {
    expect(vm.titleBlock.genre).toBe(ued.titleBlock.genre);
  });

  it('preserves target audience exactly from UED (no inference)', () => {
    expect(vm.titleBlock.targetAudience).toBe(ued.titleBlock.targetAudience);
  });

  it('preserves market readiness exactly from UED (no reinterpretation)', () => {
    expect(vm.titleBlock.marketReadiness).toBe(ued.titleBlock.marketReadiness);
  });

  it('preserves opportunity counts from UED (does not recount from criteria)', () => {
    // VM maps UED field names: high→recommended, medium→optional, low→consider
    expect(vm.revisionOpportunitySummary.total).toBe(ued.revisionOpportunitySummary.total);
    expect(vm.revisionOpportunitySummary.recommended).toBe(ued.revisionOpportunitySummary.high);
    expect(vm.revisionOpportunitySummary.optional).toBe(ued.revisionOpportunitySummary.medium);
    expect(vm.revisionOpportunitySummary.consider).toBe(ued.revisionOpportunitySummary.low);
  });

  it('preserves content warnings exactly from UED', () => {
    expect(vm.contentWarnings).toEqual(ued.contentWarnings);
  });

  it('preserves criterion details with opportunity_id intact (ledger traceability)', () => {
    for (const detail of vm.criterionDetails) {
      for (const rec of detail.recommendations) {
        expect(rec.opportunity_id).toBeDefined();
        expect(typeof rec.opportunity_id).toBe('string');
        expect(rec.opportunity_id.length).toBeGreaterThan(0);
      }
    }
  });

  it('only adds presentation-derived fields (palettes), not new business content', () => {
    // The only fields the VM adds that aren't in UED are palette classifications
    expect(vm.titleBlock.overallScorePalette).toBeDefined();
    expect(vm.titleBlock.marketReadinessPalette).toBeDefined();
    // These are derived from existing values, not new information
    expect(['strong', 'watch', 'risk', 'muted']).toContain(vm.titleBlock.overallScorePalette);
    expect(['ready', 'near', 'not_ready', 'unknown']).toContain(vm.titleBlock.marketReadinessPalette);
  });
});

describe('VM Boundary Gate: No Shadow Inventory', () => {
  const ued = buildMinimalUed();
  const vm = normalizeEvaluationReportViewModel(ued);
  const vmKeys = Object.keys(vm);

  it('VM does not expose actionItems', () => {
    expect(vmKeys).not.toContain('actionItems');
  });

  it('VM does not expose quickWins', () => {
    expect(vmKeys).not.toContain('quickWins');
  });

  it('VM does not expose strategicRevisions', () => {
    expect(vmKeys).not.toContain('strategicRevisions');
  });

  it('VM does not expose suggestedRevisions', () => {
    expect(vmKeys).not.toContain('suggestedRevisions');
  });

  it('VM does not expose revisionPlan', () => {
    expect(vmKeys).not.toContain('revisionPlan');
  });

  it('VM does not expose revisionQueue as top-level inventory', () => {
    expect(vmKeys).not.toContain('revisionQueue');
  });

  it('VM does not expose reviewGate', () => {
    expect(vmKeys).not.toContain('reviewGate');
  });

  it('VM does not expose releasabilityAssessment', () => {
    expect(vmKeys).not.toContain('releasabilityAssessment');
  });
});

describe('VM Boundary Gate: Rendered Heading Guard (short-form)', () => {
  const source = readPageTsx();

  // These headings must NOT appear as top-level rendered section headings in short-form
  const forbiddenShortFormHeadings = [
    'Action Items',
    'Quick Wins',
    'Strategic Revisions',
    'Review Gate',
    'Releasability Assessment',
    'Additional Recommendations',
    'Suggested Revisions',
  ];

  for (const heading of forbiddenShortFormHeadings) {
    it(`short-form must not render "${heading}" as a top-level section heading`, () => {
      // Look for this heading in h2/h3 tags that are NOT inside isLongForm guards
      // Simplified check: the heading should not appear as literal text in an h2 outside comments
      const headingPattern = new RegExp(`>\\s*${heading}\\s*<`, 'i');
      const matches = source.match(headingPattern);
      // If found, check it's inside an isLongForm block (acceptable for long-form only)
      if (matches) {
        // Find the line number
        const lines = source.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (headingPattern.test(lines[i])) {
            // Check surrounding context for isLongForm guard
            const context = lines.slice(Math.max(0, i - 10), i).join('\n');
            expect(context).toMatch(/isLongForm/);
          }
        }
      }
    });
  }
});

describe('VM Boundary Gate: Revise Queue Independence', () => {
  it('VM does not expose Revise Queue workflow data', () => {
    const ued = buildMinimalUed();
    const vm = normalizeEvaluationReportViewModel(ued);
    const vmKeys = Object.keys(vm);

    // Revise Queue lives at app/revise-queue/ — completely separate surface
    expect(vmKeys).not.toContain('reviseQueue');
    expect(vmKeys).not.toContain('workbenchQueue');
    expect(vmKeys).not.toContain('reviseCards');
  });

  it('criterion recommendations preserve opportunity_id for ledger traceability', () => {
    const ued = buildMinimalUed();
    const vm = normalizeEvaluationReportViewModel(ued);

    // Every recommendation must trace to revision_opportunity_ledger_v1
    const allRecs = vm.criterionDetails.flatMap(d => d.recommendations);
    expect(allRecs.length).toBeGreaterThan(0);
    const ids = allRecs.map(r => r.opportunity_id);
    expect(ids).toContain('OPP-001');
    expect(ids).toContain('OPP-002');
    for (const rec of allRecs) {
      expect(rec.opportunity_id).toBeDefined();
      expect(typeof rec.opportunity_id).toBe('string');
      expect(rec.opportunity_id.length).toBeGreaterThan(0);
    }
  });
});
