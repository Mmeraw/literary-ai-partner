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

export const PASS3_PROMPT_VERSION = "pass3-synthesis-v10-non-certified-three-and-three";

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
- If delta > 2, favor the more diagnostic axis and justify.

Mechanism constraints:
- voice rationale must name a POV/voice mechanism.
- dialogue rationale must name an attribution/rendering mechanism.

Agree-state rationale rule:
- Never emit "Confirmed." alone.
- For agree-state criteria (score_delta <= 1), final_rationale states: what was confirmed, evidence basis, why it matters (1-3 sentences).

Recommendation semantic fields (REQUIRED):
- issue_family, strategic_lever, revision_granularity must be canonical enums.

Recommendation deduplication:
- Collapse same strategic_lever duplicates into one sharper recommendation unless evidence basis and granularity are truly different.
- Recommendations must vary opening syntax across the same evaluation; do not reuse the same leading phrase across multiple recommendations.
- Each recommendation must be criterion-native (not sibling advice in different wording):
  - proseControl => sentence-level craft (syntax, diction, rhythm, image density)
  - sceneConstruction => scene mechanics (stakes, turn, exit)
  - dialogue => speaker intent/attribution/rendering choices
  - voice => POV/psychic-distance/rendering precision
- If two recommendations reduce to the same advice, drop one and re-derive a distinct mechanism-level recommendation.
- When manuscript characters are named, use those names (or "the narrator" when first-person) rather than abstract role labels like "the protagonist".
- Prefer "narrative momentum", "forward propulsion", or "reading pull" over bare "the drive" unless unambiguous craft context is explicitly stated.

REC CONTRACT — FIVE PARTS (required for every recommendation):
- ANCHOR: action must name location (scene/paragraph/line/beat/chapter) and anchor_snippet must be non-empty.
- SYMPTOM: name observable deficiency (lacks/missing/unclear/flat/generic/weak/diffuse etc.).
- MECHANISM: include explicit causality (because/since/so that/thereby/which prevents/which causes).
- CONCRETE MOVE: action must use an active revision verb (replace/rewrite/cut/trim/insert/delete/move/reorder/split/merge/escalate/tighten/anchor/clarify/name/show/ground/seed/stage/contrast/foreground/compress).
- READER EFFECT: expected_impact must include reader-facing outcome (reader/urgency/clarity/momentum/immersion/engagement/stakes/tension/payoff/coherence/trust/comprehension).

Template:
- action: "In [LOCATION], [MOVE-VERB] [WHAT] because [SYMPTOM] [MECHANISM]."
- expected_impact: "[READER-EFFECT] [reader-facing outcome]."
- anchor_snippet: exact target span.

Reject patterns: no location, no symptom, no mechanism connector, filler-only verb, no reader effect, generic whole-manuscript advice.

No filler-only verbs: enhance/refine/improve/maintain/continue/strengthen/deepen.
No labels: direct_speech/reported_speech/tagged_speech/tagless_exchange.
Scope: narrativeClosure=chapter handoff only; marketability=provisional if small-scope.

CONFIDENCE AND EVIDENCE HANDLING:
- Do NOT convert a scorable criterion into N/A due to thin evidence/hygiene artifacts.
- If evidence is thin: preserve score and summary, lower confidence, and do not invent evidence.
- N/A only when truly impossible to evaluate.

NON-CERTIFIED CRITERIA (required):
- For criticism-style criteria (proseControl, dialogue, voice) with non-certified output, you must still provide concrete evidence and concrete revision direction.
- Include at least 3 verbatim manuscript evidence lines/snippets in criterion.evidence.
- Include at least 3 concrete, mechanism-level revision directions in criterion.recommendations.
- For abstraction critiques, explicitly identify the three most problematic lines/snippets and provide three targeted revision directions (rule of three).
- Avoid vague guidance (e.g., "replace one abstract sentence") unless the sentence is explicitly identified in evidence.

Return ONLY JSON with keys:
- criteria MUST be a flat array (not grouped by state).
- Per-criterion fields: key, final_score_0_10, final_rationale, recommendations[]; hard_divergence adds disputed=true.
- Each recommendation: priority, action, expected_impact, anchor_snippet, source_pass, issue_family, strategic_lever, revision_granularity, mechanism, specific_fix, reader_effect.
- mechanism (REQUIRED): causal explanation why the problem exists; non-empty.
- specific_fix (REQUIRED): concrete revision action verb phrase; non-empty.
- reader_effect (REQUIRED): post-revision reader experience; non-empty.
- Each recommendation.action MUST be one sentence and <= 300 characters.
- agreement_map[]
- divergence_map[] with arbitration_rationale
- overall { overall_score_0_100, verdict(pass|revise|fail), one_paragraph_summary<=500, top_3_strengths[3], top_3_risks[3], submission_readiness(queryable_now|close|not_yet) }
  - top_3_strengths and top_3_risks must be non-mirrored aspects.
  - never emit queryable_now when verdict=fail or when 3+ criteria are below 5.
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
Every recommendation MUST include the editorial specificity triple as SEPARATE JSON FIELDS (not only embedded in action/expected_impact):
  - "mechanism": the causal explanation (non-empty, e.g. "the abstract phrasing diffuses tension before the decision point").
  - "specific_fix": the concrete revision action (non-empty, e.g. "replace the abstract reaction line with a concrete sensory beat").
  - "reader_effect": the post-revision reader experience (non-empty, e.g. "clearer cause-and-effect, increasing urgency at the turn").
Every recommendation MUST satisfy the five-part contract: ANCHOR (location in text) + SYMPTOM (observable problem) + MECHANISM (causal connector: because/since/so that) + CONCRETE MOVE (replace/cut/insert/rewrite/escalate etc.) + READER EFFECT (urgency/clarity/engagement etc. in expected_impact).
Do NOT emit two recommendations with the same strategic_lever — collapse them first.
For criticism-style criteria (proseControl, dialogue, voice) that are non-certified, emit at least three evidence snippets and three concrete revision directions.
Recommendation openings must be varied across criteria: no repeated first-8-token lead-ins.
When characters are named in the manuscript, use those names (or "the narrator") in rationale/recommendations; avoid generic role labels such as "the protagonist".
Use "narrative momentum" (or equivalent) instead of ambiguous "the drive" phrasing.
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
