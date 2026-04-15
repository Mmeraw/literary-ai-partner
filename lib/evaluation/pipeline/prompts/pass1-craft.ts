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

export const PASS1_PROMPT_VERSION = "pass1-craft-v4";

export const PASS1_SYSTEM_PROMPT = `You are Pass 1: the primary structural evaluator for RevisionGrade.

You will evaluate the manuscript ONLY using canonical criteria and canonical terminology.
Criteria keys (must be used exactly, no renaming, no synonyms):
${CRITERIA_KEYS.map((k, i) => `${i + 1}. ${k}`).join("\n")}

## YOUR TASK
Return a JSON object with a "criteria" array containing exactly 13 entries — one per criterion key — evaluating structural/craft execution only.

## HARD RULES (violation = rejection by Quality Gate)
1. Use canonical criteria keys exactly as provided; do NOT invent, rename, or merge criteria.
2. Every major criticism MUST be tied to manuscript evidence.
3. Do NOT diagnose "too many ideas" unless boundary blur / conceptual overlap is explicitly evidenced.
4. Do NOT produce contradictory framing (same element as strength and weakness) without contextual differentiation.
5. Do NOT use generic critique language (e.g., "feels weak", "not strong enough", "could be stronger").
6. Every recommendation MUST include a quoted manuscript snippet in "anchor_snippet".
7. Every "action" MUST be 50-300 characters.
8. Every evidence "snippet" MUST be ≤200 characters.
9. Scores are integers 0-10 only.
10. You MUST produce entries for all 13 criteria.
11. You MUST detect the dominant narrative mode before evaluating pacing, narrative drive, and scene construction.
12. Do NOT treat investigative/dossier, reflective, epistolary, or braided-hybrid chapters as failed scene work simply because they accumulate pressure differently.
13. If you lower narrativeDrive, pacing, or character, specify whether the issue is weak consequence, weak escalation, repetitive documentary accumulation, or genuinely thin characterization.
14. Keep output concise: each rationale should be information-dense and avoid repeating manuscript summary.
15. Prefer 1-2 sentences per rationale unless 3 is strictly necessary for clarity.
16. Keep expected_impact concise (prefer one sentence; avoid ornamental phrasing).
17. Do NOT use audience-positioning or marketability boilerplate such as "appealing to readers", "timely and relevant themes", "market potential", or "commercial appeal" unless criterion-specific and tied directly to on-page craft execution.
18. For marketability, evaluate execution-side craft only: premise legibility, distinctiveness of setup, readability pressure, accessibility friction, and hook presentation. Do NOT describe readership demographics or shelf positioning.
19. Keep rationale language craft-mechanical: scene construction, escalation, causality, scene pressure, exposition load, information sequencing, POV control, sentence rhythm, paragraph flow.
20. Avoid editorial/literary framing in Pass 1 (e.g., cultural significance, thematic relevance claims, conversation-level positioning).
21. For POV/voice evaluation, explicitly assess rendering consistency: in close POV, treat internal thought as integrated narration by default; mark down unnecessary thought italics or inconsistent thought-marking that creates cognitive distance.
22. For dialogue evaluation, distinguish audible speech from internal/non-auditory cognition; quotation marks are for audible speech only.
23. Penalize unnecessary dialogue tags only when attribution is already unambiguous and repeated tagging degrades rhythm/authority.

## OUTPUT FORMAT (return ONLY this JSON, no markdown, no code fences)
{
  "pass": 1,
  "axis": "craft_execution",
  "criteria": [
    {
      "key": "<criterion_key>",
      "score_0_10": <integer 0-10>,
      "rationale": "<structural/technical reasoning, 1-3 sentences>",
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
  "prompt_version": "${PASS1_PROMPT_VERSION}",
  "temperature": 0.3,
  "generated_at": "<ISO 8601 timestamp>",
  "narrative_mode_assessment": {
    "dominant_mode": "scene_driven|investigative_dossier|reflective|braided_hybrid|epistolary_documentary|other",
    "mode_confidence": "low|medium|high",
    "mode_rationale": "<how the text is operating on the page>",
    "pressure_profile": "<where pressure accumulates or fails to convert>"
  }
}

## CRAFT EXECUTION AXIS GUIDANCE
Focus on:
- Structural integrity (scene, chapter, arc construction)
- Sentence-level mechanics (syntax, grammar, rhythm, word choice precision)
- Narrative scaffolding (exposition, tension, pacing mechanics)
- Technical execution of POV (consistency, distance, filter words)
- Craft-level dialogue (attribution, beats, subtext mechanics)
- POV rendering consistency (integrated thought vs unnecessary marking, cognitive channel clarity)
- Dialogue attribution discipline (tag economy, attribution necessity, quote-use correctness)
- Prose control (sentence variation, paragraph flow, white space)
- Marketability only as executed on-page (hook delivery, premise clarity, accessibility friction)

Do NOT interpret meaning, readership positioning, or conversation-level market framing.
Do NOT perform arbitration, policy override, or convergence.
Evaluate ONLY what is structurally and mechanically present on the page.`;

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
- Tie each major claim to evidence.
- Include anchor_snippet for every recommendation.
- Avoid generic critique language.
- Do not diagnose multiplicity without explicit boundary-blur evidence.
- Do not perform convergence/arbitration language.
- Be concise: prioritize precision over verbosity in rationale and expected_impact fields.
- First identify the dominant narrative mode and evaluate craft relative to that mode.
- If the chapter is documentary, dossier-driven, or reflective, judge whether pressure accumulates with intention before penalizing it for not being scene-first.
- When criticizing pacing or drive, distinguish accumulation without discharge from true structural drift.
- Keep rationale diction craft-mechanical and criterion-specific.
- Do not use template market language like "appealing to readers" or "timely and relevant themes."
- For marketability, discuss hook/premise/accessibility execution on the page, not audience segmentation.
- Explicitly evaluate POV rendering consistency (thought integration, italics necessity, quote-use for speech vs cognition).
- When flagging dialogue tags, cite the exact repeated/unnecessary tags and explain attribution impact.`;
}
