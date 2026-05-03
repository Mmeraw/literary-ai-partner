/**
 * Phase 2.7 — Pass 3 Prompt: Synthesis & Reconciliation
 *
 * Pass 3 reconciles Pass 1 (craft) and Pass 2 (editorial) outputs,
 * producing a unified dual-axis evaluation.
 * Temperature: 0.2.  Max tokens: environment-tunable (default 9000).
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SubmissionScopeProfile } from "../submissionScope";
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  getDefaultSynthesisReferenceCharBudget,
  summarizePromptCoverage,
} from "../promptInput";

export const PASS3_PROMPT_VERSION = "pass3-synthesis-v8-rec-contract-hardening";

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
  Keep it 1-3 sentences.

Recommendation semantic fields (REQUIRED for every recommendation):
- issue_family: pacing | dialogue | closure | characterization | exposition | tension | prose_control | scene_structure | voice | market_positioning | concept | theme | worldbuilding
- strategic_lever: momentum_visibility | dialogue_exposition_density | scene_goal_clarity | closure_state_lock | character_voice_differentiation | tension_escalation | exposition_load_reduction | prose_compression | market_signal_clarity | pov_rendering_precision | structural_commitment | thematic_grounding | sensory_specificity
- revision_granularity: one of: line | beat | scene | chapter | manuscript

Recommendation deduplication rule:
- Do NOT emit two or more recommendations that share the same strategic_lever unless they have genuinely different evidence bases AND different revision_granularity values.
- When multiple upstream recommendations reduce to the same lever, collapse them into ONE sharper recommendation.
- Prefer decisive single-lever recommendations over three mild paraphrases of the same fix.

REC CONTRACT — FIVE-PART STRUCTURE (every rec must satisfy all five):

1. ANCHOR (where in the text): anchor_snippet must be non-empty AND action must name the location.
   Required: include a scene/paragraph/line/beat/chapter reference in the action field.
   Examples: "In the opening scene", "At the midpoint paragraph", "In the chapter-closing beat".

2. SYMPTOM (what is wrong): action or expected_impact must name the observable problem.
   Required: use a symptom word such as: lacks, missing, unclear, flat, generic, weak, diffuse,
   underdeveloped, abrupt, stalled, tension is absent, stakes are invisible.
   The symptom is what the reader currently experiences or fails to experience.

3. MECHANISM (why it matters causally): action or expected_impact must contain an explicit causal connector.
   Required: use one of: because, since, so that, thereby, which prevents, which causes, to avoid,
   by [doing X], which allows the reader to.
   Do NOT state what to fix without explaining why the problem exists.

4. CONCRETE MOVE (what to do): action must contain an active revision verb.
   Required: use one of: replace, rewrite, cut, trim, insert, delete, move, reorder, split, merge,
   escalate, tighten, anchor, clarify, name, show, ground, seed, stage, contrast, foreground, compress.
   Filler verbs (enhance, refine, improve, strengthen, deepen, maintain, continue) are forbidden.

5. READER EFFECT (outcome in expected_impact): expected_impact must name the reader-facing result.
   Required: include one of: reader, readers, urgency, clarity, momentum, immersion, engagement,
   stakes, tension, payoff, coherence, trust, comprehension.
   The effect is framed from the reader's perspective, not the manuscript's structure.

Five-part template (use this structure for every recommendation):
  action: "In [LOCATION], [MOVE-VERB] [WHAT] because [SYMPTOM] [CAUSAL-CONNECTOR] [PROBLEM-EFFECT]."
  expected_impact: "[READER-EFFECT-WORD] [outcome for the reader]."
  anchor_snippet: the specific text span targeted.

Five-part example (correct):
  action: "In the opening exchange, replace the abstract reaction line with a concrete sensory beat
           because the current phrasing diffuses tension before the decision point."
  expected_impact: "Gives the reader a clearer cause-and-effect chain, increasing urgency at the turn."
  anchor_snippet: "He nodded, unsure what to do next."

Six patterns that will be rejected (do not emit these):
  ❌ No location: "Rewrite the reaction line because it is vague." (no scene/paragraph/beat anchor)
  ❌ No symptom: "In scene 2, replace this line to improve the pacing." (why is pacing a problem?)
  ❌ No mechanism: "In the opening scene, replace the flat dialogue." (no because/since/causal connector)
  ❌ Filler verb: "Enhance the tension in scene 3." (no fix-marker verb)
  ❌ No reader effect: "This change will tighten the chapter." (no reader-facing outcome)
  ❌ Generic: "Improve the prose throughout." (no location, no symptom, no mechanism, no fix, no effect)

No filler: enhance/refine/improve/maintain/continue/strengthen/deepen.
No labels: direct_speech/reported_speech/tagged_speech/tagless_exchange.
Scope: narrativeClosure=chapter handoff only; marketability=provisional if small-scope.

CONFIDENCE AND EVIDENCE HANDLING:
- Do NOT convert a scorable criterion into N/A due to thin evidence or hygiene artifacts.
- If evidence is thin: preserve score and summary, lower confidence, and do not invent evidence.
- N/A is allowed only when the criterion is genuinely impossible to evaluate from the submitted text.

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
  - submission_readiness: queryable_now | close | not_yet
  - RULE: top_3_strengths and top_3_risks must cover distinct aspects (no mirrored topic).
  - RULE: submission_readiness must align with verdict, top_3_risks, and score distribution; never emit queryable_now when verdict=fail or when 3+ criteria are below 5.
- metadata { pass1_model, pass2_model, pass3_model, generated_at }

Criteria keys:
${CRITERIA_KEYS.join(", ")}`;

export function buildPass3UserPrompt(params: {
  comparisonPacketJson: string;
  manuscriptText?: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  scopeProfile?: SubmissionScopeProfile;
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
Every recommendation MUST satisfy the five-part contract: ANCHOR (location in text) + SYMPTOM (observable problem) + MECHANISM (causal connector: because/since/so that) + CONCRETE MOVE (replace/cut/insert/rewrite/escalate etc.) + READER EFFECT (urgency/clarity/engagement etc. in expected_impact).
Do NOT emit two recommendations with the same strategic_lever — collapse them first.
Target total visible output under 1500 tokens.

Coverage truth signal:
- ${coverageDisclosure}
- Reference snippet (context anchor only): ${referenceSnippet}
${params.scopeProfile ? `- Submission scope: ${params.scopeProfile.inputScale} (${params.scopeProfile.wordCount} words; ${params.scopeProfile.chunkCount} chunk(s); ${params.scopeProfile.scorableCount}/13 criteria non-NA for this scope; confidence cap ${params.scopeProfile.confidenceCapSummary})` : ""}

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
