import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";

const STOPWORDS_LIST = Object.freeze([
  "the",
  "and",
  "with",
  "this",
  "that",
  "from",
  "into",
  "over",
  "under",
  "between",
  "their",
  "they",
  "there",
  "where",
  "while",
  "across",
  "near",
  "through",
  "about",
]);

// Known cross-manuscript bleed markers from historical contamination incidents.
// This list is static and narrow — do NOT expand into a general novel-token check.
// A future cross-manuscript NER index will supersede this when available.
const HARD_FAIL_TOKENS: Set<string> = new Set([
  "maria",
  "cartel",
  "sinaloa",
]);

// Hoisted to module scope — created once, not per call.
const STOPWORDS: Set<string> = new Set(STOPWORDS_LIST);

const TOKEN_PATTERN = /[a-z]+/g;

function parseIntEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

const MIN_TOKEN_LENGTH = parseIntEnv("EVAL_CONTEXT_CONTAMINATION_MIN_TOKEN_LENGTH", 4, 3, 12);

const MAX_REPORTED_ENTITIES = parseIntEnv("EVAL_CONTEXT_CONTAMINATION_MAX_REPORTED", 25, 1, 100);

export type ContextContaminationResult = {
  contaminated: boolean;
  offendingEntities: string[];
  reasons: string[];
};

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeClean(text: string, stop: Set<string>): Set<string> {
  const normalized = normalize(text);
  if (!normalized) {
    return new Set<string>();
  }

  const tokens = normalized.match(TOKEN_PATTERN) || [];
  const result = new Set<string>();

  for (const token of tokens) {
    if (token.length < MIN_TOKEN_LENGTH) continue;
    if (stop.has(token)) continue;
    result.add(token);
  }

  return result;
}

export function buildEvaluationOutputText(result: EvaluationResultV1): string {
  const parts: string[] = [];

  parts.push(result.overview.one_paragraph_summary);
  parts.push(...result.overview.top_3_strengths);
  parts.push(...result.overview.top_3_risks);

  for (const criterion of result.criteria) {
    parts.push(criterion.rationale);
    for (const recommendation of criterion.recommendations) {
      parts.push(recommendation.action);
      parts.push(recommendation.expected_impact);
    }
  }

  for (const recommendation of result.recommendations.quick_wins) {
    parts.push(recommendation.action);
    parts.push(recommendation.why);
  }

  for (const recommendation of result.recommendations.strategic_revisions) {
    parts.push(recommendation.action);
    parts.push(recommendation.why);
  }

  return parts.filter((part) => typeof part === "string" && part.trim().length > 0).join("\n");
}

export function detectContextContamination(params: {
  sourceText: string;
  evaluationResult: EvaluationResultV1;
}): ContextContaminationResult {
  const sourceText = params.sourceText || "";
  const outputText = buildEvaluationOutputText(params.evaluationResult);

  // Hard-fail check: use token-set membership to avoid substring false-positives
  // (e.g. "mariage" would wrongly match "maria" with .includes()).
  const outputTokenSet = tokenizeClean(outputText, STOPWORDS);
  const sourceTokenSet = tokenizeClean(sourceText, STOPWORDS);

  const hardFailHits: string[] = [];
  for (const token of HARD_FAIL_TOKENS) {
    if (outputTokenSet.has(token) && !sourceTokenSet.has(token)) {
      hardFailHits.push(token);
    }
  }

  if (hardFailHits.length > 0) {
    hardFailHits.sort();
    return {
      contaminated: true,
      offendingEntities: hardFailHits.slice(0, MAX_REPORTED_ENTITIES),
      reasons: hardFailHits.map((token) => `Hard contamination token detected: ${token}`),
    };
  }

  return {
    contaminated: false,
    offendingEntities: [],
    reasons: [],
  };
}
