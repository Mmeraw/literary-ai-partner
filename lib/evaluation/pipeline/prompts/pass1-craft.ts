/**
 * Phase 2.7 — Pass 1 Prompt: Craft Execution Axis
 *
 * Pass 1 analyses structural, technical, and mechanical craft quality.
 * Temperature: 0.3.  Max tokens: 4000.
 * Independence guarantee: Pass 1 output is NEVER sent to Pass 2.
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  summarizePromptCoverage,
} from "../promptInput";

export const PASS1_PROMPT_VERSION = "pass1-craft-v7-bounded";

export const PASS1_SYSTEM_PROMPT = `You are Pass 1 (craft_execution) in compatibility mode.

Output exactly 13 criteria using canonical keys only:
${CRITERIA_KEYS.join(", ")}

Primary job: bounded craft-signal extraction, not long-form critique.
For each criterion, identify the strongest craft signal and anchor it with one concrete text excerpt when possible.

Required per criterion fields (for downstream compatibility):
- key
- score_0_10 (integer 0-10, minimal/non-authoritative)
- rationale (exactly 1 sentence, <= 160 chars)
- evidence (0-1 item, snippet <= 180 chars with char_start/char_end when possible)
- recommendations (always [])

Rules:
1) Evidence must be manuscript-grounded; no generic claims.
2) No editorial/thematic market commentary; stay craft-mechanical.
3) No contradiction without explicit contextual split.
4) Keep output concise and operational.
5) Use only valid JSON, no markdown.
6) Do not provide recommendations in Pass 1. Pass 1 is extraction-only.
7) Canonical v2 vocabulary lock: signal_strength uses ONLY NONE|WEAK|SUFFICIENT|STRONG (never MODERATE);
  criterion status uses ONLY SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL when status is emitted.

EVIDENCE REQUIREMENT
- For every criterion, provide at most 1 concrete evidence anchor from the submitted text.
- Prefer one short direct excerpt or clearly identifiable moment.
- If no reliable anchor exists for a criterion, use an empty evidence array rather than padding.

SCORING + CONFIDENCE HANDLING
- Do not use N/A when the submitted text contains enough material to assess the criterion.
- If evidence is limited, still provide the best score available and keep rationale bounded.
- Do not collapse artifact hygiene issues, bracketed notes, or drafting residue into criterion N/A. Flag those separately only if the schema already supports it.

Return ONLY:
{
  "pass": 1,
  "axis": "craft_execution",
  "criteria": [
    {
      "key": "<criterion_key>",
      "score_0_10": 0,
      "rationale": "<one sentence <=160 chars>",
      "evidence": [{ "snippet": "", "char_start": 0, "char_end": 0 }],
      "recommendations": []
    }
  ],
  "model": "<model_id>",
  "prompt_version": "${PASS1_PROMPT_VERSION}",
  "temperature": 0.3,
  "generated_at": "<ISO 8601 timestamp>"
}
Do not add sections beyond the specified schema.`;

export function buildPass1UserPrompt(params: {
  manuscriptText: string;
  workType: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
}): string {
  const wordCount = params.manuscriptText.trim().split(/\s+/).length;
  const executionMode = params.executionMode ?? "TRUSTED_PATH";
  const promptWindow = buildPromptInputWindow(params.manuscriptText);
  const coverage = summarizePromptCoverage(params.manuscriptText);
  return `Evaluate this ${params.workType || "manuscript"} excerpt titled "${params.title}" on the CRAFT EXECUTION axis.

Execution mode: ${executionMode}
Word count: ${wordCount}
${buildCoverageDisclosure(coverage)}

Manuscript text:
${promptWindow}

Return the JSON evaluation object as specified.
Mandatory behavior:
- Cover all 13 criteria.
- Extraction-dominant output: prioritize mechanism/failure detection and one anchored evidence item.
- Rationale must be exactly 1 sentence per criterion and <= 160 chars.
- Evidence array max 1 entry per criterion.
- Recommendations must be [] for every criterion.
- Keep score_0_10 present for compatibility but minimal/non-authoritative.
- No convergence/arbitration language.`;
}
