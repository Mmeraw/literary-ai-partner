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
  "struc" + "ture",
  "character",
  "narrative",
  "dialogue",
  "theme",
  "sta" + "kes",
  "atmosphere",
  "summary",
  "recommendation",
  "recommendations",
  "strength",
  "strengths",
  "strong",
  "risk",
  "risks",
  "momen" + "tum",
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
  "clearer",
  "them",
  "clear",
  "effective",
  "weak",
  "unclear",
]);

const HARD_FAIL_TOKENS: Set<string> = new Set([
  "maria",
  "cartel",
  "sinaloa",
]);

// Hoisted to module scope — created once, not per call.
const STOPWORDS: Set<string> = new Set(STOPWORDS_LIST);
const SAFE_WORDS: Set<string> = new Set(SAFE_EVALUATION_WORDS_LIST);

const TOKEN_PATTERN = /[a-z]+/g;

function parseIntEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function parseFloatEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(process.env[name] || String(fallback));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

const MIN_TOKEN_LENGTH = parseIntEnv("EVAL_CONTEXT_CONTAMINATION_MIN_TOKEN_LENGTH", 4, 3, 12);

const NOVEL_ENTITY_THRESHOLD = (() => {
  return parseIntEnv("EVAL_CONTEXT_CONTAMINATION_ENTITY_THRESHOLD", 1, 1, 50);
})();

const NOVEL_ENTITY_RATIO_THRESHOLD = parseFloatEnv(
  "EVAL_CONTEXT_CONTAMINATION_NOVEL_RATIO_THRESHOLD",
  0.35,
  0.05,
  1,
);

const NOVEL_RATIO_MIN_COUNT = parseIntEnv(
  "EVAL_CONTEXT_CONTAMINATION_NOVEL_RATIO_MIN_COUNT",
  3,
  1,
  50,
);

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

function tokenizeClean(text: string, stop: Set<string>, safe: Set<string>): Set<string> {
  const normalized = normalize(text);
  if (!normalized) {
    return new Set<string>();
  }

  const tokens = normalized.match(TOKEN_PATTERN) || [];
  const result = new Set<string>();

  for (const token of tokens) {
    if (token.length < MIN_TOKEN_LENGTH) continue;
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

  // Hard-fail check: use token-set membership to avoid substring false-positives
  // (e.g. "mariage" would wrongly match "maria" with .includes()).
  const outputTokenSet = tokenizeClean(outputText, STOPWORDS, SAFE_WORDS);
  const sourceTokenSet = tokenizeClean(sourceText, STOPWORDS, SAFE_WORDS);

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

  // Novel token diff — already computed above, reuse.
  const novelTokens: string[] = [];
  for (const token of outputTokenSet) {
    if (!sourceTokenSet.has(token)) {
      novelTokens.push(token);
    }
  }

  novelTokens.sort();

  const novelRatio = outputTokenSet.size > 0 ? novelTokens.length / outputTokenSet.size : 0;
  const countTriggered = novelTokens.length >= NOVEL_ENTITY_THRESHOLD;
  const ratioTriggered =
    novelTokens.length >= NOVEL_RATIO_MIN_COUNT && novelRatio >= NOVEL_ENTITY_RATIO_THRESHOLD;

  if (countTriggered || ratioTriggered) {
    const limitedNovelTokens = novelTokens.slice(0, MAX_REPORTED_ENTITIES);

    return {
      contaminated: true,
      offendingEntities: limitedNovelTokens,
      reasons: [
        `Novel token count ${novelTokens.length}/${outputTokenSet.size} and ratio ${novelRatio.toFixed(2)} exceeded contamination threshold`,
        ...limitedNovelTokens.map((token) => `Novel token not in source: ${token}`),
      ],
    };
  }

  return {
    contaminated: false,
    offendingEntities: [],
    reasons: [],
  };
}
