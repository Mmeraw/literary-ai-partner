/**
 * Pass 3A — Preflight Reducer Prompt
 *
 * Single LLM call receiving 6 zone summaries (TypeScript-aggregated from chunk observations).
 * Produces Pass3PreflightDraft: holistic scores for all 13 criteria, character/object
 * observations, arbitration questions for Pass 3B.
 *
 * Contract:
 *   - Input: 6 act-zone summaries (~3000 chars each, ~18k total) — no raw chunk text
 *   - Output: Pass3PreflightDraft JSON (WITHOUT manuscript_read_status — caller injects)
 *   - Temperature: 0.4
 *   - NO ledger, NO Pass 1, NO Pass 2
 *   - Scores ARE emitted here (holistic, provisional — not final)
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { Pass3AActZone } from "../types";

export const PASS3A_REDUCER_PROMPT_VERSION = "pass3a-preflight-reducer-v1";
export const PASS3A_REDUCER_TEMPERATURE = 0.4;

export const PASS3A_REDUCER_SYSTEM_PROMPT = `You are Pass 3A: the independent manuscript reader completing your holistic assessment.

You have finished reading the manuscript. You now have act-zone summaries of your observations.
Synthesize these into a holistic evaluation of all 13 criteria.

AUTHORITY RULES:
- You score PROVISIONALLY. These are your independent reads before seeing Pass 1 and Pass 2.
- Score 0-10 integer. Null is allowed ONLY if you have zero evidence for that criterion.
- Confidence rules for multi-chunk (novel-length): "high" (≥3 zones with evidence), "moderate" (1-2 zones), "low" (<1 zone or thin evidence).
- Confidence rules for short-form (chapter/excerpt, ≤2 chunks): A single zone with genuine evidence warrants "moderate" or "high" confidence. Do NOT penalize short-form manuscripts for having only one zone.
- narrativeClosure: For novels, REQUIRES evidence from late/close act zones. For short-form chapters, evaluate the chapter's internal closure — does it land its local arc and promise?
- Novel-wide structural claims: REQUIRE evidence from at least 2 distinct zones. Short-form chapters evaluated on internal structural integrity.

CRITICAL: For short-form manuscripts, you MUST score all 13 criteria with findingStatus "scored" when evidence exists in the text. Do NOT default to "insufficient_preflight_evidence" — a chapter excerpt has the same evidence density per word as a novel.

ARBITRATION QUESTIONS:
- Flag anything you detected that contradicts stable narrative logic.
- Flag location violations (character appears where they cannot be).
- Flag name-state violations (character uses wrong name for their arc position).
- Flag promise-payoff failures (promise opened, never paid).
- Flag co-presence violations (two characters together who should be separated).
- These questions are your handoff to Pass 3B — be precise, evidence-grounded, actionable.

CHARACTER NAME AUTHORITY: NEVER use dialogue fragments or common English words as character names. Words like "No", "Yes", "Oh", "Hey", "Well", "So" are NOT character names even if the manuscript text appears to use them. Use only the canonical names from the STORY LEDGER or character observations.

DO NOT (HARD CONSTRAINTS):
- DO NOT invent findings not grounded in zone summaries. Every claim must trace to evidence you observed.
- DO NOT default every criterion to "insufficient_preflight_evidence" for short-form manuscripts. A chapter with genuine evidence warrants "scored" status.
- DO NOT conflate novel-length confidence rules with short-form confidence rules. Short-form gets moderate/high confidence from a single zone.
- DO NOT hallucinate character names, locations, or plot events. If uncertain, state "uncertain" rather than fabricating.
- DO NOT emit arbitration questions that are generic ("Is the pacing effective?"). Each must identify a specific, evidence-grounded anomaly.
- DO NOT inflate provisional scores. If evidence is thin, score conservatively and note low confidence.
- DO NOT use dialogue fragments or common words as character names in character_observations.

Return ONLY valid JSON. No markdown fences, no prose commentary.`;

export function buildPass3AReducerUserPrompt(params: {
  title: string;
  workType: string;
  zoneSummaries: Array<{
    zone: Pass3AActZone;
    chunkCount: number;
    wordCount: number;
    summary: string;       // pre-formatted zone summary, ≤3000 chars
  }>;
  totalChunksExpected: number;
  totalChunksReceived: number;
  missingChunks: number[];
}): string {
  const criteriaList = CRITERIA_KEYS.map((k, i) => `${i + 1}. ${k}`).join("\n");

  const isShortForm = params.totalChunksExpected <= 2;

  // For short-form, only include zones that have data — don't send 5 empty zones
  // that confuse the reducer into thinking coverage is incomplete.
  const activeZones = isShortForm
    ? params.zoneSummaries.filter(z => z.chunkCount > 0)
    : params.zoneSummaries;

  const zoneSummaryBlock = activeZones
    .map(z => `=== Zone: ${z.zone.toUpperCase()} (${z.chunkCount} chunk(s), ~${z.wordCount} words) ===\n${z.summary}`)
    .join("\n\n");

  const coverageNote = params.missingChunks.length > 0
    ? `WARNING: ${params.missingChunks.length} chunk(s) missing from read: [${params.missingChunks.join(", ")}]. Adjust confidence accordingly.`
    : `Full manuscript coverage: ${params.totalChunksReceived}/${params.totalChunksExpected} chunks received.`;

  const shortFormPreamble = isShortForm
    ? `\n\nSHORT-FORM MODE: This is a chapter excerpt (~${activeZones.reduce((s, z) => s + z.wordCount, 0)} words), not a full novel. All content is in a single zone. Score all 13 criteria from the available evidence — do NOT mark criteria as "insufficient_preflight_evidence" just because there is only one zone. For narrativeClosure, evaluate the chapter's internal closure (does it land its local arc?) rather than requiring novel-wide resolution. Confidence should be "moderate" or "high" when there is genuine evidence, even from a single zone.`
    : '';

  const scopeLabel = isShortForm ? 'Chapter' : 'Novel';

  return `${scopeLabel}: "${params.title}" (${params.workType})
Coverage: ${params.totalChunksReceived} of ${params.totalChunksExpected} chunks read.
${coverageNote}${shortFormPreamble}

You have read the ${isShortForm ? 'chapter' : 'entire novel'} in act-zone chunks. Below are your aggregated observations by zone.

${zoneSummaryBlock}

---

Now produce your holistic Pass 3A Preflight Draft. Return a JSON object with this exact shape:

{
  "criterionDrafts": [
    // REQUIRED: one entry for EVERY criterion in CRITERIA_KEYS order
    {
      "criterion": "<criterion key>",
      "provisionalScore": <integer 0-10 or null if no evidence>,
      "confidence": "high" | "moderate" | "low",
      "findingStatus": "scored" | "insufficient_preflight_evidence" | "closure_requires_late_evidence",
      "rationale": "<1-2 sentence craft rationale — author-facing — max 220 chars>",
      "evidenceQuotes": ["<verbatim quote ≤80 chars>", ...],  // 0-4 quotes
      "actZonesSupporting": ["Opening" | "Early-Middle" | "Mid-Act" | "Late-Middle" | "Late" | "Close"],
      "strengthFindings": ["<max 100 chars each>"],
      "weaknessFindings": ["<max 100 chars each>"]
    }
  ],
  "whole_novel_read": {
    "premise_read": "<what this novel is about — max 200 chars>",
    "central_spine": "<the core dramatic question — max 150 chars>",
    "emotional_engine": "<what drives reader forward — max 150 chars>",
    "structural_shape": "<how the story is shaped — max 150 chars>",
    "ending_read": "<what the ending delivers — max 200 chars>",
    "promise_payoff_assessment": "<did the novel keep its promises — max 200 chars>"
  },
  "character_observations": [
    {
      "character": "<name>",
      "arc_read": "<what arc you saw — max 200 chars>",
      "name_state_notes": "<optional — note name changes and when>",
      "coping_behaviors_observed": ["<behavior — max 80 chars>"],
      "relationship_function": "<how they function in the story — max 150 chars>",
      "location_first_encountered": "<where they first appear — max 80 chars>"
    }
  ],
  "object_symbol_observations": [
    {
      "object_or_motif": "<name>",
      "observed_path": "<how it moves through the story — max 200 chars>",
      "symbolic_function": "<what it means — max 150 chars>",
      "payoff_status": "paid_off" | "underpaid" | "active" | "unclear"
    }
  ],
  "arbitrationQuestionsForPass3B": [
    {
      "question": "<specific question for Pass 3B to investigate — max 200 chars>",
      "relatedCriterion": "<criterion key or null>",
      "evidence": "<verbatim evidence ≤80 chars>",
      "implication": "<why this matters for scoring — max 150 chars>",
      "blockerType": "retrieval_failure_suspected" | "location_violation_suspected" | "name_state_violation_suspected" | "opening_overbias_suspected" | "missing_object_system_suspected" | "co_presence_violation_suspected" | "insufficient_coverage"
    }
  ],
  "coverageLimitations": [
    // only emit if genuine coverage gaps exist
    {
      "zone": "<act zone>",
      "limitation": "not_sampled" | "thin_sample" | "uncertain_chapter_mapping" | "insufficient_late_evidence",
      "consequence": "<how this affects scoring — max 120 chars>"
    }
  ],
  "independentPressurePoints": [
    // 3-8 most important novel-level observations Pass 3B should know
    "<max 150 chars each>"
  ]
}

Criteria keys (use exact strings):
${criteriaList}

Return only the JSON object. No markdown, no prose.`;
}
