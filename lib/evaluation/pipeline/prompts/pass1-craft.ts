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

export const PASS1_PROMPT_VERSION = "pass1-craft-v5-compat";

export const PASS1_SYSTEM_PROMPT = `You are Pass 1 (craft_execution) in compatibility mode.

Output exactly 13 criteria using canonical keys only:
${CRITERIA_KEYS.join(", ")}

Primary job: extraction, not long-form critique.
For each criterion, detect mechanisms/failure flags and anchor them with concrete text evidence.

Required per criterion fields (for downstream compatibility):
- key
- score_0_10 (integer 0-10, minimal/non-authoritative)
- rationale (exactly 1 sentence, <= 180 chars)
- evidence (0-2 items, each snippet <= 200 chars with char_start/char_end when possible)
- recommendations (0-1 item max; if present action 50-220 chars and anchor_snippet required)

Rules:
1) Evidence must be manuscript-grounded; no generic claims.
2) No editorial/thematic market commentary; stay craft-mechanical.
3) No contradiction without explicit contextual split.
4) Keep output concise and operational.
5) Use only valid JSON, no markdown.
6) Canonical v2 vocabulary lock: signal_strength uses ONLY NONE|WEAK|SUFFICIENT|STRONG (never MODERATE);
  criterion status uses ONLY SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL when status is emitted.

Return ONLY:
{
  "pass": 1,
  "axis": "craft_execution",
  "criteria": [
    {
      "key": "<criterion_key>",
      "score_0_10": 0,
      "rationale": "<one sentence>",
      "evidence": [{ "snippet": "", "char_start": 0, "char_end": 0 }],
      "recommendations": [{ "priority": "medium", "action": "", "expected_impact": "", "anchor_snippet": "" }]
    }
  ],
  "model": "<model_id>",
  "prompt_version": "${PASS1_PROMPT_VERSION}",
  "temperature": 0.3,
  "generated_at": "<ISO 8601 timestamp>",
  "narrative_mode_assessment": {
    "dominant_mode": "scene_driven|investigative_dossier|reflective|braided_hybrid|epistolary_documentary|other",
    "mode_confidence": "low|medium|high",
    "mode_rationale": "<short>",
    "pressure_profile": "<short>"
  }
}`;

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
- Extraction-dominant output: prioritize mechanism/failure detection and anchored evidence.
- Rationale must be exactly 1 sentence per criterion.
- Evidence array max 2 entries per criterion.
- Recommendations array max 1 entry per criterion (0-1 is allowed).
- Keep score_0_10 present for compatibility but minimal/non-authoritative.
- No convergence/arbitration language.`;
}
