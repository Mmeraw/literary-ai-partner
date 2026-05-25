/**
 * Phase 2.7 — Pass 2 Prompt: Editorial/Literary Insight Axis
 *
 * Pass 2 analyses interpretive, thematic, and artistic quality.
 * Temperature: 0.3.  Max tokens: 4000.
 *
 * CRITICAL INDEPENDENCE RULE (Non-Negotiable Rule #3):
 *   Pass 2 MUST NEVER receive Pass 1 output.
 *   Pass 2 receives ONLY: manuscript text + criteria definitions + this prompt.
 *   The orchestrator enforces this — this module must not accept Pass 1 data.
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SubmissionScopeProfile } from "../submissionScope";
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  summarizePromptCoverage,
} from "../promptInput";

export const PASS2_PROMPT_VERSION = "pass2-editorial-v9-provenance-hardening";

export const PASS2_SYSTEM_PROMPT = `You are Pass 2 (editorial_literary), independent from Pass 1.

Output exactly 13 criteria using canonical keys only:
${CRITERIA_KEYS.join(", ")}

Primary job: judgment-only editorial scoring from manuscript text.
Do not do mechanism detection or structural diagnostics (that is Pass 1 territory).

Required per criterion fields:
- key
- score_0_10 (integer 0-10)
- rationale (exactly 1 sentence, <= 180 chars)
- evidence (0-2 items max, snippet <= 200 chars with offsets when possible)
- recommendations (0-1 item max; if present include anchor_snippet)

Rules:
1) Stay independent; do not reference any prior pass.
2) Every non-trivial claim must be evidence-grounded.
3) Keep output concise and non-redundant.
4) No generic boilerplate language.
5) Return valid JSON only.
6) Canonical v2 vocabulary lock: signal_strength uses ONLY NONE|WEAK|SUFFICIENT|STRONG (never MODERATE);
  criterion status uses ONLY SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL when status is emitted.

RATIONALE FORMAT (MANDATORY — independence requirement):
- Each rationale MUST describe the editorial mechanism using cause → effect → reader impact structure.
- Identify WHAT structural or craft choice operates (cause), HOW it produces a narrative outcome (effect), and WHAT the reader experiences as a result (reader impact).
- Do NOT use surface-descriptive phrasing such as "richly detailed", "strong sense of", "well-developed", "vivid", "compelling", or similar evaluative adjectives that describe appearance rather than mechanism.
- Use mechanism verbs: generates, produces, activates, channels, establishes, drives, anchors, exposes, conditions, calibrates.
- Every rationale sentence must identify an editorial mechanism and its observable narrative consequence.
- Example structure: "[Mechanism] [causes / generates / produces] [narrative effect], [orienting / positioning / conditioning] readers [specific reader experience]."

RECOMMENDATION CONTRACT
- If recommendations are emitted, each recommendation must include:
  - anchor/location
  - issue
  - mechanism
  - specific revision move
  - reader effect
- Do NOT use generic filler verbs as standalone advice: enhance, refine, improve, maintain, continue, strengthen, deepen.
- Do NOT emit duplicate recommendations or near-paraphrases.
- Do NOT reference internal analysis labels such as direct_speech, reported_speech, tagged_speech, or tagless_exchange.

EVIDENCE REQUIREMENT
- For every criterion, provide at least 2 concrete evidence anchors from the submitted text whenever possible.
- Each evidence anchor must be:
  - a direct excerpt or clearly identifiable moment from the submitted text
  - specific to the criterion being scored
  - short enough to be readable
  - not a generic summary of the manuscript

PROSE CONTROL CRITERION ADDITIONAL REQUIREMENT
- For the proseControl criterion specifically, the rationale MUST include at least one explicit craft mechanism term (e.g., cadence, register, diction, imagery, rhythm, syntax, fragment, beat, phrasing, repetition, linebreak) that explains WHY the verbatim quote demonstrates prose control (or lack thereof).
- Every proseControl evidence anchor MUST be a verbatim manuscript sentence (not a meta-observation about the prose). Emit the maximum 2 verbatim anchors whenever the manuscript supports it, since downstream synthesis requires at least 3 verbatim proseControl anchors aggregated across passes.
- If a proseControl recommendation is emitted, its action text MUST also name a craft mechanism term (e.g., "tighten syntax", "trim repeated sentence-starters by collapsing the beat").

SCORING + CONFIDENCE HANDLING
- Do not use N/A when the submitted text contains enough material to assess the criterion.
- If evidence is limited, still provide the best score available and indicate reduced confidence through evidence limitations.
- For each criterion:
  - score the criterion
  - summarize the judgment
  - include evidence anchors
  - explain how the evidence supports the score
- Do not collapse artifact hygiene issues, bracketed notes, or drafting residue into criterion N/A. Flag those separately.

Return ONLY:
{
  "pass": 2,
  "axis": "editorial_literary",
  "criteria": [
    {
      "key": "<criterion_key>",
      "score_0_10": 0,
      "rationale": "<one sentence>",
      "evidence": [{ "snippet": "", "char_start": 0, "char_end": 0 }],
      "recommendations": [{ "priority": "medium", "action": "", "expected_impact": "", "anchor_snippet": "" }]
    }
  ],
  "prompt_version": "${PASS2_PROMPT_VERSION}",
  "temperature": 0.3,
  "generated_at": "<ISO 8601 timestamp>"
}

Note: do NOT emit a "model" field. Model identity is stamped server-side from the actually-executed resolver. Any "model" value you emit will be ignored.`;

/**
 * Builds the Author Corrections Block from accepted_story_ledger_v1.governance_rail.
 * This block is MANDATORY — author flags and comments take precedence over AI extraction.
 * Returns null if no corrections or notes were provided.
 */
export function buildAuthorCorrectionsBlock(
  governanceRail: Record<string, unknown> | null | undefined
): string | null {
  if (!governanceRail) return null;

  const layerDecisions = governanceRail.layer_decisions as
    Record<string, { status: string; comment: string }> | undefined;

  const LAYER_LABELS: Record<string, string> = {
    canonical_identity_layer: "Canonical Identity",
    cast_role_tier_layer: "Cast / Role Tier",
    pov_structure_layer: "POV Structure",
    relationship_network_layer: "Relationship Network",
    object_symbol_layer: "Object / Symbol",
    location_timeline_worldstate_layer: "Timeline / Location / World-State",
    threat_antagonist_ending_layer: "Threat / Pressure / Ending",
    source_integrity_layer: "Source Integrity",
  };

  const corrections: string[] = [];
  const notes: string[] = [];
  // Source Integrity is the author-enrichment surface: its comment is the
  // author's description of novel-specific peculiarities (gender-ambiguous
  // protagonist, intentional non-linear timeline, dialect, etc.) and must be
  // labelled distinctly so the model treats it as enriching context rather
  // than as a correction or error report.
  let sourceIntegrityEnrichment: string | null = null;

  if (layerDecisions && Object.keys(layerDecisions).length > 0) {
    for (const [layerKey, decision] of Object.entries(layerDecisions)) {
      const label = LAYER_LABELS[layerKey] ?? layerKey;
      const isRejected =
        decision?.status === 'rejected' || decision?.status === 'rejected_with_comment';
      const hasComment =
        typeof decision?.comment === 'string' && decision.comment.trim().length > 0;

      const commentText = hasComment ? decision.comment.trim() : "";

      if (layerKey === 'source_integrity_layer') {
        if (hasComment) {
          sourceIntegrityEnrichment = commentText;
        }
        continue;
      }

      if (isRejected && hasComment) {
        corrections.push(`- ${label} [FLAGGED AS INCORRECT]: "${commentText}"`);
      } else if (isRejected) {
        corrections.push(`- ${label} [FLAGGED AS INCORRECT — no comment provided]`);
      } else if (hasComment) {
        notes.push(`- ${label} [Author note]: "${commentText}"`);
      }
    }
  }

  const authorNotes = governanceRail.author_notes as string | null | undefined;
  const editRequests = governanceRail.edit_requests as string[] | null | undefined;

  if (
    corrections.length === 0 &&
    notes.length === 0 &&
    !authorNotes &&
    !editRequests?.length &&
    !sourceIntegrityEnrichment
  ) {
    return null;
  }

  const lines: string[] = [
    "## AUTHOR CORRECTIONS — MANDATORY GOVERNING CONTEXT",
    "",
    "The author reviewed the Story Layer extraction and provided the following corrections and notes.",
    "These inputs are AUTHORITATIVE. Author corrections take precedence over AI extraction.",
    "Score with these corrections active. Do not revert to unverified extraction.",
    "",
  ];

  if (sourceIntegrityEnrichment) {
    lines.push("### Author Enrichment Context (novel-specific peculiarities — treat as ground-truth authorial intent):");
    lines.push(sourceIntegrityEnrichment);
    lines.push("");
  }

  if (corrections.length > 0) {
    lines.push("### Layers flagged as INCORRECT by author (treat as contested — author's version is ground truth):");
    lines.push(...corrections);
    lines.push("");
  }

  if (notes.length > 0) {
    lines.push("### Author notes on specific layers:");
    lines.push(...notes);
    lines.push("");
  }

  if (authorNotes?.trim()) {
    lines.push("### General author notes:");
    lines.push(authorNotes.trim());
    lines.push("");
  }

  if (editRequests?.length) {
    lines.push("### Author's specific edit requests (factor into recommendations):");
    editRequests.forEach((r) => lines.push(`- ${r}`));
    lines.push("");
  }

  lines.push("END OF AUTHOR CORRECTIONS — proceed with above as governing context.");

  return lines.join("\n");
}

export function buildPass2UserPrompt(params: {
  manuscriptText: string;
  workType: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  scopeProfile?: SubmissionScopeProfile;
  /** Pre-built character ledger block from Pass 1A — injected before manuscript text. */
  characterLedgerBlock?: string;
  /** Author corrections from accepted_story_ledger_v1.governance_rail — MANDATORY if present. */
  authorCorrectionsBlock?: string | null;
}): string {
  const wordCount = params.manuscriptText.trim().split(/\s+/).length;
  const executionMode = params.executionMode ?? "TRUSTED_PATH";
  // DEPRECATED-PATH (2026-05-13): buildPromptInputWindow performs the
  // 40,000-char silent truncation that produces PASS{1,2,3}_TIMEOUT on
  // long manuscripts. Will be replaced by chunk-scoped map-reduce in
  // PR-A of docs/MAP_REDUCE_PIPELINE_GOVERNANCE_BRIEF.md (locked PR #473).
  // Do NOT add new callers.
  const promptWindow = buildPromptInputWindow(params.manuscriptText);
  const coverage = summarizePromptCoverage(params.manuscriptText);
  const ledgerSection = params.characterLedgerBlock
    ? `\n${params.characterLedgerBlock}\n`
    : "";
  const correctionsSection = params.authorCorrectionsBlock
    ? `\n${params.authorCorrectionsBlock}\n`
    : "";
  return `Evaluate this ${params.workType || "manuscript"} excerpt titled "${params.title}" on the EDITORIAL/LITERARY INSIGHT axis.

Execution mode: ${executionMode}
Word count: ${wordCount}
${buildCoverageDisclosure(coverage)}
${params.scopeProfile ? `Submission scope: ${params.scopeProfile.inputScale} (${params.scopeProfile.wordCount} words; ${params.scopeProfile.chunkCount} chunk(s); ${params.scopeProfile.scorableCount}/13 criteria non-NA for this scope). Treat scope-limited criteria accordingly.` : ""}${correctionsSection}${ledgerSection}
Manuscript text:
${promptWindow}

Return the JSON evaluation object as specified.
Mandatory behavior:
- Cover all 13 criteria.
- Stay fully independent from any prior analysis.
- Rationale must be exactly 1 sentence per criterion.
- Evidence array max 2 entries per criterion and target 2 anchors whenever source support is available.
- Recommendations array max 1 entry per criterion.
- For chapter-mode or smaller inputs, do not judge narrativeClosure as full-arc resolution and treat marketability as provisional.
- Do not add sections beyond the specified schema.`;
}
