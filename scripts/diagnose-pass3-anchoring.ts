/**
 * PR 1 — Read-only diagnostic: Pass 3 anchor-packaging analysis
 *
 * Usage:
 *   tsx scripts/diagnose-pass3-anchoring.ts <job-id> [job-id2] ...
 *
 * Dumps per-criterion: score, confidence components, anchor count/lengths,
 * verbatim/paraphrase classification, and quote style.
 * Read-only — never writes to the database.
 *
 * Failure code under diagnosis: v2_fidelity_score_confidence_alignment
 * Forbidden behavior: PASS3_EMITTED_HIGH_SCORE_WITH_LOW_CONFIDENCE
 */

import { createClient } from "@supabase/supabase-js";

const DEFAULT_JOB_IDS = [
  "15a655ae-6658-4e1e-b39b-b10542cd5f87",
  "bae4c87b-87f9-4000-ab86-d20124ce251c",
];

const MEANINGFUL_ANCHOR_MIN_CHARS = 20;
const HIGH_SCORE_THRESHOLD = 5;

type EvidenceItem = {
  snippet?: string;
  type?: string;
  verbatim?: boolean;
  source?: string;
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
  pass3_result?: { criteria?: CriterionRow[]; [key: string]: unknown } | null;
  convergence_result?: { criteria?: CriterionRow[]; [key: string]: unknown } | null;
  quality_gate_result?: { checks?: { check_id: string; passed: boolean; details?: string }[] } | null;
  [key: string]: unknown;
};

function detectQuoteStyle(text: string): "straight" | "curly" | "mixed" | "none" {
  const hasStraight = /\"[^\"]{1,}\"/.test(text);
  const hasCurly = /[\u201C][^\u201C\u201D]{1,}[\u201D]/.test(text);
  if (hasStraight && hasCurly) return "mixed";
  if (hasStraight) return "straight";
  if (hasCurly) return "curly";
  return "none";
}

function classifyAnchor(snippet: string): {
  length: number;
  meetsMinLength: boolean;
  quoteStyle: "straight" | "curly" | "mixed" | "none";
  likelyVerbatim: boolean;
} {
  const trimmed = snippet.trim();
  const quoteStyle = detectQuoteStyle(trimmed);
  const likelyVerbatim =
    quoteStyle !== "none" ||
    // Heuristic: no hedge words, concrete phrasing
    !/\b(paraphrase|summarize|general|usually|often|tends to|typically)\b/i.test(trimmed);
  return {
    length: trimmed.length,
    meetsMinLength: trimmed.length >= MEANINGFUL_ANCHOR_MIN_CHARS,
    quoteStyle,
    likelyVerbatim,
  };
}

function hasTextualAnchorSignal(criterion: CriterionRow): boolean {
  const rationale = criterion.rationale ?? criterion.final_rationale ?? "";
  // Check rationale for quoted snippet (straight or curly)
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

function analyzeCriterion(c: CriterionRow): void {
  const key = c.key ?? "(unknown)";
  const score = c.final_score_0_10 ?? c.score_0_10 ?? null;
  const confidenceLevel = c.confidence_level ?? "(missing)";
  const confidenceScore = c.confidence_score_0_100 ?? null;
  const confidenceReasons = c.confidence_reasons ?? [];
  const scorabilityStatus = c.scorability_status ?? "(missing)";
  const evidence = c.evidence ?? [];
  const rationale = c.rationale ?? c.final_rationale ?? "";

  const isContradiction =
    score !== null &&
    score > HIGH_SCORE_THRESHOLD &&
    confidenceLevel === "low";

  const anchors = evidence.map((e) => classifyAnchor(e.snippet ?? ""));
  const anchorCount = anchors.length;
  const qualifyingAnchors = anchors.filter((a) => a.meetsMinLength).length;
  const verbatimAnchors = anchors.filter((a) => a.likelyVerbatim && a.meetsMinLength).length;
  const rationaleQuoteStyle = detectQuoteStyle(rationale);
  const hasAnchorSignal = hasTextualAnchorSignal(c);

  console.log(`\n  ── ${key} ──`);
  console.log(`     score:              ${score ?? "null"}`);
  console.log(`     confidence_level:   ${confidenceLevel}`);
  console.log(`     confidence_score:   ${confidenceScore ?? "null"}`);
  console.log(`     scorability_status: ${scorabilityStatus}`);
  console.log(`     confidence_reasons: [${confidenceReasons.join(", ")}]`);
  console.log(`     anchor_count:       ${anchorCount}`);
  console.log(`     anchors_≥20chars:   ${qualifyingAnchors}`);
  console.log(`     likely_verbatim:    ${verbatimAnchors}`);
  console.log(`     rationale_quotes:   ${rationaleQuoteStyle}`);
  console.log(`     hasTextualAnchor:   ${hasAnchorSignal}`);

  if (isContradiction) {
    console.log(`     ⚠️  CONTRADICTION DETECTED: score=${score} but confidence=low`);
    console.log(`        Forbidden behavior: PASS3_EMITTED_HIGH_SCORE_WITH_LOW_CONFIDENCE`);

    // Detailed anchor breakdown
    if (anchorCount > 0) {
      console.log(`     Anchor details:`);
      evidence.forEach((e, i) => {
        const cls = anchors[i];
        const snippet = (e.snippet ?? "").trim();
        const preview = snippet.length > 60 ? snippet.slice(0, 60) + "…" : snippet;
        console.log(
          `       [${i}] len=${cls.length} quotes=${cls.quoteStyle} verbatim=${cls.likelyVerbatim} | "${preview}"`,
        );
      });
    } else {
      console.log(`     Anchor details: NO EVIDENCE ITEMS`);
    }
  }
}

async function diagnoseJob(supabase: ReturnType<typeof createClient>, jobId: string): Promise<void> {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`JOB: ${jobId}`);
  console.log("=".repeat(70));

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, status, pass3_result, convergence_result, quality_gate_result")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === "PGRST116") {
      console.error(`  ERROR: No evaluation_jobs row found for ${jobId}`);
    } else {
      console.error(`  ERROR: ${error?.message ?? "unknown error"}`);
    }
    return;
  }

  const row = data as JobRow;
  console.log(`  status: ${row.status ?? "(missing)"}`);

  // Find pass3/convergence result
  const pass3 = row.pass3_result ?? row.convergence_result;
  if (!pass3) {
    console.log("  pass3_result / convergence_result: (null — job may not have reached Pass 3)");
    return;
  }

  const criteria: CriterionRow[] = pass3.criteria ?? [];
  if (criteria.length === 0) {
    console.log("  criteria: (empty array)");
    return;
  }

  // Quality gate check summary
  const qgChecks = row.quality_gate_result?.checks ?? [];
  const alignmentCheck = qgChecks.find((c) => c.check_id === "v2_fidelity_score_confidence_alignment");
  if (alignmentCheck) {
    console.log(`\n  QG v2_fidelity_score_confidence_alignment:`);
    console.log(`    passed: ${alignmentCheck.passed}`);
    console.log(`    details: ${alignmentCheck.details ?? "(none)"}`);
  }

  // Summary counts
  const contradictions = criteria.filter(
    (c) => (c.final_score_0_10 ?? c.score_0_10 ?? 0) > HIGH_SCORE_THRESHOLD && c.confidence_level === "low",
  );

  console.log(`\n  Total criteria:        ${criteria.length}`);
  console.log(`  Contradictions (score>${HIGH_SCORE_THRESHOLD} + low confidence): ${contradictions.length}`);

  console.log("\n  Per-criterion breakdown:");
  for (const c of criteria) {
    analyzeCriterion(c);
  }
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

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Pass 3 Anchor-Packaging Diagnostic");
  console.log("Read-only — no database writes");
  console.log(`Analysing ${jobIds.length} job(s): ${jobIds.join(", ")}`);

  for (const id of jobIds) {
    await diagnoseJob(supabase, id);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
