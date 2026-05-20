/**
 * Phase 2.7 — Pass 3 Prompt: Synthesis & Reconciliation
 *
 * Pass 3 reconciles Pass 1 (craft) and Pass 2 (editorial) outputs,
 * producing a unified dual-axis evaluation.
 * Temperature: 0.2.  Max tokens: environment-tunable (default 9000).
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SubmissionScopeProfile } from "../submissionScope";
import type { Pass2aStructuredContext, SinglePassOutput, Pass1aCharacterLedger, CharacterArcLedgerEntry, SymbolPayoffEntry, CharacterLedgerV2 } from "../types";
import type { Pass3ReadAheadResult } from "../runPass3ReadAhead";
import { formatActiveBlockersForPrompt } from "../ledgerValidation";
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  getDefaultSynthesisReferenceCharBudget,
  summarizePromptCoverage,
} from "../promptInput";

export const PASS3_PROMPT_VERSION = "pass3-synthesis-v18-tier1-ledger";

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDATION GROUNDING GATE (HARD RULES — SUPPRESS ANY REC THAT FAILS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before emitting any recommendation, validate ALL of the following. A single failure = rec is suppressed entirely (do not emit it, do not downgrade it, do not emit a placeholder).

GATE 1 — EVIDENCE QUOTE REQUIRED
Every recommendation MUST include an anchor_snippet containing a verbatim or near-verbatim quote from the manuscript. If you cannot locate the exact offending line, the recommendation is suppressed.
→ This blocks: "glib aside" with no quoted line, "compress by 10%" with no target sentence, "mixed metaphor" with no identified line.
→ Rule: You may NOT use the phrases "glib aside", "mixed metaphor", "lyrical drift", "unclear orientation", "expository line", "over-translated", or equivalent craft-weakness labels UNLESS anchor_snippet contains the verbatim target. If you cannot locate the offending line in your evidence, OMIT the recommendation entirely.

GATE 2 — CHARACTER CO-PRESENCE VALIDATION
If a recommendation names two or more characters together in a scene, check the CHARACTER ARC LEDGER coPresenceMap. If their firstSharedChunk is AFTER the target chapter, the recommendation is suppressed.
→ This blocks: placing Paolito and Benjamin together before their first shared scene, placing Raúl in a scene he does not appear in.
→ Rule: Never place characters together in a recommendation unless the coPresenceMap or relational_engines ledger confirms they are co-present in that chapter/chunk range.

GATE 3 — NAME-STATE VALIDATION
Check the CHARACTER ARC LEDGER nameStates for every character referenced. Do not use a name that is not valid for the target chapter/chunk range.
→ This blocks: using "Paul" before the embassy renaming scene, using an alias before it is introduced.
→ Rule: If nameStates shows validFromChunk > target chunk, use the earlier valid name instead. If in doubt, omit the character name and suppress the rec.

GATE 4 — EXISTING COPING MECHANISM CHECK
Before recommending "seed X ritual" or "add X coping mechanism" for any character, check copingMechanisms in the CHARACTER ARC LEDGER. If two or more coping mechanisms already exist for that character, suppress the "seed" recommendation and instead recommend FOREGROUNDING or EARLIER PLACEMENT of an existing mechanism.
→ This blocks: "seed a coping ritual for Benjamin" when Benjamin already has smoking, pencil-lining, shopping, Starbucks runs in the ledger.
→ Rule: "Seed" language is only valid when copingMechanisms.length === 0 for that character. Otherwise use "foreground", "surface earlier", or "echo" language.

GATE 5 — MULTI-ZONE EVIDENCE RULE
For any manuscript ≥ 25,000 words: no criterion recommendation may cite only Opening-zone evidence. Every recommendation must cite evidence from at least two distinct act zones (Opening, MID-EARLY, MID, MID-LATE, LATE, Close). If supporting evidence from mid or late acts cannot be found, mark confidence as LOW and suppress the recommendation.
→ This blocks: all 13 criteria recommendations anchoring exclusively to Chapter 1 for a 111,732-word novel.
→ Rule: narrativeClosure recommendations must cite LATE/Close evidence. Recommendations about novel-wide patterns must span at least two act zones.

GATE 6 — LOW-PRIORITY / HIGH-CONFIDENCE SUPPRESSION
If a recommendation has priority = "low" AND the criterion confidence_band = "HIGH", suppress the recommendation or demote it to a parenthetical note inside the rationale. Do not emit it as a standalone recommendation.
→ This blocks: "Name a highway marker or ejido" on a worldbuilding criterion already rated High Confidence and 8/10.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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


// ── Character Arc Ledger block builder ────────────────────────────────────

function buildCharacterLedgerBlock(ledger?: Pass1aCharacterLedger, ledgerV2?: CharacterLedgerV2): string {
  if (!ledger || ledger.entries.length === 0) return "";
  const summary = ledger.coverage_summary;
  const rows = ledger.entries.map((e: CharacterArcLedgerEntry) => {
    const agePart = e.age_exact_first !== null
      ? ` | age ${e.age_exact_first}${e.age_exact_last !== null ? `→${e.age_exact_last}` : ""}`
      : e.age_signal ? ` | ${e.age_signal}` : "";
    const aliasPart = e.aliases.length > 0 ? ` (aka ${e.aliases.join(" / ")})` : "";
    const identityPart = [
      ...e.racial_ethnic_signals.slice(0, 2),
      ...e.lgbtq_signals.slice(0, 2),
      ...e.disability_neuro_signals.slice(0, 1),
    ].filter(Boolean).join(", ");
    const symbolPart = e.symbolic_objects.length > 0
      ? ` | symbols: ${e.symbolic_objects.map((s) => `${s.object}${s.traced ? " ✓traced" : ""}`).join(", ")}`
      : "";
    const relPart = e.relational_engines.length > 0
      ? ` | rels: ${e.relational_engines.map((r) => `${r.other_character}(${r.relationship_type})`).join(", ")}`
      : "";
    const warnPart = e.warnings.length > 0
      ? ` ⚠ ${e.warnings.map((w) => w.type).join(", ")}`
      : "";
    // nameStates for grounding gate 3
    const nameStatePart = (e.nameStates ?? []).length > 0
      ? `\n  nameStates: ${e.nameStates.map((ns) =>
          `${ns.name}(chunks ${ns.validFromChunk}→${ns.validUntilChunk ?? "end"})`
        ).join(" | ")}`
      : "";
    // copingMechanisms for grounding gate 4
    const copingPart = (e.copingMechanisms ?? []).length > 0
      ? `\n  coping[${e.copingMechanisms.length}]: ${e.copingMechanisms.map((c) =>
          `"${c.description}"(${c.frequency},ch${c.firstAppearsChunk})`
        ).slice(0, 5).join(", ")}`
      : "";
    // coPresenceMap for grounding gate 2
    const coPresencePart = Object.keys(e.coPresenceMap ?? {}).length > 0
      ? `\n  firstMeets: ${Object.entries(e.coPresenceMap).map(([other, v]) =>
          `${other}@chunk${v.firstSharedChunk}`
        ).join(", ")}`
      : "";
    return [
      `• ${e.canonical_name}${aliasPart}`,
      `  role=${e.role} weight=${e.narrative_weight_band}${agePart} gender=${e.gender_identity}`,
      identityPart ? `  identity: ${identityPart}` : null,
      `  who: ${e.who_is_this}`,
      e.how_signal ? `  behavior: ${e.how_signal}` : null,
      `  arc: ${e.arc_start} → ${e.arc_turning_points.slice(0, 2).join(" → ")} → ${e.arc_end_state}`,
      `  ending: ${e.ending_status}${symbolPart}${relPart}${warnPart}`,
      nameStatePart || null,
      copingPart || null,
      coPresencePart || null,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const hardFails = summary.hard_fail_triggers.length > 0
    ? `\n\n⛔ HARD-FAIL TRIGGERS:\n${summary.hard_fail_triggers.map((t) => `  ${t}`).join("\n")}`
    : "";
  const symbolTable = summary.symbol_payoff_items.length > 0
    ? `\n\nSYMBOL PAYOFF TABLE:\n${(summary.symbol_payoff_items as SymbolPayoffEntry[]).map((s) =>
        `  ${s.object} | chars: ${s.attached_characters.join(", ")} | chunks ${s.first_chunk}→${s.last_chunk} | ${s.status}${s.traced ? " ✓traced" : " ✗not-traced"}`
      ).join("\n")}`
    : "";
  const relEngines = summary.relational_engines.length > 0
    ? `\nRELATIONAL ENGINES: ${summary.relational_engines.join(" | ")}`
    : "";

  // Tier 1: inject CharacterLedgerV2 active blockers if available
  const v2BlockerBlock = ledgerV2
    ? `\n\n${formatActiveBlockersForPrompt(ledgerV2)}`
    : "";

  // Tier 1: inject validation query summary (coverage + negative knowledge count)
  const v2ValidationSummary = ledgerV2
    ? `\nLEDGER V2 VALIDATION QUERIES ACTIVE: ${Object.keys(ledgerV2.validationQueries.coPresenceIndex).length} co-presence pairs indexed | ${Object.keys(ledgerV2.validationQueries.nameStateIndex).length} name-state entries | ${Object.keys(ledgerV2.validationQueries.copingIndex).length} coping index entries | ${ledgerV2.activeBlockers.length} active blockers (${ledgerV2.activeBlockers.filter((b) => b.severity === "suppress").length} suppress, ${ledgerV2.activeBlockers.filter((b) => b.severity === "downgrade").length} downgrade, ${ledgerV2.activeBlockers.filter((b) => b.severity === "warn").length} warn)`
    : "";

  return `\n\n## PASS 1A — CHARACTER ARC LEDGER (Hard Input)
Schema: ${ledger.schema_version} | Chunks: ${ledger.total_chunks_processed}
Protagonists: ${summary.protagonists.join(", ") || "NONE ⚠"}
Co-protagonists: ${summary.co_protagonists.join(", ") || "none"}
Antagonists: ${summary.antagonists.join(", ") || "none"}
${relEngines}

CHARACTER ENTRIES:
${rows}${symbolTable}${hardFails}

LEDGER RULES (REQUIRED):
- Every character above MUST appear in the report by canonical name.
- ✓traced symbols must show their full arc in the report (first function → payoff).
- Children (age_exact / life_stage=child) must be identified as such — do not treat them as generic victims.
- Characters with disability_neuro_signals (OCD, PTSD, rituals) must have those patterns named.
- Hard-fail triggers above MUST be addressed before claiming narrative closure.
- GROUNDING GATE 2: Before placing two characters in a scene together in a recommendation, verify coPresenceMap confirms firstSharedChunk ≤ target chunk.
- GROUNDING GATE 3: Before using any character name, verify nameStates confirms that name is valid for the target chunk range.
- GROUNDING GATE 4: Before recommending "seed" a coping mechanism, verify copingMechanisms is empty for that character. If coping mechanisms exist, use "foreground" or "surface earlier" instead.${v2BlockerBlock}${v2ValidationSummary}`;
}

// ── Read-ahead primer block builder ───────────────────────────────────────

function buildReadAheadPrimerBlock(readAhead?: Pass3ReadAheadResult): string {
  if (!readAhead || readAhead.is_fallback) return "";
  const charList = readAhead.character_first_impressions.slice(0, 10).map((c) => {
    const demo = c.demographic_signals.length > 0 ? ` [${c.demographic_signals.slice(0, 3).join(", ")}]` : "";
    const age = c.age_if_stated !== null ? ` age ${c.age_if_stated}` : c.life_stage !== "unknown" ? ` (${c.life_stage})` : "";
    const syms = c.symbolic_objects_attached.length > 0 ? ` | symbols: ${c.symbolic_objects_attached.join(", ")}` : "";
    return `  ${c.name}${demo}${age} — ${c.role_impression} — ${c.arc_impression}${syms} [${c.present_in.join(", ")}]`;
  }).join("\n");
  const symList = readAhead.symbol_register.map((s) =>
    `  ${s.object}: ${s.first_window}→${s.last_window_seen} — ${s.function_impression}`
  ).join("\n");
  const relList = readAhead.relationship_spine_impressions.map((r) =>
    `  ${r.pair}: ${r.dynamic_impression}`
  ).join("\n");
  const concerns = readAhead.coverage_concerns.length > 0
    ? `\nCOVERAGE CONCERNS:\n${readAhead.coverage_concerns.map((c) => `  ⚠ ${c}`).join("\n")}`
    : "";
  return `\n\n## PASS 3 READ-AHEAD PRIMER (Pre-scoring manuscript impression)
POV: ${readAhead.narrative_structure_map.pov_architecture}
Tone: ${readAhead.narrative_structure_map.dominant_tone} | Scope: ${readAhead.narrative_structure_map.temporal_scope}
Opening: ${readAhead.narrative_structure_map.act_impressions.opening_register}
Late-act: ${readAhead.narrative_structure_map.act_impressions.late_act_pressure}
Ending: ${readAhead.narrative_structure_map.act_impressions.ending_register}

CHARACTERS (from read-ahead):
${charList || "  (none detected)"}
SYMBOLS: ${symList || "  (none)"}
RELATIONSHIPS: ${relList || "  (none)"}${concerns}

SYNTHESIS NOTE: If scored packets are opening-heavy but your read-ahead detected strong arcs/symbols
in LATE-MIDDLE or ENDING windows, address the late-act content in your synthesis explicitly.`;
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
  /**
   * Pass 1A character arc ledger — structured identity, arc, and relationship data.
   * Optional — Pass 3 degrades gracefully without it.
   */
  characterLedger?: Pass1aCharacterLedger;
  /**
   * Tier 1 CharacterLedgerV2 — full six-ledger envelope with active blockers and
   * validation query indices.  When present, overrides the v1 ledger for blocker
   * injection and supplies deterministic suppression labels to the system prompt.
   * Optional — Pass 3 degrades gracefully to v1 ledger rules when absent.
   */
  characterLedgerV2?: CharacterLedgerV2;
  /**
   * Pass 3 read-ahead result — manuscript impression formed BEFORE scoring arrived.
   * Optional — Pass 3 degrades gracefully without it.
   */
  readAheadResult?: Pass3ReadAheadResult;
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

${buildCharacterLedgerBlock(params.characterLedger, params.characterLedgerV2)}${buildReadAheadPrimerBlock(params.readAheadResult)}

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
