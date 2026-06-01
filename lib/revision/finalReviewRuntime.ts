import PDFDocument from "pdfkit";
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createDerivedVersion } from "@/lib/manuscripts/versions";

export type FinalReviewExportFormat = "clean" | "marked" | "changelog";
export type FinalReviewExportFile = "txt" | "pdf" | "docx";

export type FinalReviewRuntimeInput = {
  manuscriptId: string | number;
  evaluationJobId: string;
};

type RuntimeContext = {
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
  manuscriptId: number;
  manuscriptTitle: string;
  evaluationJobId: string;
  sourceVersionId: string;
  sourceText: string;
  decisions: RuntimeDecision[];
};

type RuntimeDecision = {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  decision: string;
  selected_option: string | null;
  custom_text: string | null;
  selected_text: string | null;
  source_excerpt: string | null;
  source_location: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const APPLICABLE = new Set(["accepted_a", "accepted_b", "accepted_c", "custom"]);

const RG = {
  gold: "B8922A",
  goldLight: "F5E9C8",
  goldSoft: "FBF1DC",
  oxblood: "8B2E2E",
  amber: "8B5E1A",
  yellow: "B8922A",
  green: "3A6B2A",
  greenBg: "EBF4E6",
  blue: "2F5F87",
  blueBg: "E9F2FA",
  neutral: "5C5549",
  neutralBg: "F2EFE9",
  ink: "1C1814",
  muted: "5C5549",
  border: "D9D0C3",
  surface: "FAF7F2",
  white: "FFFFFF",
} as const;

function safeFilename(title: string, suffix: string, ext: string): string {
  const base = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "").slice(0, 50) || "manuscript";
  return `revisiongrade-${base}-${suffix}.${ext}`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/[ \u00A0]{2,}/g, " ").trim();
}

function scrubInternalMetadata(text: string): string {
  const lines = text.split(/\r?\n/);
  const output: string[] = [];
  let skip = false;
  const headingBlock = /^(Evaluation Provenance|Technical Metadata|Score Ledger|Job Status|Word Count|Created|Updated|Generated|Chunks Analyzed|Successfully Processed|Evaluation Status|Engine|Provider|Prompt Version|Confidence|Limitations):?\s*$/i;
  const inlineLeak = /\b(gpt-|openai|provider|prompt version|chunks? analyzed|successfully processed|evaluation provenance|score ledger|job id|schema version|raw\s+\d|normalized\s+\d|confidence varies across this report|too few chunks|sampled prompt window|compressed manuscript reference window)\b/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (headingBlock.test(line)) {
      skip = true;
      continue;
    }
    if (skip) {
      if (!line || inlineLeak.test(line) || /^[0-9,]+$/.test(line) || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(line)) continue;
      skip = false;
    }
    if (inlineLeak.test(line)) continue;
    output.push(rawLine);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function decisionLabel(decision: RuntimeDecision): string {
  if (decision.decision === "accepted_a" || decision.decision === "accepted_b" || decision.decision === "accepted_c") return `Accepted ${decision.selected_option ?? ""}`.trim();
  if (decision.decision === "custom") return "Custom rewrite";
  if (decision.decision === "keep_original") return "Kept original";
  if (decision.decision === "reject") return "Rejected";
  if (decision.decision === "deferred") return "Deferred";
  return decision.decision;
}

function severityOf(decision: RuntimeDecision): "must" | "should" | "could" | null {
  const value = typeof decision.metadata?.severity === "string" ? decision.metadata.severity.toLowerCase() : null;
  return value === "must" || value === "should" || value === "could" ? value : null;
}

function severityLabel(decision: RuntimeDecision): string {
  return (severityOf(decision) ?? "severity n/a").toUpperCase();
}

function severityColor(decision: RuntimeDecision): string {
  const severity = severityOf(decision);
  if (severity === "must") return RG.oxblood;
  if (severity === "should") return RG.amber;
  if (severity === "could") return RG.yellow;
  return RG.neutral;
}

function decisionFill(decision: RuntimeDecision): string {
  if (decision.decision === "custom") return RG.blueBg;
  if (decision.decision === "deferred" || decision.decision === "keep_original" || decision.decision === "reject") return RG.neutralBg;
  return RG.goldSoft;
}

async function loadRuntimeContext(input: FinalReviewRuntimeInput): Promise<RuntimeContext> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Not authenticated");

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) throw new Error("Invalid manuscript id");

  const supabase = createAdminClient();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id, title, user_id")
    .eq("id", manuscriptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (manuscriptError) throw new Error(manuscriptError.message);
  if (!manuscript) throw new Error("Manuscript not found in your workspace");

  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, status, manuscript_id, manuscript_version_id")
    .eq("id", input.evaluationJobId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error("Evaluation job not found for this manuscript");
  if (job.status !== "complete") throw new Error("Evaluation must be complete before Final Review can apply or export.");
  if (!job.manuscript_version_id) throw new Error("Evaluation is missing source manuscript version.");

  const { data: version, error: versionError } = await supabase
    .from("manuscript_versions")
    .select("id, raw_text")
    .eq("id", job.manuscript_version_id)
    .maybeSingle();

  if (versionError) throw new Error(versionError.message);
  if (!version) throw new Error("Source manuscript version not found.");

  const { data: rows, error: ledgerError } = await supabase
    .from("revision_ledger_decisions")
    .select("id, opportunity_id, opportunity_title, decision, selected_option, custom_text, selected_text, source_excerpt, source_location, created_at, metadata")
    .eq("user_id", user.id)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", input.evaluationJobId)
    .eq("is_undo", false)
    .order("created_at", { ascending: false });

  if (ledgerError) throw new Error(ledgerError.message);

  const latestByOpportunity = new Map<string, RuntimeDecision>();
  for (const row of (rows ?? []) as RuntimeDecision[]) {
    if (!latestByOpportunity.has(row.opportunity_id)) latestByOpportunity.set(row.opportunity_id, row);
  }

  return {
    supabase,
    userId: user.id,
    manuscriptId,
    manuscriptTitle: manuscript.title ?? "Untitled Manuscript",
    evaluationJobId: String(input.evaluationJobId),
    sourceVersionId: job.manuscript_version_id,
    sourceText: scrubInternalMetadata(version.raw_text ?? ""),
    decisions: [...latestByOpportunity.values()],
  };
}

function applicableDecisions(decisions: RuntimeDecision[]): RuntimeDecision[] {
  return decisions.filter((d) => APPLICABLE.has(d.decision));
}

function buildChangelog(ctx: RuntimeContext): string {
  const lines = [
    "RevisionGrade Final Review Changelog",
    `Manuscript: ${ctx.manuscriptTitle}`,
    "",
  ];

  if (ctx.decisions.length === 0) {
    lines.push("No synced revision decisions were found.");
    return lines.join("\n");
  }

  for (const decision of ctx.decisions) {
    lines.push(`${decisionLabel(decision)} | ${severityLabel(decision)} | ${decision.opportunity_title}`);
    if (decision.selected_option) lines.push(`Option: ${decision.selected_option}`);
    if (decision.source_location) lines.push(`Location: ${decision.source_location}`);
    if (decision.source_excerpt) lines.push(`Original: ${scrubInternalMetadata(decision.source_excerpt)}`);
    if (decision.selected_text) lines.push(`Selected revision: ${scrubInternalMetadata(decision.selected_text)}`);
    if (decision.custom_text) lines.push(`Custom text: ${scrubInternalMetadata(decision.custom_text)}`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildMarkedText(ctx: RuntimeContext): string {
  const lines = [
    "RevisionGrade Marked Review Copy",
    `Manuscript: ${ctx.manuscriptTitle}`,
    "",
    ctx.sourceText,
    "",
    "Revision Changelog",
    buildChangelog(ctx),
  ];
  return lines.join("\n");
}

function applyTextSnapshots(ctx: RuntimeContext): { text: string; applied: RuntimeDecision[]; blocked: string[] } {
  let text = ctx.sourceText;
  const applied: RuntimeDecision[] = [];
  const blocked: string[] = [];

  for (const decision of applicableDecisions(ctx.decisions)) {
    const replacement = scrubInternalMetadata(decision.decision === "custom" ? decision.custom_text ?? "" : decision.selected_text ?? "");
    const source = scrubInternalMetadata(decision.source_excerpt ?? "");

    if (!replacement || !source) {
      blocked.push(`${decision.opportunity_title}: missing source excerpt or selected replacement text.`);
      continue;
    }

    if (!text.includes(source)) {
      blocked.push(`${decision.opportunity_title}: source excerpt no longer matches source manuscript version.`);
      continue;
    }

    text = text.replace(source, replacement);
    applied.push(decision);
  }

  return { text, applied, blocked };
}

async function recordRun(
  ctx: RuntimeContext,
  input: {
    status: "blocked" | "applied" | "exported";
    mode: "apply" | "export_clean" | "export_marked" | "export_changelog";
    revisedVersionId?: string | null;
    appliedDecisionIds?: string[];
    skippedDecisionIds?: string[];
    blockedReason?: string | null;
    exportFormat?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.supabase.from("final_review_apply_runs").insert({
    user_id: ctx.userId,
    manuscript_id: ctx.manuscriptId,
    evaluation_job_id: ctx.evaluationJobId,
    source_version_id: ctx.sourceVersionId,
    revised_version_id: input.revisedVersionId ?? null,
    status: input.status,
    mode: input.mode,
    applied_decision_ids: input.appliedDecisionIds ?? [],
    skipped_decision_ids: input.skippedDecisionIds ?? [],
    blocked_reason: input.blockedReason ?? null,
    export_format: input.exportFormat ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function applyFinalReviewDecisions(input: FinalReviewRuntimeInput) {
  const ctx = await loadRuntimeContext(input);
  const result = applyTextSnapshots(ctx);

  if (result.applied.length === 0 || result.blocked.length > 0) {
    await recordRun(ctx, {
      status: "blocked",
      mode: "apply",
      skippedDecisionIds: applicableDecisions(ctx.decisions).map((d) => d.id),
      blockedReason: result.blocked.join(" | ") || "No applicable accepted/custom decisions with persisted text snapshots.",
      metadata: { blocked: result.blocked },
    });
    return { ok: false, error: result.blocked.join("\n") || "No applicable accepted/custom decisions with persisted text snapshots." };
  }

  const version = await createDerivedVersion({
    manuscript_id: ctx.manuscriptId,
    source_version_id: ctx.sourceVersionId,
    raw_text: result.text,
    created_by: ctx.userId,
  });

  await recordRun(ctx, {
    status: "applied",
    mode: "apply",
    revisedVersionId: version.id,
    appliedDecisionIds: result.applied.map((d) => d.id),
    skippedDecisionIds: ctx.decisions.filter((d) => !APPLICABLE.has(d.decision)).map((d) => d.id),
    metadata: { applied_count: result.applied.length },
  });

  return { ok: true, revisedVersionId: version.id, appliedCount: result.applied.length };
}

function exportText(ctx: RuntimeContext, format: FinalReviewExportFormat, applied: { text: string; applied: RuntimeDecision[]; blocked: string[] }): { text: string; suffix: string } {
  if (format === "changelog") return { text: buildChangelog(ctx), suffix: "changelog" };
  if (format === "marked") return { text: buildMarkedText(ctx), suffix: "marked-review-copy" };

  if (applied.blocked.length > 0) {
    return {
      text: `${ctx.sourceText}\n\nRevisionGrade Clean Draft Notice\nClean export could not apply all decisions because some accepted/custom decisions are missing source/replacement snapshots. Exported source text unchanged.\n\n${applied.blocked.join("\n")}`,
      suffix: "clean-draft",
    };
  }

  return { text: applied.text, suffix: "clean-draft" };
}

function splitParagraphs(text: string): string[] {
  return normalizeWhitespace(text).split(/\n{2,}/g).flatMap((block) => block.split(/\n/g)).map((p) => p.trim()).filter(Boolean);
}

async function buildPdf(ctx: RuntimeContext, format: FinalReviewExportFormat, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 54, bottom: 54, left: 54, right: 54 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fillColor(`#${RG.ink}`).font("Times-Bold").fontSize(20).text(format === "clean" ? "Clean Revised Manuscript" : format === "marked" ? "Marked Review Copy" : "Revision Changelog");
    doc.moveDown(0.3).font("Times-Roman").fontSize(11).fillColor(`#${RG.muted}`).text(ctx.manuscriptTitle);
    doc.moveDown(1);

    if (format === "changelog") {
      for (const decision of ctx.decisions) {
        const y = doc.y;
        doc.roundedRect(54, y, 504, 56, 6).fillAndStroke(`#${decisionFill(decision)}`, `#${RG.border}`);
        doc.fillColor(`#${severityColor(decision)}`).font("Times-Bold").fontSize(9).text(`${severityLabel(decision)} · ${decisionLabel(decision)}`, 66, y + 8, { width: 480 });
        doc.fillColor(`#${RG.ink}`).font("Times-Bold").fontSize(10).text(decision.opportunity_title, 66, y + 22, { width: 480, ellipsis: true });
        const selected = decision.selected_text || decision.custom_text;
        if (selected) doc.fillColor(`#${RG.muted}`).font("Times-Roman").fontSize(9).text(scrubInternalMetadata(selected), 66, y + 38, { width: 480, ellipsis: true });
        doc.y = y + 68;
        if (doc.y > 700) doc.addPage();
      }
    } else {
      for (const paragraph of splitParagraphs(text)) {
        doc.fillColor(`#${RG.ink}`).font("Times-Roman").fontSize(11).text(paragraph, { align: "left", lineGap: 3 });
        doc.moveDown(0.7);
      }
      if (format === "marked" && ctx.decisions.length > 0) {
        doc.addPage().fillColor(`#${RG.ink}`).font("Times-Bold").fontSize(16).text("Revision Changelog");
        doc.moveDown(0.8);
        for (const decision of ctx.decisions) {
          doc.fillColor(`#${severityColor(decision)}`).font("Times-Bold").fontSize(10).text(`${severityLabel(decision)} · ${decisionLabel(decision)}`);
          doc.fillColor(`#${RG.ink}`).font("Times-Roman").fontSize(10).text(decision.opportunity_title);
          const selected = decision.selected_text || decision.custom_text;
          if (selected) doc.fillColor(`#${RG.muted}`).text(scrubInternalMetadata(selected));
          doc.moveDown(0.8);
        }
      }
    }

    doc.end();
  });
}

function docxParagraph(text: string, options: { bold?: boolean; color?: string; heading?: keyof typeof HeadingLevel; fill?: string } = {}) {
  return new Paragraph({
    heading: options.heading ? HeadingLevel[options.heading] : undefined,
    shading: options.fill ? { type: ShadingType.CLEAR, color: "auto", fill: options.fill } : undefined,
    children: [new TextRun({ text, bold: options.bold, color: options.color ?? RG.ink })],
    spacing: { after: 160 },
  });
}

function buildDecisionTable(decisions: RuntimeDecision[]): Table {
  const rows = [
    new TableRow({
      children: ["Decision", "Severity", "Opportunity", "Selected revision"].map((label) => new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: RG.ink },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: RG.white })] })],
      })),
    }),
    ...decisions.map((decision) => new TableRow({
      children: [
        decisionLabel(decision),
        severityLabel(decision),
        decision.opportunity_title,
        scrubInternalMetadata(decision.selected_text || decision.custom_text || "-"),
      ].map((value, index) => new TableCell({
        shading: index === 1 ? { type: ShadingType.CLEAR, color: "auto", fill: severityColor(decision) } : index === 3 ? { type: ShadingType.CLEAR, color: "auto", fill: decisionFill(decision) } : undefined,
        margins: { top: 90, bottom: 90, left: 90, right: 90 },
        children: [new Paragraph({ children: [new TextRun({ text: value, color: index === 1 ? RG.white : RG.ink })] })],
      })),
    })),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: RG.border },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: RG.border },
      left: { style: BorderStyle.SINGLE, size: 1, color: RG.border },
      right: { style: BorderStyle.SINGLE, size: 1, color: RG.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: RG.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: RG.border },
    },
    rows,
  });
}

async function buildDocx(ctx: RuntimeContext, format: FinalReviewExportFormat, text: string): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [
    docxParagraph(format === "clean" ? "Clean Revised Manuscript" : format === "marked" ? "Marked Review Copy" : "Revision Changelog", { heading: "HEADING_1", color: RG.ink }),
    docxParagraph(ctx.manuscriptTitle, { color: RG.muted }),
  ];

  if (format === "changelog") {
    children.push(buildDecisionTable(ctx.decisions));
  } else {
    for (const paragraph of splitParagraphs(text)) children.push(docxParagraph(paragraph));
    if (format === "marked" && ctx.decisions.length > 0) {
      children.push(docxParagraph("Revision Changelog", { heading: "HEADING_2", color: RG.ink }));
      children.push(buildDecisionTable(ctx.decisions));
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
}

export async function buildFinalReviewExport(input: FinalReviewRuntimeInput & { format: FinalReviewExportFormat; file?: FinalReviewExportFile }) {
  const ctx = await loadRuntimeContext(input);
  const applied = applyTextSnapshots(ctx);
  const format = input.format;
  const file = input.file ?? "txt";
  const { text, suffix } = exportText(ctx, format, applied);

  let content: string | Buffer = text;
  let contentType = "text/plain; charset=utf-8";
  let ext: FinalReviewExportFile = "txt";

  if (file === "pdf") {
    content = await buildPdf(ctx, format, text);
    contentType = "application/pdf";
    ext = "pdf";
  } else if (file === "docx") {
    content = await buildDocx(ctx, format, text);
    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    ext = "docx";
  }

  await recordRun(ctx, {
    status: "exported",
    mode: format === "clean" ? "export_clean" : format === "marked" ? "export_marked" : "export_changelog",
    appliedDecisionIds: applied.applied.map((d) => d.id),
    skippedDecisionIds: ctx.decisions.filter((d) => !APPLICABLE.has(d.decision)).map((d) => d.id),
    exportFormat: ext,
    metadata: { export_kind: format, blocked: applied.blocked },
  });

  return {
    content,
    filename: safeFilename(ctx.manuscriptTitle, suffix, ext),
    contentType,
  };
}
