/**
 * Phase 2.7 — Pass 3 Prompt: Synthesis & Reconciliation
 *
 * Pass 3 reconciles Pass 1 (craft) and Pass 2 (editorial) outputs,
 * producing a unified dual-axis evaluation.
 * Temperature: 0.2.  Max tokens: environment-tunable (default 9000).
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

export const PASS3_PROMPT_VERSION = "pass3-synthesis-v4";

export const PASS3_SYSTEM_PROMPT = `You are Pass 3: convergence and arbitration authority.
Input: deterministic comparison packet + manuscript text.

Rules:
- Do NOT perform a new unconstrained evaluation.
- Do NOT silently overwrite disagreement.
- Use the packet as canonical input; do not expect raw pass payloads.
- For each criterion, explicitly trace pressure signal -> decision inflection -> consequence trajectory.
- Classify consequence_status as landed|deferred|dissipated.
- If |craft_score-editorial_score| > 2, include delta_explanation and explicit arbitration logic.
- Preserve narrative-mode distinctions (scene vs dossier/reflective progression).
- Use manuscript-grounded evidence only.

Scoring:
- Integer scores only (0-10).
- If delta <= 2, final_score_0_10 should be rounded average.
- If delta > 2, final score must favor the more diagnostic axis and justify why.

Mechanism constraints:
- voice rationale must name at least one POV/voice mechanism (e.g., psychic distance, diction, syntax, focalization).
- dialogue rationale must name at least one attribution/rendering mechanism (e.g., tags, beats, subtext).

Recommendations:
- Merge complementary advice, dedupe true duplicates, keep valid anchor_snippet, set source_pass (1|2|3).

Return ONLY JSON with keys:
- criteria[]: key, craft_score, editorial_score, final_score_0_10, score_delta, optional delta_explanation, final_rationale (must include pressure->decision->consequence logic), pressure_points[], decision_points[], consequence_status, optional deferred_consequence_risk, evidence[], recommendations[].
- agreement_map[]
- divergence_map[] with arbitration_rationale
- overall { overall_score_0_100, verdict(pass|revise|fail), one_paragraph_summary<=500, top_3_strengths[3], top_3_risks[3] }
- metadata { pass1_model, pass2_model, pass3_model, generated_at }

Criteria keys:
${CRITERIA_KEYS.join(", ")}`;

export function buildPass3UserPrompt(params: {
  comparisonPacketJson: string;
  manuscriptText?: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
}): string {
  const executionMode = params.executionMode ?? "TRUSTED_PATH";
  return `Synthesize these two independent evaluation passes for the manuscript titled "${params.title}".

Execution mode: ${executionMode}

## PASS 1 / PASS 2 COMPARISON PACKET (Deterministic)
${params.comparisonPacketJson.substring(0, 3500)}

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
