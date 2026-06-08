/**
 * Candidate Hydration Pass — RevisionGrade
 *
 * Post-ledger enrichment step: for each revision opportunity that SLAE blocked
 * (no explicit candidate prose from the evaluation pipeline), call OpenAI once
 * (batched) to generate manuscript-ready A/B/C candidates, then validate each
 * through the same SLAE rules before accepting.
 *
 * Contract:
 * - Fire-and-forget: any failure leaves opportunities blocked rather than
 *   shipping unvalidated prose. The caller must not throw on hydration failure.
 * - SLAE-compliant: candidates that echo the anchor or are too short are
 *   discarded. All three must pass for an opportunity to be marked supported.
 * - Idempotent from the ledger's perspective: the caller controls whether to
 *   call hydration again once candidates are already populated.
 */

import OpenAI from 'openai';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Model used for candidate generation. Override with EVAL_HYDRATION_MODEL env var. */
const HYDRATION_MODEL = process.env.EVAL_HYDRATION_MODEL ?? 'gpt-4o-mini';
/** Hard cap on completion tokens per batch call. */
const HYDRATION_MAX_TOKENS = 6000;
/** Per-call timeout — generous enough for 15 opportunities, strict enough to not starve the serverless function. */
const HYDRATION_TIMEOUT_MS = 45_000;
/** Max opportunities to send in one OpenAI call (token budget guard). */
export const HYDRATION_MAX_BATCH_SIZE = 15;
/** Minimum word count a candidate must meet to pass SLAE. */
const SLAE_MIN_WORDS = 5;

// ── Input / output types ─────────────────────────────────────────────────────

export type HydrationOpportunity = {
  opportunity_id: string;
  evidence_anchor: string;
  rationale: string;
  revision_operation?: string;
};

export type HydrationCandidates = {
  candidate_text_a: string;
  candidate_text_b: string;
  candidate_text_c: string;
};

export type HydrationResult = {
  /** Number of opportunities for which all three candidates passed SLAE. */
  hydratedCount: number;
  /** Number of opportunities skipped because they exceeded MAX_BATCH_SIZE. */
  skippedCount: number;
  /** Map from opportunity_id → validated candidates. Only contains entries where A/B/C all passed. */
  candidates: Map<string, HydrationCandidates>;
};

// ── SLAE-equivalent validation ────────────────────────────────────────────────
// Mirrors the rules in explicitCandidateOrFallback / candidateEchoesAnchor
// in opportunityLedger.ts. Any change to those rules must be reflected here.

function normalizeProse(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function candidateEchoesAnchor(candidate: string, anchor: string): boolean {
  if (candidate.length < 20 || anchor.length < 20) return false;
  const normCandidate = normalizeProse(candidate);
  const normAnchor = normalizeProse(anchor);
  return normCandidate.length >= 20 && normAnchor.includes(normCandidate);
}

/** Returns the validated candidate string, or empty string if it fails SLAE. */
function slaeValidate(raw: unknown, anchor: string, rationale: string): string {
  if (typeof raw !== 'string') return '';
  const text = raw.trim();
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length < SLAE_MIN_WORDS) return '';
  if (text.toLowerCase() === rationale.trim().toLowerCase()) return '';
  if (candidateEchoesAnchor(text, anchor)) return '';
  return text;
}

// ── Prompt construction ───────────────────────────────────────────────────────

const SYSTEM_MESSAGE =
  'You are a literary manuscript editor. ' +
  'Your task is to produce precise, copy-paste-ready prose revision candidates. ' +
  'Output only valid JSON — no markdown fences, no explanations, no preamble.';

function buildUserMessage(opportunities: HydrationOpportunity[]): string {
  const items = opportunities
    .map(
      (o, i) =>
        `OPPORTUNITY ${i + 1}\n` +
        `id: ${JSON.stringify(o.opportunity_id)}\n` +
        `Excerpt to revise:\n"${o.evidence_anchor.slice(0, 500)}"\n` +
        `Editorial recommendation: ${o.rationale.slice(0, 300)}` +
        (o.revision_operation ? `\nRevision type: ${o.revision_operation}` : ''),
    )
    .join('\n---\n');

  return `For each opportunity below, produce 3 distinct, manuscript-ready prose revision candidates.

Rules:
- Every candidate must be ≥ 20 words
- Every candidate (A, B, C) must differ in approach, tone, or specifics
- Do NOT simply repeat or lightly paraphrase the excerpt
- Write complete, fluent prose that a human editor would accept as-is
- For insert_before_selected_passage / insert_after_selected_passage: write NEW text to insert; do not copy the excerpt
- For compress_selected_passage: write a tighter, more concise version of the excerpt
- For all other operations: rewrite the excerpt to address the editorial recommendation

${items}

Return ONLY this JSON object (no other text):
{
  "results": [
    {
      "id": "<opportunity_id exactly as given>",
      "candidate_a": "<manuscript-ready prose>",
      "candidate_b": "<manuscript-ready prose>",
      "candidate_c": "<manuscript-ready prose>"
    }
  ]
}`;
}

// ── Main hydration function ───────────────────────────────────────────────────

/**
 * Generate A/B/C revision candidates for blocked opportunities via a single
 * batched OpenAI call. Returns a Map from opportunity_id → validated candidates.
 *
 * @param blocked  Opportunities with missing/blocked candidates.
 * @param openaiApiKey  Caller-supplied key; must not be empty.
 * @returns HydrationResult — always resolves, never rejects.
 */
export async function hydrateLedgerCandidates(
  blocked: HydrationOpportunity[],
  openaiApiKey: string,
): Promise<HydrationResult> {
  const candidates = new Map<string, HydrationCandidates>();

  if (blocked.length === 0) {
    return { hydratedCount: 0, skippedCount: 0, candidates };
  }

  const batch = blocked.slice(0, HYDRATION_MAX_BATCH_SIZE);
  const skippedCount = blocked.length - batch.length;

  try {
    const openai = new OpenAI({
      apiKey: openaiApiKey,
      timeout: HYDRATION_TIMEOUT_MS,
      maxRetries: 1,
    });

    const completion = await openai.chat.completions.create({
      model: HYDRATION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: buildUserMessage(batch) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: HYDRATION_MAX_TOKENS,
    });

    const rawContent = completion.choices[0]?.message?.content ?? '';
    if (!rawContent) {
      console.warn('[CandidateHydration] OpenAI returned empty content');
      return { hydratedCount: 0, skippedCount, candidates };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawContent) as Record<string, unknown>;
    } catch {
      console.warn('[CandidateHydration] Failed to parse OpenAI response as JSON');
      return { hydratedCount: 0, skippedCount, candidates };
    }

    const results = Array.isArray(parsed.results) ? parsed.results : [];
    let hydratedCount = 0;

    for (const item of results) {
      if (typeof item !== 'object' || item === null) continue;
      const r = item as Record<string, unknown>;

      const id = typeof r.id === 'string' ? r.id.trim() : null;
      if (!id) continue;

      const opp = batch.find((o) => o.opportunity_id === id);
      if (!opp) continue;

      const a = slaeValidate(r.candidate_a, opp.evidence_anchor, opp.rationale);
      const b = slaeValidate(r.candidate_b, opp.evidence_anchor, opp.rationale);
      const c = slaeValidate(r.candidate_c, opp.evidence_anchor, opp.rationale);

      if (a && b && c) {
        candidates.set(id, {
          candidate_text_a: a,
          candidate_text_b: b,
          candidate_text_c: c,
        });
        hydratedCount++;
      }
    }

    return { hydratedCount, skippedCount, candidates };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[CandidateHydration] OpenAI call failed (non-fatal):', message);
    return { hydratedCount: 0, skippedCount, candidates };
  }
}
