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

const SAFE_EVALUATION_WORDS_LIST = Object.freeze([
  "chapter",
  "voice",
  "pacing",
  "tone",
  "scene",
  "structure",
  "character",
  "narrative",
  "dialogue",
  "theme",
  "stakes",
  "atmosphere",
  "summary",
  "recommendation",
  "recommendations",
  "strength",
  "strengths",
  "strong",
  "risk",
  "risks",
  "momentum",
  "reflective",
  "tension",
  "sustain",
  "move",
  "softens",
  "passage",
  "passages",
  "coherent",
  "clarify",
  "transition",
  "language",
  "improves",
  "readability",
  "friction",
  "boundaries",
  "setup",
  "external",
  "pressure",
  "medium",
  "high",
  "low",
  "action",
  "impact",
  "expected",
  "rationale",
  "overall",
  "score",
  "criteria",
  "foundation",
  "foundations",
  "sustain",
  "softens",
  "passages",
  "clearer",
  "they",
  "their",
  "them",
  "strong",
  "clear",
  "effective",
  "weak",
  "unclear",
]);

const HARD_FAIL_TOKENS = Object.freeze([
  "maria",
  "cartel",
  "sinaloa",
  "father",
  "daughter",
]);

const TOKEN_PATTERN = /[a-z]+/g;

const NOVEL_ENTITY_THRESHOLD = (() => {
  const parsed = Number.parseInt(
    process.env.EVAL_CONTEXT_CONTAMINATION_ENTITY_THRESHOLD || "1",
    10,
  );
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 1;
})();

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

function tokenizeClean(text: string, stop: Set<string>, safe: Set<string>): Set<string> {
  const normalized = normalize(text);
  if (!normalized) {
    return new Set<string>();
  }

  const tokens = normalized.match(TOKEN_PATTERN) || [];
  const result = new Set<string>();

  for (const token of tokens) {
    if (token.length < 4) continue;
    if (stop.has(token)) continue;
    if (safe.has(token)) continue;
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
  const stopwords = new Set<string>(STOPWORDS_LIST);
  const safeWords = new Set<string>(SAFE_EVALUATION_WORDS_LIST);

  const normalizedSource = normalize(sourceText);
  const normalizedOutput = normalize(outputText);

  // Hard-fail signals bypass token filtering and apply on normalized text.
  const hardFailHits = HARD_FAIL_TOKENS.filter(
    (token) => normalizedOutput.includes(token) && !normalizedSource.includes(token),
  );

  if (hardFailHits.length > 0) {
    return {
      contaminated: true,
      offendingEntities: hardFailHits,
      reasons: hardFailHits.map((token) => `Hard contamination token detected: ${token}`),
    };
  }

  // Filter before diff for deterministic behavior.
  const sourceTokens = tokenizeClean(sourceText, stopwords, safeWords);
  const outputTokens = tokenizeClean(outputText, stopwords, safeWords);

  const novelTokens: string[] = [];
  for (const token of outputTokens) {
    if (!sourceTokens.has(token)) {
      novelTokens.push(token);
    }
  }

  if (novelTokens.length >= NOVEL_ENTITY_THRESHOLD) {
    return {
      contaminated: true,
      offendingEntities: novelTokens,
      reasons: novelTokens.map((token) => `Novel token not in source: ${token}`),
    };
  }

  return {
    contaminated: false,
    offendingEntities: [],
    reasons: [],
  };
}
