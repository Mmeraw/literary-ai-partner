/**
 * Phase 2.7 — Pass 3 Prompt: Synthesis & Reconciliation
 *
 * Pass 3 reconciles Pass 1 (craft) and Pass 2 (editorial) outputs,
 * producing a unified dual-axis evaluation.
 * Temperature: 0.2.  Max tokens: environment-tunable (default 9000).
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SubmissionScopeProfile } from "../submissionScope";
import type { Pass2aStructuredContext, SinglePassOutput } from "../types";
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  getDefaultSynthesisReferenceCharBudget,
  summarizePromptCoverage,
} from "../promptInput";

export const PASS3_PROMPT_VERSION = "pass3-synthesis-v15-entity-roster-grounding";

export const PASS3_SYSTEM_PROMPT = `You are Pass 3: convergence and arbitration authority.
Rules:
- Do NOT re-evaluate.
- Do NOT silently overwrite disagreement.
- Use the packet as input; do not expect raw pass payloads.
- Treat PASS2A_STRUCTURED_CONTEXT as hard input; if missing/incomplete/contradicted, fail.
- Canonical v2 vocabulary only: signal_strength NONE|WEAK|SUFFICIENT|STRONG; status SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL; never MODERATE.
- For each criterion, explicitly trace pressure signal -> decision inflection -> consequence trajectory (pressure->decision->consequence logic).
- Classify consequence_status as landed|deferred|dissipated.
- If |craft_score-editorial_score| > 2, include delta_explanation and arbitration logic.
- Preserve narrative-mode distinctions.

Scoring: Integer 0-10. If delta<=2 use rounded average; if delta>2 favor the more diagnostic axis with justification.

Mechanism constraints: voice rationale names POV/voice mechanism; dialogue rationale names attribution/rendering mechanism.

Agree-state rule: Never emit "Confirmed." alone; for score_delta<=1 state confirmation + evidence basis + why it matters (1-3 sentences).
Rationale prefix rule: NEVER open final_rationale with "Agreement", "Agreement sustained", "Agreement held", "Both passes", "Both evaluations", "Both agreed", or any variant that leaks internal arbitration state. Rationale is author-facing craft feedback — write it from that perspective only. Open with the craft observation itself (e.g. "The opening ambush establishes...", "Scene construction is anchored by...", "Tonal register stays...").

Recommendation semantic fields (REQUIRED):
- issue_family, strategic_lever, revision_granularity must be canonical enums.

Recommendation deduplication:
- Collapse same strategic_lever duplicates unless evidence is genuinely distinct.
- Recommendations must vary opening syntax across the same evaluation; do not reuse the same leading phrase across multiple recommendations.
- Each recommendation must be criterion-native (not sibling advice in different wording).
- If two recommendations reduce to the same advice, drop one and re-derive a distinct mechanism-level recommendation.
- When manuscript characters are named, use those names (or "the narrator" when first-person) rather than abstract role labels like "the protagonist".
- Prefer "narrative momentum" over ambiguous "the drive".

REC CONTRACT — FIVE PARTS (required for every recommendation):
- ANCHOR: action must name location (scene/paragraph/line/beat/chapter) and anchor_snippet must be non-empty.
- SYMPTOM: name observable deficiency (lacks/missing/unclear/flat/generic/weak/diffuse etc.).
- MECHANISM: include explicit causality (because/since/so that/thereby/which prevents/which causes).
- CONCRETE MOVE: action must use an active revision verb (replace/rewrite/cut/trim/insert/delete/move/reorder/split/merge/escalate/tighten/anchor/clarify/name/show/ground/seed/stage/contrast/foreground/compress).
- READER EFFECT: expected_impact must include reader-facing outcome (reader/urgency/clarity/momentum/immersion/engagement/stakes/tension/payoff/coherence/trust/comprehension).

Reject patterns: no location/symptom/mechanism/concrete move/reader effect, or generic whole-manuscript advice.

Confidence/evidence: do not convert scorable criteria to N/A due to thin evidence; lower confidence instead; do not invent evidence.

Prose Control certification hard rule:
- Never certify high Prose Control without at least 2 distinct verbatim manuscript anchors.
- Positive prose sentiment (award-ready/line-level control/precise syntax) may trigger rescue but cannot substitute for anchors.
- If proseControl rationale is strongly positive but anchors remain underfilled, prefer explicit uncertified output shape over synthetic score inflation.
- Never emit truncated recommendation actions; if a rewrite instruction is incomplete, omit it.

NON-CERTIFIED CRITERIA (required):
- For proseControl/dialogue/voice when non-certified: include at least 3 verbatim evidence snippets and at least 3 concrete mechanism-level revision directions.
- For abstraction critiques: identify the three most problematic lines/snippets and provide three targeted revision directions (rule of three).

Return ONLY JSON with keys:
- criteria MUST be a flat array (not grouped by state).
- Per-criterion fields: key, final_score_0_10, final_rationale, recommendations[]; hard_divergence adds disputed=true.
- Each recommendation: priority, action, expected_impact, anchor_snippet, source_pass, issue_family, strategic_lever, revision_granularity, mechanism, specific_fix, reader_effect.
- Each recommendation.action MUST be one sentence and <= 300 characters.
- agreement_map[]
- divergence_map[] with arbitration_rationale
- overall { overall_score_0_100, verdict(pass|revise|fail), one_paragraph_summary<=500, top_3_strengths[3], top_3_risks[3], submission_readiness(queryable_now|nearly_ready|not_yet) }
  - top_3_strengths and top_3_risks must be non-mirrored aspects.
  - never emit queryable_now when verdict=fail or when 3+ criteria are below 5.
  - one_paragraph_summary MUST name every criterion scoring <=5 by readable key.
- metadata { generated_at } (do NOT emit pass1_model/pass2_model/pass3_model; stamped server-side)

Criteria keys:
${CRITERIA_KEYS.join(", ")}`;

/**
 * Build a MANUSCRIPT ENTITY ROSTER block from the Pass2a structured context.
 * Surfaces the top characters (by mention count) and named entities/locations
 * harvested across scenes so the criteria commentary section can ground in
 * specific names rather than abstract role labels. Returns "" when no roster
 * data is available — callers should treat that as a structural fallback.
 *
 * Caps: 15 characters and 12 scene entities to keep the block bounded.
 */
function buildEntityRoster(context: Pass2aStructuredContext): string {
  const ledger = Array.isArray(context.character_ledger) ? context.character_ledger : [];
  const topCharacters = [...ledger]
    .sort((a, b) => (b.mention_count ?? 0) - (a.mention_count ?? 0))
    .slice(0, 15)
    .map((c) => {
      const mentionCount = typeof c.mention_count === "number" ? c.mention_count : 0;
      return `${c.name} (${mentionCount} mention${mentionCount === 1 ? "" : "s"})`;
    })
    .filter((line) => line.length > 0);

  const sceneEntities = new Set<string>();
  for (const scene of context.scene_index ?? []) {
    for (const entity of scene.named_entities ?? []) {
      const trimmed = entity.trim();
      if (trimmed.length > 0) sceneEntities.add(trimmed);
    }
    if (sceneEntities.size >= 24) break;
  }
  const characterNameSet = new Set(ledger.map((c) => c.name.trim().toLowerCase()));
  const namedEntities = Array.from(sceneEntities)
    .filter((entity) => !characterNameSet.has(entity.toLowerCase()))
    .slice(0, 12);

  if (topCharacters.length === 0 && namedEntities.length === 0) return "";

  const lines: string[] = [];
  if (topCharacters.length > 0) {
    lines.push(`Characters (use these exact names, not "the protagonist"): ${topCharacters.join(", ")}.`);
  }
  if (namedEntities.length > 0) {
    lines.push(`Named entities, locations, and motifs from the scene index: ${namedEntities.join(", ")}.`);
  }
  return lines.join("\n");
}

/**
 * Build a compact summary of the Perplexity dual-model packet for Pass 3.
 * One line per criterion: score, short rationale, and first evidence snippet.
 * Cap the rationale length so the prompt stays bounded.
 */
function buildPerplexityPacketSummary(packet: SinglePassOutput): string {
  return packet.criteria
    .map((c) => {
      const rationale = (c.rationale ?? "").trim();
      const truncRationale =
        rationale.length > 180 ? `${rationale.slice(0, 180).trimEnd()}…` : rationale;
      const evidenceSnippet = (c.evidence[0]?.snippet ?? "").trim();
      const truncEvidence =
        evidenceSnippet.length > 120
          ? `${evidenceSnippet.slice(0, 120).trimEnd()}…`
          : evidenceSnippet;
      const evidencePart = truncEvidence ? ` | evidence: "${truncEvidence}"` : "";
      return `- ${c.key}: ${c.score_0_10}/10 — ${truncRationale}${evidencePart}`;
    })
    .join("\n");
}

export function buildPass3UserPrompt(params: {
  comparisonPacketJson: string;
  pass2aStructuredContext: Pass2aStructuredContext;
  manuscriptText?: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  scopeProfile?: SubmissionScopeProfile;
  /**
   * Optional independent Perplexity chunk-scoring packet (dual-model parallel scoring).
   * When provided, the prompt switches to dual-model mode and asks the model to
   * synthesize across BOTH independent evaluations, flagging divergences > 1 point.
   */
  perplexityChunkPacket?: SinglePassOutput;
  /**
   * When true, render the dual-model synthesis block. Defaults to true when
   * perplexityChunkPacket is provided. Allows callers to feature-flag the
   * dual-model render at the prompt boundary independently of packet presence.
   */
  dualModelMode?: boolean;
}): string {
  const executionMode = params.executionMode ?? "TRUSTED_PATH";
  const synthesisBudget = getDefaultSynthesisReferenceCharBudget();
  // DEPRECATED-PATH (2026-05-13): buildPromptInputWindow performs the
  // 40,000-char silent truncation that produces PASS{1,2,3}_TIMEOUT on
  // long manuscripts. Will be replaced by chunk-scoped map-reduce in
  // PR-A of docs/MAP_REDUCE_PIPELINE_GOVERNANCE_BRIEF.md (locked PR #473).
  // Do NOT add new callers.
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
  const structuredContextJson = JSON.stringify({
    character_ledger: params.pass2aStructuredContext.character_ledger.slice(0, 24),
    scene_index: params.pass2aStructuredContext.scene_index.slice(0, 16),
    timeline_anchors: params.pass2aStructuredContext.timeline_anchors.slice(0, 24),
  });

  const entityRoster = buildEntityRoster(params.pass2aStructuredContext);
  const entityRosterBlock = entityRoster
    ? `\n\n## MANUSCRIPT ENTITY ROSTER (REQUIRED GROUNDING SOURCE)\n${entityRoster}\n\nFor EACH of the 13 criteria, the final_rationale and recommendations MUST cite at least 2 specific characters by name (drawn from the roster above or the structured context) and at least 1 specific scene, object, motif, or location from the manuscript. Generic commentary that names no characters and references no specific manuscript content is NOT acceptable and will be rejected as a quality regression. Refer to the manuscript reference window above to identify the relevant motifs and recurring objects for each criterion.`
    : `\n\n## MANUSCRIPT GROUNDING REQUIREMENT\nFor EACH of the 13 criteria, the final_rationale and recommendations MUST cite at least 2 specific characters by name (drawn from the structured context or manuscript reference window) and at least 1 specific scene, object, motif, or location from the manuscript. Generic commentary that names no characters is NOT acceptable and will be rejected as a quality regression.`;

  const dualModelMode = params.dualModelMode ?? !!params.perplexityChunkPacket;
  const dualModelBlock =
    dualModelMode && params.perplexityChunkPacket
      ? `

## DUAL-MODEL PARALLEL SCORING (Independent Second Evaluation)
This evaluation has TWO independent scoring sweeps over the manuscript chunks:
  • PRIMARY: GPT craft + editorial passes (already reconciled into the comparison packet above).
  • SECONDARY: Perplexity sonar-reasoning-pro chunk sweep (model=${params.perplexityChunkPacket.model}).
Each model scored the chunks WITHOUT seeing the other's output — agreement is a real signal, not an echo.

PERPLEXITY INDEPENDENT SCORES:
${buildPerplexityPacketSummary(params.perplexityChunkPacket)}

Dual-model synthesis rules (REQUIRED):
- Treat the Perplexity packet as a real second opinion. Use it to confirm or challenge the GPT axes.
- When the Perplexity score and the GPT final_score_0_10 diverge by MORE THAN 1 point on any criterion, flag the divergence in final_rationale: name the gap, name which axis is more diagnostic given the manuscript evidence, and resolve toward the better-supported axis.
- When the Perplexity score and the GPT axes AGREE (within ±1), this is a stronger signal of validity — keep the synthesis confident, but do not let agreement substitute for evidence; the rationale must still anchor to manuscript craft.
- Do not import Perplexity's wording verbatim into final_rationale (this is the author-facing surface — keep it craft-voiced, not adjudication-process-voiced).
- Do not invent disagreement where the two models concur, and do not paper over disagreement where they diverge.`
      : "";

  return `Synthesize these two independent evaluation passes for the manuscript titled "${params.title}".${dualModelBlock}

Execution mode: ${executionMode}

OUTPUT BUDGET BY STATE (STRICT):
- agree (score_delta <= 1): emit { key, final_score_0_10, final_rationale (1-3 substantive sentences—NOT "Confirmed."), recommendations[] (with semantic fields) }
- soft_divergence (score_delta 2-3): emit { key, final_score_0_10, final_rationale (1 sentence) }
- hard_divergence (score_delta >= 4): emit { key, final_score_0_10, final_rationale (2 sentences), disputed=true }
- missing_or_invalid: emit concise corrective rationale, no long prose
- overall: verdict + overall_score_0_100 + one_paragraph_summary (max 3 sentences) + top_3_strengths + top_3_risks + submission_readiness

Do NOT emit "Confirmed." as complete rationale for agree criteria. State what was confirmed, the evidence basis, and why it matters.
Do NOT open any final_rationale with "Agreement", "Agreement sustained", "Agreement held", "Both passes", "Both evaluations", or any internal arbitration prefix. Rationale is read directly by the author — write it as craft feedback, not as a process log. Start with the craft observation (e.g. "The opening ambush establishes...", "Tonal register stays...", "Scene construction is anchored by...").
Do NOT return criteria as { agree:[], soft_divergence:[] ... }; return a single criteria[] array.
Every recommendation MUST include: issue_family, strategic_lever, revision_granularity.
For proseControl specifically: ensure at least one recommendation carries a non-empty anchor_snippet.
Every recommendation MUST include the editorial specificity triple as SEPARATE JSON FIELDS (not only embedded in action/expected_impact):
  - "mechanism": the causal explanation (non-empty, e.g. "the abstract phrasing diffuses tension before the decision point").
  - "specific_fix": the concrete revision action (non-empty, e.g. "replace the abstract reaction line with a concrete sensory beat").
  - "reader_effect": the post-revision reader experience (non-empty, e.g. "clearer cause-and-effect, increasing urgency at the turn").
Every recommendation MUST satisfy the five-part contract: ANCHOR (location in text) + SYMPTOM (observable problem) + MECHANISM (causal connector: because/since/so that) + CONCRETE MOVE (replace/cut/insert/rewrite/escalate etc.) + READER EFFECT (urgency/clarity/engagement etc. in expected_impact).
Do NOT emit two recommendations with the same strategic_lever — collapse them first.
For criticism-style criteria (proseControl, dialogue, voice) that are non-certified, emit at least three evidence snippets and three concrete revision directions.
Recommendation openings must be varied across criteria: no repeated first-8-token lead-ins.
When characters are named in the manuscript, use those names (or "the narrator") in rationale/recommendations; avoid generic role labels such as "the protagonist".
Per-criterion specificity floor: Every final_rationale across all 13 criteria MUST name at least 2 specific characters by name (taken from the MANUSCRIPT ENTITY ROSTER above or the character_ledger) and reference at least 1 specific scene, object, motif, or location from the manuscript. Rationales that read as generic craft commentary without naming a single character will be treated as a quality regression. Vary which characters and motifs you cite across the 13 criteria so the report does not echo the same two names everywhere.
Use "narrative momentum" (or equivalent) instead of ambiguous "the drive" phrasing.
Target total visible output under 1500 tokens.

Coverage truth signal:
- ${coverageDisclosure}
- Reference snippet (context anchor only): ${referenceSnippet}
${params.scopeProfile ? `- Submission scope: ${params.scopeProfile.inputScale} (${params.scopeProfile.wordCount} words; ${params.scopeProfile.chunkCount} chunk(s); ${params.scopeProfile.scorableCount}/13 criteria non-NA for this scope; confidence cap ${params.scopeProfile.confidenceCapSummary})` : ""}

## PASS2A_STRUCTURED_CONTEXT (Hard Input)
${structuredContextJson}${entityRosterBlock}

## PASS 1 / PASS 2 COMPARISON PACKET (Deterministic)
${params.comparisonPacketJson}

Reconcile both perspectives into a unified evaluation.
Mandatory behavior:
- Produce explicit agreement_map and divergence_map.
- Preserve major disagreement visibility.
- Provide explicit arbitration rationale for divergence.
- Do not silently merge conflicting conclusions.
- Use named entities from PASS2A_STRUCTURED_CONTEXT.character_ledger when referring to manuscript actors or locations; do not invent missing entities.
- Do not request or assume raw pass payloads; use the comparison packet fields as provided.
- Preserve narrative-mode distinctions when reconciling pacing, narrativeDrive, and character judgments.
- If a chapter accumulates pressure through archives, reflection, or system mapping, distinguish that from true absence of movement.
- For each criterion, identify concrete pressure, then the chapter-level decision (or non-decision), then the resulting consequence.
- If consequence is deferred, name the risk and expected downstream cost explicitly.
- Populate pressure_points, decision_points, consequence_status, and (when deferred) deferred_consequence_risk for every criterion.
Return the synthesis JSON object as specified.`;
}
