import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { isEvaluationResultV1, type EvaluationResultV1 } from '@/schemas/evaluation-result-v1';
import type { LongformDreamDocument } from '@/lib/evaluation/pipeline/runPass3bLongform';
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
export const runtime = 'nodejs';

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
  push('');
  push('Market Shelf:');
  push(`  Best shelf: ${dream.market_shelf?.best_shelf ?? '—'}`);
  push(`  Marketable hook: ${dream.market_shelf?.marketable_hook ?? '—'}`);
  push(`  Market danger: ${dream.market_shelf?.market_danger ?? '—'}`);
  if (Array.isArray(dream.market_shelf?.shelf_neighbors) && dream.market_shelf!.shelf_neighbors.length > 0) {
    push(`  Shelf neighbors: ${dream.market_shelf!.shelf_neighbors.join('; ')}`);
  }
  if (Array.isArray(dream.market_shelf?.comparison_space) && dream.market_shelf!.comparison_space.length > 0) {
    push(`  Comparison space: ${dream.market_shelf!.comparison_space.join('; ')}`);
  }
  push('');
  if (Array.isArray(dream.what_not_to_become) && dream.what_not_to_become.length > 0) {
    push('Anti-Patterns to Avoid:');
    dream.what_not_to_become.forEach((p, i) => push(`  ${i + 1}. ${p}`));
    push('');
  }

  if (Array.isArray(dream.structural_stack) && dream.structural_stack.length > 0) {
    push('Structural Stack:');
    dream.structural_stack.forEach((layer) => {
      push(`  • ${layer.layer_name} [${layer.status}]`);
      push(`    Function: ${layer.function}`);
      push(`    Revision note: ${layer.revision_note}`);
    });
    push('');
  }

  if (Array.isArray(dream.arc_map) && dream.arc_map.length > 0) {
    push('Arc Map:');
    dream.arc_map.forEach((arc) => {
      push(`  • ${arc.act_name} (${arc.chapter_range})`);
      push(`    Primary function: ${arc.primary_function}`);
      push(`    Revision priority: ${arc.revision_priority}`);
    });
    push('');
  }

  if (Array.isArray(dream.criterion_analyses) && dream.criterion_analyses.length > 0) {
    push('');
    push(sep);
    push('DREAM ANALYSIS — PER-CRITERION');
    push(sep);
    push('');
    dream.criterion_analyses.forEach((a) => {
      push(`${a.key} — ${a.score}/10 (${a.confidence} confidence)`);
      if (Array.isArray(a.fit_evidence) && a.fit_evidence.length > 0) {
        push(`  Fit evidence: ${a.fit_evidence.join('; ')}`);
      }
      if (Array.isArray(a.gap_evidence) && a.gap_evidence.length > 0) {
        push(`  Gap evidence: ${a.gap_evidence.join('; ')}`);
      }
      if (Array.isArray(a.revision_queue) && a.revision_queue.length > 0) {
        push(`  Revision queue: ${a.revision_queue.join('; ')}`);
      }
      push('');
    });
  }

  if (dream.symbolic_audit) {
    push(sep);
    push('SYMBOLIC / DOCTRINE AUDIT');
    push(sep);
    push('');
    if (Array.isArray(dream.symbolic_audit.preserved_symbols)) {
      dream.symbolic_audit.preserved_symbols.forEach((sym) => {
        push(`  • Symbol: ${sym.symbol}`);
        push(`    Current function: ${sym.current_function}`);
        push(`    Revision instruction: ${sym.revision_instruction}`);
      });
    }
    if (Array.isArray(dream.symbolic_audit.doctrine_strengths) && dream.symbolic_audit.doctrine_strengths.length > 0) {
      push(`  Doctrine strengths: ${dream.symbolic_audit.doctrine_strengths.join('; ')}`);
    }
    if (Array.isArray(dream.symbolic_audit.doctrine_risks) && dream.symbolic_audit.doctrine_risks.length > 0) {
      push(`  Doctrine risks: ${dream.symbolic_audit.doctrine_risks.join('; ')}`);
    }
    if (dream.symbolic_audit.audit_conclusion) {
      push(`  Audit conclusion: ${dream.symbolic_audit.audit_conclusion}`);
    }
    push('');
  }

  if (dream.reader_experience) {
    push(sep);
    push('READER EXPERIENCE');
    push(sep);
    push('');
    const acts: Array<['First Act' | 'Middle' | 'Final Act', { reader_question: string; emotional_state: string; risk: string } | undefined]> = [
      ['First Act', dream.reader_experience.first_act],
      ['Middle', dream.reader_experience.middle],
      ['Final Act', dream.reader_experience.final_act],
    ];
    acts.forEach(([label, act]) => {
      if (!act) return;
      push(`  ${label}:`);
      push(`    Reader question: ${act.reader_question}`);
      push(`    Emotional state: ${act.emotional_state}`);
      push(`    Risk: ${act.risk}`);
    });
    if (dream.reader_experience.aftertaste) {
      push(`  Aftertaste: ${dream.reader_experience.aftertaste}`);
    }
    push('');
  }

  if (Array.isArray(dream.revision_plan) && dream.revision_plan.length > 0) {
    push(sep);
    push('REVISION PLAN');
    push(sep);
    push('');
    dream.revision_plan.forEach((item) => {
      push(`  Priority ${item.priority}: ${item.title}`);
      push(`    Goal: ${item.goal}`);
      if (Array.isArray(item.actions) && item.actions.length > 0) {
        push(`    Actions: ${item.actions.join('; ')}`);
      }
      push(`    Acceptance check: ${item.acceptance_check}`);
      push('');
    });
  }

  if (Array.isArray(dream.releasability) && dream.releasability.length > 0) {
    push(sep);
    push('RELEASABILITY');
    push(sep);
    push('');
    dream.releasability.forEach((row) => {
      push(`  • ${row.dimension} — ${row.verdict}`);
      push(`    Current status: ${row.current_status}`);
    });
    push('');
  }

  if (Array.isArray(dream.manuscript_integrity_issues) && dream.manuscript_integrity_issues.length > 0) {
    push(sep);
    push('CHARACTER SYSTEM / MANUSCRIPT INTEGRITY');
    push(sep);
    push('');
    dream.manuscript_integrity_issues.forEach((issue) => {
      push(`  • [${issue.severity}] ${issue.kind}: ${issue.description}`);
    });
    push('');
  }
}

function buildTxtReport(
  result: EvaluationResultV1,
  title: string | null,
  dream: LongformDreamDocument | null,
): string {
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

  if (dream) {
    appendDreamTxtSections(lines, dream);
  }

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


async function buildPdfReport(
  result: EvaluationResultV1,
  title: string | null,
  dream: LongformDreamDocument | null,
): Promise<Buffer> {
  const titleText = title ?? 'Untitled';

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 54,
      info: {
        Title: `Evaluation Report - ${titleText}`,
        Author: 'RevisionGrade',
        Subject: 'Evaluation Report',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const ensureSpace = (height = 90) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + height > bottom) doc.addPage();
    };

    const section = (headingText: string) => {
      ensureSpace(70);
      doc.moveDown(0.9);
      doc.font('Helvetica-Bold').fontSize(15).text(headingText, { width: contentWidth });
      doc.moveDown(0.35);
      doc.moveTo(doc.page.margins.left, doc.y)
         .lineTo(doc.page.margins.left + contentWidth, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.5);
      doc.strokeColor('#000000');
    };

    const paragraph = (text: string) => {
      ensureSpace(70);
      doc.font('Helvetica').fontSize(10.5).text(text || '—', { width: contentWidth, align: 'left' });
      doc.moveDown(0.45);
    };

    const bullet = (text: string) => {
      ensureSpace(45);
      doc.font('Helvetica').fontSize(10.5).text(`\u2022 ${text}`, { width: contentWidth, indent: 12 });
      doc.moveDown(0.25);
    };

    // Title block
    doc.font('Helvetica-Bold').fontSize(24).text('Evaluation Report', { width: contentWidth });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(14).text(titleText, { width: contentWidth });
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(10).text(`Generated: ${result.generated_at}`, { width: contentWidth });
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(12).text(
      `Verdict: ${result.overview.verdict.toUpperCase()}   |   Score: ${result.overview.overall_score_0_100}/100`,
      { width: contentWidth },
    );

    section('Summary');
    paragraph(result.overview.one_paragraph_summary);

    section('Top Strengths');
    if (result.overview.top_3_strengths.length === 0) {
      paragraph('(none)');
    } else {
      result.overview.top_3_strengths.forEach(bullet);
    }

    section('Top Risks');
    if (result.overview.top_3_risks.length === 0) {
      paragraph('(none)');
    } else {
      result.overview.top_3_risks.forEach(bullet);
    }

    section('Criteria Scores');
    result.criteria.forEach((c) => {
      ensureSpace(90);
      doc.font('Helvetica-Bold').fontSize(11).text(
        `${c.key} \u2014 ${c.score_0_10}/10${c.confidence_level ? ` (${c.confidence_level} confidence)` : ''}`,
        { width: contentWidth },
      );
      if (c.rationale) {
        doc.font('Helvetica').fontSize(10).text(c.rationale, { width: contentWidth });
      }
      doc.moveDown(0.5);
    });

    section('Quick Wins');
    if (result.recommendations.quick_wins.length === 0) {
      paragraph('(none)');
    } else {
      result.recommendations.quick_wins.forEach((qw, idx) => {
        ensureSpace(80);
        doc.font('Helvetica-Bold').fontSize(10.5).text(
          `${idx + 1}. ${qw.action}  [effort: ${qw.effort}, impact: ${qw.impact}]`,
          { width: contentWidth },
        );
        if (qw.why) paragraph(qw.why);
      });
    }

    section('Strategic Revisions');
    if (result.recommendations.strategic_revisions.length === 0) {
      paragraph('(none)');
    } else {
      result.recommendations.strategic_revisions.forEach((sr, idx) => {
        ensureSpace(80);
        doc.font('Helvetica-Bold').fontSize(10.5).text(
          `${idx + 1}. ${sr.action}  [effort: ${sr.effort}, impact: ${sr.impact}]`,
          { width: contentWidth },
        );
        if (sr.why) paragraph(sr.why);
      });
    }

    if (dream) {
      const subheading = (text: string) => {
        ensureSpace(40);
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(12).text(text, { width: contentWidth });
        doc.moveDown(0.2);
      };
      const labeled = (label: string, value: string | number | undefined | null) => {
        if (value === undefined || value === null || value === '') return;
        ensureSpace(40);
        doc.font('Helvetica-Bold').fontSize(10.5).text(`${label}: `, { width: contentWidth, continued: true });
        doc.font('Helvetica').fontSize(10.5).text(String(value), { width: contentWidth });
        doc.moveDown(0.2);
      };

      section('Narrative Synthesis');
      labeled('Quality', dream.dream_scores?.quality);
      labeled('Readiness', dream.dream_scores?.readiness);
      labeled('Commercial', dream.dream_scores?.commercial);
      labeled('Literary', dream.dream_scores?.literary);
      doc.moveDown(0.3);
      subheading('Executive Verdict');
      paragraph(dream.executive_verdict ?? '—');

      subheading('Market Shelf');
      labeled('Best shelf', dream.market_shelf?.best_shelf);
      labeled('Marketable hook', dream.market_shelf?.marketable_hook);
      labeled('Market danger', dream.market_shelf?.market_danger);
      if (Array.isArray(dream.market_shelf?.shelf_neighbors) && dream.market_shelf!.shelf_neighbors.length > 0) {
        labeled('Shelf neighbors', dream.market_shelf!.shelf_neighbors.join('; '));
      }
      if (Array.isArray(dream.market_shelf?.comparison_space) && dream.market_shelf!.comparison_space.length > 0) {
        labeled('Comparison space', dream.market_shelf!.comparison_space.join('; '));
      }

      if (Array.isArray(dream.what_not_to_become) && dream.what_not_to_become.length > 0) {
        subheading('Anti-Patterns to Avoid');
        dream.what_not_to_become.forEach(bullet);
      }

      if (Array.isArray(dream.structural_stack) && dream.structural_stack.length > 0) {
        subheading('Structural Stack');
        dream.structural_stack.forEach((layer) => {
          bullet(`${layer.layer_name} [${layer.status}] — ${layer.function}`);
          if (layer.revision_note) paragraph(`  Revision note: ${layer.revision_note}`);
        });
      }

      if (Array.isArray(dream.arc_map) && dream.arc_map.length > 0) {
        subheading('Arc Map');
        dream.arc_map.forEach((arc) => {
          bullet(`${arc.act_name} (${arc.chapter_range}) — ${arc.primary_function}`);
          if (arc.revision_priority) paragraph(`  Revision priority: ${arc.revision_priority}`);
        });
      }

      if (Array.isArray(dream.criterion_analyses) && dream.criterion_analyses.length > 0) {
        section('DREAM Analysis');
        dream.criterion_analyses.forEach((a) => {
          ensureSpace(90);
          doc.font('Helvetica-Bold').fontSize(11).text(
            `${a.key} — ${a.score}/10 (${a.confidence} confidence)`,
            { width: contentWidth },
          );
          if (Array.isArray(a.fit_evidence) && a.fit_evidence.length > 0) {
            paragraph(`Fit evidence: ${a.fit_evidence.join('; ')}`);
          }
          if (Array.isArray(a.gap_evidence) && a.gap_evidence.length > 0) {
            paragraph(`Gap evidence: ${a.gap_evidence.join('; ')}`);
          }
          if (Array.isArray(a.revision_queue) && a.revision_queue.length > 0) {
            paragraph(`Revision queue: ${a.revision_queue.join('; ')}`);
          }
          doc.moveDown(0.3);
        });
      }

      if (dream.symbolic_audit) {
        section('Symbolic / Doctrine Audit');
        if (Array.isArray(dream.symbolic_audit.preserved_symbols)) {
          dream.symbolic_audit.preserved_symbols.forEach((sym) => {
            bullet(`${sym.symbol} — ${sym.current_function}`);
            if (sym.revision_instruction) paragraph(`  Revision: ${sym.revision_instruction}`);
          });
        }
        if (Array.isArray(dream.symbolic_audit.doctrine_strengths) && dream.symbolic_audit.doctrine_strengths.length > 0) {
          labeled('Doctrine strengths', dream.symbolic_audit.doctrine_strengths.join('; '));
        }
        if (Array.isArray(dream.symbolic_audit.doctrine_risks) && dream.symbolic_audit.doctrine_risks.length > 0) {
          labeled('Doctrine risks', dream.symbolic_audit.doctrine_risks.join('; '));
        }
        labeled('Audit conclusion', dream.symbolic_audit.audit_conclusion);
      }

      if (dream.reader_experience) {
        section('Reader Experience');
        const acts: Array<[string, { reader_question: string; emotional_state: string; risk: string } | undefined]> = [
          ['First Act', dream.reader_experience.first_act],
          ['Middle', dream.reader_experience.middle],
          ['Final Act', dream.reader_experience.final_act],
        ];
        acts.forEach(([label, act]) => {
          if (!act) return;
          subheading(label);
          labeled('Reader question', act.reader_question);
          labeled('Emotional state', act.emotional_state);
          labeled('Risk', act.risk);
        });
        if (dream.reader_experience.aftertaste) {
          labeled('Aftertaste', dream.reader_experience.aftertaste);
        }
      }

      if (Array.isArray(dream.revision_plan) && dream.revision_plan.length > 0) {
        section('Revision Plan');
        dream.revision_plan.forEach((item) => {
          ensureSpace(90);
          doc.font('Helvetica-Bold').fontSize(11).text(
            `Priority ${item.priority}: ${item.title}`,
            { width: contentWidth },
          );
          paragraph(`Goal: ${item.goal}`);
          if (Array.isArray(item.actions) && item.actions.length > 0) {
            paragraph(`Actions: ${item.actions.join('; ')}`);
          }
          if (item.acceptance_check) paragraph(`Acceptance check: ${item.acceptance_check}`);
        });
      }

      if (Array.isArray(dream.releasability) && dream.releasability.length > 0) {
        section('Releasability');
        dream.releasability.forEach((row) => {
          bullet(`${row.dimension} — ${row.verdict}`);
          if (row.current_status) paragraph(`  Current status: ${row.current_status}`);
        });
      }

      if (Array.isArray(dream.manuscript_integrity_issues) && dream.manuscript_integrity_issues.length > 0) {
        section('Character System / Manuscript Integrity');
        dream.manuscript_integrity_issues.forEach((issue) => {
          bullet(`[${issue.severity}] ${issue.kind}: ${issue.description}`);
        });
      }
    }

    doc.end();
  });
}

async function buildDocx(
  result: EvaluationResultV1,
  title: string | null,
  dream: LongformDreamDocument | null,
): Promise<Buffer> {
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

  const dreamChildren: Paragraph[] = [];
  if (dream) {
    dreamChildren.push(heading('Narrative Synthesis', HeadingLevel.HEADING_2));
    dreamChildren.push(
      para(
        `Quality: ${dream.dream_scores?.quality ?? '—'}/100  |  Readiness: ${dream.dream_scores?.readiness ?? '—'}/100  |  Commercial: ${dream.dream_scores?.commercial ?? '—'}/100  |  Literary: ${dream.dream_scores?.literary ?? '—'}/100`,
        { bold: true },
      ),
    );
    dreamChildren.push(heading('Executive Verdict', HeadingLevel.HEADING_3));
    dreamChildren.push(para(dream.executive_verdict ?? '—'));

    dreamChildren.push(heading('Market Shelf', HeadingLevel.HEADING_3));
    dreamChildren.push(para(`Best shelf: ${dream.market_shelf?.best_shelf ?? '—'}`));
    dreamChildren.push(para(`Marketable hook: ${dream.market_shelf?.marketable_hook ?? '—'}`));
    dreamChildren.push(para(`Market danger: ${dream.market_shelf?.market_danger ?? '—'}`));
    if (Array.isArray(dream.market_shelf?.shelf_neighbors) && dream.market_shelf!.shelf_neighbors.length > 0) {
      dreamChildren.push(para(`Shelf neighbors: ${dream.market_shelf!.shelf_neighbors.join('; ')}`));
    }
    if (Array.isArray(dream.market_shelf?.comparison_space) && dream.market_shelf!.comparison_space.length > 0) {
      dreamChildren.push(para(`Comparison space: ${dream.market_shelf!.comparison_space.join('; ')}`));
    }

    if (Array.isArray(dream.what_not_to_become) && dream.what_not_to_become.length > 0) {
      dreamChildren.push(heading('Anti-Patterns to Avoid', HeadingLevel.HEADING_3));
      dream.what_not_to_become.forEach((p) => dreamChildren.push(para(`• ${p}`)));
    }

    if (Array.isArray(dream.structural_stack) && dream.structural_stack.length > 0) {
      dreamChildren.push(heading('Structural Stack', HeadingLevel.HEADING_3));
      dream.structural_stack.forEach((layer) => {
        dreamChildren.push(para(`• ${layer.layer_name} [${layer.status}]: ${layer.function}`, { bold: true }));
        if (layer.revision_note) dreamChildren.push(para(`   Revision note: ${layer.revision_note}`));
      });
    }

    if (Array.isArray(dream.arc_map) && dream.arc_map.length > 0) {
      dreamChildren.push(heading('Arc Map', HeadingLevel.HEADING_3));
      dream.arc_map.forEach((arc) => {
        dreamChildren.push(para(`• ${arc.act_name} (${arc.chapter_range}): ${arc.primary_function}`, { bold: true }));
        if (arc.revision_priority) dreamChildren.push(para(`   Revision priority: ${arc.revision_priority}`));
      });
    }

    if (Array.isArray(dream.criterion_analyses) && dream.criterion_analyses.length > 0) {
      dreamChildren.push(heading('DREAM Analysis', HeadingLevel.HEADING_2));
      dream.criterion_analyses.forEach((a) => {
        dreamChildren.push(para(`${a.key} — ${a.score}/10 (${a.confidence} confidence)`, { bold: true }));
        if (Array.isArray(a.fit_evidence) && a.fit_evidence.length > 0) {
          dreamChildren.push(para(`Fit evidence: ${a.fit_evidence.join('; ')}`));
        }
        if (Array.isArray(a.gap_evidence) && a.gap_evidence.length > 0) {
          dreamChildren.push(para(`Gap evidence: ${a.gap_evidence.join('; ')}`));
        }
        if (Array.isArray(a.revision_queue) && a.revision_queue.length > 0) {
          dreamChildren.push(para(`Revision queue: ${a.revision_queue.join('; ')}`));
        }
        dreamChildren.push(para(''));
      });
    }

    if (dream.symbolic_audit) {
      dreamChildren.push(heading('Symbolic / Doctrine Audit', HeadingLevel.HEADING_2));
      if (Array.isArray(dream.symbolic_audit.preserved_symbols)) {
        dream.symbolic_audit.preserved_symbols.forEach((sym) => {
          dreamChildren.push(para(`• ${sym.symbol}: ${sym.current_function}`, { bold: true }));
          if (sym.revision_instruction) dreamChildren.push(para(`   Revision: ${sym.revision_instruction}`));
        });
      }
      if (Array.isArray(dream.symbolic_audit.doctrine_strengths) && dream.symbolic_audit.doctrine_strengths.length > 0) {
        dreamChildren.push(para(`Doctrine strengths: ${dream.symbolic_audit.doctrine_strengths.join('; ')}`));
      }
      if (Array.isArray(dream.symbolic_audit.doctrine_risks) && dream.symbolic_audit.doctrine_risks.length > 0) {
        dreamChildren.push(para(`Doctrine risks: ${dream.symbolic_audit.doctrine_risks.join('; ')}`));
      }
      if (dream.symbolic_audit.audit_conclusion) {
        dreamChildren.push(para(`Audit conclusion: ${dream.symbolic_audit.audit_conclusion}`));
      }
    }

    if (dream.reader_experience) {
      dreamChildren.push(heading('Reader Experience', HeadingLevel.HEADING_2));
      const acts: Array<[string, { reader_question: string; emotional_state: string; risk: string } | undefined]> = [
        ['First Act', dream.reader_experience.first_act],
        ['Middle', dream.reader_experience.middle],
        ['Final Act', dream.reader_experience.final_act],
      ];
      acts.forEach(([label, act]) => {
        if (!act) return;
        dreamChildren.push(heading(label, HeadingLevel.HEADING_3));
        dreamChildren.push(para(`Reader question: ${act.reader_question}`));
        dreamChildren.push(para(`Emotional state: ${act.emotional_state}`));
        dreamChildren.push(para(`Risk: ${act.risk}`));
      });
      if (dream.reader_experience.aftertaste) {
        dreamChildren.push(para(`Aftertaste: ${dream.reader_experience.aftertaste}`));
      }
    }

    if (Array.isArray(dream.revision_plan) && dream.revision_plan.length > 0) {
      dreamChildren.push(heading('Revision Plan', HeadingLevel.HEADING_2));
      dream.revision_plan.forEach((item) => {
        dreamChildren.push(para(`Priority ${item.priority}: ${item.title}`, { bold: true }));
        dreamChildren.push(para(`Goal: ${item.goal}`));
        if (Array.isArray(item.actions) && item.actions.length > 0) {
          dreamChildren.push(para(`Actions: ${item.actions.join('; ')}`));
        }
        if (item.acceptance_check) dreamChildren.push(para(`Acceptance check: ${item.acceptance_check}`));
        dreamChildren.push(para(''));
      });
    }

    if (Array.isArray(dream.releasability) && dream.releasability.length > 0) {
      dreamChildren.push(heading('Releasability', HeadingLevel.HEADING_2));
      dream.releasability.forEach((row) => {
        dreamChildren.push(para(`• ${row.dimension} — ${row.verdict}`, { bold: true }));
        if (row.current_status) dreamChildren.push(para(`   Current status: ${row.current_status}`));
      });
    }

    if (Array.isArray(dream.manuscript_integrity_issues) && dream.manuscript_integrity_issues.length > 0) {
      dreamChildren.push(heading('Character System / Manuscript Integrity', HeadingLevel.HEADING_2));
      dream.manuscript_integrity_issues.forEach((issue) => {
        dreamChildren.push(para(`• [${issue.severity}] ${issue.kind}: ${issue.description}`));
      });
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [...children, criteriaTable, para(''), ...recommendationsChildren, ...dreamChildren],
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

  // Optional long-form DREAM document — async Pass 3b artifact. Falls back to
  // null when absent (short-form manuscripts or jobs that ran before Pass 3b
  // existed). When present, the long-form sections (DREAM analysis, Narrative
  // Synthesis, Character System, etc.) are appended to every export format.
  let dream: LongformDreamDocument | null = null;
  {
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
  }

  if (format === 'txt') {
    const body = buildTxtReport(result, title, dream);
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(title, jobId, 'txt')}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'pdf') {
    const buffer = await buildPdfReport(result, title, dream);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename(title, jobId, 'pdf')}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // docx
  const buffer = await buildDocx(result, title, dream);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeFilename(title, jobId, 'docx')}"`,
      'Cache-Control': 'no-store',
    },
  });
}
