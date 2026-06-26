/**
 * Boundary Audit — field-lineage report for PR #1183
 * Generates a table showing where each parity-governed field lives
 * and whether it appears in each renderer surface.
 */
import { buildUnifiedDocumentForParityFromEvaluationResult } from '@/lib/evaluation/reportRenderParity';
import { normalizeEvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import { mistakeProofText } from '@/lib/evaluation/reportRenderSafety';
import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import mammoth from 'mammoth';

const { __testingDownload: testing } = require('@/app/api/reports/[jobId]/download/route');

const REQUIRED_FIELDS = [
  'title', 'titleBlock.reportType', 'titleBlock.genre', 'titleBlock.targetAudience',
  'titleBlock.overallScoreLabel', 'titleBlock.overallScoreConfidenceLabel',
  'titleBlock.marketReadiness', 'titleBlock.marketReadinessConfidenceLabel',
  'oneParagraphPitch', 'oneSentencePitch', 'contentWarnings', 'executiveSummary',
  'topStrengths', 'topRisks', 'topRecommendations', 'criteriaScoreGrid',
  'criterionDetails', 'confidenceExplanation', 'disclaimer',
];

function readPath(root: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = root as Record<string, unknown> | unknown;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function normText(s: string): string {
  return s.normalize('NFKC')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}

function flatPrimitives(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return value.trim().length > 0 ? [value] : [];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flatPrimitives);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(flatPrimitives);
  return [];
}

function getFragments(value: unknown, path: string): string[] {
  if (path === 'criteriaScoreGrid' && Array.isArray(value)) {
    return value.flatMap((row: Record<string, unknown>) =>
      [row.label, row.scoreLabel, row.confidenceLabel].flatMap(flatPrimitives));
  }
  if (path === 'criterionDetails' && Array.isArray(value)) {
    return value.flatMap((detail: Record<string, unknown>) => {
      const recs = Array.isArray(detail.recommendations) ? detail.recommendations : [];
      const recFrags = recs.flatMap((rec: Record<string, unknown>) => [
        rec.anchor_snippet, rec.symptom, rec.mechanism,
        rec.specific_fix || rec.action,
        rec.reader_effect || rec.expected_impact,
        rec.mistake_proofing, rec.collapsed_from_criteria,
      ].flatMap(flatPrimitives));
      return [detail.label, detail.scoreLabel, detail.confidenceLabel,
        detail.supportLabel, detail.rationaleLabel, detail.rationaleText,
        ...recFrags].flatMap(flatPrimitives);
    });
  }
  return flatPrimitives(value);
}

function checkPresence(output: string, value: unknown, path: string): { pass: boolean; missing: string[] } {
  const normOut = normText(output);
  const fragments = getFragments(value, path)
    .map(f => normText(mistakeProofText(f, '')))
    .filter(f => f.length > 0 && f !== 'not available');
  if (fragments.length === 0) return { pass: false, missing: ['<no-fragments>'] };
  const missing = fragments.filter(f => !normOut.includes(f));
  return { pass: missing.length === 0, missing };
}

// Mode-specific fields to check for long-form multi-layer
const LONG_FORM_MODE_SPECIFIC_FIELDS = [
  'modeSpecific.manuscriptScaleContinuityFindings',
  'modeSpecific.storyLedgerArchitectureMap',
  'modeSpecific.reviewGateReadinessSurface',
  'modeSpecific.governedLedgerAddenda',
  'modeSpecific.crossLayerSynthesis',
  'modeSpecific.layerAwareRevisionSequencing',
  'modeSpecific.continuityCoverageProof',
  'modeSpecific.readinessReleasabilityPosture',
  'modeSpecific.revisionPriorityPlan',
];

type AuditResult = {
  failures: Array<{ field: string; cls: string; missing: string[] }>;
  total: number;
  passing: number;
};

async function runFieldLineageAudit(params: {
  mode: 'short_form_evaluation' | 'long_form_multi_layer_evaluation';
  result: EvaluationResultV2;
  displayTitle: string;
}): Promise<AuditResult> {
  const doc = buildUnifiedDocumentForParityFromEvaluationResult({
    evaluationResult: params.result,
    displayTitle: params.displayTitle,
    mode: params.mode,
  });
  const vm = normalizeEvaluationReportViewModel({ ued: doc });
  const txt = testing.renderTxtFromViewModel(vm, null, 'job-audit');
  const html = testing.renderHtmlFromViewModel(vm, null, 'job-audit');
  const docxBuffer = await testing.renderDocxFromViewModel(vm, null, 'job-audit');
  const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

  const fieldsToCheck = [
    ...REQUIRED_FIELDS,
    ...(params.mode !== 'short_form_evaluation' ? LONG_FORM_MODE_SPECIFIC_FIELDS : []),
  ];

  console.log(`\n=== FIELD-LINEAGE REPORT [${params.mode}] ===`);
  console.log('field | UED? | VM? | VM=UED? | Web | DOCX | TXT | class');
  console.log('--- | --- | --- | --- | --- | --- | --- | ---');

  const failures: Array<{ field: string; cls: string; missing: string[] }> = [];

  for (const field of fieldsToCheck) {
    const uedVal = readPath(doc, field);
    const vmPath = field === 'title' ? 'titleBlock.displayTitle' : field;
    const vmVal = readPath(vm, vmPath);
    const uedPresent = !isEmpty(uedVal) ? 'Y' : 'N';
    const vmPresent = !isEmpty(vmVal) ? 'Y' : 'N';

    let vmSameAsUed = '-';
    if (typeof uedVal === 'string' && typeof vmVal === 'string') {
      vmSameAsUed = normText(uedVal) === normText(vmVal) ? 'Y' : 'N';
    } else if (uedPresent === 'Y' && vmPresent === 'Y') {
      vmSameAsUed = JSON.stringify(uedVal) === JSON.stringify(vmVal) ? 'Y' : '?';
    }

    // Renderers consume VM, not UED — check VM fragments against renderer output.
    // UED fragments may differ from VM when correctScopeLanguage applies (expected).
    const checkVal = vmPresent === 'Y' ? vmVal : uedVal;
    const webCheck = checkPresence(html, checkVal, field);
    const docxCheck = checkPresence(docxText, checkVal, field);
    const txtCheck = checkPresence(txt, checkVal, field);

    let cls = 'PASS';
    if (uedPresent === 'N') cls = 'A';
    else if (vmPresent === 'N') cls = 'B';
    else if (!webCheck.pass || !docxCheck.pass || !txtCheck.pass) cls = 'C';

    console.log(`${field} | ${uedPresent} | ${vmPresent} | ${vmSameAsUed} | ${webCheck.pass?'Y':'N'} | ${docxCheck.pass?'Y':'N'} | ${txtCheck.pass?'Y':'N'} | ${cls}`);

    if (cls !== 'PASS') {
      const allMissing = [...new Set([...webCheck.missing, ...docxCheck.missing, ...txtCheck.missing])];
      failures.push({ field, cls, missing: allMissing });
      console.log(`  └─ missing: ${allMissing.map(m => `"${m.slice(0,80)}"`).join(', ')}`);
    }
  }

  // correctScopeLanguage verification for long-form
  if (params.mode !== 'short_form_evaluation') {
    console.log('\n=== correctScopeLanguage VERIFICATION ===');
    const chapterInUed = JSON.stringify(doc).match(/\bthis chapter\b/gi)?.length ?? 0;
    const chapterInVm = JSON.stringify(vm).match(/\bthis chapter\b/gi)?.length ?? 0;
    const manuscriptInVm = JSON.stringify(vm).match(/\bthis manuscript\b/gi)?.length ?? 0;
    console.log(`UED "this chapter" occurrences: ${chapterInUed}`);
    console.log(`VM "this chapter" occurrences: ${chapterInVm} (should be 0 for long-form)`);
    console.log(`VM "this manuscript" occurrences: ${manuscriptInVm}`);
    if (chapterInVm > 0) {
      console.log('WARNING: correctScopeLanguage did not replace all "this chapter" in VM');
    }
  }

  // Authority answers
  console.log('\n=== AUTHORITY: confidenceExplanation ===');
  console.log('UED:', JSON.stringify((doc as Record<string, unknown>).confidenceExplanation).slice(0, 150));
  console.log('VM:', JSON.stringify((vm as Record<string, unknown>).confidenceExplanation).slice(0, 150));

  const total = fieldsToCheck.length;
  const passing = total - failures.length;
  console.log(`\n=== SUMMARY [${params.mode}] ===`);
  console.log(`Total fields: ${total} | Passing: ${passing} | Failing: ${failures.length}`);
  failures.forEach(f => console.log(`  ${f.cls}: ${f.field}`));

  return { failures, total, passing };
}

const SHORT_FORM_FIXTURE = {
  generated_at: '2026-01-01T00:00:00Z',
  overview: {
    overall_score_0_100: 82, verdict: 'revise',
    one_paragraph_summary: 'Measured parity summary appears in every renderer output.',
    top_3_strengths: ['Measured voice strength', 'Clean scene intent', 'Useful premise'],
    top_3_risks: ['Measured pacing risk', 'Thin midpoint pressure', 'Soft closing turn'],
  },
  metrics: { manuscript: { title: 'Measured Parity Manuscript', word_count: 5200, genre: 'thriller', target_audience: 'Adult thriller readers' } },
  enrichment: { premise: 'A forensic editor validates renderer parity.', trigger_warnings: ['violence'], reading_grade_level: 9, dialogue_percentage: 35, narrative_percentage: 65 },
  governance: { warnings: [], limitations: [] },
  criteria: [{
    key: 'narrativeDrive', score_0_10: 8, confidence_level: 'high',
    rationale: 'The measured rationale must survive all renderer adapters.',
    recommendations: [{
      priority: 'high', action: 'Increase pressure around the midpoint reversal.',
      anchor_snippet: 'The corridor fell silent before the alarm began.',
      symptom: 'Tension softens before the decision point.',
      mechanism: 'Delayed consequence signaling.',
      specific_fix: 'Move the consequence beat one paragraph earlier.',
      reader_effect: 'Keeps the reader oriented toward danger.',
      mistake_proofing: 'Check each scene exit for a forward-pull sentence.',
    }],
  }],
  recommendations: {
    quick_wins: [{ action: 'Clarify the opening image.', why: 'Reader orientation improves.', effort: 'low', impact: 'medium' }],
    strategic_revisions: [{ action: 'Rebalance the midpoint sequence.', why: 'Central tension should peak sooner.', effort: 'medium', impact: 'high' }],
  },
} as unknown as EvaluationResultV2;

// Long-form multi-layer fixture: includes "chapter" references to exercise correctScopeLanguage
const LONG_FORM_FIXTURE = {
  generated_at: '2026-01-01T00:00:00Z',
  overview: {
    overall_score_0_100: 74, verdict: 'revise',
    one_paragraph_summary: 'This chapter demonstrates strong voice but the chapter needs tighter pacing at the midpoint.',
    top_3_strengths: ['Layered character psychology across this chapter', 'Strong thematic resonance per chapter', 'Clean arc structure'],
    top_3_risks: ['Pacing sags in the chapter midpoint', 'Subplot integration is chapter-level only', 'The chapter closing lacks forward pull'],
  },
  metrics: { manuscript: { title: 'Long Form Audit Novel', word_count: 85000, genre: 'literary fiction', target_audience: 'Adult literary fiction readers' } },
  enrichment: { premise: 'A multi-layer audit validates scope language correction.', trigger_warnings: ['violence', 'substance use'], reading_grade_level: 12, dialogue_percentage: 25, narrative_percentage: 75 },
  governance: { warnings: [], limitations: [] },
  criteria: [{
    key: 'narrativeDrive', score_0_10: 7, confidence_level: 'moderate',
    rationale: 'This chapter builds tension effectively but the chapter loses momentum before the climax.',
    recommendations: [{
      priority: 'high', action: 'Tighten the chapter midpoint reversal.',
      anchor_snippet: 'The hallway stretched longer than memory allowed.',
      symptom: 'This chapter softens before the decision point.',
      mechanism: 'The chapter delays consequence signaling.',
      specific_fix: 'Move the chapter consequence beat one scene earlier.',
      reader_effect: 'Keeps the reader oriented toward the chapter climax.',
      mistake_proofing: 'Check each chapter exit for a forward-pull sentence.',
    }],
  }],
  recommendations: {
    quick_wins: [{ action: 'Clarify the chapter opening image.', why: 'Reader orientation improves.', effort: 'low', impact: 'medium' }],
    strategic_revisions: [{ action: 'Rebalance the chapter midpoint sequence.', why: 'Central tension should peak sooner.', effort: 'medium', impact: 'high' }],
  },
} as unknown as EvaluationResultV2;

it('boundary audit: short_form_evaluation field-lineage report', async () => {
  const audit = await runFieldLineageAudit({
    mode: 'short_form_evaluation',
    result: SHORT_FORM_FIXTURE,
    displayTitle: 'Measured Parity Manuscript',
  });
  console.log(`\nShort-form audit: ${audit.passing}/${audit.total} fields passing`);
  expect(true).toBe(true);
});

it('boundary audit: long_form_multi_layer_evaluation field-lineage report', async () => {
  const audit = await runFieldLineageAudit({
    mode: 'long_form_multi_layer_evaluation',
    result: LONG_FORM_FIXTURE,
    displayTitle: 'Long Form Audit Novel',
  });
  console.log(`\nLong-form multi-layer audit: ${audit.passing}/${audit.total} fields passing`);
  expect(true).toBe(true);
});
