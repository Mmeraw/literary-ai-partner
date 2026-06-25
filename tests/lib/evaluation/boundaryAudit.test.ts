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

it('boundary audit: field-lineage report', async () => {
  const result = {
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

  const doc = buildUnifiedDocumentForParityFromEvaluationResult({ evaluationResult: result, displayTitle: 'Measured Parity Manuscript', mode: 'short_form_evaluation' });
  const vm = normalizeEvaluationReportViewModel(doc);
  const txt = testing.renderTxtFromViewModel(vm, null, 'job-measured');
  const html = testing.renderHtmlFromViewModel(vm, null, 'job-measured');
  const docxBuffer = await testing.renderDocxFromViewModel(vm, null, 'job-measured');
  const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

  console.log('\n=== FIELD-LINEAGE REPORT ===');
  console.log('field | UED? | VM? | VM=UED? | Web | DOCX | TXT | class');
  console.log('--- | --- | --- | --- | --- | --- | --- | ---');

  const failures: Array<{ field: string; cls: string; missing: string[] }> = [];

  for (const field of REQUIRED_FIELDS) {
    const uedVal = readPath(doc, field);
    // VM stores 'title' at 'titleBlock.displayTitle' (architectural rename)
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

    const webCheck = checkPresence(html, uedVal, field);
    const docxCheck = checkPresence(docxText, uedVal, field);
    const txtCheck = checkPresence(txt, uedVal, field);

    let cls = 'PASS';
    if (uedPresent === 'N') cls = 'A';
    else if (vmPresent === 'N' || vmSameAsUed === 'N') cls = 'B';
    else if (!webCheck.pass || !docxCheck.pass || !txtCheck.pass) cls = 'C';

    console.log(`${field} | ${uedPresent} | ${vmPresent} | ${vmSameAsUed} | ${webCheck.pass?'Y':'N'} | ${docxCheck.pass?'Y':'N'} | ${txtCheck.pass?'Y':'N'} | ${cls}`);

    if (cls !== 'PASS') {
      const allMissing = [...new Set([...webCheck.missing, ...docxCheck.missing, ...txtCheck.missing])];
      failures.push({ field, cls, missing: allMissing });
      console.log(`  └─ missing: ${allMissing.map(m => `"${m.slice(0,80)}"`).join(', ')}`);
    }
  }

  // Authority answers
  console.log('\n=== AUTHORITY: confidenceExplanation ===');
  console.log('UED:', JSON.stringify((doc as Record<string, unknown>).confidenceExplanation).slice(0, 150));
  console.log('VM:', JSON.stringify((vm as Record<string, unknown>).confidenceExplanation).slice(0, 150));

  console.log('\n=== AUTHORITY: criterionDetails ===');
  const uedDetails = (doc as Record<string, unknown>).criterionDetails as Array<Record<string, unknown>>;
  const vmDetails = (vm as Record<string, unknown>).criterionDetails as Array<Record<string, unknown>>;
  console.log(`UED criterionDetails count: ${uedDetails?.length ?? 0}`);
  console.log(`VM criterionDetails count: ${vmDetails?.length ?? 0}`);
  // Show first and last detail entries (first has score, last likely stub)
  if (uedDetails?.length > 0) {
    const first = uedDetails[0];
    console.log(`UED[0]: key=${first.key}, scoreLabel=${first.scoreLabel}, supportLabel=${first.supportLabel}`);
    const last = uedDetails[uedDetails.length - 1];
    console.log(`UED[last]: key=${last.key}, scoreLabel=${last.scoreLabel}, supportLabel=${last.supportLabel}`);
    const firstRecs = Array.isArray(first.recommendations) ? first.recommendations : [];
    if (firstRecs.length > 0) {
      const r = firstRecs[0] as Record<string, unknown>;
      console.log(`UED[0].rec[0] keys: ${Object.keys(r).join(', ')}`);
      console.log(`  action: ${r.action}`);
      console.log(`  specific_fix: ${r.specific_fix}`);
    }
  }
  if (vmDetails?.length > 0) {
    const first = vmDetails[0];
    console.log(`VM[0]: key=${(first as Record<string, unknown>).key}, scoreLabel=${(first as Record<string, unknown>).scoreLabel}, supportLabel=${(first as Record<string, unknown>).supportLabel}`);
    const last = vmDetails[vmDetails.length - 1];
    console.log(`VM[last]: key=${(last as Record<string, unknown>).key}, scoreLabel=${(last as Record<string, unknown>).scoreLabel}, supportLabel=${(last as Record<string, unknown>).supportLabel}`);
  }
  
  // Check if supportLabel text appears in outputs
  const testFragment = 'score omitted';
  const normTxtOut = normText(txt);
  const normDocxOut = normText(docxText);
  console.log(`\n"${testFragment}" in TXT: ${normTxtOut.includes(testFragment)}`);
  console.log(`"${testFragment}" in DOCX: ${normDocxOut.includes(testFragment)}`);
  // Show what the parity checker actually looks for
  const stubLabel = "Score omitted — insufficient confidence in what the submitted text presented for this criterion";
  const normalizedStub = normText(mistakeProofText(stubLabel, ''));
  console.log(`Parity expects fragment: "${normalizedStub.slice(0, 80)}..."`);
  console.log(`In TXT: ${normTxtOut.includes(normalizedStub)}`);
  console.log(`In DOCX: ${normDocxOut.includes(normalizedStub)}`);

  // Show small samples of TXT/DOCX output for debugging
  console.log('\n=== TXT SAMPLE (first 500 chars) ===');
  console.log(txt.slice(0, 500));
  console.log('\n=== DOCX TEXT SAMPLE (first 500 chars) ===');
  console.log(docxText.slice(0, 500));

  // Print overall summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total fields: ${REQUIRED_FIELDS.length}`);
  console.log(`Passing: ${REQUIRED_FIELDS.length - failures.length}`);
  console.log(`Failing: ${failures.length}`);
  failures.forEach(f => console.log(`  ${f.cls}: ${f.field}`));

  // Don't assert — this is an audit tool
  expect(true).toBe(true);
});
