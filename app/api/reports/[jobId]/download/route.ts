import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { isEvaluationResultV1, type EvaluationResultV1 } from '@/schemas/evaluation-result-v1';
import { isEvaluationResultV2, type EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { LongformDreamDocument } from '@/lib/evaluation/pipeline/runPass3bLongform';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ExportFormat = 'pdf' | 'docx' | 'txt';
type ExportableResult = EvaluationResultV1 | EvaluationResultV2;

function safeFilename(title: string | null, jobId: string, ext: string): string {
  const base = title ? title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) : jobId.slice(0, 8);
  return `revision-grade-${base}.${ext}`;
}

function extractManuscriptTitle(manuscripts: unknown): string | null {
  const relation = Array.isArray(manuscripts) ? manuscripts[0] : manuscripts;
  const title =
    typeof relation === 'object' && relation && 'title' in relation
      ? (relation as { title?: unknown }).title
      : null;
  return typeof title === 'string' && title.trim().length > 0 ? title.trim() : null;
}

function scoreLabel(score: number | null | undefined, denominator: number): string {
  return typeof score === 'number' ? `${score}/${denominator}` : `—/${denominator}`;
}

function appendDreamTxtSections(lines: string[], dream: LongformDreamDocument): void {
  const sep = '='.repeat(72);
  const push = (s: string) => lines.push(s);

  push('');
  push(sep);
  push('NARRATIVE SYNTHESIS — HOLISTIC CRAFT ASSESSMENT');
  push(sep);
  push('');
  push(`Quality: ${dream.dream_scores?.quality ?? '—'}/100`);
  push(`Readiness: ${dream.dream_scores?.readiness ?? '—'}/100`);
  push(`Commercial: ${dream.dream_scores?.commercial ?? '—'}/100`);
  push(`Literary: ${dream.dream_scores?.literary ?? '—'}/100`);
  push('');
  push('Executive Verdict:');
  push(dream.executive_verdict ?? '—');

  if (dream.market_shelf) {
    push('');
    push('Market Shelf:');
    push(`  Best shelf: ${dream.market_shelf.best_shelf ?? '—'}`);
    push(`  Marketable hook: ${dream.market_shelf.marketable_hook ?? '—'}`);
    push(`  Market danger: ${dream.market_shelf.market_danger ?? '—'}`);
  }

  if (Array.isArray(dream.criterion_analyses) && dream.criterion_analyses.length > 0) {
    push('');
    push(sep);
    push('DREAM ANALYSIS — PER-CRITERION');
    push(sep);
    dream.criterion_analyses.forEach((a) => {
      push('');
      push(`${a.key} — ${a.score}/10 (${a.confidence} confidence)`);
      if (Array.isArray(a.fit_evidence) && a.fit_evidence.length > 0) push(`  Fit evidence: ${a.fit_evidence.join('; ')}`);
      if (Array.isArray(a.gap_evidence) && a.gap_evidence.length > 0) push(`  Gap evidence: ${a.gap_evidence.join('; ')}`);
      if (Array.isArray(a.revision_queue) && a.revision_queue.length > 0) push(`  Revision queue: ${a.revision_queue.join('; ')}`);
    });
  }

  if (Array.isArray(dream.revision_plan) && dream.revision_plan.length > 0) {
    push('');
    push(sep);
    push('REVISION PLAN');
    push(sep);
    dream.revision_plan.forEach((item) => {
      push('');
      push(`Priority ${item.priority}: ${item.title}`);
      push(`  Goal: ${item.goal}`);
      if (Array.isArray(item.actions) && item.actions.length > 0) push(`  Actions: ${item.actions.join('; ')}`);
      if (item.acceptance_check) push(`  Acceptance check: ${item.acceptance_check}`);
    });
  }
}

function buildTxtReport(result: ExportableResult, title: string | null, jobId: string, dream: LongformDreamDocument | null): string {
  const lines: string[] = [];
  const sep = '='.repeat(72);
  const sub = '-'.repeat(72);
  const displayTitle = title ?? result.metrics?.manuscript?.title ?? 'Untitled';

  lines.push(sep);
  lines.push('REVISIONGRADE™ EVALUATION REPORT');
  lines.push(displayTitle);
  lines.push(sep);
  lines.push(`Job ID: ${jobId}`);
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Schema: ${result.schema_version}`);
  lines.push('');
  lines.push(`Verdict: ${result.overview.verdict.toUpperCase()}`);
  lines.push(`Overall Score: ${scoreLabel(result.overview.overall_score_0_100, 100)}`);
  lines.push('');

  lines.push(sub);
  lines.push('SUMMARY');
  lines.push(sub);
  lines.push(result.overview.one_paragraph_summary);
  lines.push('');

  lines.push(sub);
  lines.push('TOP STRENGTHS');
  lines.push(sub);
  result.overview.top_3_strengths.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('');

  lines.push(sub);
  lines.push('TOP RISKS');
  lines.push(sub);
  result.overview.top_3_risks.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  lines.push('');

  lines.push(sub);
  lines.push('CRITERIA SCORES');
  lines.push(sub);
  result.criteria.forEach((c) => {
    lines.push(`• ${c.key} — ${scoreLabel(c.score_0_10, 10)}${c.confidence_level ? ` (${c.confidence_level} confidence)` : ''}`);
    if (c.rationale) lines.push(`  Rationale: ${c.rationale}`);
    lines.push('');
  });

  lines.push(sub);
  lines.push('QUICK WINS');
  lines.push(sub);
  if (result.recommendations.quick_wins.length === 0) lines.push('(none)');
  result.recommendations.quick_wins.forEach((qw, i) => {
    lines.push(`${i + 1}. ${qw.action} [effort: ${qw.effort}, impact: ${qw.impact}]`);
    if (qw.why) lines.push(`   Why: ${qw.why}`);
  });
  lines.push('');

  lines.push(sub);
  lines.push('STRATEGIC REVISIONS');
  lines.push(sub);
  if (result.recommendations.strategic_revisions.length === 0) lines.push('(none)');
  result.recommendations.strategic_revisions.forEach((sr, i) => {
    lines.push(`${i + 1}. ${sr.action} [effort: ${sr.effort}, impact: ${sr.impact}]`);
    if (sr.why) lines.push(`   Why: ${sr.why}`);
  });

  if (dream) appendDreamTxtSections(lines, dream);

  lines.push('');
  lines.push(sep);
  lines.push('Generated by RevisionGrade™. Author retains ownership of manuscript content.');
  return lines.join('\n');
}

async function buildPdfReport(result: ExportableResult, title: string | null, jobId: string, dream: LongformDreamDocument | null): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const displayTitle = title ?? result.metrics?.manuscript?.title ?? 'Untitled';
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomY = () => doc.page.height - doc.page.margins.bottom - 42;
    const ensureSpace = (height = 90) => {
      if (doc.y + height > bottomY()) doc.addPage();
    };
    const section = (text: string) => {
      ensureSpace(70);
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(15).text(text, { width: contentWidth });
      doc.moveDown(0.35);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + contentWidth, doc.y).strokeColor('#CCCCCC').stroke();
      doc.strokeColor('#000000');
      doc.moveDown(0.5);
    };
    const paragraph = (text: string) => {
      ensureSpace(70);
      doc.font('Helvetica').fontSize(10.5).text(text || '—', { width: contentWidth });
      doc.moveDown(0.45);
    };
    const bullet = (text: string) => {
      ensureSpace(45);
      doc.font('Helvetica').fontSize(10.5).text(`• ${text}`, { width: contentWidth, indent: 12 });
      doc.moveDown(0.25);
    };

    doc.font('Helvetica-Bold').fontSize(24).text('RevisionGrade™ Evaluation Report', { width: contentWidth });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(14).text(displayTitle, { width: contentWidth });
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(10).text(`Job ID: ${jobId}`, { width: contentWidth });
    doc.text(`Generated: ${result.generated_at}`, { width: contentWidth });
    doc.text(`Schema: ${result.schema_version}`, { width: contentWidth });
    doc.moveDown(0.45);
    doc.font('Helvetica-Bold').fontSize(12).text(
      `Verdict: ${result.overview.verdict.toUpperCase()}   |   Score: ${scoreLabel(result.overview.overall_score_0_100, 100)}`,
      { width: contentWidth },
    );

    section('Summary');
    paragraph(result.overview.one_paragraph_summary);

    section('Top Strengths');
    result.overview.top_3_strengths.length ? result.overview.top_3_strengths.forEach(bullet) : paragraph('(none)');

    section('Top Risks');
    result.overview.top_3_risks.length ? result.overview.top_3_risks.forEach(bullet) : paragraph('(none)');

    section('Criteria Scores');
    result.criteria.forEach((c) => {
      ensureSpace(90);
      doc.font('Helvetica-Bold').fontSize(11).text(
        `${c.key} — ${scoreLabel(c.score_0_10, 10)}${c.confidence_level ? ` (${c.confidence_level} confidence)` : ''}`,
        { width: contentWidth },
      );
      if (c.rationale) paragraph(c.rationale);
    });

    section('Quick Wins');
    result.recommendations.quick_wins.length ? result.recommendations.quick_wins.forEach((qw, idx) => {
      ensureSpace(80);
      doc.font('Helvetica-Bold').fontSize(10.5).text(`${idx + 1}. ${qw.action}  [effort: ${qw.effort}, impact: ${qw.impact}]`, { width: contentWidth });
      if (qw.why) paragraph(qw.why);
    }) : paragraph('(none)');

    section('Strategic Revisions');
    result.recommendations.strategic_revisions.length ? result.recommendations.strategic_revisions.forEach((sr, idx) => {
      ensureSpace(80);
      doc.font('Helvetica-Bold').fontSize(10.5).text(`${idx + 1}. ${sr.action}  [effort: ${sr.effort}, impact: ${sr.impact}]`, { width: contentWidth });
      if (sr.why) paragraph(sr.why);
    }) : paragraph('(none)');

    if (dream) {
      section('Narrative Synthesis');
      paragraph(`Quality: ${dream.dream_scores?.quality ?? '—'}/100 | Readiness: ${dream.dream_scores?.readiness ?? '—'}/100 | Commercial: ${dream.dream_scores?.commercial ?? '—'}/100 | Literary: ${dream.dream_scores?.literary ?? '—'}/100`);
      doc.font('Helvetica-Bold').fontSize(12).text('Executive Verdict', { width: contentWidth });
      paragraph(dream.executive_verdict ?? '—');
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7).fillColor('#4B5563').text(
        `Generated by RevisionGrade™ · Job ID: ${jobId}`,
        doc.page.margins.left,
        doc.page.height - 42,
        { width: contentWidth, align: 'center' },
      );
      doc.fillColor('#000000');
    }

    doc.end();
  });
}

async function buildDocx(result: ExportableResult, title: string | null, jobId: string, dream: LongformDreamDocument | null): Promise<Buffer> {
  const displayTitle = title ?? result.metrics?.manuscript?.title ?? 'Untitled';
  const para = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new Paragraph({ children: [new TextRun({ text, bold: opts.bold ?? false, size: opts.size })] });
  const heading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
    new Paragraph({ heading: level, children: [new TextRun({ text })] });

  const children: Paragraph[] = [];
  children.push(heading('RevisionGrade™ Evaluation Report', HeadingLevel.HEADING_1));
  children.push(para(displayTitle, { bold: true, size: 28 }));
  children.push(para(`Job ID: ${jobId}`));
  children.push(para(`Generated: ${result.generated_at}`));
  children.push(para(`Schema: ${result.schema_version}`));
  children.push(para(`Verdict: ${result.overview.verdict.toUpperCase()}  |  Score: ${scoreLabel(result.overview.overall_score_0_100, 100)}`, { bold: true }));
  children.push(para(''));

  children.push(heading('Summary', HeadingLevel.HEADING_2));
  children.push(para(result.overview.one_paragraph_summary));

  children.push(heading('Top Strengths', HeadingLevel.HEADING_2));
  result.overview.top_3_strengths.forEach((s) => children.push(para(`• ${s}`)));

  children.push(heading('Top Risks', HeadingLevel.HEADING_2));
  result.overview.top_3_risks.forEach((r) => children.push(para(`• ${r}`)));

  children.push(heading('Criteria Scores', HeadingLevel.HEADING_2));
  result.criteria.forEach((c) => {
    children.push(para(`${c.key} — ${scoreLabel(c.score_0_10, 10)}${c.confidence_level ? ` (${c.confidence_level} confidence)` : ''}`, { bold: true }));
    if (c.rationale) children.push(para(c.rationale));
  });

  children.push(heading('Quick Wins', HeadingLevel.HEADING_2));
  if (result.recommendations.quick_wins.length === 0) children.push(para('(none)'));
  result.recommendations.quick_wins.forEach((qw) => {
    children.push(para(`• ${qw.action}  [effort: ${qw.effort}, impact: ${qw.impact}]`, { bold: true }));
    if (qw.why) children.push(para(`   ${qw.why}`));
  });

  children.push(heading('Strategic Revisions', HeadingLevel.HEADING_2));
  if (result.recommendations.strategic_revisions.length === 0) children.push(para('(none)'));
  result.recommendations.strategic_revisions.forEach((sr) => {
    children.push(para(`• ${sr.action}  [effort: ${sr.effort}, impact: ${sr.impact}]`, { bold: true }));
    if (sr.why) children.push(para(`   ${sr.why}`));
  });

  if (dream) {
    children.push(heading('Narrative Synthesis', HeadingLevel.HEADING_2));
    children.push(para(`Quality: ${dream.dream_scores?.quality ?? '—'}/100  |  Readiness: ${dream.dream_scores?.readiness ?? '—'}/100  |  Commercial: ${dream.dream_scores?.commercial ?? '—'}/100  |  Literary: ${dream.dream_scores?.literary ?? '—'}/100`, { bold: true }));
    children.push(heading('Executive Verdict', HeadingLevel.HEADING_3));
    children.push(para(dream.executive_verdict ?? '—'));
  }

  children.push(para(''));
  children.push(para('Generated by RevisionGrade™. Author retains ownership of manuscript content.'));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } | Promise<{ jobId: string }> },
) {
  const resolved = await Promise.resolve(params);
  const jobId = resolved.jobId;

  if (!jobId || !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const formatParam = (searchParams.get('format') ?? 'txt').toLowerCase();
  if (!['pdf', 'docx', 'txt'].includes(formatParam)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }
  const format = formatParam as ExportFormat;

  const ssrSupabase = await createSSRClient();
  const {
    data: { user },
  } = await ssrSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from('evaluation_jobs')
    .select(`evaluation_result, status, validity_status, manuscripts!inner(user_id, title)`)
    .eq('id', jobId)
    .eq('manuscripts.user_id', user.id)
    .single();

  if (error || !job || !canReleaseEvaluationRead(job) || !job.evaluation_result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rawResult = job.evaluation_result as unknown;
  if (!isEvaluationResultV1(rawResult) && !isEvaluationResultV2(rawResult)) {
    return NextResponse.json({ error: 'Invalid result format' }, { status: 500 });
  }

  const result = rawResult as ExportableResult;
  const title = extractManuscriptTitle((job as { manuscripts?: unknown }).manuscripts);

  let dream: LongformDreamDocument | null = null;
  const { data: dreamRow } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'longform_document_v1')
    .maybeSingle();
  const content = dreamRow?.content as { longform_document?: unknown } | null | undefined;
  if (content?.longform_document && typeof content.longform_document === 'object') {
    dream = content.longform_document as LongformDreamDocument;
  }

  if (format === 'txt') {
    const body = buildTxtReport(result, title, jobId, dream);
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(title, jobId, 'txt')}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'pdf') {
    const buffer = await buildPdfReport(result, title, jobId, dream);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename(title, jobId, 'pdf')}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const buffer = await buildDocx(result, title, jobId, dream);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeFilename(title, jobId, 'docx')}"`,
      'Cache-Control': 'no-store',
    },
  });
}
