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
import { buildEnglishVariantPromptBlock } from '@/lib/evaluation/englishVariant';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Model used for candidate generation. Override with EVAL_HYDRATION_MODEL env var. */
export const HYDRATION_MODEL = process.env.EVAL_HYDRATION_MODEL ?? 'gpt-5.1';
/** Version identifier for hydration prompt contract (never include prompt text in telemetry). */
export const HYDRATION_PROMPT_VERSION = 'candidate_hydration_v2_premium_prose' as const;
/** Hard cap on completion tokens per batch call. */
const HYDRATION_MAX_TOKENS = 8000;
/** Per-call timeout — generous enough for one batch, strict enough not to starve the serverless function. */
const HYDRATION_TIMEOUT_MS = 60_000;
/**
 * Max opportunities sent in a single OpenAI call (token budget guard).
 * Prose generation quality collapses when too many unrelated cards are batched.
 * Keep batches small so the model can attend to local context and voice.
 */
export const HYDRATION_MAX_BATCH_SIZE = 3;
/** Minimum word count a candidate must meet to pass SLAE. */
const SLAE_MIN_WORDS = 5;

// ── Input / output types ─────────────────────────────────────────────────────

export type HydrationOpportunity = {
  opportunity_id: string;
  evidence_anchor: string;
  rationale: string;
  revision_operation?: string;
  /** Evaluation mode contract; TESTIMONY receives stricter memoir-safety checks. */
  evaluation_mode?: string;
  /** Surrounding manuscript paragraph/chunk containing the anchor. Improves SLAE pass rate. */
  manuscript_context?: string;
  /** Evaluate-time selected English variant for generated candidate prose. */
  english_variant?: string;
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
  /** Map from opportunity_id → hydration-specific rejection reason code. */
  rejectionReasons?: Map<string, string>;
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

function contentTokenSet(raw: string): Set<string> {
  const stop = new Set([
    'about', 'after', 'again', 'against', 'before', 'being', 'between', 'could', 'every', 'from', 'have', 'into',
    'more', 'should', 'that', 'their', 'there', 'these', 'this', 'those', 'through', 'with', 'would', 'while',
    'where', 'which', 'when', 'what', 'will', 'without', 'within', 'because', 'passage', 'selected', 'revision',
  ]);
  return new Set(
    normalizeProse(raw)
      .split(' ')
      .filter((token) => token.length >= 4 && !stop.has(token)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = contentTokenSet(a);
  const bTokens = contentTokenSet(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap / Math.min(aTokens.size, bTokens.size);
}

function candidateEchoesAnchor(candidate: string, anchor: string): boolean {
  if (candidate.length < 20 || anchor.length < 20) return false;
  const normCandidate = normalizeProse(candidate);
  const normAnchor = normalizeProse(anchor);
  return normCandidate.length >= 20 && (
    normAnchor.includes(normCandidate) ||
    normCandidate.includes(normAnchor) ||
    tokenOverlapRatio(candidate, anchor) >= 0.82
  );
}

function looksLikeEditorialAdvice(text: string): boolean {
  // Match multi-word editorial/analytical phrases, not single literary words that
  // appear in valid manuscript prose (e.g. "narrative", "theme", "tension").
  // A character saying "the tension was too high" is prose, not advice.
  return /\b(the reader (?:will|would|should|can|might)|reader experience|narrative arc should|narrative tension should|this (?:shows|demonstrates|illustrates|reveals|creates|builds)|this would (?:improve|strengthen|enhance|create)|scene should (?:be|have|include)|the manuscript|the criterion|the diagnostic|craft-level|revision opportunity|prose control|thematic resonance should|on the page)\b/i.test(text);
}

function looksLikeGenericLiteraryFiller(text: string): boolean {
  return /\b(moment (?:tightened|claimed|held|shifted)|air (?:still|tightened|changed)|weight (?:settled|registered)|looked away first|hesitated,? and|small delay told|pressure of the moment|kept the air still|moment to claim its price)\b/i.test(text);
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
  if (looksLikeEditorialAdvice(text)) return '';
  if (looksLikeGenericLiteraryFiller(text)) return '';
  return text;
}

function hasDirectSpeech(raw: string): boolean {
  return /["\u201c][^"\u201d]{2,}["\u201d]/u.test(raw);
}

function hasDialogueIntent(opportunity: HydrationOpportunity): boolean {
  return /\b(dialogue|conversation|exchange|direct interaction|spoken|line of dialogue|scene with dialogue)\b/i.test(
    `${opportunity.rationale} ${opportunity.revision_operation ?? ''}`,
  );
}

function candidatesAreDistinct(candidates: string[]): boolean {
  const sets = candidates.map(contentTokenSet);
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      if (jaccardSimilarity(sets[i], sets[j]) >= 0.6) return false;
    }
  }
  return true;
}

function candidatesSatisfyRes(opportunity: HydrationOpportunity, candidates: string[]): boolean {
  if (!candidatesAreDistinct(candidates)) return false;

  if (
    (opportunity.revision_operation === 'insert_before_selected_passage' ||
      opportunity.revision_operation === 'insert_after_selected_passage') &&
    candidates.some((candidate) => tokenOverlapRatio(candidate, opportunity.evidence_anchor) >= 0.55)
  ) {
    return false;
  }

  if (
    opportunity.evaluation_mode === 'TESTIMONY' &&
    hasDialogueIntent(opportunity) &&
    !hasDirectSpeech(opportunity.evidence_anchor) &&
    candidates.some(hasDirectSpeech)
  ) {
    return false;
  }

  return true;
}

// ── Prompt construction ───────────────────────────────────────────────────────

const SYSTEM_MESSAGE =
  'You are a senior literary line editor producing premium, copy-ready manuscript revision candidates. ' +
  'You are not writing advice, analysis, summary, explanation, or generic literary filler. ' +
  'Every candidate must be plausible prose that could be pasted into the author\'s manuscript with minimal adjustment. ' +
  'Output only valid JSON — no markdown fences, no explanations, no preamble.';

function operationInstruction(operation?: string): string {
  switch (operation) {
    case 'insert_before_selected_passage':
      return 'Write new prose that can appear immediately BEFORE the excerpt. It must transition naturally into the excerpt and must not repeat the excerpt.';
    case 'insert_after_selected_passage':
      return 'Write new prose that can appear immediately AFTER the excerpt. It must grow from the excerpt and must not summarize or repeat it.';
    case 'compress_selected_passage':
      return 'Rewrite the excerpt more tightly while preserving its concrete content, sequence, voice, and factual boundaries.';
    case 'replace_selected_passage':
      return 'Replace the excerpt with improved manuscript prose that solves the recommendation while preserving factual content and voice.';
    default:
      return 'Produce improved manuscript prose that solves the recommendation while preserving factual content, voice, and local continuity.';
  }
}

function buildUserMessage(opportunities: HydrationOpportunity[]): string {
  const englishVariantBlock = buildEnglishVariantPromptBlock(opportunities[0]?.english_variant);
  const items = opportunities
    .map(
      (o, i) =>
        `OPPORTUNITY ${i + 1}\n` +
        `id: ${JSON.stringify(o.opportunity_id)}\n` +
        (o.manuscript_context
          ? `Local manuscript context for voice and continuity. Do not copy it unless replacing the selected excerpt:\n${o.manuscript_context.slice(0, 3500)}\n\n`
          : 'Local manuscript context: unavailable. Be conservative; do not invent facts, names, places, dialogue, dates, or numbers.\n\n') +
        `Selected excerpt / anchor:\n${JSON.stringify(o.evidence_anchor.slice(0, 1800))}\n` +
        `Revision objective, not prose to copy:\n${JSON.stringify(o.rationale.slice(0, 900))}` +
        (o.evaluation_mode ? `\nEvaluation mode: ${o.evaluation_mode}` : '') +
        (o.revision_operation ? `\nRevision type: ${o.revision_operation}` : '') +
        `\nOperation contract: ${operationInstruction(o.revision_operation)}`,
    )
    .join('\n---\n');

  return `For each opportunity below, produce exactly 3 distinct, manuscript-ready prose candidates.

${englishVariantBlock}

Hard rules:
- Return prose only inside candidate_a/b/c. Do not return advice, diagnosis, rationale, summary, bullets, labels, or explanations.
- No generic literary filler. Avoid canned lines such as: "the moment tightened," "the air went still," "he looked away first," "the weight settled," or similar vague atmospheric padding.
- No unsupported facts. Do not invent new names, places, dates, numbers, dialogue, motives, or events.
- Preserve author voice, tense, POV, factual boundaries, and local continuity.
- Each candidate must be concrete, scene-aware, and different in strategy.
- Every candidate must be 18–70 words unless the revision type is compress_selected_passage.
- For insert operations, write only the insertable bridge/beat, not a rewritten version of the selected excerpt.
- For replacement/compression operations, rewrite only the selected excerpt.
- In TESTIMONY/memoir mode, never invent direct dialogue unless direct dialogue exists in the excerpt/context.

${items}

Return ONLY this JSON object (no other text):
{
  "results": [
    {
      "id": "<opportunity_id exactly as given>",
      "candidate_a": "<copy-ready manuscript prose>",
      "candidate_b": "<copy-ready manuscript prose>",
      "candidate_c": "<copy-ready manuscript prose>"
    }
  ]
}`;
}

// ── Main hydration function ───────────────────────────────────────────────────

/**
 * Generate A/B/C revision candidates for blocked opportunities.
 *
 * All blocked opportunities are processed — if there are more than
 * HYDRATION_MAX_BATCH_SIZE, the function makes sequential OpenAI calls
 * (one per chunk) until every opportunity has been attempted.
 * Any individual call failure is non-fatal: that chunk's opportunities
 * remain blocked while subsequent chunks continue.
 *
 * @param blocked  Opportunities with missing/blocked candidates.
 * @param openaiApiKey  Caller-supplied key; must not be empty.
 * @returns HydrationResult — always resolves, never rejects.
 *          `skippedCount` is always 0 (all opportunities are attempted).
 */
export async function hydrateLedgerCandidates(
  blocked: HydrationOpportunity[],
  openaiApiKey: string,
): Promise<HydrationResult> {
  const candidates = new Map<string, HydrationCandidates>();
  const rejectionReasons = new Map<string, string>();

  if (blocked.length === 0) {
    return { hydratedCount: 0, skippedCount: 0, candidates, rejectionReasons };
  }

  const openai = new OpenAI({
    apiKey: openaiApiKey,
    timeout: HYDRATION_TIMEOUT_MS,
    maxRetries: 1,
  });

  // Split into chunks of HYDRATION_MAX_BATCH_SIZE and process each sequentially.
  let hydratedCount = 0;
  for (let offset = 0; offset < blocked.length; offset += HYDRATION_MAX_BATCH_SIZE) {
    const chunk = blocked.slice(offset, offset + HYDRATION_MAX_BATCH_SIZE);
    try {
      const completion = await openai.chat.completions.create({
        model: HYDRATION_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_MESSAGE },
          { role: 'user', content: buildUserMessage(chunk) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.25,
        max_tokens: HYDRATION_MAX_TOKENS,
      });

      const rawContent = completion.choices[0]?.message?.content ?? '';
      if (!rawContent) {
        console.warn(`[CandidateHydration] OpenAI returned empty content for chunk offset=${offset}`);
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawContent) as Record<string, unknown>;
      } catch {
        console.warn(`[CandidateHydration] Failed to parse OpenAI response as JSON for chunk offset=${offset}`);
        continue;
      }

      const results = Array.isArray(parsed.results) ? parsed.results : [];

      for (const item of results) {
        if (typeof item !== 'object' || item === null) continue;
        const r = item as Record<string, unknown>;

        const id = typeof r.id === 'string' ? r.id.trim() : null;
        if (!id) continue;

        const opp = chunk.find((o) => o.opportunity_id === id);
        if (!opp) continue;

        const a = slaeValidate(r.candidate_a, opp.evidence_anchor, opp.rationale);
        const b = slaeValidate(r.candidate_b, opp.evidence_anchor, opp.rationale);
        const c = slaeValidate(r.candidate_c, opp.evidence_anchor, opp.rationale);

        if (a && b && c && candidatesSatisfyRes(opp, [a, b, c])) {
          candidates.set(id, {
            candidate_text_a: a,
            candidate_text_b: b,
            candidate_text_c: c,
          });
          hydratedCount++;
          rejectionReasons.delete(id);
          continue;
        }

        const rawCandidates = [r.candidate_a, r.candidate_b, r.candidate_c];
        const anyEchoOverlap = rawCandidates.some(
          (candidate) => typeof candidate === 'string' && tokenOverlapRatio(candidate, opp.evidence_anchor) >= 0.55,
        );
        const anyGenericFiller = rawCandidates.some(
          (candidate) => typeof candidate === 'string' && looksLikeGenericLiteraryFiller(candidate),
        );
        const anyAdvice = rawCandidates.some(
          (candidate) => typeof candidate === 'string' && looksLikeEditorialAdvice(candidate),
        );
        const hasMissingCandidate = !a || !b || !c;

        if (anyGenericFiller) {
          rejectionReasons.set(id, 'hydration_candidate_rejected_generic_filler');
        } else if (anyAdvice) {
          rejectionReasons.set(id, 'hydration_candidate_rejected_advice_not_prose');
        } else if (anyEchoOverlap) {
          rejectionReasons.set(id, 'hydration_candidate_rejected_overlap');
        } else if (hasMissingCandidate) {
          rejectionReasons.set(id, 'hydration_candidate_rejected_incomplete');
        } else {
          rejectionReasons.set(id, 'hydration_candidate_rejected_quality');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[CandidateHydration] OpenAI call failed for chunk offset=${offset} (non-fatal):`, message);
      // Continue to the next chunk rather than aborting entirely.
    }
  }

  return {
    hydratedCount,
    skippedCount: 0,
    candidates,
    rejectionReasons,
  };
}
