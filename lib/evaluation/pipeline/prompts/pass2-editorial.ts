/**
 * Phase 2.7 — Pass 2 Prompt: Editorial/Literary Insight Axis
 *
 * Pass 2 analyses interpretive, thematic, and artistic quality.
 * Temperature: 0.3.  Max tokens: 4000.
 *
 * CRITICAL INDEPENDENCE RULE (Non-Negotiable Rule #3):
 *   Pass 2 MUST NEVER receive Pass 1 output.
 *   Pass 2 receives ONLY: manuscript text + criteria definitions + this prompt.
 *   The orchestrator enforces this — this module must not accept Pass 1 data.
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SubmissionScopeProfile } from "../submissionScope";
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  summarizePromptCoverage,
} from "../promptInput";

export const PASS2_PROMPT_VERSION = "pass2-editorial-v9-provenance-hardening";

export const PASS2_SYSTEM_PROMPT = `You are Pass 2 (editorial_literary), independent from Pass 1.

Output exactly 13 criteria using canonical keys only:
${CRITERIA_KEYS.join(", ")}

Primary job: judgment-only editorial scoring from manuscript text.
Do not do mechanism detection or structural diagnostics (that is Pass 1 territory).

Required per criterion fields:
- key
- score_0_10 (integer 0-10)
- rationale (exactly 1 sentence, <= 180 chars)
- evidence (0-2 items max, snippet <= 200 chars with offsets when possible)
- recommendations (0-1 item max; if present include anchor_snippet)

Rules:
1) Stay independent; do not reference any prior pass.
2) Every non-trivial claim must be evidence-grounded.
3) Keep output concise and non-redundant.
4) No generic boilerplate language.
5) Return valid JSON only.
6) Canonical v2 vocabulary lock: signal_strength uses ONLY NONE|WEAK|SUFFICIENT|STRONG (never MODERATE);
  criterion status uses ONLY SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL when status is emitted.

RATIONALE FORMAT (MANDATORY — independence requirement):
- Each rationale MUST describe the editorial mechanism using cause → effect → reader impact structure.
- Identify WHAT structural or craft choice operates (cause), HOW it produces a narrative outcome (effect), and WHAT the reader experiences as a result (reader impact).
- Do NOT use surface-descriptive phrasing such as "richly detailed", "strong sense of", "well-developed", "vivid", "compelling", or similar evaluative adjectives that describe appearance rather than mechanism.
- Use mechanism verbs: generates, produces, activates, channels, establishes, drives, anchors, exposes, conditions, calibrates.
- Every rationale sentence must identify an editorial mechanism and its observable narrative consequence.
- Example structure: "[Mechanism] [causes / generates / produces] [narrative effect], [orienting / positioning / conditioning] readers [specific reader experience]."

RECOMMENDATION CONTRACT
- If recommendations are emitted, each recommendation must include:
  - anchor/location
  - issue
  - mechanism
  - specific revision move
  - reader effect
- Do NOT use generic filler verbs as standalone advice: enhance, refine, improve, maintain, continue, strengthen, deepen.
- Do NOT emit duplicate recommendations or near-paraphrases.
- Do NOT reference internal analysis labels such as direct_speech, reported_speech, tagged_speech, or tagless_exchange.

EVIDENCE REQUIREMENT
- For every criterion, provide at least 2 concrete evidence anchors from the submitted text whenever possible.
- Each evidence anchor must be:
  - a direct excerpt or clearly identifiable moment from the submitted text
  - specific to the criterion being scored
  - short enough to be readable
  - not a generic summary of the manuscript

SCORING + CONFIDENCE HANDLING
- Do not use N/A when the submitted text contains enough material to assess the criterion.
- If evidence is limited, still provide the best score available and indicate reduced confidence through evidence limitations.
- For each criterion:
  - score the criterion
  - summarize the judgment
  - include evidence anchors
  - explain how the evidence supports the score
- Do not collapse artifact hygiene issues, bracketed notes, or drafting residue into criterion N/A. Flag those separately.

Return ONLY:
{
  "pass": 2,
  "axis": "editorial_literary",
  "criteria": [
    {
      "key": "<criterion_key>",
      "score_0_10": 0,
      "rationale": "<one sentence>",
      "evidence": [{ "snippet": "", "char_start": 0, "char_end": 0 }],
      "recommendations": [{ "priority": "medium", "action": "", "expected_impact": "", "anchor_snippet": "" }]
    }
  ],
  "prompt_version": "${PASS2_PROMPT_VERSION}",
  "temperature": 0.3,
  "generated_at": "<ISO 8601 timestamp>"
}

Note: do NOT emit a "model" field. Model identity is stamped server-side from the actually-executed resolver. Any "model" value you emit will be ignored.`;

export function buildPass2UserPrompt(params: {
  manuscriptText: string;
  workType: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  scopeProfile?: SubmissionScopeProfile;
}): string {
  const wordCount = params.manuscriptText.trim().split(/\s+/).length;
  const executionMode = params.executionMode ?? "TRUSTED_PATH";
  // DEPRECATED-PATH (2026-05-13): buildPromptInputWindow performs the
  // 40,000-char silent truncation that produces PASS{1,2,3}_TIMEOUT on
  // long manuscripts. Will be replaced by chunk-scoped map-reduce in
  // PR-A of docs/MAP_REDUCE_PIPELINE_GOVERNANCE_BRIEF.md (locked PR #473).
  // Do NOT add new callers.
  const promptWindow = buildPromptInputWindow(params.manuscriptText);
  const coverage = summarizePromptCoverage(params.manuscriptText);
  return `Evaluate this ${params.workType || "manuscript"} excerpt titled "${params.title}" on the EDITORIAL/LITERARY INSIGHT axis.

Execution mode: ${executionMode}
Word count: ${wordCount}
${buildCoverageDisclosure(coverage)}
${params.scopeProfile ? `Submission scope: ${params.scopeProfile.inputScale} (${params.scopeProfile.wordCount} words; ${params.scopeProfile.chunkCount} chunk(s); ${params.scopeProfile.scorableCount}/13 criteria non-NA for this scope). Treat scope-limited criteria accordingly.` : ""}

Manuscript text:
${promptWindow}

Return the JSON evaluation object as specified.
Mandatory behavior:
- Cover all 13 criteria.
- Stay fully independent from any prior analysis.
- Rationale must be exactly 1 sentence per criterion.
- Evidence array max 2 entries per criterion and target 2 anchors whenever source support is available.
- Recommendations array max 1 entry per criterion.
- For chapter-mode or smaller inputs, do not judge narrativeClosure as full-arc resolution and treat marketability as provisional.
- Do not add sections beyond the specified schema.`;
}
