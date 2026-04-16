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
Rules:
- Do NOT perform a new unconstrained evaluation.
- Do NOT silently overwrite disagreement.
- Use the packet as canonical input; do not expect raw pass payloads.
- For each criterion, explicitly trace pressure signal -> decision inflection -> consequence trajectory.
- pressure->decision->consequence logic.
- Classify consequence_status as landed|deferred|dissipated.
- If |craft_score-editorial_score| > 2, include delta_explanation and explicit arbitration logic.
- Preserve narrative-mode distinctions (scene vs dossier/reflective progression).

Scoring:
- Integer scores only (0-10).
- If delta <= 2, final_score_0_10 should be rounded average.
- If delta > 2, final score must favor the more diagnostic axis and justify why.

Mechanism constraints:
- voice rationale must name at least one POV/voice mechanism (e.g., psychic distance, diction, syntax, focalization).
- dialogue rationale must name at least one attribution/rendering mechanism (e.g., tags, beats, subtext).

Return ONLY JSON with keys:
- criteria MUST be a flat array of criterion objects (one per key), not grouped/nested by state.
- criteria[] by state:
  - agree: key, final_score_0_10, final_rationale="Confirmed."
  - soft_divergence: key, final_score_0_10, final_rationale
  - hard_divergence: key, final_score_0_10, final_rationale, disputed=true
  - missing_or_invalid: key, final_score_0_10, final_rationale
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
  const synthesisBudget = getDefaultSynthesisReferenceCharBudget();
  const synthesisWindow = params.manuscriptText
    ? buildPromptInputWindow(params.manuscriptText, synthesisBudget)
    : "";
  const synthesisCoverage = params.manuscriptText
    ? summarizePromptCoverage(params.manuscriptText, synthesisBudget)
    : null;
  const coverageDisclosure = synthesisCoverage
    ? buildCoverageDisclosure(synthesisCoverage, "Synthesis reference coverage")
    : "Synthesis reference coverage: unavailable (comparison packet-only execution).";
  const referenceSnippet = synthesisWindow.length > 0 ? synthesisWindow.substring(0, 600) : "[reference omitted]";

  return `Synthesize these two independent evaluation passes for the manuscript titled "${params.title}".

Execution mode: ${executionMode}

OUTPUT BUDGET BY STATE (STRICT):
- agree (score_delta <= 1): emit ONLY { key, final_score_0_10, final_rationale: "Confirmed." }
- soft_divergence (score_delta 2-3): emit ONLY { key, final_score_0_10, final_rationale } with 1 sentence
- hard_divergence (score_delta >= 4): emit ONLY { key, final_score_0_10, final_rationale } with 2 sentences + disputed=true
- missing_or_invalid: emit concise corrective rationale, no long prose
- overall: verdict + overall_score_0_100 + one_paragraph_summary (max 3 sentences) + top_3_strengths + top_3_risks

Do NOT re-litigate agreed criteria.
Do NOT add evidence, recommendations, delta_explanation, craft_score, or editorial_score for agree criteria.
Do NOT return criteria as { agree:[], soft_divergence:[] ... }; return a single criteria[] array.
Target total visible output under 1500 tokens.

Coverage truth signal:
- ${coverageDisclosure}
- Reference snippet (context anchor only): ${referenceSnippet}

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
