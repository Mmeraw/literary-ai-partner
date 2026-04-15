/**
 * Phase 2.7 — Pass 3 Prompt: Synthesis & Reconciliation
 *
 * Pass 3 reconciles Pass 1 (craft) and Pass 2 (editorial) outputs,
 * producing a unified dual-axis evaluation.
 * Temperature: 0.2.  Max tokens: environment-tunable (default 9000).
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  getDefaultSynthesisReferenceCharBudget,
  summarizePromptCoverage,
} from "../promptInput";

export const PASS3_PROMPT_VERSION = "pass3-synthesis-v4";

export const PASS3_SYSTEM_PROMPT = `You are Pass 3: convergence and arbitration authority.

You will receive:
- Deterministic comparison packet derived from Pass 1 + Pass 2
- Original manuscript text

Your job is to compare, expose agreement and divergence, and produce a governed final decision.

## SYNTHESIS RULES
1. Do NOT perform a fresh unconstrained evaluation.
2. Do NOT silently overwrite disagreement.
3. Do NOT hide meaningful divergence by score averaging alone.
4. Every major arbitration decision MUST include evidence-backed reasoning.
4b. Treat the comparison packet as canonical Pass 1/Pass 2 input. Do NOT expect raw pass payloads.
5. Preserve narrative-mode awareness: do NOT flatten documentary/dossier/reflective chapters into generic scene-work judgments.
6. For each criterion, explicitly trace: pressure signal -> decision inflection -> consequence trajectory.
7. Do NOT leave consequence state implicit; classify each criterion as landed, deferred, or dissipated.
8. Never emit canned fallback rationale phrases (e.g., "neither pass supplied", "default neutral score", "placeholder").

### Score Reconciliation
- If craft_score and editorial_score differ by ≤2: use the mathematical average (rounded to nearest integer)  
- If they differ by >2: you MUST explain the divergence in "delta_explanation"; the final score should reflect which axis is more diagnostic for this criterion
9. For the "voice" criterion, final_rationale MUST reference at least one specific POV/voice mechanism (e.g., narrative perspective, psychic distance, interiority, diction, register, tone, syntax, rhythm, free indirect discourse, sensory rendering, focalization). Generic praise or criticism without mechanism language will be rejected by the Quality Gate.
10. For the "dialogue" criterion, final_rationale MUST reference at least one attribution/rendering mechanism (e.g., dialogue tags, speaker attribution, beats, quotation use, subtext mechanics).
- All scores are integers 0-10 — no fractions

### Recommendation Synthesis
- Merge complementary recommendations from both passes
- Remove genuine duplicates (same advice, different wording)
- Mark each recommendation with "source_pass": 1, 2, or 3 (3 = your synthesis added it)
- Every recommendation must still have a valid "anchor_snippet" from the manuscript

### Overall Assessment
- Compute overall_score_0_100 as the weighted average of all 13 final_score_0_10 values × 10
- verdict: "pass" if ≥ 75, "fail" if ≤ 40, "revise" otherwise
- one_paragraph_summary: ≤500 characters — executive-level assessment
- top_3_strengths and top_3_risks: most diagnostic issues only

## CRITERIA TO SYNTHESIZE
${CRITERIA_KEYS.map((k, i) => `${i + 1}. ${k}`).join("\n")}

## OUTPUT FORMAT (return ONLY this JSON, no markdown, no code fences)
{
  "criteria": [
    {
      "key": "<criterion_key>",
      "craft_score": <integer 0-10>,
      "editorial_score": <integer 0-10>,
      "final_score_0_10": <integer 0-10>,
      "score_delta": <|craft_score - editorial_score|>,
      "delta_explanation": "<required if score_delta > 2, otherwise omit>",
      "final_rationale": "<synthesized reasoning from both axes, 2-4 sentences including pressure->decision->consequence logic>",
      "pressure_points": ["<where pressure enters/escalates>", "<optional second point>"],
      "decision_points": ["<decision reached or avoided>", "<optional second point>"],
      "consequence_status": "landed|deferred|dissipated",
      "deferred_consequence_risk": "<required when consequence_status=deferred>",
      "evidence": [
        { "snippet": "<verbatim, ≤200 chars>", "char_start": <number>, "char_end": <number> }
      ],
      "recommendations": [
        {
          "priority": "high|medium|low",
          "action": "<50-300 chars, references anchor_snippet>",
          "expected_impact": "<concrete improvement>",
          "anchor_snippet": "<specific text from manuscript>",
          "source_pass": 1 | 2 | 3
        }
      ]
    }
  ],
  "agreement_map": [
    {
      "key": "<criterion_key>",
      "agreement": "<where pass1 and pass2 agree>"
    }
  ],
  "divergence_map": [
    {
      "key": "<criterion_key>",
      "pass1_position": "<summary>",
      "pass2_position": "<summary>",
      "nature_of_divergence": "<what differs>",
      "arbitration_rationale": "<why final decision chosen>"
    }
  ],
  "overall": {
    "overall_score_0_100": <0-100>,
    "verdict": "pass|revise|fail",
    "one_paragraph_summary": "<≤500 chars>",
    "top_3_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "top_3_risks": ["<risk 1>", "<risk 2>", "<risk 3>"]
  },
  "metadata": {
    "pass1_model": "<from pass1 output>",
    "pass2_model": "<from pass2 output>",
    "pass3_model": "<your model id>",
    "generated_at": "<ISO 8601 timestamp>"
  }
}`;

export function buildPass3UserPrompt(params: {
  comparisonPacketJson: string;
  manuscriptText: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
}): string {
  const executionMode = params.executionMode ?? "TRUSTED_PATH";
  const synthesisBudget = getDefaultSynthesisReferenceCharBudget();
  const promptWindow = buildPromptInputWindow(params.manuscriptText, synthesisBudget);
  const coverage = summarizePromptCoverage(params.manuscriptText, synthesisBudget);
  return `Synthesize these two independent evaluation passes for the manuscript titled "${params.title}".

Execution mode: ${executionMode}
${buildCoverageDisclosure(coverage, "Pass 3 manuscript reference coverage")}

## PASS 1 / PASS 2 COMPARISON PACKET (Deterministic)
${params.comparisonPacketJson.substring(0, 6000)}

## ORIGINAL MANUSCRIPT TEXT (for reference)
${promptWindow}

Reconcile both perspectives into a unified evaluation.
Mandatory behavior:
- Produce explicit agreement_map and divergence_map.
- Preserve major disagreement visibility.
- Provide explicit arbitration rationale for divergence.
- Do not silently merge conflicting conclusions.
- Do not request or assume raw pass payloads; use the comparison packet fields as provided.
- Preserve narrative-mode distinctions when reconciling pacing, narrativeDrive, and character judgments.
- If a chapter accumulates pressure through archives, reflection, or system mapping, distinguish that from true absence of movement.
- For each criterion, identify concrete pressure, then the chapter-level decision (or non-decision), then the resulting consequence.
- If consequence is deferred, name the risk and expected downstream cost explicitly.
- Populate pressure_points, decision_points, consequence_status, and (when deferred) deferred_consequence_risk for every criterion.
Return the synthesis JSON object as specified.`;
}
