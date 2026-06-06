import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { isEvaluationResultV1, type EvaluationResultV1 } from '@/schemas/evaluation-result-v1';
import { isEvaluationResultV2, type EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import { enforceApiRateLimit } from '@/lib/security/apiRateLimit';
import { requireUser } from '@/lib/security/apiGuards';
import { getCriterionDisplayLabel } from '@/lib/evaluation/reportRenderSafety';
import { sanitizeCMOS } from '@/lib/evaluation/cmosSanitizer';
import { buildTopRecommendations } from '@/lib/evaluation/reportRecommendations';
import {
  buildReportPitches,
  summarizeRevisionOpportunities,
} from '@/lib/evaluation/reportTemplateContract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WORDS_PER_MANUSCRIPT_PAGE = 250;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const TOP_Y = 740;
const BOTTOM_Y = 54;
const LINE_HEIGHT = 14;
const MAX_CHARS = 94;

type ExportableResult = EvaluationResultV1 | EvaluationResultV2;

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gapBefore?: number;
};

function sanitizePdfText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return sanitizeCMOS(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00AE/g, '(R)')
    .replace(/\u00A9/g, '(C)')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeFilename(title: string | null, jobId: string): string {
  const base = title ? title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) : jobId.slice(0, 8);
  return `revision-grade-${base}.pdf`;
}

function extractManuscriptTitle(manuscripts: unknown): string | null {
  const relation = Array.isArray(manuscripts) ? manuscripts[0] : manuscripts;
  const title = typeof relation === 'object' && relation && 'title' in relation
    ? (relation as { title?: unknown }).title
    : null;
  return typeof title === 'string' && title.trim().length > 0 ? title.trim() : null;
}

function scoreLabel(score: number | null | undefined, denominator: number): string {
  return typeof score === 'number' ? `${Math.round(score)}/${denominator}` : `-/${denominator}`;
}

function wrapText(text: string, maxChars = MAX_CHARS): string[] {
  const clean = sanitizePdfText(text);
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      continue;
    }
    current = next;
  }

  if (current) lines.push(current);
  return lines;
}

function addWrapped(lines: PdfLine[], text: unknown, options: Omit<PdfLine, 'text'> = {}, maxChars = MAX_CHARS): void {
  wrapText(sanitizePdfText(text), maxChars).forEach((line, index) => {
    lines.push({ text: line, ...options, gapBefore: index === 0 ? options.gapBefore : 0 });
  });
}

function buildReportLines(result: ExportableResult, title: string | null): PdfLine[] {
  const manuscript = result.metrics?.manuscript;
  const displayTitle = title ?? manuscript?.title ?? 'Untitled Manuscript';
  const wordCount = typeof manuscript?.word_count === 'number' ? manuscript.word_count : null;
  const estimatedPages = wordCount ? Math.max(1, Math.ceil(wordCount / WORDS_PER_MANUSCRIPT_PAGE)) : null;
  const enrichment = isEvaluationResultV2(result) ? result.enrichment : undefined;
  const pitches = buildReportPitches({
    premise: enrichment?.premise,
    summary: result.overview.one_paragraph_summary,
    title: displayTitle,
  });
  const opportunitySummary = summarizeRevisionOpportunities(result.criteria);
  const topRecommendations = buildTopRecommendations(result, 5);
  const lines: PdfLine[] = [];

  lines.push({ text: 'RevisionGrade\u2122 Evaluation Report', bold: true, size: 18 });
  addWrapped(lines, displayTitle, { bold: true, size: 16, gapBefore: 12 }, 74);
  lines.push({ text: `Score: ${scoreLabel(result.overview.overall_score_0_100, 100)}    Verdict: ${sanitizePdfText(result.overview.verdict).toUpperCase()}`, bold: true, gapBefore: 8 });
  if (manuscript?.genre) lines.push({ text: `Genre: ${sanitizePdfText(manuscript.genre)}` });
  if (wordCount) lines.push({ text: `Submitted Word Count: ${wordCount.toLocaleString()}${estimatedPages ? ` (${estimatedPages} estimated pages)` : ''}` });
  lines.push({ text: `Generated: ${sanitizePdfText(result.generated_at)}` });

  lines.push({ text: 'One-Paragraph Pitch', bold: true, size: 14, gapBefore: 18 });
  addWrapped(lines, pitches.oneParagraphPitch, {}, 92);

  lines.push({ text: 'One-Sentence Pitch', bold: true, size: 14, gapBefore: 18 });
  addWrapped(lines, pitches.oneSentencePitch, {}, 92);

  if (enrichment?.premise) {
    lines.push({ text: 'Premise', bold: true, size: 14, gapBefore: 18 });
    addWrapped(lines, enrichment.premise, {}, 92);
  }

  lines.push({ text: 'Trigger Warnings', bold: true, size: 14, gapBefore: 18 });
  if (enrichment?.trigger_warnings?.length) {
    enrichment.trigger_warnings.forEach((item) => addWrapped(lines, `- ${item}`, {}, 92));
  } else {
    addWrapped(lines, 'No content warnings identified.', {}, 92);
  }
  addWrapped(lines, 'Consider including content warnings in book marketing or front matter.', {}, 92);

  lines.push({ text: 'Revision Opportunity Summary', bold: true, size: 14, gapBefore: 18 });
  lines.push({ text: `Total Revision Opportunities: ${opportunitySummary.total}` });
  lines.push({ text: `High Priority: ${opportunitySummary.high}` });
  lines.push({ text: `Medium Priority: ${opportunitySummary.medium}` });
  lines.push({ text: `Low Priority: ${opportunitySummary.low}` });
  addWrapped(lines, 'Priority labels indicate the recommended urgency of each revision opportunity.', {}, 92);

  lines.push({ text: 'Executive Summary', bold: true, size: 14, gapBefore: 18 });
  addWrapped(lines, result.overview.one_paragraph_summary, {}, 92);

  lines.push({ text: 'Top Strengths', bold: true, size: 14, gapBefore: 18 });
  result.overview.top_3_strengths.forEach((item, index) => addWrapped(lines, `${index + 1}. ${item}`, {}, 90));

  lines.push({ text: 'Top Risks', bold: true, size: 14, gapBefore: 18 });
  result.overview.top_3_risks.forEach((item, index) => addWrapped(lines, `${index + 1}. ${item}`, {}, 90));

  if (topRecommendations.length > 0) {
    lines.push({ text: 'Top Recommendations', bold: true, size: 14, gapBefore: 18 });
    topRecommendations.forEach((item, index) => addWrapped(lines, `${index + 1}. ${item}`, {}, 90));
  }

  lines.push({ text: '13 Criteria Score Grid', bold: true, size: 14, gapBefore: 18 });
  result.criteria.forEach((criterion) => {
    lines.push({
      text: `${getCriterionDisplayLabel(criterion.key)} | ${scoreLabel(criterion.score_0_10, 10)}${criterion.confidence_level ? ` | ${criterion.confidence_level} confidence` : ''}`,
      gapBefore: 4,
    });
  });

  lines.push({ text: 'Criterion Rationales & Surfaced Opportunities', bold: true, size: 14, gapBefore: 18 });
  result.criteria.forEach((criterion) => {
    lines.push({
      text: `${getCriterionDisplayLabel(criterion.key)} - ${scoreLabel(criterion.score_0_10, 10)}${criterion.confidence_level ? ` (${criterion.confidence_level} confidence)` : ''}`,
      bold: true,
      gapBefore: 8,
    });
    if (criterion.rationale) addWrapped(lines, criterion.rationale, {}, 92);
  });

  lines.push({ text: 'Generated by RevisionGrade\u2122. Author retains ownership of manuscript content. This report is an editorial diagnostic and does not guarantee publication, representation, or commercial outcome.', gapBefore: 8 });

  return lines;
}

function escapePdfLiteral(text: string): string {
  return sanitizePdfText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildDependencyFreePdf(lines: PdfLine[]): Buffer {
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let y = TOP_Y;

  for (const line of lines) {
    const size = line.size ?? 10;
    const gap = line.gapBefore ?? 0;
    const needed = gap + Math.max(LINE_HEIGHT, size + 4);
    if (y - needed < BOTTOM_Y && page.length > 0) {
      pages.push(page);
      page = [];
      y = TOP_Y;
    }
    page.push(line);
    y -= needed;
  }

  if (page.length > 0) pages.push(page);

  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageIds: number[] = [];

  pages.forEach((pageLines, pageIndex) => {
    let cursorY = TOP_Y;
    const commands: string[] = ['BT'];

    pageLines.forEach((line) => {
      const size = line.size ?? 10;
      cursorY -= line.gapBefore ?? 0;
      commands.push(`/${line.bold ? 'F2' : 'F1'} ${size} Tf`);
      commands.push(`${MARGIN_X} ${cursorY} Td`);
      commands.push(`(${escapePdfLiteral(line.text)}) Tj`);
      commands.push(`${-MARGIN_X} ${-LINE_HEIGHT} Td`);
      cursorY -= Math.max(LINE_HEIGHT, size + 4);
    });

    commands.push('/F1 8 Tf');
    commands.push(`${MARGIN_X} 34 Td`);
    commands.push(`(RevisionGrade(TM) | Confidential | Page ${pageIndex + 1}) Tj`);
    commands.push('ET');

    const stream = commands.join('\n');
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'binary');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } | Promise<{ jobId: string }> },
) {
  const rateLimitDenied = enforceApiRateLimit(request, {
    bucket: 'report_download_pdf',
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitDenied) return rateLimitDenied;

  const resolved = await Promise.resolve(params);
  const jobId = resolved.jobId;

  if (!jobId || !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
  }

  const auth = await requireUser();
  if (auth.ok === false) return auth.response;
  const user = auth.user;

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from('evaluation_jobs')
    .select('evaluation_result, status, validity_status, manuscripts!inner(user_id,title)')
    .eq('id', jobId)
    .eq('manuscripts.user_id', user.id)
    .single();

  if (error || !job || !job.evaluation_result || !canReleaseEvaluationRead(job)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rawResult = job.evaluation_result as unknown;
  if (!isEvaluationResultV1(rawResult) && !isEvaluationResultV2(rawResult)) {
    return NextResponse.json({ error: 'Invalid result format' }, { status: 500 });
  }

  const title = extractManuscriptTitle((job as { manuscripts?: unknown }).manuscripts) ?? rawResult.metrics?.manuscript?.title ?? null;
  const pdf = buildDependencyFreePdf(buildReportLines(rawResult, title));

  if (pdf.subarray(0, 4).toString('ascii') !== '%PDF') {
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename(title, jobId)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
