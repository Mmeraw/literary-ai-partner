/**
 * Pass 4 – Perplexity Cross-Check (Hardened / Canon-Aligned)
 *
 * Purpose:
 * Independent second-opinion adjudication over the 13 Story Criteria.
 *
 * Canon alignment:
 * - Artifact-based evaluation only (no author-intent privilege)
 * - Scores must be derived from detected signals
 * - Each criterion must include evidence + reasoning
 * - Missing evidence/reasoning invalidates the criterion
 * - Divergence identifies judgment zones; agreement strengthens validity
 *
 * This pass is diagnostic/adjudicative. It does NOT perform WAVE refinement.
 */

import { parseJsonObjectBoundary, JsonBoundaryError } from "@/lib/llm/jsonParseBoundary";
import { buildJsonBoundaryEvidence } from "@/lib/llm/jsonBoundaryTelemetry";
import { persistPassEvidence } from "@/lib/llm/persistPassEvidence";

export type CriterionKey =
  | "concept"
  | "narrativeDrive"
  | "character"
  | "voice"
  | "sceneConstruction"
  | "dialogue"
  | "theme"
  | "worldbuilding"
  | "pacing"
  | "proseControl"
  | "tone"
  | "emotionalResonance"
  | "marketability";

export interface OpenAICriterionInput {
  score: number;
  rationale?: string;
  evidence?: string[];
  detectedSignals?: string[];
  scoringBand?: "1-3" | "4-6" | "7-8" | "9-10";
}

export interface Pass4EvidenceRef {
  quote: string;
  explanation: string;
}

export interface PerplexityCriterionResponse {
  score: number;
  rationale: string;
  evidence: Pass4EvidenceRef[];
  detectedSignals: string[];
  scoringBand: "1-3" | "4-6" | "7-8" | "9-10";
  doctrineTrace: string[];
}

export interface CanonValidity {
  valid: boolean;
  reasons: string[];
}

export interface CrossCheckCriterionResult {
  openaiScore: number;
  openaiRationale: string;
  openaiEvidence: string[];
  openaiDetectedSignals: string[];
  openaiScoringBand?: "1-3" | "4-6" | "7-8" | "9-10";

  perplexityScore: number | null;
  perplexityRationale: string;
  perplexityEvidence: Pass4EvidenceRef[];
  perplexityDetectedSignals: string[];
  perplexityScoringBand: "1-3" | "4-6" | "7-8" | "9-10" | null;
  perplexityDoctrineTrace: string[];

  delta: number | null;
  disputed: boolean;
  missingFromPerplexity: boolean;
  invalidPerplexityCriterion: boolean;
  canonValidity: CanonValidity;
  direction: "HIGHER" | "LOWER" | "MATCH" | "MISSING" | "INVALID";
}

export interface CrossCheckOutput {
  model: string;
  crossCheckedAt: string;
  overallAgreement: "STRONG" | "MODERATE" | "WEAK";
  disputedCriteria: CriterionKey[];
  invalidCriteria: CriterionKey[];
  criteria: Record<CriterionKey, CrossCheckCriterionResult>;
  perplexitySynthesisNote: string;
  canonValid: boolean;
  rawPerplexityResponse?: string;
}

type PerplexityResponseShape = {
  criteria: Record<CriterionKey, PerplexityCriterionResponse>;
  synthesisNote: string;
};

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const PERPLEXITY_MODEL = "sonar-reasoning-pro";
const DISPUTE_THRESHOLD = 1.0;

const CRITERION_KEYS: CriterionKey[] = [
  "concept",
  "narrativeDrive",
  "character",
  "voice",
  "sceneConstruction",
  "dialogue",
  "theme",
  "worldbuilding",
  "pacing",
  "proseControl",
  "tone",
  "emotionalResonance",
  "marketability",
];
// ── CrossCheck payload types ──────────────────────────────────────────────────

export type CrossCheckPayload = {
  criteria: Record<CriterionKey, PerplexityCriterionResponse>;
  synthesisNote: string;
};

export function isCrossCheckPayload(value: unknown): value is CrossCheckPayload {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj["criteria"] === "object" && obj["criteria"] !== null;
}

function assertScore(score: unknown, key: string): number {
  if (typeof score !== "number" || Number.isNaN(score)) {
    throw new Error(`[Pass4] Invalid numeric score for criterion '${key}'.`);
  }
  if (score < 1 || score > 10) {
    throw new Error(`[Pass4] Score out of range for criterion '${key}': ${score}`);
  }
  return score;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function isScoringBand(value: unknown): value is "1-3" | "4-6" | "7-8" | "9-10" {
  return value === "1-3" || value === "4-6" || value === "7-8" || value === "9-10";
}

function validateEvidenceArray(value: unknown): Pass4EvidenceRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const quote = typeof (item as { quote?: unknown }).quote === "string"
        ? (item as { quote: string }).quote.trim()
        : "";
      const explanation = typeof (item as { explanation?: unknown }).explanation === "string"
        ? (item as { explanation: string }).explanation.trim()
        : "";

      if (!quote || !explanation) return null;

      return { quote, explanation };
    })
    .filter((item): item is Pass4EvidenceRef => item !== null);
}
function validatePerplexityCriterion(
  key: CriterionKey,
  value: unknown
): PerplexityCriterionResponse {
  if (!value || typeof value !== "object") {
    throw new Error(`[Pass4] Criterion '${key}' missing or not an object.`);
  }

  const obj = value as Record<string, unknown>;
  const score = assertScore(obj.score, key);
  const rationale = typeof obj.rationale === "string" ? obj.rationale.trim() : "";
  const evidence = validateEvidenceArray(obj.evidence);
  const detectedSignals = asStringArray(obj.detectedSignals);
  const doctrineTrace = asStringArray(obj.doctrineTrace);
  const scoringBand = obj.scoringBand;

  if (!rationale) {
    throw new Error(`[Pass4] Criterion '${key}' missing rationale.`);
  }

  if (!isScoringBand(scoringBand)) {
    throw new Error(`[Pass4] Criterion '${key}' missing valid scoringBand.`);
  }

  return {
    score,
    rationale,
    evidence,
    detectedSignals,
    scoringBand,
    doctrineTrace,
  };
}

function validateParsedResponse(parsed: unknown): PerplexityResponseShape {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("[Pass4] Parsed response is not an object.");
  }

  const obj = parsed as Record<string, unknown>;
  const criteriaObj = obj.criteria;
  const synthesisNote = typeof obj.synthesisNote === "string" ? obj.synthesisNote : "";

  if (!criteriaObj || typeof criteriaObj !== "object") {
    throw new Error("[Pass4] Parsed response missing 'criteria'.");
  }

  const criteria = {} as Record<CriterionKey, PerplexityCriterionResponse>;

  for (const key of CRITERION_KEYS) {
    criteria[key] = validatePerplexityCriterion(
      key,
      (criteriaObj as Record<string, unknown>)[key]
    );
  }

  return { criteria, synthesisNote };
}

function bandForScore(score: number): "1-3" | "4-6" | "7-8" | "9-10" {
  if (score <= 3) return "1-3";
  if (score <= 6) return "4-6";
  if (score <= 8) return "7-8";
  return "9-10";
}

function validateCanonCompleteness(
  criterion: PerplexityCriterionResponse
): CanonValidity {
  const reasons: string[] = [];

  if (!criterion.rationale.trim()) {
    reasons.push("Missing rationale.");
  }

  if (criterion.evidence.length === 0) {
    reasons.push("Missing quoted manuscript evidence.");
  }

  if (criterion.detectedSignals.length === 0) {
    reasons.push("Missing detected signals.");
  }

  if (criterion.doctrineTrace.length === 0) {
    reasons.push("Missing doctrine trace.");
  }

  if (!isScoringBand(criterion.scoringBand)) {
    reasons.push("Missing or invalid scoring band.");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
export async function runPerplexityCrossCheck(opts: {
  openaiCriteria: Record<CriterionKey, OpenAICriterionInput>;
  openaiSynthesis: string;
  manuscriptExcerpt: string;
  workType: string;
  title: string;
  perplexityApiKey: string;
}): Promise<CrossCheckOutput> {
  const {
    openaiCriteria,
    openaiSynthesis,
    manuscriptExcerpt,
    workType,
    title,
    perplexityApiKey,
  } = opts;

  if (!perplexityApiKey) {
    throw new Error("[Pass4] PERPLEXITY_API_KEY is required.");
  }

  const criteriaBlock = CRITERION_KEYS.map((key) => {
    const item = openaiCriteria[key];
    const score = item?.score ?? 0;
    const rationale = item?.rationale?.trim()
      ? ` \u2014 "${item.rationale.slice(0, 140)}${item.rationale.length > 140 ? "..." : ""}"`
      : "";
    return `- ${key}: ${score}/10${rationale}`;
  }).join("\n");

  const systemPrompt = `You are an independent literary evaluation adjudicator performing a canon-governed second-opinion review.

Rules:
1. Evaluate the manuscript excerpt as a standalone artifact.
2. Do not use author intent.
3. Score each criterion ONLY from detected signals in the excerpt.
4. Each criterion MUST include:
   - score
   - rationale
   - at least one short quoted manuscript reference
   - detectedSignals
   - scoringBand
   - doctrineTrace
5. If evidence is absent, the criterion is invalid.
6. Do not provide revision advice.
7. Do not perform line-editing or WAVE refinement.
8. Return ONLY valid JSON.

Required schema:
{
  "criteria": {
    "concept": {
      "score": 1,
      "rationale": "string",
      "evidence": [{ "quote": "string", "explanation": "string" }],
      "detectedSignals": ["string"],
      "scoringBand": "1-3",
      "doctrineTrace": ["string"]
    },
    "narrativeDrive": { ...same shape... },
    "character": { ...same shape... },
    "voice": { ...same shape... },
    "sceneConstruction": { ...same shape... },
    "dialogue": { ...same shape... },
    "theme": { ...same shape... },
    "worldbuilding": { ...same shape... },
    "pacing": { ...same shape... },
    "proseControl": { ...same shape... },
    "tone": { ...same shape... },
    "emotionalResonance": { ...same shape... },
    "marketability": { ...same shape... }
  },
  "synthesisNote": "3-5 sentence adjudication summary"
}`;

  const userPrompt = `MANUSCRIPT TITLE: "${title}"
WORK TYPE: ${workType}

MANUSCRIPT EXCERPT (first 3000 chars):
${manuscriptExcerpt.slice(0, 3000)}

PRIMARY EVALUATOR SCORES:
${criteriaBlock}

PRIMARY EVALUATOR SYNTHESIS:
${openaiSynthesis?.slice(0, 900) ?? "(none)"}

Now return the independent adjudication as JSON.`;
  const response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${perplexityApiKey}`,
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 3000,
      return_citations: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `[Pass4] Perplexity API error ${response.status}: ${errText.slice(0, 400)}`
    );
  }

  const raw = await response.json();
  const rawContent: string = raw?.choices?.[0]?.message?.content ?? "";

  // P0: Check finish_reason — log a warning if the model stopped due to token limit
  const finishReason = raw?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    console.warn("[Pass4] finish_reason=length — Perplexity output may be truncated", {
      model: PERPLEXITY_MODEL,
      rawContentLen: rawContent.length,
    });
  }

  // P0: Log raw response preview before parse
  console.log(`[Pass4] raw Perplexity response preview len=${rawContent.length}: ${rawContent.slice(0, 200)}`);

  const boundaryResult = parseJsonObjectBoundary(rawContent, "Pass4", {
    maxRawChars: 150_000,
  });

  const boundaryEvidence = buildJsonBoundaryEvidence({
    raw: boundaryResult.raw,
    normalized: boundaryResult.normalized,
    candidate: boundaryResult.candidate,
    candidatesFound: boundaryResult.candidatesFound,
    parseFailureCode: boundaryResult.ok === false ? boundaryResult.error.code : null,
    parseFailureMessage: boundaryResult.ok === false ? boundaryResult.error.message : null,
    telemetry: {
      provider: "perplexity",
      model: PERPLEXITY_MODEL,
      finishReason: typeof finishReason === "string" ? finishReason : undefined,
      promptTokens: raw?.usage?.prompt_tokens,
      completionTokens: raw?.usage?.completion_tokens,
      totalTokens: raw?.usage?.total_tokens,
      latencyMs: undefined,
    },
  });

  persistPassEvidence({
    pass: "pass4",
    status: boundaryResult.ok ? "ok" : "failed",
    evidence: boundaryEvidence as unknown as Record<string, unknown>,
  });

  if (boundaryResult.ok === false) {
    throw new Error(
      `[Pass4] CROSSCHECK_JSON_BOUNDARY_FAILED: ${boundaryResult.error.message}`
    );
  }

  let parsed: PerplexityResponseShape;
  try {
    parsed = validateParsedResponse(boundaryResult.value);
  } catch (error) {
    if (error instanceof JsonBoundaryError) throw error;
    throw new Error(
      `[Pass4] JSON parse/validation failed: ${(error as Error).message}`
    );
  }

  const criteria = {} as Record<CriterionKey, CrossCheckCriterionResult>;
  const disputedCriteria: CriterionKey[] = [];
  const invalidCriteria: CriterionKey[] = [];

  for (const key of CRITERION_KEYS) {
    const openaiItem = openaiCriteria[key];
    const openaiScore = assertScore(openaiItem?.score ?? 0, key);
    const openaiRationale = openaiItem?.rationale ?? "";
    const openaiEvidence = openaiItem?.evidence ?? [];
    const openaiDetectedSignals = openaiItem?.detectedSignals ?? [];
    const openaiScoringBand = openaiItem?.scoringBand ?? bandForScore(openaiScore);

    const pplx = parsed.criteria[key];

    if (!pplx) {
      invalidCriteria.push(key);
      disputedCriteria.push(key);

      criteria[key] = {
        openaiScore,
        openaiRationale,
        openaiEvidence,
        openaiDetectedSignals,
        openaiScoringBand,
        perplexityScore: null,
        perplexityRationale: "",
        perplexityEvidence: [],
        perplexityDetectedSignals: [],
        perplexityScoringBand: null,
        perplexityDoctrineTrace: [],
        delta: null,
        disputed: true,
        missingFromPerplexity: true,
        invalidPerplexityCriterion: true,
        canonValidity: {
          valid: false,
          reasons: ["Criterion missing from Perplexity response."],
        },
        direction: "MISSING",
      };
      continue;
    }

    const canonValidity = validateCanonCompleteness(pplx);
    const invalidPerplexityCriterion = !canonValidity.valid;
    const perplexityScore = invalidPerplexityCriterion ? null : pplx.score;
    const delta =
      perplexityScore === null ? null : Math.abs(openaiScore - perplexityScore);
    const disputed =
      invalidPerplexityCriterion || delta === null || delta > DISPUTE_THRESHOLD;

    if (invalidPerplexityCriterion) {
      invalidCriteria.push(key);
    }
    if (disputed) {
      disputedCriteria.push(key);
    }

    criteria[key] = {
      openaiScore,
      openaiRationale,
      openaiEvidence,
      openaiDetectedSignals,
      openaiScoringBand,
      perplexityScore,
      perplexityRationale: pplx.rationale,
      perplexityEvidence: pplx.evidence,
      perplexityDetectedSignals: pplx.detectedSignals,
      perplexityScoringBand: pplx.scoringBand,
      perplexityDoctrineTrace: pplx.doctrineTrace,
      delta: delta === null ? null : Math.round(delta * 10) / 10,
      disputed,
      missingFromPerplexity: false,
      invalidPerplexityCriterion,
      canonValidity,
      direction:
        invalidPerplexityCriterion || perplexityScore === null
          ? "INVALID"
          : perplexityScore > openaiScore
            ? "HIGHER"
            : perplexityScore < openaiScore
              ? "LOWER"
              : "MATCH",
    };
  }

  const disputeRatio = disputedCriteria.length / CRITERION_KEYS.length;
  const overallAgreement: CrossCheckOutput["overallAgreement"] =
    disputeRatio === 0 ? "STRONG" : disputeRatio <= 0.3 ? "MODERATE" : "WEAK";

  return {
    model: PERPLEXITY_MODEL,
    crossCheckedAt: new Date().toISOString(),
    overallAgreement,
    disputedCriteria,
    invalidCriteria,
    criteria,
    perplexitySynthesisNote: parsed.synthesisNote ?? "",
    canonValid: invalidCriteria.length === 0,
    rawPerplexityResponse: rawContent,
  };
}
