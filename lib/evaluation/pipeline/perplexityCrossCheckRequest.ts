/**
 * Pass 4 Perplexity request builders.
 *
 * Extracted from perplexityCrossCheck.ts to keep that file under 1000 lines
 * after the structured observability plumb-through. Pure helpers, no behavior
 * change.
 */

export function buildRefusalRetryUserPrompt(originalUserPrompt: string): string {
  return `${originalUserPrompt}

IMPORTANT — RE-FRAMING:
This is NOT a web research task. You are NOT being asked to look anything up.
This is a STRUCTURED ANALYSIS task over the manuscript text provided above.
You are scoring 13 craft criteria from signals you detect IN THE EXCERPT.
Do not refuse. Do not say "I am search-based." Do not write disclaimers.
Return ONLY the JSON object specified by the schema. No prose before or after.`;
}

export function buildPerplexityResponseSchema(
  criterionKeys: readonly string[],
): Record<string, unknown> {
  const criterionSchema: Record<string, unknown> = {
    type: "object",
    additionalProperties: false,
    properties: {
      score: { type: "number", minimum: 1, maximum: 10 },
      rationale: { type: "string", minLength: 1 },
      evidence: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            quote: { type: "string", minLength: 1 },
            explanation: { type: "string", minLength: 1 },
          },
          required: ["quote", "explanation"],
        },
      },
      detectedSignals: { type: "array", items: { type: "string" } },
      scoringBand: { type: "string", enum: ["1-3", "4-6", "7-8", "9-10"] },
      doctrineTrace: { type: "array", items: { type: "string" } },
    },
    required: [
      "score",
      "rationale",
      "evidence",
      "detectedSignals",
      "scoringBand",
      "doctrineTrace",
    ],
  };

  const criteriaProps: Record<string, unknown> = {};
  for (const key of criterionKeys) {
    criteriaProps[key] = criterionSchema;
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      criteria: {
        type: "object",
        additionalProperties: false,
        properties: criteriaProps,
        required: [...criterionKeys],
      },
      synthesisNote: { type: "string", minLength: 1 },
    },
    required: ["criteria", "synthesisNote"],
  };
}
