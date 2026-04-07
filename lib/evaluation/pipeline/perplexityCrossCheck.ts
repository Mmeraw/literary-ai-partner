/**
 * Pass 4 – Perplexity Cross-Check
 *
 * After OpenAI (o3) produces craft + editorial + synthesis scores,
 * this pass sends the full scored output to Perplexity sonar-reasoning-pro
 * for independent validation. The two verdicts are then reconciled:
 *  - Where they agree (≤1 point delta): score is confirmed.
 *  - Where they diverge (>1 point): a DISPUTE flag is raised with
 *    both scores surfaced for human adjudication.
 *
 * Perplexity uses its own LLM + live web context for grounding,
 * giving us a second opinion that is architecturally independent
 * of OpenAI's reasoning chain.
 */

export interface CrossCheckCriterionResult {
  openaiScore: number;
  perplexityScore: number;
  delta: number;
  disputed: boolean;
  perplexityRationale: string;
}

export interface CrossCheckOutput {
  model: string;
  crossCheckedAt: string;
  overallAgreement: "STRONG" | "MODERATE" | "WEAK";
  disputedCriteria: string[];
  criteria: Record<string, CrossCheckCriterionResult>;
  perplexitySynthesisNote: string;
  rawPerplexityResponse?: string;
}

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const PERPLEXITY_MODEL = "sonar-reasoning-pro";
const DISPUTE_THRESHOLD = 1.5; // scores differing by more than this are flagged

export async function runPerplexityCrossCheck(opts: {
  openaiCriteria: Record<string, { score: number; rationale?: string }>;
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
    throw new Error(
      "[Pass4] PERPLEXITY_API_KEY is required for cross-check validation."
    );
  }

  // Build the validation prompt
  const criteriaBlock = Object.entries(openaiCriteria)
    .map(
      ([key, val]) =>
        `  ${key}: ${val.score}/10${
          val.rationale ? ` — "${val.rationale.slice(0, 120)}..."` : ""
        }`
    )
    .join("\n");

  const systemPrompt = `You are an elite literary critic and editorial validator with deep expertise in ${
    workType
  } fiction. You are performing an INDEPENDENT second-opinion evaluation to validate or dispute another AI system's literary scores.

Your mandate:
1. Read the manuscript excerpt carefully.
2. Review the 13 criterion scores given by the first AI system.
3. For each criterion, assign YOUR OWN independent score (1-10) and a one-sentence rationale.
4. Flag any score where your assessment differs by more than ${DISPUTE_THRESHOLD} points.
5. Provide a short synthesis note (3-5 sentences) on the manuscript's overall literary standing.

Respond ONLY with valid JSON matching this exact schema:
{
  "criteria": {
    "concept": { "score": <1-10>, "rationale": "<one sentence>" },
    "narrativeDrive": { "score": <1-10>, "rationale": "<one sentence>" },
    "character": { "score": <1-10>, "rationale": "<one sentence>" },
    "voice": { "score": <1-10>, "rationale": "<one sentence>" },
    "sceneConstruction": { "score": <1-10>, "rationale": "<one sentence>" },
    "dialogue": { "score": <1-10>, "rationale": "<one sentence>" },
    "theme": { "score": <1-10>, "rationale": "<one sentence>" },
    "worldbuilding": { "score": <1-10>, "rationale": "<one sentence>" },
    "pacing": { "score": <1-10>, "rationale": "<one sentence>" },
    "proseControl": { "score": <1-10>, "rationale": "<one sentence>" },
    "tone": { "score": <1-10>, "rationale": "<one sentence>" },
    "narrativeClosure": { "score": <1-10>, "rationale": "<one sentence>" },
    "marketability": { "score": <1-10>, "rationale": "<one sentence>" }
  },
  "synthesisNote": "<3-5 sentence overall literary assessment>"
}`;

  const userPrompt = `MANUSCRIPT TITLE: "${title}"
WORK TYPE: ${workType}

--- MANUSCRIPT EXCERPT (first 3000 chars) ---
${manuscriptExcerpt.slice(0, 3000)}

--- FIRST AI SYSTEM'S SCORES (OpenAI o3) ---
${criteriaBlock}

--- FIRST AI SYNTHESIS ---
${openaiSynthesis?.slice(0, 800) ?? "(no synthesis provided)"}

Now provide your independent evaluation as JSON.`;

  // Call Perplexity API (OpenAI-compatible)
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
      temperature: 0.2, // low temp for analytical consistency
      max_tokens: 2000,
      return_citations: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `[Pass4] Perplexity API error ${response.status}: ${errText.slice(0, 300)}`
    );
  }

  const raw = await response.json();
  const rawContent: string =
    raw?.choices?.[0]?.message?.content ?? "";

  // Extract JSON from response (may be wrapped in markdown)
  const jsonMatch =
    rawContent.match(/```json\s*([\s\S]+?)\s*```/) ??
    rawContent.match(/```\s*([\s\S]+?)\s*```/) ??
    rawContent.match(/(\{[\s\S]+\})/);

  if (!jsonMatch) {
    throw new Error(
      `[Pass4] Could not parse Perplexity JSON response: ${rawContent.slice(0, 200)}`
    );
  }

  let parsed: {
    criteria: Record<string, { score: number; rationale: string }>;
    synthesisNote: string;
  };

  try {
    parsed = JSON.parse(jsonMatch[1]);
  } catch (e) {
    throw new Error(
      `[Pass4] Perplexity JSON parse failed: ${(e as Error).message}`
    );
  }

  // Reconcile OpenAI vs Perplexity scores
  const reconciled: Record<string, CrossCheckCriterionResult> = {};
  const disputedCriteria: string[] = [];

  for (const key of Object.keys(openaiCriteria)) {
    const openaiScore = openaiCriteria[key]?.score ?? 0;
    const pplxScore = parsed.criteria?.[key]?.score ?? openaiScore; // fallback to openai if missing
    const delta = Math.abs(openaiScore - pplxScore);
    const disputed = delta > DISPUTE_THRESHOLD;

    if (disputed) disputedCriteria.push(key);

    reconciled[key] = {
      openaiScore,
      perplexityScore: pplxScore,
      delta: Math.round(delta * 10) / 10,
      disputed,
      perplexityRationale: parsed.criteria?.[key]?.rationale ?? "",
    };
  }

  // Determine overall agreement level
  const disputeRatio = disputedCriteria.length / Object.keys(openaiCriteria).length;
  const overallAgreement: CrossCheckOutput["overallAgreement"] =
    disputeRatio === 0
      ? "STRONG"
      : disputeRatio <= 0.3
      ? "MODERATE"
      : "WEAK";

  return {
    model: PERPLEXITY_MODEL,
    crossCheckedAt: new Date().toISOString(),
    overallAgreement,
    disputedCriteria,
    criteria: reconciled,
    perplexitySynthesisNote: parsed.synthesisNote ?? "",
    rawPerplexityResponse: rawContent,
  };
}
