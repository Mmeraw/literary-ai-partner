// canon-audit-allow: vocabulary-detection
// Reason: 'commercial' below is a DREAM subscore dimension (commercial literary fiction
// is a publishing genre/shelf category), not a criterion alias for the canonical
// 'marketability' criterion. The two are distinct concepts in different namespaces.
// See docs/benchmarks/froggin-noggin-dream-longform-multilayer-gold-standard.md §dream_scores for DREAM subscore authority.
/**
 * Pass 3b — Long-Form DREAM Document Synthesis Runner
 *
 * Compact repair implementation after a connector write truncated the previous large file.
 * Preserves the exported API, validation guardrails, truthful criterion fallback, revision-plan
 * guardrail, CMOS sanitization, cost tracking, and OpenAI JSON-object generation path.
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
import type { EnglishVariant } from "@/lib/evaluation/englishVariant";

const PASS3B_TEMPERATURE = 0.3;
const PASS3B_MAX_TOKENS_CEILING = 32000;

type DreamConfidence = "High" | "Moderate-High" | "Moderate" | "Low";

function getPass3bMaxTokens(): number {
  const raw = process.env.EVAL_PASS3B_MAX_TOKENS;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 12000 && parsed <= PASS3B_MAX_TOKENS_CEILING) return parsed;
  }
  return 24000;
}

export interface LongformDreamDocument {
  executive_verdict: string;
  dream_scores: { quality: number; readiness: number; commercial: number; literary: number };
  market_shelf: {
    best_shelf: string;
    shelf_neighbors: string[];
    comparison_space: string[];
    marketable_hook: string;
    market_danger: string;
  };
  what_not_to_become: string[];
  structural_stack: Array<{ layer_name: string; function: string; status: "strong" | "moderate" | "weak" | "fragile"; revision_note: string }>;
  arc_map: Array<{ act_name: string; chapter_range: string; primary_function: string; revision_priority: string }>;
  criterion_analyses: Array<{ key: string; score: number; confidence: DreamConfidence; fit_evidence: string[]; gap_evidence: string[]; revision_queue: string[] }>;
  layer_analyses: Array<{ layer_name: string; status: string; needed_revision: string }>;
  cross_layer_integration: Array<{ motif: string; description: string; integration_quality: "strong" | "moderate" | "weak"; revision_note: string }>;
  symbolic_audit: {
    preserved_symbols: Array<{ symbol: string; current_function: string; revision_instruction: string }>;
    doctrine_strengths: string[];
    doctrine_risks: string[];
    audit_conclusion: string;
  };
  reader_experience: {
    first_act: { reader_question: string; emotional_state: string; risk: string };
    middle: { reader_question: string; emotional_state: string; risk: string };
    final_act: { reader_question: string; emotional_state: string; risk: string };
    aftertaste: string;
  };
  revision_plan: Array<{ priority: number; title: string; goal: string; actions: string[]; acceptance_check: string }>;
  releasability: Array<{ dimension: string; current_status: string; verdict: "Ready" | "Near-ready" | "Revise" | "Must fix" }>;
  acceptance_checks: { required_detection: string[]; failure_conditions: string[] };
  calibration_notes: string[];
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
  manuscript_integrity_issues: Array<{ kind: string; description: string; severity: "blocking" | "major" | "minor" }>;
  prompt_version: string;
  generated_at: string;
  model: string;
  genre_expectation_context?: GenreExpectationMetadata;
}

export interface RunPass3bOptions {
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
  authorCorrectionsBlock?: string | null;
  chapterIndex?: string | null;
  jobId?: string;
  genreExpectationContext?: GenreExpectationMetadata | null;
  englishVariant?: EnglishVariant | string;
}

export type TruthfulFallbackReport = { autofilled_keys: string[]; repaired_keys: string[] };
export type RevisionPlanGuardrailReport = { removed_entries: string[]; removed_actions_count: number };

const PASS3B_INTERNAL_DIAGNOSTIC_PATTERNS: RegExp[] = [
  /source[-\s]?integrity/i,
  /relationship\s+network\s+representation/i,
  /threat\s*\/?\s*pressure/i,
  /ending\s+taxonomy/i,
  /location\s*\/?\s*timeline/i,
  /object\s*\/?\s*symbol/i,
  /extraction\s+diagnostic/i,
  /degraded_extraction|hard_fail/i,
  /layer\s+contamination/i,
  /taxonomy\s+repair/i,
  /renderer\s+defect|export\s+defect/i,
  /schema\s+defect|ontology\s+repair|pipeline\s+fix/i,
  /no\s+qualifying\s+relationship\s+pairs/i,
];

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isInternalDiagnosticTextForPass3b(value: string): boolean {
  const text = value.trim();
  return !!text && PASS3B_INTERNAL_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(text));
}

function filterAuthorFacingTextListForPass3b(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .filter((entry) => !isInternalDiagnosticTextForPass3b(entry));
}

export function sanitizeAuthorFacingRevisionPlanInPass3b(
  raw: Record<string, unknown>
): { patched: Record<string, unknown>; report: RevisionPlanGuardrailReport } {
  const report: RevisionPlanGuardrailReport = { removed_entries: [], removed_actions_count: 0 };
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
    if (!combinedText) continue;
    if (isInternalDiagnosticTextForPass3b(combinedText)) {
      report.removed_entries.push(title || goal || acceptance || "(untitled internal diagnostic item)");
      continue;
    }
    kept.push({ ...obj, actions: filteredActions });
  }

  const calibrationNotes = Array.isArray(raw.calibration_notes)
    ? raw.calibration_notes.filter((note): note is string => typeof note === "string" && note.trim().length > 0)
    : [];

  if (report.removed_entries.length > 0 || report.removed_actions_count > 0) {
    calibrationNotes.push(
      `[Pass3b guardrail] Removed ${report.removed_entries.length} internal diagnostic revision_plan item(s) and stripped ${report.removed_actions_count} internal diagnostic action(s) from author-facing revision guidance.`
    );
  }

  return {
    patched: { ...raw, revision_plan: kept.map((entry, idx) => ({ ...entry, priority: idx + 1 })), calibration_notes: calibrationNotes },
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
    const normalized = value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
    if (normalized.length > 0) return normalized;
  }
  return fallback;
}

function buildCriterionFallbackEntry(criterion: SynthesizedCriterion): Record<string, unknown> {
  const rationale = criterion.final_rationale?.trim() || `${criterion.key} requires focused revision.`;
  const fitEvidence = (criterion.evidence ?? []).map((entry) => (entry?.snippet ?? "").trim()).filter(Boolean).slice(0, 2);
  const revisionQueue = (criterion.recommendations ?? []).map((rec) => rec.action?.trim()).filter(Boolean).slice(0, 3);
  return {
    key: criterion.key,
    score: criterion.final_score_0_10,
    confidence: toDreamConfidence(criterion.confidence_level),
    fit_evidence: fitEvidence.length > 0 ? fitEvidence : [`Pass 3 rationale: ${rationale.slice(0, 180)}`],
    gap_evidence: [`Pass 3b omitted explicit gap evidence for ${criterion.key}; fallback preserved Pass 3 rationale.`],
    revision_queue: revisionQueue.length > 0 ? revisionQueue : [`Refine ${criterion.key} with manuscript-grounded revisions from Pass 3 recommendations.`],
  };
}

export function applyTruthfulLongformCriteriaFallback(
  raw: Record<string, unknown>,
  criteria: SynthesizedCriterion[]
): { patched: Record<string, unknown>; report: TruthfulFallbackReport } {
  const report: TruthfulFallbackReport = { autofilled_keys: [], repaired_keys: [] };
  const entries = Array.isArray(raw.criterion_analyses) ? raw.criterion_analyses : [];
  const byKey = new Map<string, Record<string, unknown>>();

  for (const entry of entries) {
    const obj = asObject(entry);
    const key = String(obj?.key ?? "").trim();
    if (obj && key && !byKey.has(key)) byKey.set(key, obj);
  }

  const normalized = criteria.map((criterion) => {
    const existing = byKey.get(criterion.key);
    if (!existing) {
      report.autofilled_keys.push(criterion.key);
      return buildCriterionFallbackEntry(criterion);
    }
    const fallbackEntry = buildCriterionFallbackEntry(criterion);
    const confidenceRaw = String(existing.confidence ?? "").trim();
    const confidence: DreamConfidence =
      confidenceRaw === "High" || confidenceRaw === "Moderate-High" || confidenceRaw === "Moderate" || confidenceRaw === "Low"
        ? (confidenceRaw as DreamConfidence)
        : toDreamConfidence(criterion.confidence_level);
    const patched = {
      ...existing,
      key: criterion.key,
      score: criterion.final_score_0_10,
      confidence,
      fit_evidence: ensureStringArray(existing.fit_evidence, fallbackEntry.fit_evidence as string[]),
      gap_evidence: ensureStringArray(existing.gap_evidence, fallbackEntry.gap_evidence as string[]),
      revision_queue: ensureStringArray(existing.revision_queue, fallbackEntry.revision_queue as string[]),
    };
    if (patched.score !== existing.score || patched.confidence !== existing.confidence) report.repaired_keys.push(criterion.key);
    return patched;
  });

  return { patched: { ...raw, criterion_analyses: normalized }, report };
}

function defaultCreateCompletion(apiKey?: string, timeoutMs?: number) {
  const key = apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const timeout = timeoutMs ?? getEvalOpenAiTimeoutMs();
  const openai = new OpenAI({ apiKey: key, maxRetries: OPENAI_SDK_MAX_RETRIES, timeout });
  return openai.chat.completions.create.bind(openai.chat.completions);
}

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
  const missing = REQUIRED_TOP_LEVEL_KEYS.filter((key) => !(key in raw));
  if (missing.length > 0) throw new Error(`[Pass3b] DREAM document missing required sections: ${missing.join(", ")}`);
  const analyses = raw.criterion_analyses;
  if (!Array.isArray(analyses) || analyses.length < 13) {
    throw new Error(`[Pass3b] criterion_analyses must have at least 13 entries, got ${Array.isArray(analyses) ? analyses.length : "non-array"}`);
  }
  const plan = raw.revision_plan;
  if (!Array.isArray(plan) || plan.length < 3) {
    throw new Error(`[Pass3b] revision_plan must have at least 3 priorities, got ${Array.isArray(plan) ? plan.length : "non-array"}`);
  }
  const scores = raw.dream_scores as Record<string, unknown> | undefined;
  for (const key of ["quality", "readiness", "commercial", "literary"]) {
    const value = scores?.[key];
    if (typeof value !== "number" || value < 0 || value > 100) {
      throw new Error(`[Pass3b] dream_scores.${key} must be a number 0–100, got ${value}`);
    }
  }
  return raw as unknown as LongformDreamDocument;
}

function applyScoreCalibrationNotes(doc: LongformDreamDocument): string[] {
  const notes: string[] = [];
  for (const ca of doc.criterion_analyses) {
    if (ca.score === 10 && Array.isArray(ca.gap_evidence) && ca.gap_evidence.length > 0) {
      const label = CRITERIA_METADATA[ca.key as keyof typeof CRITERIA_METADATA]?.label ?? ca.key;
      notes.push(`Score calibration tension: ${label} (${ca.key}) scored 10/10 but has ${ca.gap_evidence.length} gap_evidence entries. A 10/10 implies near-perfection; the identified gaps suggest 9 or 9.5 may be more credible.`);
    }
  }
  return notes;
}

async function attemptCompletion(
  createCompletion: ReturnType<typeof defaultCreateCompletion>,
  selectedModel: string,
  tokenBudget: number,
  opts: RunPass3bOptions
): Promise<Record<string, unknown>> {
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
    englishVariant: opts.englishVariant,
  });

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
    throw new Error(`[Pass3b] EMPTY_RESPONSE: model=${selectedModel} finish_reason=${completion.choices?.[0]?.finish_reason ?? "unknown"}`);
  }
  return parseJsonObjectBoundary<Record<string, unknown>>(rawContent, { label: "Pass3b DREAM" }).value;
}

export async function runPass3bLongform(opts: RunPass3bOptions): Promise<LongformDreamDocument> {
  if (opts.manuscriptChunks.length === 0) throw new Error("[Pass3b] LONGFORM_CHUNKS_REQUIRED: no manuscript chunks provided");
  if (opts.criteria.length < 13) throw new Error(`[Pass3b] CRITERIA_INSUFFICIENT: expected 13 criteria, got ${opts.criteria.length}`);

  const selectedModel = getCanonicalPass3Model(opts.model);
  const maxTokens = getPass3bMaxTokens();
  const createCompletion = defaultCreateCompletion(opts.openaiApiKey, opts.openAiTimeoutMs);

  let parsed: Record<string, unknown>;
  try {
    parsed = await attemptCompletion(createCompletion, selectedModel, maxTokens, opts);
  } catch (err) {
    if (err instanceof JsonBoundaryError && err.code === "JSON_PARSE_FAILED_TRUNCATED") {
      const retryTokens = Math.min(Math.ceil(maxTokens * 1.5), PASS3B_MAX_TOKENS_CEILING);
      parsed = await attemptCompletion(createCompletion, selectedModel, retryTokens, opts);
    } else if (err instanceof JsonBoundaryError) {
      throw new Error(`[Pass3b] JSON_PARSE_FAILURE: ${err.message}`);
    } else {
      throw err;
    }
  }

  const { patched, report } = applyTruthfulLongformCriteriaFallback(parsed, opts.criteria);
  const { patched: guarded, report: revisionPlanGuardrailReport } = sanitizeAuthorFacingRevisionPlanInPass3b(patched);
  const guardedPlanLength = Array.isArray(guarded.revision_plan) ? guarded.revision_plan.length : 0;
  if (guardedPlanLength < 3) {
    throw new Error(`[Pass3b] revision_plan failed author-facing guardrail after sanitization: requires at least 3 actionable manuscript priorities, got ${guardedPlanLength}`);
  }

  const document = validateDreamDocument(guarded);
  if (report.autofilled_keys.length > 0 || report.repaired_keys.length > 0) console.warn("[Pass3b] truthful_fallback_applied", report);
  if (revisionPlanGuardrailReport.removed_entries.length > 0 || revisionPlanGuardrailReport.removed_actions_count > 0) console.warn("[Pass3b] revision_plan_guardrail_applied", revisionPlanGuardrailReport);

  const sanitizedDocument = sanitizeCMOSDeep(document);
  const calibrationNotes = applyScoreCalibrationNotes(sanitizedDocument);
  if (calibrationNotes.length > 0) sanitizedDocument.calibration_notes = [...(sanitizedDocument.calibration_notes ?? []), ...calibrationNotes];
  sanitizedDocument.prompt_version = PASS3B_PROMPT_VERSION;
  sanitizedDocument.generated_at = new Date().toISOString();
  sanitizedDocument.model = selectedModel;
  if (opts.genreExpectationContext) sanitizedDocument.genre_expectation_context = opts.genreExpectationContext;
  return sanitizedDocument;
}
