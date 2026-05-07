/**
 * PR 1 — Read-only diagnostic: Pass 3 anchor-packaging analysis
 *
 * Usage:
 *   tsx scripts/diagnose-pass3-anchoring.ts <job-id> [job-id2] ...
 *
 * Writes one JSON artifact per job to:
 *   artifacts/diagnostics/pass3-prosecontrol-{job_id}.json
 *
 * Read-only with respect to the database — never writes production state.
 *
 * Failure code under diagnosis: v2_fidelity_score_confidence_alignment
 * Forbidden behavior: PASS3_EMITTED_HIGH_SCORE_WITH_LOW_CONFIDENCE
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_JOB_IDS = [
  "15a655ae-6658-4e1e-b39b-b10542cd5f87",
  "bae4c87b-87f9-4000-ab86-d20124ce251c",
];

const DIAGNOSTIC_DIR = path.resolve("artifacts/diagnostics");
const MEANINGFUL_ANCHOR_MIN_CHARS = 20;
const HIGH_SCORE_THRESHOLD = 5;

type EvidenceItem = {
  snippet?: string;
  type?: string;
  verbatim?: boolean;
  source?: string;
  char_start?: number;
  char_end?: number;
  location?: { char_start?: number; char_end?: number };
  [key: string]: unknown;
};

type CriterionRow = {
  key?: string;
  score_0_10?: number;
  final_score_0_10?: number;
  confidence_level?: string;
  confidence_band?: string;
  confidence_score_0_100?: number;
  confidence_reasons?: string[];
  scorability_status?: string;
  rationale?: string;
  final_rationale?: string;
  evidence?: EvidenceItem[];
  [key: string]: unknown;
};

type JobRow = {
  id: string;
  status?: string;
  progress?: Record<string, unknown>;
  [key: string]: unknown;
};

type AnchorDiagnostic = {
  index: number;
  length: number;
  meets_min_length: boolean;
  quote_style: "straight" | "curly" | "mixed" | "none";
  likely_verbatim: boolean;
  has_offsets: boolean;
  preview: string;
};

type CriterionDiagnostic = {
  key: string;
  score_0_10: number | null;
  confidence_level: string;
  confidence_score_0_100: number | null;
  confidence_reasons: string[];
  scorability_status: string;
  anchor_count: number;
  anchors_meeting_min_length: number;
  likely_verbatim_anchors: number;
  rationale_quote_style: "straight" | "curly" | "mixed" | "none";
  has_textual_anchor_signal: boolean;
  contradiction_detected: boolean;
  forbidden_behavior?: "PASS3_EMITTED_HIGH_SCORE_WITH_LOW_CONFIDENCE";
  anchors: AnchorDiagnostic[];
};

type JobDiagnostic = {
  generated_at: string;
  diagnostic_version: "pass3-anchoring-v1";
  job_id: string;
  status: string;
  quality_gate_alignment_check?: {
    passed: boolean;
    details?: string;
  };
  total_criteria: number;
  contradictions_count: number;
  contradictions: string[];
  criteria: CriterionDiagnostic[];
  error?: string;
};

function detectQuoteStyle(text: string): "straight" | "curly" | "mixed" | "none" {
  const hasStraight = /\"[^\"]{1,}\"/.test(text);
  const hasCurly = /[\u201C][^\u201C\u201D]{1,}[\u201D]/.test(text);
  if (hasStraight && hasCurly) return "mixed";
  if (hasStraight) return "straight";
  if (hasCurly) return "curly";
  return "none";
}

function classifyAnchor(snippet: string, index: number, anchor: EvidenceItem): AnchorDiagnostic {
  const trimmed = snippet.trim();
  const quoteStyle = detectQuoteStyle(trimmed);
  const likelyVerbatim =
    quoteStyle !== "none" ||
    !/\b(paraphrase|summarize|general|usually|often|tends to|typically)\b/i.test(trimmed);
  const charStart = anchor.char_start ?? anchor.location?.char_start;
  const charEnd = anchor.char_end ?? anchor.location?.char_end;
  return {
    index,
    length: trimmed.length,
    meets_min_length: trimmed.length >= MEANINGFUL_ANCHOR_MIN_CHARS,
    quote_style: quoteStyle,
    likely_verbatim: likelyVerbatim,
    has_offsets: Number.isInteger(charStart) && Number.isInteger(charEnd),
    preview: trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed,
  };
}

function hasTextualAnchorSignal(criterion: CriterionRow): boolean {
  const rationale = criterion.rationale ?? criterion.final_rationale ?? "";
  if (/[\u201C\u0022][^\u201C\u201D\u0022]{8,}[\u201D\u0022]/.test(rationale)) {
    return true;
  }
  return (criterion.evidence ?? []).some((anchor) => {
    const snippet = (anchor.snippet ?? "").trim();
    if (/[\u201C\u0022][^\u201C\u201D\u0022]{8,}[\u201D\u0022]/.test(snippet)) {
      return true;
    }
    return snippet.length >= MEANINGFUL_ANCHOR_MIN_CHARS;
  });
}

function analyzeCriterion(c: CriterionRow): CriterionDiagnostic {
  const key = c.key ?? "(unknown)";
  const score = c.final_score_0_10 ?? c.score_0_10 ?? null;
  const confidenceLevel = c.confidence_level ?? "(missing)";
  const confidenceScore = c.confidence_score_0_100 ?? null;
  const confidenceReasons = c.confidence_reasons ?? [];
  const scorabilityStatus = c.scorability_status ?? "(missing)";
  const evidence = c.evidence ?? [];
  const rationale = c.rationale ?? c.final_rationale ?? "";

  const anchors = evidence.map((e, i) => classifyAnchor(e.snippet ?? "", i, e));
  const contradictionDetected =
    score !== null && score > HIGH_SCORE_THRESHOLD && confidenceLevel === "low";

  return {
    key,
    score_0_10: score,
    confidence_level: confidenceLevel,
    confidence_score_0_100: confidenceScore,
    confidence_reasons: confidenceReasons,
    scorability_status: scorabilityStatus,
    anchor_count: anchors.length,
    anchors_meeting_min_length: anchors.filter((a) => a.meets_min_length).length,
    likely_verbatim_anchors: anchors.filter((a) => a.likely_verbatim && a.meets_min_length).length,
    rationale_quote_style: detectQuoteStyle(rationale),
    has_textual_anchor_signal: hasTextualAnchorSignal(c),
    contradiction_detected: contradictionDetected,
    ...(contradictionDetected
      ? { forbidden_behavior: "PASS3_EMITTED_HIGH_SCORE_WITH_LOW_CONFIDENCE" as const }
      : {}),
    anchors,
  };
}

function diagnosticPath(jobId: string): string {
  return path.join(DIAGNOSTIC_DIR, `pass3-prosecontrol-${jobId}.json`);
}

async function diagnoseJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
): Promise<JobDiagnostic> {
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, status, progress")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    return {
      generated_at: new Date().toISOString(),
      diagnostic_version: "pass3-anchoring-v1",
      job_id: jobId,
      status: "(missing)",
      total_criteria: 0,
      contradictions_count: 0,
      contradictions: [],
      criteria: [],
      error: error?.message ?? `No evaluation_jobs row found for ${jobId}`,
    };
  }

  const row = data as JobRow;
  const progress = (row.progress ?? {}) as Record<string, unknown>;

  const pass3 =
    (progress.pass3_result as { criteria?: CriterionRow[] } | undefined) ??
    (progress.convergence_result as { criteria?: CriterionRow[] } | undefined) ??
    (progress.convergence as { criteria?: CriterionRow[] } | undefined);

  const criteria: CriterionRow[] = pass3?.criteria ?? [];
  const criterionDiagnostics = criteria.map(analyzeCriterion);
  const contradictions = criterionDiagnostics
    .filter((c) => c.contradiction_detected)
    .map((c) => c.key);

  const envelope = (progress.pipeline_failure_envelope ?? {}) as Record<string, unknown>;
  const errorMessage =
    typeof envelope.error_message === "string" ? envelope.error_message : "";

  const parsedAlignment = errorMessage.match(
    /v2_fidelity_score_confidence_alignment:.*?:\s*([A-Za-z0-9_]+):(\d+)/,
  );

  const envelopeContradiction = parsedAlignment
    ? {
        key: parsedAlignment[1],
        score_0_10: Number(parsedAlignment[2]),
        confidence_level: "low",
        forbidden_behavior: "PASS3_EMITTED_HIGH_SCORE_WITH_LOW_CONFIDENCE",
        source: "progress.pipeline_failure_envelope.error_message",
      }
    : null;

  const effectiveContradictions =
    contradictions.length > 0
      ? contradictions
      : envelopeContradiction
        ? [envelopeContradiction.key]
        : [];

  return {
    generated_at: new Date().toISOString(),
    diagnostic_version: "pass3-anchoring-v1",
    job_id: jobId,
    status: row.status ?? "(missing)",
    progress_keys: Object.keys(progress),
    pipeline_failure_envelope: {
      error_code: envelope.error_code ?? null,
      reason_codes: envelope.reason_codes ?? [],
      error_message: errorMessage || null,
      failure_origin: envelope.failure_origin ?? null,
      pipeline_stage: envelope.pipeline_stage ?? null,
    },
    pass3_output_persisted: criteria.length > 0,
    note:
      criteria.length > 0
        ? "pass3_output_found"
        : "pass3_output_not_persisted_on_qg_failure; diagnostic falls back to failure envelope",
    envelope_contradiction: envelopeContradiction,
    total_criteria: criterionDiagnostics.length,
    contradictions_count: effectiveContradictions.length,
    contradictions: effectiveContradictions,
    criteria: criterionDiagnostics,
  };
}

function printSummary(diagnostic: JobDiagnostic, outputPath: string): void {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`JOB: ${diagnostic.job_id}`);
  console.log("=".repeat(70));
  console.log(`status: ${diagnostic.status}`);
  if (diagnostic.error) {
    console.log(`error: ${diagnostic.error}`);
  }
  if (diagnostic.quality_gate_alignment_check) {
    console.log(
      `v2_fidelity_score_confidence_alignment passed: ${diagnostic.quality_gate_alignment_check.passed}`,
    );
    console.log(`details: ${diagnostic.quality_gate_alignment_check.details ?? "(none)"}`);
  }
  console.log(`total criteria: ${diagnostic.total_criteria}`);
  console.log(`contradictions: ${diagnostic.contradictions_count}`);
  if (diagnostic.contradictions.length > 0) {
    console.log(`contradicting criteria: ${diagnostic.contradictions.join(", ")}`);
  }
  console.log(`artifact: ${outputPath}`);
}

async function main(): Promise<void> {
  const jobIds = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_JOB_IDS;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  fs.mkdirSync(DIAGNOSTIC_DIR, { recursive: true });
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Pass 3 Anchor-Packaging Diagnostic");
  console.log("Read-only — no database writes");
  console.log(`Analysing ${jobIds.length} job(s): ${jobIds.join(", ")}`);

  for (const id of jobIds) {
    const diagnostic = await diagnoseJob(supabase, id);
    const outPath = diagnosticPath(id);
    fs.writeFileSync(outPath, `${JSON.stringify(diagnostic, null, 2)}\n`, "utf-8");
    printSummary(diagnostic, outPath);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
