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
 * Benchmark authority:
 *   docs/benchmarks/froggin-noggin-dream.md
 *   docs/benchmarks/cartel-babies-dream-longform-evaluation.md
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

export type TruthfulFallbackReport = {
  autofilled_keys: string[];
  repaired_keys: string[];
};

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
  const document = validateDreamDocument(patched);

  if (report.autofilled_keys.length > 0 || report.repaired_keys.length > 0) {
    console.warn("[Pass3b] truthful_fallback_applied", {
      autofilled_keys: report.autofilled_keys,
      repaired_keys: report.repaired_keys,
    });
  }

  // Stamp provenance server-side
  document.prompt_version = PASS3B_PROMPT_VERSION;
  document.generated_at = new Date().toISOString();
  document.model = selectedModel;

  console.log(`[Pass3b] complete title="${opts.title}" integrity_issues=${document.manuscript_integrity_issues.length} revision_priorities=${document.revision_plan.length}`);

  return document;
}
