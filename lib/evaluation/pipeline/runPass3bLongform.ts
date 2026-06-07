// canon-audit-allow: vocabulary-detection
// Reason: 'commercial' below is a DREAM subscore dimension (commercial literary fiction
// is a publishing genre/shelf category), not a criterion alias for the canonical
// 'marketability' criterion. The two are distinct concepts in different namespaces.
// See docs/benchmarks/froggin-noggin-dream.md §dream_scores for DREAM subscore authority.
/**
 * Pass 3b — Long-Form DREAM Document Synthesis Runner
 *
 * Fires ONLY when route === "LONG_FORM" (≥ 25,000 words / inputScale === "full_manuscript").
 * Reads Pass 3 synthesized criteria and produces the full 16-section DREAM document.
 *
 * Authority chain:
 *   docs/governance/evaluation-output-mode-contract.md
 *   docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
 *   docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
 *   docs/benchmarks/froggin-noggin-dream.md
 *   docs/benchmarks/cartel-babies-dream.md
 *
 * Temperature: 0.3   Default max tokens: 12000 (override via EVAL_PASS3B_MAX_TOKENS)
 *
 * This pass is ADDITIVE. It does not re-score criteria and does not affect the
 * quality gate. Its output is stored as artifact type "longform_document_v1".
 */

import OpenAI from "openai";
import {
  PASS3B_SYSTEM_PROMPT,
  PASS3B_PROMPT_VERSION,
  buildPass3bUserPrompt,
} from "./prompts/pass3b-longform";
import { sanitizeCMOSDeep } from "../cmosSanitizer";
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPass3Model,
  OPENAI_SDK_MAX_RETRIES,
} from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { trackCompletionCost } from "@/lib/jobs/cost";
import { JsonBoundaryError, parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import type {
  SynthesizedCriterion,
  ManuscriptChunkEvidence,
  Pass2aStructuredContext,
} from "./types";
import type { SubmissionScopeProfile } from "./submissionScope";
import { CRITERIA_METADATA } from "@/schemas/criteria-keys";
import type { GenreExpectationMetadata } from "@/lib/evaluation/genreExpectationProfiles";

// ── Constants ─────────────────────────────────────────────────────────────────

const PASS3B_TEMPERATURE = 0.3;

type DreamConfidence = "High" | "Moderate-High" | "Moderate" | "Low";

// Default raised from 6000 → 16000 for the 16-section Narrative Synthesis document.
// The output spans 16 mandatory sections (executive verdict, dream_scores, market_shelf,
// structural_stack, arc_map, criterion_analyses for 13 criteria, layer_analyses,
// cross_layer_integration, symbolic_audit, reader_experience, revision_plan, releasability,
// acceptance_checks, calibration_notes, repo_summary, manuscript_integrity_issues).
// At 6000 tokens GPT-5 was truncating mid-document → response_format=json_object returned
// malformed JSON → validateDreamDocument threw with "missing required sections".
// 16000 is generous by design — dial back via EVAL_PASS3B_MAX_TOKENS once reports confirm
// full document completion. Floor set to 12000 to prevent silently-too-low overrides.
function getPass3bMaxTokens(): number {
  const raw = process.env.EVAL_PASS3B_MAX_TOKENS;
  if (raw) {
    const parsed = parseInt(raw, 10);
    // Allow 12000–32000; gpt-5.1 supports up to 128k output tokens
    if (!isNaN(parsed) && parsed >= 12000 && parsed <= 32000) return parsed;
  }
  // Raised from 16000 → 24000: the 16-section DREAM document reliably exceeds 16k tokens
  // on full novels with gpt-5.1. 24000 gives headroom without excessive cost.
  return 24000;
}

const PASS3B_MAX_TOKENS_CEILING = 32000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LongformDreamDocument {
  /** §1 — Executive verdict prose */
  executive_verdict: string;
  /** §1 — DREAM subscores 0–100 */
  dream_scores: {
    quality: number;
    readiness: number;
    /** Publishing genre dimension: commercial literary fiction readiness (distinct from the 'marketability' criterion) */
    commercial: number;
    literary: number;
  };
  /** §2 — Market shelf analysis */
  market_shelf: {
    best_shelf: string;
    shelf_neighbors: string[];
    comparison_space: string[];
    marketable_hook: string;
    market_danger: string;
  };
  /** §3 — Named anti-patterns specific to this manuscript */
  what_not_to_become: string[];
  /** §4 — Structural layer stack */
  structural_stack: Array<{
    layer_name: string;
    function: string;
    status: "strong" | "moderate" | "weak" | "fragile";
    revision_note: string;
  }>;
  /** §5 — Act-level arc map */
  arc_map: Array<{
    act_name: string;
    chapter_range: string;
    primary_function: string;
    revision_priority: string;
  }>;
  /** §7 — Per-criterion expanded analysis (expands the score grid) */
  criterion_analyses: Array<{
    key: string;
    score: number;
    confidence: "High" | "Moderate-High" | "Moderate" | "Low";
    fit_evidence: string[];
    gap_evidence: string[];
    revision_queue: string[];
  }>;
  /** §8 — Layer-by-layer analysis */
  layer_analyses: Array<{
    layer_name: string;
    status: string;
    needed_revision: string;
  }>;
  /** §9 — Cross-layer motif integration */
  cross_layer_integration: Array<{
    motif: string;
    description: string;
    integration_quality: "strong" | "moderate" | "weak";
    revision_note: string;
  }>;
  /** §10 — Symbolic / doctrine / system audit */
  symbolic_audit: {
    preserved_symbols: Array<{
      symbol: string;
      current_function: string;
      revision_instruction: string;
    }>;
    doctrine_strengths: string[];
    doctrine_risks: string[];
    audit_conclusion: string;
  };
  /** §11 — Reader experience by act */
  reader_experience: {
    first_act: { reader_question: string; emotional_state: string; risk: string };
    middle: { reader_question: string; emotional_state: string; risk: string };
    final_act: { reader_question: string; emotional_state: string; risk: string };
    aftertaste: string;
  };
  /** §12 — Prioritized revision plan */
  revision_plan: Array<{
    priority: number;
    title: string;
    goal: string;
    actions: string[];
    acceptance_check: string;
  }>;
  /** §13 — Release dimension table */
  releasability: Array<{
    dimension: string;
    current_status: string;
    verdict: "Ready" | "Near-ready" | "Revise" | "Must fix";
  }>;
  /** §14 — Acceptance checks for benchmark validation */
  acceptance_checks: {
    required_detection: string[];
    failure_conditions: string[];
  };
  /** §15 — Evaluator calibration notes */
  calibration_notes: string[];
  /** §16 — Repo-ready summary block */
  repo_summary: {
    benchmark_name: string;
    source: string;
    evaluation_type: string;
    overall_score: number;
    readiness_score: number;
    primary_strengths: string[];
    primary_blockers: string[];
    gold_standard_requirement: string;
  };
  /** Pre-analysis integrity flags — duplicate chapters, TOC errors, etc. */
  manuscript_integrity_issues: Array<{
    kind: string;
    description: string;
    severity: "blocking" | "major" | "minor";
  }>;
  /** Provenance */
  prompt_version: string;
  generated_at: string;
  model: string;
  /** Server-stamped genre expectation contract consumed by Pass 3B. */
  genre_expectation_context?: GenreExpectationMetadata;
}

export interface RunPass3bOptions {
  /** Pass 3 synthesized criteria (scores, rationales, evidence) */
  criteria: SynthesizedCriterion[];
  pass2aStructuredContext: Pass2aStructuredContext;
  manuscriptChunks: ManuscriptChunkEvidence[];
  title: string;
  wordCount: number;
  chapterCount?: number;
  workType: string;
  mode?: string;
  scopeProfile?: SubmissionScopeProfile;
  model?: string;
  openaiApiKey?: string;
  openAiTimeoutMs?: number;
  /** Author corrections from accepted_story_ledger_v1.governance_rail — MANDATORY if present. */
  authorCorrectionsBlock?: string | null;
  /** Formatted chapter-to-chunk index string. Built from buildChapterIndex + formatChapterIndex. */
  chapterIndex?: string | null;
  /** Job ID for cost tracking */
  jobId?: string;
  /** Canon-backed genre expectation context from EvaluationResultV2 governance transparency. */
  genreExpectationContext?: GenreExpectationMetadata | null;
}

export type TruthfulFallbackReport = {
  autofilled_keys: string[];
  repaired_keys: string[];
};

export type RevisionPlanGuardrailReport = {
  removed_entries: string[];
  removed_actions_count: number;
};

const PASS3B_INTERNAL_DIAGNOSTIC_PATTERNS: RegExp[] = [
  /source[-\s]?integrity/i,
  /source[-\s]?integrity\s+semantics?/i,
  /relationship\s+network\s+representation/i,
  /repair\s+relationship\s+network/i,
  /threat\s*\/?\s*pressure/i,
  /threat\s*\/?\s*pressure\s*\/?\s*ending\s+taxonomy/i,
  /ending\s+taxonomy/i,
  /location\s*\/?\s*timeline/i,
  /normalize\s+location\s*\/?\s*timeline/i,
  /location\s+normalization|timeline\s+normalization/i,
  /object\s*\/?\s*symbol/i,
  /symbol\s*\/?\s*object\s+layer\s+weighting/i,
  /extraction\s+diagnostic/i,
  /degraded_extraction|hard_fail/i,
  /layer\s+contamination/i,
  /taxonomy\s+repair/i,
  /renderer\s+defect|export\s+defect/i,
  /schema\s+defect|ontology\s+repair|pipeline\s+fix/i,
  /no\s+qualifying\s+relationship\s+pairs/i,
];

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isInternalDiagnosticTextForPass3b(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return PASS3B_INTERNAL_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(text));
}

function filterAuthorFacingTextListForPass3b(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .filter((entry) => !isInternalDiagnosticTextForPass3b(entry));
}

/**
 * Deterministic post-generation guardrail:
 * - remove internal/system remediation entries from author-facing revision_plan
 * - filter internal diagnostic actions from surviving entries
 * - renumber priorities to contiguous 1..N
 * - append a calibration note when sanitization occurs
 */
export function sanitizeAuthorFacingRevisionPlanInPass3b(
  raw: Record<string, unknown>
): { patched: Record<string, unknown>; report: RevisionPlanGuardrailReport } {
  const report: RevisionPlanGuardrailReport = {
    removed_entries: [],
    removed_actions_count: 0,
  };

  const plan = Array.isArray(raw.revision_plan) ? raw.revision_plan : [];
  const kept: Array<Record<string, unknown>> = [];

  for (const entry of plan) {
    const obj = asObject(entry);
    if (!obj) continue;

    const title = asText(obj.title);
    const goal = asText(obj.goal);
    const acceptance = asText(obj.acceptance_check);
    const originalActions = Array.isArray(obj.actions) ? obj.actions : [];
    const filteredActions = filterAuthorFacingTextListForPass3b(originalActions);
    const originalActionCount = originalActions.filter((a) => typeof a === "string" && a.trim().length > 0).length;
    report.removed_actions_count += Math.max(0, originalActionCount - filteredActions.length);

    const combinedText = [title, goal, acceptance, ...filteredActions].join(" ").trim();
    if (!combinedText) {
      continue;
    }

    if (isInternalDiagnosticTextForPass3b(combinedText)) {
      report.removed_entries.push(title || goal || acceptance || "(untitled internal diagnostic item)");
      continue;
    }

    kept.push({
      ...obj,
      actions: filteredActions,
    });
  }

  const renumbered = kept.map((entry, idx) => ({
    ...entry,
    priority: idx + 1,
  }));

  let calibrationNotes = Array.isArray(raw.calibration_notes)
    ? raw.calibration_notes.filter((note): note is string => typeof note === "string" && note.trim().length > 0)
    : [];

  if (report.removed_entries.length > 0 || report.removed_actions_count > 0) {
    const movedEntries = report.removed_entries.length;
    const strippedActions = report.removed_actions_count;
    calibrationNotes = [
      ...calibrationNotes,
      `[Pass3b guardrail] Removed ${movedEntries} internal diagnostic revision_plan item(s) and stripped ${strippedActions} internal diagnostic action(s) from author-facing revision guidance.`,
    ];
  }

  return {
    patched: {
      ...raw,
      revision_plan: renumbered,
      calibration_notes: calibrationNotes,
    },
    report,
  };
}

function toDreamConfidence(value?: SynthesizedCriterion["confidence_level"]): DreamConfidence {
  if (value === "high") return "High";
  if (value === "low") return "Low";
  return "Moderate";
}

function ensureStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    if (normalized.length > 0) return normalized;
  }
  return fallback;
}

function buildCriterionFallbackEntry(criterion: SynthesizedCriterion): Record<string, unknown> {
  const rationale = criterion.final_rationale?.trim() || `${criterion.key} requires focused revision.`;
  const fitEvidence = (criterion.evidence ?? [])
    .map((entry) => (entry?.snippet ?? "").trim())
    .filter(Boolean)
    .slice(0, 2);
  const revisionQueue = (criterion.recommendations ?? [])
    .map((rec) => rec.action?.trim())
    .filter(Boolean)
    .slice(0, 3);

  return {
    key: criterion.key,
    score: criterion.final_score_0_10,
    confidence: toDreamConfidence(criterion.confidence_level),
    fit_evidence:
      fitEvidence.length > 0
        ? fitEvidence
        : [`Pass 3 rationale: ${rationale.slice(0, 180)}`],
    gap_evidence: [
      `Pass 3b omitted explicit gap evidence for ${criterion.key}; fallback preserved Pass 3 rationale.`
    ],
    revision_queue:
      revisionQueue.length > 0
        ? revisionQueue
        : [`Refine ${criterion.key} with manuscript-grounded revisions from Pass 3 recommendations.`],
  };
}

/**
 * Deterministic truthful fallback for Pass 3b criterion analyses.
 *
 * Guarantees all Pass 3 criteria are present in §7 and preserves ledger truth:
 * - missing criteria are auto-filled from Pass 3 synthesis
 * - malformed entries are repaired in place
 * - score is always aligned to Pass 3 final_score_0_10
 */
export function applyTruthfulLongformCriteriaFallback(
  raw: Record<string, unknown>,
  criteria: SynthesizedCriterion[]
): { patched: Record<string, unknown>; report: TruthfulFallbackReport } {
  const report: TruthfulFallbackReport = {
    autofilled_keys: [],
    repaired_keys: [],
  };

  const entries = Array.isArray(raw.criterion_analyses) ? raw.criterion_analyses : [];
  const byKey = new Map<string, Record<string, unknown>>();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const key = String((entry as Record<string, unknown>).key ?? "").trim();
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, entry as Record<string, unknown>);
  }

  const normalized = criteria.map((criterion) => {
    const key = criterion.key;
    const existing = byKey.get(key);

    if (!existing) {
      report.autofilled_keys.push(key);
      return buildCriterionFallbackEntry(criterion);
    }

    const fallbackEntry = buildCriterionFallbackEntry(criterion);

    const fit_evidence = ensureStringArray(existing.fit_evidence, fallbackEntry.fit_evidence as string[]);
    const gap_evidence = ensureStringArray(existing.gap_evidence, fallbackEntry.gap_evidence as string[]);
    const revision_queue = ensureStringArray(existing.revision_queue, fallbackEntry.revision_queue as string[]);

    const confidenceValue = String(existing.confidence ?? "").trim();
    const confidence: DreamConfidence =
      confidenceValue === "High" ||
      confidenceValue === "Moderate-High" ||
      confidenceValue === "Moderate" ||
      confidenceValue === "Low"
        ? (confidenceValue as DreamConfidence)
        : toDreamConfidence(criterion.confidence_level);

    const repaired =
      confidence !== existing.confidence ||
      fit_evidence !== existing.fit_evidence ||
      gap_evidence !== existing.gap_evidence ||
      revision_queue !== existing.revision_queue ||
      existing.score !== criterion.final_score_0_10;

    if (repaired) {
      report.repaired_keys.push(key);
    }

    return {
      ...existing,
      key,
      score: criterion.final_score_0_10,
      confidence,
      fit_evidence,
      gap_evidence,
      revision_queue,
    };
  });

  return {
    patched: {
      ...raw,
      criterion_analyses: normalized,
    },
    report,
  };
}

// ── OpenAI completion factory ─────────────────────────────────────────────────

function defaultCreateCompletion(apiKey?: string, timeoutMs?: number) {
  const key = apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const timeout = timeoutMs ?? getEvalOpenAiTimeoutMs();
  const openai = new OpenAI({ apiKey: key, maxRetries: OPENAI_SDK_MAX_RETRIES, timeout });
  return openai.chat.completions.create.bind(openai.chat.completions);
}

// ── Validation helpers ────────────────────────────────────────────────────────

const REQUIRED_TOP_LEVEL_KEYS: Array<keyof LongformDreamDocument> = [
  "executive_verdict",
  "dream_scores",
  "market_shelf",
  "what_not_to_become",
  "structural_stack",
  "arc_map",
  "criterion_analyses",
  "layer_analyses",
  "cross_layer_integration",
  "symbolic_audit",
  "reader_experience",
  "revision_plan",
  "releasability",
  "acceptance_checks",
  "calibration_notes",
  "repo_summary",
  "manuscript_integrity_issues",
];

function validateDreamDocument(raw: Record<string, unknown>): LongformDreamDocument {
  const missing = REQUIRED_TOP_LEVEL_KEYS.filter((k) => !(k in raw));
  if (missing.length > 0) {
    throw new Error(
      `[Pass3b] DREAM document missing required sections: ${missing.join(", ")}`
    );
  }

  // Validate criterion_analyses count matches input criteria count
  const analyses = raw.criterion_analyses as unknown[];
  if (!Array.isArray(analyses) || analyses.length < 13) {
    throw new Error(
      `[Pass3b] criterion_analyses must have at least 13 entries, got ${Array.isArray(analyses) ? analyses.length : "non-array"}`
    );
  }

  // Validate revision_plan has entries
  const plan = raw.revision_plan as unknown[];
  if (!Array.isArray(plan) || plan.length < 3) {
    throw new Error(
      `[Pass3b] revision_plan must have at least 3 priorities, got ${Array.isArray(plan) ? plan.length : "non-array"}`
    );
  }

  // Validate dream_scores are numbers 0–100
  const scores = raw.dream_scores as Record<string, unknown>;
  for (const key of ["quality", "readiness", "commercial", "literary"]) {
    const v = scores?.[key];
    if (typeof v !== "number" || v < 0 || v > 100) {
      throw new Error(`[Pass3b] dream_scores.${key} must be a number 0–100, got ${v}`);
    }
  }

  return raw as unknown as LongformDreamDocument;
}

/**
 * Post-processing: detect 10/10 scores with gap_evidence and inject calibration notes.
 * This ensures the report's credibility is never undermined by a perfect score
 * sitting alongside documented weaknesses.
 */
function applyScoreCalibrationNotes(doc: LongformDreamDocument): string[] {
  const notes: string[] = [];
  for (const ca of doc.criterion_analyses) {
    if (ca.score === 10 && Array.isArray(ca.gap_evidence) && ca.gap_evidence.length > 0) {
      const label = CRITERIA_METADATA[ca.key as keyof typeof CRITERIA_METADATA]?.label ?? ca.key;
      notes.push(
        `Score calibration tension: ${label} (${ca.key}) scored 10/10 but has ${ca.gap_evidence.length} gap_evidence entries. A 10/10 implies near-perfection; the identified gaps suggest 9 or 9.5 may be more credible.`
      );
    }
  }
  return notes;
}

// ── Chunked criterion analysis ────────────────────────────────────────────────

/**
 * When EVAL_PASS3B_CHUNKED=true, generate criterion_analyses in parallel batches
 * then synthesize remaining sections. Reduces latency from ~60-90s to ~30-40s.
 */
const CRITERION_BATCH_SIZE = 5;

function isChunkedEnabled(): boolean {
  return process.env.EVAL_PASS3B_CHUNKED === 'true';
}

function formatGenreExpectationContractForPass3b(context?: GenreExpectationMetadata | null): string {
  if (!context) return "";
  return `GENRE EXPECTATION CONTRACT (canon-backed; do not override with generic commercial assumptions)
- Diagnosed genre: ${context.diagnosed_genre}
- Shelf/target audience: ${context.shelf_target_audience}
- Dominant craft engine: ${context.dominant_craft_engine}
- Expectation profiles: ${context.expectation_profiles.join(", ")}
- Genre expectation labels: ${context.genre_expectation_labels.join(", ")}
- Genre expectation IDs: ${context.genre_expectation_ids.join(", ")}
Apply these requirements when interpreting pacing, dialogue density, atmosphere, reflection, worldbuilding, and recommendation risk. If a genre-protected behavior appears functional, protect it; critique it only when manuscript evidence shows malfunction.
`;
}

function buildCriterionBatchPrompt(params: {
  title: string;
  wordCount: number;
  workType: string;
  criteria: SynthesizedCriterion[];
  chunkSample: ManuscriptChunkEvidence[];
  chapterIndex?: string | null;
  genreExpectationContext?: GenreExpectationMetadata | null;
}): string {
  const scoreSummary = params.criteria.map((c) => {
    const label = CRITERIA_METADATA[c.key as keyof typeof CRITERIA_METADATA]?.label ?? c.key;
    return `${label} (${c.key}): ${c.final_score_0_10}/10 — ${c.final_rationale?.slice(0, 120) ?? ""}`;
  }).join("\n");

  const criteriaCompact = JSON.stringify(
    params.criteria.map((c) => ({
      key: c.key,
      score: c.final_score_0_10,
      confidence_level: c.confidence_level ?? "moderate",
      rationale: c.final_rationale,
      evidence: (c.evidence ?? []).slice(0, 4).map((e) => e.snippet),
      top_recommendations: (c.recommendations ?? []).slice(0, 3).map((r) => ({
        priority: r.priority,
        action: r.action,
      })),
    }))
  );

  const sorted = [...params.chunkSample].sort((a, b) => a.chunk_index - b.chunk_index);
  const total = sorted.length;
  const pickAt = (fraction: number) =>
    sorted[Math.min(Math.floor(total * fraction), total - 1)];
  const fractions = [0, 0.25, 0.5, 0.75, 1.0];
  const labels = ["OPENING", "EARLY", "MIDDLE", "LATE", "CLOSE"];
  const chunkWindows = fractions.map((f, i) => ({
    label: labels[i],
    content: pickAt(f)?.content?.slice(0, 1500) ?? "",
  }));

  const criterionKeys = params.criteria.map(c => c.key).join(", ");

  const chapterIndexBlock = params.chapterIndex
    ? `\nCHAPTER INDEX (use these real chapter numbers for location references):\n${params.chapterIndex}\n`
    : "";
  const genreContractBlock = formatGenreExpectationContractForPass3b(params.genreExpectationContext);

  return `Generate criterion_analyses for the following criteria ONLY: ${criterionKeys}

MANUSCRIPT: "${params.title}" (${params.wordCount.toLocaleString()} words, ${params.workType})
${chapterIndexBlock}
${genreContractBlock}
PASS 3 SCORES (do not re-score — expand with evidence):
${scoreSummary}

CRITERIA DATA:
${criteriaCompact}

MANUSCRIPT SAMPLES:
${chunkWindows.map(w => `[${w.label}]\n${w.content}`).join("\n\n")}

Return a JSON object: { "criterion_analyses": [...] }
Each entry: { "key": CriterionKey, "score": number (match Pass 3), "confidence": "High"|"Moderate-High"|"Moderate"|"Low", "fit_evidence": string[] (2-4), "gap_evidence": string[] (2-4), "revision_queue": string[] (2-4) }

EVIDENCE RULE: Every fit_evidence and gap_evidence entry MUST open with a verbatim manuscript quote in quotation marks, followed by an em dash and the interpretive observation. No conclusions without quotes.
REVISION QUEUE RULE: Each revision_queue entry must follow: "[LOCATION: Chapter X] [OPERATION: add|cut|replace|merge|compress] — [instruction]. Acceptance: [condition]."
SCORE RULE: If you identify gap_evidence for a 10/10 criterion, note the tension but do not change the score.
Evidence must be grounded in the manuscript samples. Use character names, not "the protagonist".
Return ONLY valid JSON.`;
}

function buildSynthesisPrompt(params: {
  title: string;
  wordCount: number;
  chapterCount?: number;
  workType: string;
  mode?: string;
  criterionAnalyses: unknown[];
  pass2aStructuredContext: Pass2aStructuredContext;
  chunkSample: ManuscriptChunkEvidence[];
  scopeProfile?: SubmissionScopeProfile;
  authorCorrectionsBlock?: string | null;
  criteria: SynthesizedCriterion[];
  chapterIndex?: string | null;
  genreExpectationContext?: GenreExpectationMetadata | null;
}): string {
  const scoreSummary = params.criteria.map((c) => {
    const label = CRITERIA_METADATA[c.key as keyof typeof CRITERIA_METADATA]?.label ?? c.key;
    return `${label} (${c.key}): ${c.final_score_0_10}/10`;
  }).join("\n");

  const sorted = [...params.chunkSample].sort((a, b) => a.chunk_index - b.chunk_index);
  const total = sorted.length;
  const pickAt = (fraction: number) =>
    sorted[Math.min(Math.floor(total * fraction), total - 1)];
  const SAMPLE_FRACTIONS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const SAMPLE_LABELS = ["OPENING (0%)", "EARLY-1 (10%)", "EARLY-2 (20%)", "MID-EARLY (30%)", "MID-1 (40%)", "MID-2 (50%)", "MID-LATE (60%)", "LATE-1 (70%)", "LATE-2 (80%)", "LATE-3 (90%)", "CLOSE (100%)"];
  const chunkWindows = SAMPLE_FRACTIONS.map((f, i) => ({
    label: SAMPLE_LABELS[i],
    content: pickAt(f)?.content?.slice(0, 2000) ?? "",
  }));

  const structuredCtx = JSON.stringify({
    character_ledger: params.pass2aStructuredContext.character_ledger.slice(0, 30),
    scene_index: params.pass2aStructuredContext.scene_index.slice(0, 20),
    timeline_anchors: params.pass2aStructuredContext.timeline_anchors.slice(0, 24),
  });

  const chapterInfo = params.chapterCount ? `${params.chapterCount} chapters` : "chapter count not provided";
  const correctionsSection = params.authorCorrectionsBlock
    ? `\n${params.authorCorrectionsBlock}\n\n`
    : "";
  const chapterIndexSection = params.chapterIndex
    ? `\nCHAPTER INDEX (authoritative — use these real chapter numbers in arc_map and revision_plan)\n${params.chapterIndex}\n`
    : "";
  const genreContractSection = formatGenreExpectationContractForPass3b(params.genreExpectationContext);

  return `Produce the DREAM long-form evaluation document (EXCLUDING criterion_analyses — those are pre-computed below).
${correctionsSection}
MANUSCRIPT FACTS
- Title: ${params.title}
- Word count: ${params.wordCount.toLocaleString()}
- Structure: ${chapterInfo}
- Work type: ${params.workType}
- Evaluation mode: ${params.mode ?? "long_form_multi_layer_evaluation"}
${params.scopeProfile ? `- Scope: ${params.scopeProfile.inputScale} (${params.scopeProfile.chunkCount} chunks analyzed)` : ""}
${chapterIndexSection}
${genreContractSection}

SCORE GRID:
${scoreSummary}

PRE-COMPUTED CRITERION ANALYSES (DO NOT regenerate — use these for synthesis):
${JSON.stringify(params.criterionAnalyses)}

MANUSCRIPT CONTEXT (Pass 2a):
${structuredCtx}

MANUSCRIPT CHUNK SAMPLE:
${chunkWindows.map(w => `[${w.label}]\n${w.content}`).join("\n\n")}

INSTRUCTIONS:
Produce all DREAM sections EXCEPT criterion_analyses (already provided above).
Return a JSON object with these keys:
- executive_verdict (string, 150-300 words)
- dream_scores ({ quality, readiness, commercial, literary } — each 0-100)
- market_shelf ({ best_shelf, shelf_neighbors, comparison_space, marketable_hook, market_danger })
- what_not_to_become (string[])
- structural_stack (object[])
- arc_map (object[] — chapter_range MUST use real chapter numbers from CHAPTER INDEX)
- layer_analyses (object[])
- cross_layer_integration (object[])
- symbolic_audit (object)
- reader_experience (object)
- revision_plan (object[] — 5-6 priorities, CANONICAL recommendation ledger — do not duplicate advice in other sections)
- releasability (object[])
- acceptance_checks (object)
- calibration_notes (string[] — include any 10/10 + gap_evidence tensions)
- repo_summary (object)
- manuscript_integrity_issues (object[])

Ground all findings in manuscript evidence. Use character names.
structural_stack revision_notes and cross_layer_integration revision_notes should reference revision_plan priorities by number, not repeat the same advice.
revision_plan actions must include specific chapter locations from the CHAPTER INDEX.
Return ONLY valid JSON.`;
}

async function runPass3bChunked(
  opts: RunPass3bOptions,
  createCompletion: ReturnType<typeof defaultCreateCompletion>,
  selectedModel: string,
): Promise<Record<string, unknown>> {
  // Split criteria into batches
  const batches: SynthesizedCriterion[][] = [];
  for (let i = 0; i < opts.criteria.length; i += CRITERION_BATCH_SIZE) {
    batches.push(opts.criteria.slice(i, i + CRITERION_BATCH_SIZE));
  }

  console.log(`[Pass3b:chunked] generating criterion_analyses in ${batches.length} parallel batches`);

  // Phase A: Generate criterion_analyses in parallel
  const batchPromises = batches.map(async (batch, idx) => {
    const prompt = buildCriterionBatchPrompt({
      title: opts.title,
      wordCount: opts.wordCount,
      workType: opts.workType,
      criteria: batch,
      chunkSample: opts.manuscriptChunks,
      chapterIndex: opts.chapterIndex,
      genreExpectationContext: opts.genreExpectationContext,
    });

    const completion = await createCompletion({
      model: selectedModel,
      messages: [
        { role: "system", content: "You generate criterion_analyses entries for a DREAM evaluation document. Each entry expands a criterion score with manuscript-grounded evidence. Return ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      ...buildOpenAITemperatureParam(selectedModel, PASS3B_TEMPERATURE),
      ...buildOpenAIOutputTokenParam(selectedModel, 6000),
      response_format: { type: "json_object" },
    });
    trackCompletionCost({ jobId: opts.jobId ?? "unknown", phase: `pass3b_criterion_batch_${idx}`, model: selectedModel, usage: completion.usage });

    const rawContent = completion.choices?.[0]?.message?.content ?? "";
    if (!rawContent.trim()) {
      throw new Error(`[Pass3b:chunked] EMPTY_RESPONSE for batch ${idx}`);
    }

    const parseResult = parseJsonObjectBoundary<Record<string, unknown>>(rawContent, {
      label: `Pass3b criterion batch ${idx}`,
    });

    const analyses = parseResult.value.criterion_analyses;
    if (!Array.isArray(analyses)) {
      throw new Error(`[Pass3b:chunked] batch ${idx} missing criterion_analyses array`);
    }

    console.log(`[Pass3b:chunked] batch ${idx} complete — ${analyses.length} criteria`);
    return analyses;
  });

  const batchResults = await Promise.all(batchPromises);
  const allCriterionAnalyses = batchResults.flat();

  if (allCriterionAnalyses.length < 13) {
    throw new Error(
      `[Pass3b:chunked] criterion batches produced ${allCriterionAnalyses.length} analyses, expected 13+`
    );
  }

  console.log(`[Pass3b:chunked] all ${allCriterionAnalyses.length} criterion_analyses complete, generating synthesis`);

  // Phase B: Generate remaining sections with pre-computed criterion_analyses
  const synthesisPrompt = buildSynthesisPrompt({
    title: opts.title,
    wordCount: opts.wordCount,
    chapterCount: opts.chapterCount,
    workType: opts.workType,
    mode: opts.mode,
    criterionAnalyses: allCriterionAnalyses,
    pass2aStructuredContext: opts.pass2aStructuredContext,
    chunkSample: opts.manuscriptChunks,
    scopeProfile: opts.scopeProfile,
    authorCorrectionsBlock: opts.authorCorrectionsBlock,
    criteria: opts.criteria,
    chapterIndex: opts.chapterIndex,
    genreExpectationContext: opts.genreExpectationContext,
  });

  const synthesisCompletion = await createCompletion({
    model: selectedModel,
    messages: [
      { role: "system", content: PASS3B_SYSTEM_PROMPT },
      { role: "user", content: synthesisPrompt },
    ],
    ...buildOpenAITemperatureParam(selectedModel, PASS3B_TEMPERATURE),
    ...buildOpenAIOutputTokenParam(selectedModel, 16000),
    response_format: { type: "json_object" },
  });
  trackCompletionCost({ jobId: opts.jobId ?? "unknown", phase: "pass3b_synthesis", model: selectedModel, usage: synthesisCompletion.usage });

  const synthesisContent = synthesisCompletion.choices?.[0]?.message?.content ?? "";
  if (!synthesisContent.trim()) {
    throw new Error("[Pass3b:chunked] EMPTY_RESPONSE for synthesis call");
  }

  const synthesisResult = parseJsonObjectBoundary<Record<string, unknown>>(synthesisContent, {
    label: "Pass3b synthesis",
  });

  // Merge: pre-computed criterion_analyses + synthesized sections
  return {
    ...synthesisResult.value,
    criterion_analyses: allCriterionAnalyses,
  };
}

// ── Main runner ───────────────────────────────────────────────────────────────

/**
 * Run Pass 3b — Long-Form DREAM Document Synthesis.
 *
 * Only call this when route === "LONG_FORM" (manuscript ≥ 25,000 words).
 * Throws on OpenAI error, parse failure, or missing required sections.
 *
 * When EVAL_PASS3B_CHUNKED=true, uses parallel criterion batching for lower latency.
 */
export async function runPass3bLongform(
  opts: RunPass3bOptions
): Promise<LongformDreamDocument> {
  if (opts.manuscriptChunks.length === 0) {
    throw new Error("[Pass3b] LONGFORM_CHUNKS_REQUIRED: no manuscript chunks provided");
  }

  if (opts.criteria.length < 13) {
    throw new Error(
      `[Pass3b] CRITERIA_INSUFFICIENT: expected 13 criteria, got ${opts.criteria.length}`
    );
  }

  const selectedModel = getCanonicalPass3Model(opts.model);
  const maxTokens = getPass3bMaxTokens();
  const createCompletion = defaultCreateCompletion(opts.openaiApiKey, opts.openAiTimeoutMs);

  // ── Chunked path: parallel criterion batching for lower latency ──────────
  if (isChunkedEnabled()) {
    console.log(`[Pass3b:chunked] enabled — model=${selectedModel} title="${opts.title}" words=${opts.wordCount}`);
    const parsed = await runPass3bChunked(opts, createCompletion, selectedModel);
    const { patched, report } = applyTruthfulLongformCriteriaFallback(parsed, opts.criteria);
    const { patched: guarded, report: revisionPlanGuardrailReport } = sanitizeAuthorFacingRevisionPlanInPass3b(patched);
    const guardedPlanLength = Array.isArray(guarded.revision_plan) ? guarded.revision_plan.length : 0;
    if (guardedPlanLength < 3) {
      throw new Error(`[Pass3b:chunked] revision_plan requires at least 3 priorities, got ${guardedPlanLength}`);
    }
    const document = validateDreamDocument(guarded);
    if (report.autofilled_keys.length > 0 || report.repaired_keys.length > 0) {
      console.warn("[Pass3b:chunked] truthful_fallback_applied", report);
    }
    if (revisionPlanGuardrailReport.removed_entries.length > 0 || revisionPlanGuardrailReport.removed_actions_count > 0) {
      console.warn("[Pass3b:chunked] revision_plan_guardrail_applied", revisionPlanGuardrailReport);
    }
    const sanitizedDocument = sanitizeCMOSDeep(document);
    const calibrationNotes = applyScoreCalibrationNotes(sanitizedDocument);
    if (calibrationNotes.length > 0) {
      sanitizedDocument.calibration_notes = [
        ...(sanitizedDocument.calibration_notes ?? []),
        ...calibrationNotes,
      ];
      console.log(`[Pass3b:chunked] score_calibration_notes_injected count=${calibrationNotes.length}`);
    }
    sanitizedDocument.prompt_version = PASS3B_PROMPT_VERSION + ':chunked';
    sanitizedDocument.generated_at = new Date().toISOString();
    sanitizedDocument.model = selectedModel;
    if (opts.genreExpectationContext) {
      sanitizedDocument.genre_expectation_context = opts.genreExpectationContext;
    }
    console.log(`[Pass3b:chunked] complete title="${opts.title}" integrity_issues=${sanitizedDocument.manuscript_integrity_issues.length} revision_priorities=${sanitizedDocument.revision_plan.length}`);
    return sanitizedDocument;
  }

  // ── Single-call path (default) ──────────────────────────────────────────
  const userPrompt = buildPass3bUserPrompt({
    title: opts.title,
    wordCount: opts.wordCount,
    chapterCount: opts.chapterCount,
    workType: opts.workType,
    mode: opts.mode,
    criteria: opts.criteria,
    pass2aStructuredContext: opts.pass2aStructuredContext,
    chunkSample: opts.manuscriptChunks,
    scopeProfile: opts.scopeProfile,
    authorCorrectionsBlock: opts.authorCorrectionsBlock,
    chapterIndex: opts.chapterIndex,
    genreExpectationContext: opts.genreExpectationContext,
  });

  console.log(`[Pass3b] request model=${selectedModel} max_tokens=${maxTokens} title="${opts.title}" words=${opts.wordCount} chunks=${opts.manuscriptChunks.length}`);

  async function attemptCompletion(tokenBudget: number): Promise<Record<string, unknown>> {
    const completion = await createCompletion({
      model: selectedModel,
      messages: [
        { role: "system", content: PASS3B_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      ...buildOpenAITemperatureParam(selectedModel, PASS3B_TEMPERATURE),
      ...buildOpenAIOutputTokenParam(selectedModel, tokenBudget),
      response_format: { type: "json_object" },
    });
    trackCompletionCost({ jobId: opts.jobId ?? "unknown", phase: "pass3b", model: selectedModel, usage: completion.usage });

    const rawContent = completion.choices?.[0]?.message?.content ?? "";

    if (!rawContent.trim()) {
      throw new Error(
        `[Pass3b] EMPTY_RESPONSE: model=${selectedModel} finish_reason=${completion.choices?.[0]?.finish_reason ?? "unknown"}`
      );
    }

    const parseResult = parseJsonObjectBoundary<Record<string, unknown>>(rawContent, {
      label: "Pass3b DREAM",
    });
    return parseResult.value;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = await attemptCompletion(maxTokens);
  } catch (err) {
    if (err instanceof JsonBoundaryError && err.code === "JSON_PARSE_FAILED_TRUNCATED") {
      const retryTokens = Math.min(Math.ceil(maxTokens * 1.5), PASS3B_MAX_TOKENS_CEILING);
      console.warn(`[Pass3b] TRUNCATION_RETRY: first attempt truncated, retrying with max_tokens=${retryTokens}`);
      try {
        parsed = await attemptCompletion(retryTokens);
      } catch (retryErr) {
        if (retryErr instanceof JsonBoundaryError) {
          throw new Error(
            `[Pass3b] JSON_PARSE_FAILURE: ${retryErr.message} (after truncation retry at max_tokens=${retryTokens})`
          );
        }
        throw retryErr;
      }
    } else if (err instanceof JsonBoundaryError) {
      throw new Error(
        `[Pass3b] JSON_PARSE_FAILURE: ${err.message}`
      );
    } else {
      throw err;
    }
  }

  const { patched, report } = applyTruthfulLongformCriteriaFallback(parsed, opts.criteria);
  const {
    patched: guarded,
    report: revisionPlanGuardrailReport,
  } = sanitizeAuthorFacingRevisionPlanInPass3b(patched);

  const guardedPlanLength = Array.isArray(guarded.revision_plan) ? guarded.revision_plan.length : 0;
  if (guardedPlanLength < 3) {
    throw new Error(
      `[Pass3b] revision_plan failed author-facing guardrail after sanitization: requires at least 3 actionable manuscript priorities, got ${guardedPlanLength}`
    );
  }

  const document = validateDreamDocument(guarded);

  if (report.autofilled_keys.length > 0 || report.repaired_keys.length > 0) {
    console.warn("[Pass3b] truthful_fallback_applied", {
      autofilled_keys: report.autofilled_keys,
      repaired_keys: report.repaired_keys,
    });
  }

  if (revisionPlanGuardrailReport.removed_entries.length > 0 || revisionPlanGuardrailReport.removed_actions_count > 0) {
    console.warn("[Pass3b] revision_plan_guardrail_applied", {
      removed_entries: revisionPlanGuardrailReport.removed_entries,
      removed_actions_count: revisionPlanGuardrailReport.removed_actions_count,
    });
  }

  // CMOS 17th Ed. — deterministic post-processing of all author-facing text
  const sanitizedDocument = sanitizeCMOSDeep(document);

  // Post-processing: inject calibration notes for 10/10 + gap_evidence tensions
  const calibrationNotes = applyScoreCalibrationNotes(sanitizedDocument);
  if (calibrationNotes.length > 0) {
    sanitizedDocument.calibration_notes = [
      ...(sanitizedDocument.calibration_notes ?? []),
      ...calibrationNotes,
    ];
    console.log(`[Pass3b] score_calibration_notes_injected count=${calibrationNotes.length}`);
  }

  // Stamp provenance server-side (after sanitization to avoid mangling metadata)
  sanitizedDocument.prompt_version = PASS3B_PROMPT_VERSION;
  sanitizedDocument.generated_at = new Date().toISOString();
  sanitizedDocument.model = selectedModel;
  if (opts.genreExpectationContext) {
    sanitizedDocument.genre_expectation_context = opts.genreExpectationContext;
  }

  console.log(`[Pass3b] complete title="${opts.title}" integrity_issues=${sanitizedDocument.manuscript_integrity_issues.length} revision_priorities=${sanitizedDocument.revision_plan.length}`);

  return sanitizedDocument;
}
