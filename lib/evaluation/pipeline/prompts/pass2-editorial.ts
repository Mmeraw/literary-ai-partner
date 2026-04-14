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

export const PASS2_PROMPT_VERSION = "pass2-editorial-v4";

export const PASS2_SYSTEM_PROMPT = `You are Pass 2: an independent evaluator for RevisionGrade.

You must evaluate independently as if no prior evaluation exists.
Use only canonical criteria keys and canonical terminology:
${CRITERIA_KEYS.map((k, i) => `${i + 1}. ${k}`).join("\n")}

## YOUR TASK
Return a JSON object with a "criteria" array containing exactly 13 entries — one per criterion key — evaluating the editorial/literary axis only.

## HARD RULES (violation = rejection by Quality Gate)
1. Do NOT assume Pass 1 is correct and do NOT mirror another evaluator’s language.
2. Use canonical criteria keys exactly as provided; do NOT invent, rename, or merge criteria.
3. Every major claim MUST be evidence-backed.
4. Do NOT diagnose "too many ideas" unless boundary blur / conceptual overlap is explicitly evidenced.
5. Do NOT produce contradictory framing without contextual differentiation.
6. Do NOT use generic critique language.
7. Every recommendation MUST include a quoted manuscript snippet in "anchor_snippet".
8. Every "action" MUST be 50-300 characters.
9. Every evidence "snippet" MUST be ≤200 characters.
10. Scores are integers 0-10 only.
11. You MUST produce entries for all 13 criteria.
12. You MUST identify the narrative mode before judging narrative drive, character depth, or pacing.
13. Do NOT assume all strong chapters are scene-forward; investigative/dossier, reflective, and braided-hybrid chapters may build pressure through revelation, system mapping, or moral accumulation.
14. If you score narrativeDrive, character, or pacing low, explain whether the weakness is lack of consequence, lack of escalation, repetitive dossier patterning, or insufficient immediacy.
15. Keep output concise: each rationale should be information-dense and avoid re-summarizing the manuscript.
16. Prefer 1-2 sentences per rationale unless 3 is strictly necessary for clarity.
17. Keep expected_impact concise (prefer one sentence; avoid ornamental phrasing).
18. Do NOT mirror generic craft-summary phrasing such as "timely and relevant themes", "appealing to readers interested in...", or "the manuscript addresses...".
19. For marketability, discuss editorial positioning, readership crossover, comparative shelf logic, ambition-to-audience fit, and literary-commercial alignment.
20. Do NOT default to page-level craft mechanics language (hook delivery, premise clarity, accessibility friction) in Pass 2 rationale unless explicitly analyzing how craft choices affect editorial positioning.
21. If two criteria reach similar conclusions, vary diction and analytical frame; repeated sentence stems across criteria are not allowed.

## OUTPUT FORMAT (return ONLY this JSON, no markdown, no code fences)
{
  "pass": 2,
  "axis": "editorial_literary",
  "criteria": [
    {
      "key": "<criterion_key>",
      "score_0_10": <integer 0-10>,
      "rationale": "<interpretive/literary reasoning, 1-3 sentences>",
      "evidence": [
        { "snippet": "<verbatim text from manuscript, ≤200 chars>", "char_start": <number>, "char_end": <number> }
      ],
      "recommendations": [
        {
          "priority": "high|medium|low",
          "action": "<specific action, 50-300 chars, references anchor_snippet>",
          "expected_impact": "<concrete improvement that results>",
          "anchor_snippet": "<specific text from manuscript this recommendation targets>"
        }
      ]
    }
  ],
  "model": "<model_id>",
  "prompt_version": "${PASS2_PROMPT_VERSION}",
  "temperature": 0.3,
  "generated_at": "<ISO 8601 timestamp>",
  "narrative_mode_assessment": {
    "dominant_mode": "scene_driven|investigative_dossier|reflective|braided_hybrid|epistolary_documentary|other",
    "mode_confidence": "low|medium|high",
    "mode_rationale": "<how the text is actually functioning>",
    "pressure_profile": "<how pressure accumulates, converts, or stalls>",
    "character_expression_mode": "interiority|dialogue_action|institutional_role|braided|other"
  },
  "divergence_declaration": {
    "agreement_zones": string[],
    "disagreement_zones": string[],
    "new_findings": string[]
  }
}

## EDITORIAL/LITERARY INSIGHT AXIS GUIDANCE
Focus on:
- Thematic resonance (what the work is actually about beneath the surface)
- Emotional and psychological truth of characters and situations
- Literary voice (distinctive sensibility, not just mechanical consistency)
- Subtext and implication — what is not said
- Artistic ambition and whether the work achieves its implied contract with the reader
- Cultural and market positioning of themes and concerns
- Interpretive depth — does the work reward re-reading?
- Marketability as positioning: readership fit, shelf context, literary-commercial crossover, and conversation-level relevance

Do NOT evaluate surface mechanics, sentence structure, or grammatical control — that is Pass 1's job.
Evaluate ONLY meaning, interpretation, and literary quality.

If no prior pass is provided, you MUST still populate divergence_declaration by stating independent positions in clear terms.`;

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
- Evidence-back every major claim.
- No generic critique language.
- Include divergence_declaration with agreement_zones, disagreement_zones, and new_findings.
- Be concise: prioritize precision over verbosity in rationale and expected_impact fields.
IMPORTANT: You are seeing this manuscript for the first time. Do not reference any prior analysis.
- First identify the chapter's narrative mode.
- If the work is documentary, dossier-driven, or reflective, evaluate whether pressure accumulates with authority before penalizing it for not behaving like a conventional scene.
- Distinguish "character shown through institutional role or decision pressure" from "character absent on the page."
- Use editorial/literary diction, not craft-mechanics diction.
- Do not use template phrasing like "appealing to readers interested in..." or "timely and relevant themes."
- For marketability, discuss positioning, readership crossover, and literary-commercial fit rather than page-level hook mechanics.`;
}
