import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { isEvaluationResultV1, type EvaluationResultV1 } from '@/schemas/evaluation-result-v1';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function buildTxtReport(result: EvaluationResultV1, title: string | null): string {
  const lines: string[] = [];
  const sep = '='.repeat(72);
  const sub = '-'.repeat(72);

  lines.push(sep);
  lines.push(`EVALUATION REPORT — ${title ?? 'Untitled'}`);
  lines.push(sep);
  lines.push('');
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Verdict: ${result.overview.verdict.toUpperCase()}`);
  lines.push(`Overall Score: ${result.overview.overall_score_0_100}/100`);
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
    lines.push(`• ${c.key} — ${c.score_0_10}/10${c.confidence_level ? ` (${c.confidence_level} confidence)` : ''}`);
    if (c.rationale) lines.push(`  Rationale: ${c.rationale}`);
    lines.push('');
  });

  lines.push(sub);
  lines.push('QUICK WINS');
  lines.push(sub);
  if (result.recommendations.quick_wins.length === 0) {
    lines.push('(none)');
  } else {
    result.recommendations.quick_wins.forEach((qw, i) => {
      lines.push(`${i + 1}. ${qw.action} [effort: ${qw.effort}, impact: ${qw.impact}]`);
      if (qw.why) lines.push(`   Why: ${qw.why}`);
    });
  }
  lines.push('');

  lines.push(sub);
  lines.push('STRATEGIC REVISIONS');
  lines.push(sub);
  if (result.recommendations.strategic_revisions.length === 0) {
    lines.push('(none)');
  } else {
    result.recommendations.strategic_revisions.forEach((sr, i) => {
      lines.push(`${i + 1}. ${sr.action} [effort: ${sr.effort}, impact: ${sr.impact}]`);
      if (sr.why) lines.push(`   Why: ${sr.why}`);
    });
  }
  lines.push('');
  lines.push(sep);

  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlReport(result: EvaluationResultV1, title: string | null): string {
  const t = escapeHtml(title ?? 'Untitled');
  const verdict = escapeHtml(result.overview.verdict.toUpperCase());
  const summary = escapeHtml(result.overview.one_paragraph_summary);

  const strengths = result.overview.top_3_strengths
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('');
  const risks = result.overview.top_3_risks.map((r) => `<li>${escapeHtml(r)}</li>`).join('');

  const criteriaRows = result.criteria
    .map(
      (c) => `
        <tr>
          <td>${escapeHtml(c.key)}</td>
          <td class="num">${c.score_0_10}/10</td>
          <td>${escapeHtml(c.confidence_level ?? '—')}</td>
          <td>${escapeHtml(c.rationale ?? '')}</td>
        </tr>`,
    )
    .join('');

  const quickWins = result.recommendations.quick_wins
    .map(
      (qw) => `
        <li>
          <strong>${escapeHtml(qw.action)}</strong>
          <span class="meta">effort: ${escapeHtml(qw.effort)} · impact: ${escapeHtml(qw.impact)}</span>
          <div class="why">${escapeHtml(qw.why ?? '')}</div>
        </li>`,
    )
    .join('');

  const strategic = result.recommendations.strategic_revisions
    .map(
      (sr) => `
        <li>
          <strong>${escapeHtml(sr.action)}</strong>
          <span class="meta">effort: ${escapeHtml(sr.effort)} · impact: ${escapeHtml(sr.impact)}</span>
          <div class="why">${escapeHtml(sr.why ?? '')}</div>
        </li>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Evaluation Report — ${t}</title>
<style>
  @page { margin: 1in; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a1a;
    line-height: 1.5;
    max-width: 7in;
    margin: 0 auto;
    padding: 0.5in 0.25in;
  }
  h1 { font-size: 28px; margin: 0 0 4px 0; }
  h2 { font-size: 18px; margin: 24px 0 8px 0; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 16px 0 6px 0; }
  .meta-row { color: #555; font-size: 13px; margin-bottom: 12px; }
  .score-block {
    display: inline-block;
    padding: 6px 12px;
    background: #f3f4f6;
    border-radius: 4px;
    font-weight: bold;
    margin-right: 8px;
  }
  .verdict-pass { background: #d1fae5; color: #065f46; }
  .verdict-revise { background: #fef3c7; color: #92400e; }
  .verdict-fail { background: #fee2e2; color: #991b1b; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; }
  td.num { text-align: center; font-weight: bold; white-space: nowrap; }
  ul { padding-left: 20px; }
  li { margin-bottom: 8px; }
  .meta { font-size: 11px; color: #6b7280; margin-left: 8px; }
  .why { font-size: 12px; color: #4b5563; margin-top: 2px; }
  @media print {
    body { padding: 0; }
    h2 { page-break-after: avoid; }
    tr, li { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>Evaluation Report</h1>
  <div class="meta-row"><strong>${t}</strong> · Generated ${escapeHtml(result.generated_at)}</div>
  <div>
    <span class="score-block verdict-${escapeHtml(result.overview.verdict)}">${verdict}</span>
    <span class="score-block">${result.overview.overall_score_0_100}/100</span>
  </div>

  <h2>Summary</h2>
  <p>${summary}</p>

  <h2>Top Strengths</h2>
  <ul>${strengths}</ul>

  <h2>Top Risks</h2>
  <ul>${risks}</ul>

  <h2>Criteria Scores</h2>
  <table>
    <thead>
      <tr><th>Criterion</th><th>Score</th><th>Confidence</th><th>Rationale</th></tr>
    </thead>
    <tbody>${criteriaRows}</tbody>
  </table>

  <h2>Quick Wins</h2>
  ${quickWins ? `<ul>${quickWins}</ul>` : '<p><em>(none)</em></p>'}

  <h2>Strategic Revisions</h2>
  ${strategic ? `<ul>${strategic}</ul>` : '<p><em>(none)</em></p>'}

  <script>window.addEventListener('load', function() { setTimeout(function(){ window.print(); }, 250); });</script>
</body>
</html>`;
}

async function buildDocx(result: EvaluationResultV1, title: string | null): Promise<Buffer> {
  const titleText = title ?? 'Untitled';

  const para = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new Paragraph({
      children: [
        new TextRun({
          text,
          bold: opts.bold ?? false,
          size: opts.size,
        }),
      ],
    });

  const heading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
    new Paragraph({
      heading: level,
      children: [new TextRun({ text })],
    });

  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  };

  const headerCell = (text: string) =>
    new TableCell({
      borders: cellBorders,
      children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    });
  const bodyCell = (text: string) =>
    new TableCell({
      borders: cellBorders,
      children: [new Paragraph({ children: [new TextRun({ text })] })],
    });

  const criteriaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [headerCell('Criterion'), headerCell('Score'), headerCell('Confidence'), headerCell('Rationale')],
      }),
      ...result.criteria.map(
        (c) =>
          new TableRow({
            children: [
              bodyCell(c.key),
              bodyCell(`${c.score_0_10}/10`),
              bodyCell(c.confidence_level ?? '—'),
              bodyCell(c.rationale ?? ''),
            ],
          }),
      ),
    ],
  });

  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: 'Evaluation Report' })],
    }),
  );
  children.push(para(titleText, { bold: true, size: 28 }));
  children.push(para(`Generated: ${result.generated_at}`));
  children.push(
    para(
      `Verdict: ${result.overview.verdict.toUpperCase()}  |  Score: ${result.overview.overall_score_0_100}/100`,
      { bold: true },
    ),
  );
  children.push(para(''));

  children.push(heading('Summary', HeadingLevel.HEADING_2));
  children.push(para(result.overview.one_paragraph_summary));

  children.push(heading('Top Strengths', HeadingLevel.HEADING_2));
  result.overview.top_3_strengths.forEach((s) => children.push(para(`• ${s}`)));

  children.push(heading('Top Risks', HeadingLevel.HEADING_2));
  result.overview.top_3_risks.forEach((r) => children.push(para(`• ${r}`)));

  children.push(heading('Criteria Scores', HeadingLevel.HEADING_2));

  const recommendationsChildren: Paragraph[] = [];
  recommendationsChildren.push(heading('Quick Wins', HeadingLevel.HEADING_2));
  if (result.recommendations.quick_wins.length === 0) {
    recommendationsChildren.push(para('(none)'));
  } else {
    result.recommendations.quick_wins.forEach((qw) => {
      recommendationsChildren.push(
        para(`• ${qw.action}  [effort: ${qw.effort}, impact: ${qw.impact}]`, { bold: true }),
      );
      if (qw.why) recommendationsChildren.push(para(`   ${qw.why}`));
    });
  }

  recommendationsChildren.push(heading('Strategic Revisions', HeadingLevel.HEADING_2));
  if (result.recommendations.strategic_revisions.length === 0) {
    recommendationsChildren.push(para('(none)'));
  } else {
    result.recommendations.strategic_revisions.forEach((sr) => {
      recommendationsChildren.push(
        para(`• ${sr.action}  [effort: ${sr.effort}, impact: ${sr.impact}]`, { bold: true }),
      );
      if (sr.why) recommendationsChildren.push(para(`   ${sr.why}`));
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [...children, criteriaTable, para(''), ...recommendationsChildren],
      },
    ],
  });

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
  const format = formatParam as 'pdf' | 'docx' | 'txt';

  const ssrSupabase = await createSSRClient();
  const {
    data: { user },
  } = await ssrSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  if (!isEvaluationResultV1(job.evaluation_result as unknown)) {
    return NextResponse.json({ error: 'Invalid result format' }, { status: 500 });
  }

  const result = job.evaluation_result as EvaluationResultV1;
  const title = extractManuscriptTitle((job as { manuscripts?: unknown }).manuscripts);

  if (format === 'txt') {
    const body = buildTxtReport(result, title);
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(title, jobId, 'txt')}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'pdf') {
    const html = buildHtmlReport(result, title);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  // docx
  const buffer = await buildDocx(result, title);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeFilename(title, jobId, 'docx')}"`,
      'Cache-Control': 'no-store',
    },
  });
}
