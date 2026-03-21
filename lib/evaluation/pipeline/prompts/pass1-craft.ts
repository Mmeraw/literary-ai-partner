/**
 * Phase 2.7 — Pass 1 Prompt: Craft Execution Axis
 *
 * Pass 1 analyses structural, technical, and mechanical craft quality.
 * Temperature: 0.3.  Max tokens: 4000.
 * Independence guarantee: Pass 1 output is NEVER sent to Pass 2.
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

export const PASS1_PROMPT_VERSION = "pass1-craft-v1";

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
  "generated_at": "<ISO 8601 timestamp>"
}

## CRAFT EXECUTION AXIS GUIDANCE
Focus on:
- Structural integrity (scene, chapter, arc construction)
- Sentence-level mechanics (syntax, grammar, rhythm, word choice precision)
- Narrative scaffolding (exposition, tension, pacing mechanics)
- Technical execution of POV (consistency, distance, filter words)
- Craft-level dialogue (attribution, beats, subtext mechanics)
- Prose control (sentence variation, paragraph flow, white space)

Do NOT interpret meaning, market positioning, or convergence decisions.
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
  return `Evaluate this ${params.workType || "manuscript"} excerpt titled "${params.title}" on the CRAFT EXECUTION axis.

Execution mode: ${executionMode}
Word count: ${wordCount}

Manuscript text:
${params.manuscriptText.substring(0, 12000)}

Return the JSON evaluation object as specified.
Mandatory behavior:
- Cover all 13 criteria.
- Tie each major claim to evidence.
- Include anchor_snippet for every recommendation.
- Avoid generic critique language.
- Do not diagnose multiplicity without explicit boundary-blur evidence.
- Do not perform convergence/arbitration language.`;
}
