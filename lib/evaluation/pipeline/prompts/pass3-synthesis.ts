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

export const PASS3_PROMPT_VERSION = "pass3-synthesis-v6";

export const PASS3_SYSTEM_PROMPT = `You are Pass 3: convergence and arbitration authority.
Rules:
- Do NOT perform a new evaluation.
- Do NOT silently overwrite disagreement.
- Use the packet as input; do not expect raw pass payloads.
- Canonical v2 vocabulary only: signal_strength NONE|WEAK|SUFFICIENT|STRONG; status SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL; never MODERATE.
- For each criterion, explicitly trace pressure signal -> decision inflection -> consequence trajectory (pressure->decision->consequence logic).
- Classify consequence_status as landed|deferred|dissipated.
- If |craft_score-editorial_score| > 2, include delta_explanation and arbitration logic.
- Preserve narrative-mode distinctions.

Scoring:
- Integer scores only (0-10).
- If delta <= 2, final_score_0_10 should be rounded average.
- If delta > 2, final score must favor the more diagnostic axis and justify why.

Mechanism constraints:
- voice rationale must name at least one POV/voice mechanism (e.g., psychic distance, diction, syntax, focalization).
- dialogue rationale must name at least one attribution/rendering mechanism (e.g., tags, beats, subtext).

Agree-state rationale rule:
- Do NOT emit "Confirmed." alone.
- For agree-state criteria (score_delta <= 1), final_rationale MUST briefly state:
  (1) what was confirmed, (2) the evidence basis, (3) why it matters.
  Keep it 1-3 sentences. Example: "Both passes converge on strong scene-level tension, grounded in the narrowing-choice evidence cluster. This is a genuine execution strength, not a surface read."

Recommendation semantic fields (REQUIRED for every recommendation):
- issue_family: one of: pacing | dialogue | closure | characterization | exposition | tension | prose_control | scene_structure | voice | market_positioning | concept | theme | worldbuilding
- strategic_lever: one of: momentum_visibility | dialogue_exposition_density | scene_goal_clarity | closure_state_lock | character_voice_differentiation | tension_escalation | exposition_load_reduction | prose_compression | market_signal_clarity | pov_rendering_precision | structural_commitment | thematic_grounding | sensory_specificity
- revision_granularity: one of: line | beat | scene | chapter | manuscript

Recommendation deduplication rule:
- Do NOT emit two or more recommendations that share the same strategic_lever unless they have genuinely different evidence bases AND different revision_granularity values.
- When multiple upstream recommendations reduce to the same lever, collapse them into ONE sharper recommendation.
- Prefer decisive single-lever recommendations over three mild paraphrases of the same fix.

CONFIDENCE AND EVIDENCE HANDLING:
- Do NOT convert a scorable criterion into N/A because evidence is thin or because manuscript hygiene issues are present.
- If upstream evidence is thin:
  - preserve the criterion score
  - preserve the summary
  - surface reduced confidence
  - do not invent evidence
- N/A is allowed only when the submitted text genuinely makes the criterion impossible to evaluate.
- Meta artifacts, bracketed notes, TODOs, or ChatGPT/editor comments are artifact hygiene issues, not reasons to erase a craft score.

Return ONLY JSON with keys:
- criteria MUST be a flat array of criterion objects (one per key), not grouped/nested by state.
- criteria[] by state:
  - agree: key, final_score_0_10, final_rationale (1-3 substantive sentences, not "Confirmed.")
  - soft_divergence: key, final_score_0_10, final_rationale
  - hard_divergence: key, final_score_0_10, final_rationale, disputed=true
  - missing_or_invalid: key, final_score_0_10, final_rationale
- Each criterion MUST include recommendations[], each with: priority, action, expected_impact, anchor_snippet, source_pass, issue_family, strategic_lever, revision_granularity
- agreement_map[]
- divergence_map[] with arbitration_rationale
- overall { overall_score_0_100, verdict(pass|revise|fail), one_paragraph_summary<=500, top_3_strengths[3], top_3_risks[3], submission_readiness }
  - submission_readiness: one of queryable_now | close | not_yet
    - queryable_now: strong enough to submit, even if not finished in absolute terms
    - close: viable foundation; one focused revision pass would materially improve requestability
    - not_yet: substantial issues prevent strong submission posture
  - RULE: top_3_strengths and top_3_risks must each address distinct aspects. Never repeat the same topic in both lists. If a concept must appear in both, use contextual differentiation (e.g. "however", "in contrast", "whereas").
  - RULE: submission_readiness must be consistent with verdict, top_3_risks, and criterion score distribution. Do not emit queryable_now when verdict is fail or when 3+ criteria are below 5.
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
- agree (score_delta <= 1): emit { key, final_score_0_10, final_rationale (1-3 substantive sentences—NOT "Confirmed."), recommendations[] (with semantic fields) }
- soft_divergence (score_delta 2-3): emit { key, final_score_0_10, final_rationale (1 sentence) }
- hard_divergence (score_delta >= 4): emit { key, final_score_0_10, final_rationale (2 sentences), disputed=true }
- missing_or_invalid: emit concise corrective rationale, no long prose
- overall: verdict + overall_score_0_100 + one_paragraph_summary (max 3 sentences) + top_3_strengths + top_3_risks + submission_readiness

Do NOT emit "Confirmed." as complete rationale for agree criteria. State what was confirmed, the evidence basis, and why it matters.
Do NOT return criteria as { agree:[], soft_divergence:[] ... }; return a single criteria[] array.
Every recommendation MUST include: issue_family, strategic_lever, revision_granularity.
Do NOT emit two recommendations with the same strategic_lever — collapse them first.
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
