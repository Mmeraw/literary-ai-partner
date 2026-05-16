/**
 * Pass 3b — Long-Form DREAM Document Synthesis Runner
 *
 * Fires ONLY when route === "LONG_FORM" (≥ 25,000 words / inputScale === "full_manuscript").
 * Reads Pass 3 synthesized criteria and produces the full 16-section DREAM document.
 *
 * Benchmark authority:
 *   docs/benchmarks/froggin-noggin-dream.md
 *   docs/benchmarks/cartel-babies-dream-longform-evaluation.md
 *
 * Temperature: 0.3   Default max tokens: 6000 (override via EVAL_PASS3B_MAX_TOKENS)
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
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPass3Model,
  OPENAI_SDK_MAX_RETRIES,
} from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { JsonBoundaryError, parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import type {
  SynthesizedCriterion,
  ManuscriptChunkEvidence,
  Pass2aStructuredContext,
} from "./types";
import type { SubmissionScopeProfile } from "./submissionScope";

// ── Constants ─────────────────────────────────────────────────────────────────

const PASS3B_TEMPERATURE = 0.3;

function getPass3bMaxTokens(): number {
  const raw = process.env.EVAL_PASS3B_MAX_TOKENS;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 2000 && parsed <= 16000) return parsed;
  }
  return 6000;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LongformDreamDocument {
  /** §1 — Executive verdict prose */
  executive_verdict: string;
  /** §1 — DREAM subscores 0–100 */
  dream_scores: {
    quality: number;
    readiness: number;
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

// ── Main runner ───────────────────────────────────────────────────────────────

/**
 * Run Pass 3b — Long-Form DREAM Document Synthesis.
 *
 * Only call this when route === "LONG_FORM" (manuscript ≥ 25,000 words).
 * Throws on OpenAI error, parse failure, or missing required sections.
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
  });

  console.log(`[Pass3b] request model=${selectedModel} max_tokens=${maxTokens} title="${opts.title}" words=${opts.wordCount} chunks=${opts.manuscriptChunks.length}`);

  const createCompletion = defaultCreateCompletion(opts.openaiApiKey, opts.openAiTimeoutMs);

  const completion = await createCompletion({
    model: selectedModel,
    messages: [
      { role: "system", content: PASS3B_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    ...buildOpenAITemperatureParam(selectedModel, PASS3B_TEMPERATURE),
    ...buildOpenAIOutputTokenParam(selectedModel, maxTokens),
    response_format: { type: "json_object" },
  });

  const rawContent = completion.choices?.[0]?.message?.content ?? "";

  if (!rawContent.trim()) {
    throw new Error(
      `[Pass3b] EMPTY_RESPONSE: model=${selectedModel} finish_reason=${completion.choices?.[0]?.finish_reason ?? "unknown"}`
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObjectBoundary<Record<string, unknown>>(rawContent, {
      allowTrailingGarbage: true,
    });
  } catch (err) {
    if (err instanceof JsonBoundaryError) {
      throw new Error(
        `[Pass3b] JSON_PARSE_FAILURE: ${err.message} raw_head=${rawContent.slice(0, 200)}`
      );
    }
    throw err;
  }

  const document = validateDreamDocument(parsed);

  // Stamp provenance server-side
  document.prompt_version = PASS3B_PROMPT_VERSION;
  document.generated_at = new Date().toISOString();
  document.model = selectedModel;

  console.log(`[Pass3b] complete title="${opts.title}" integrity_issues=${document.manuscript_integrity_issues.length} revision_priorities=${document.revision_plan.length}`);

  return document;
}
