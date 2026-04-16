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
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  summarizePromptCoverage,
} from "../promptInput";

export const PASS2_PROMPT_VERSION = "pass2-editorial-v5-judgment";

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
  "model": "<model_id>",
  "prompt_version": "${PASS2_PROMPT_VERSION}",
  "temperature": 0.3,
  "generated_at": "<ISO 8601 timestamp>",
  "narrative_mode_assessment": {
    "dominant_mode": "scene_driven|investigative_dossier|reflective|braided_hybrid|epistolary_documentary|other",
    "mode_confidence": "low|medium|high",
    "mode_rationale": "<short>",
    "pressure_profile": "<short>",
    "character_expression_mode": "interiority|dialogue_action|institutional_role|braided|other"
  },
  "divergence_declaration": {
    "agreement_zones": [],
    "disagreement_zones": [],
    "new_findings": []
  }
}`;

export function buildPass2UserPrompt(params: {
  manuscriptText: string;
  workType: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
}): string {
  const wordCount = params.manuscriptText.trim().split(/\s+/).length;
  const executionMode = params.executionMode ?? "TRUSTED_PATH";
  const promptWindow = buildPromptInputWindow(params.manuscriptText);
  const coverage = summarizePromptCoverage(params.manuscriptText);
  return `Evaluate this ${params.workType || "manuscript"} excerpt titled "${params.title}" on the EDITORIAL/LITERARY INSIGHT axis.

Execution mode: ${executionMode}
Word count: ${wordCount}
${buildCoverageDisclosure(coverage)}

Manuscript text:
${promptWindow}

Return the JSON evaluation object as specified.
Mandatory behavior:
- Cover all 13 criteria.
- Stay fully independent from any prior analysis.
- Rationale must be exactly 1 sentence per criterion.
- Evidence array max 2 entries per criterion.
- Recommendations array max 1 entry per criterion.
- Include divergence_declaration with concise arrays.`;
}
