// canon-audit-allow: vocabulary-detection
// 'commercial' in this file is a DREAM shelf dimension (commercial literary fiction),
// not the banned alias for the 'marketability' evaluation criterion.
/**
 * Pass 3b — Long-Form DREAM Document Synthesis Prompt
 *
 * Fires ONLY when route === "LONG_FORM" (≥ 25,000 words).
 * Receives: Pass 3 synthesized criteria JSON + chunk evidence + structured context.
 * Produces: Full 16-section DREAM long-form evaluation document as structured JSON.
 *
 * Benchmark authority:
 *   docs/benchmarks/froggin-noggin-dream.md
 *   docs/benchmarks/cartel-babies-dream.md
 *   docs/benchmarks/let-the-river-decide-dream.md (calibration)
 *
 * Temperature: 0.3   Max tokens: 16000 (default; see runPass3bLongform getPass3bMaxTokens)
 *
 * DO NOT call this pass for manuscripts < 25,000 words.
 * DO NOT modify the 13-criterion scores — Pass 3b reads them, it does not re-score.
 * DO NOT run the quality gate against Pass 3b output — it is an additive document layer.
 */

import type { SubmissionScopeProfile } from "../submissionScope";
import type { SynthesizedCriterion, ManuscriptChunkEvidence, Pass2aStructuredContext } from "../types";
import { CRITERIA_METADATA } from "@/schemas/criteria-keys";
import type { CriterionKey } from "@/schemas/criteria-keys";

export const PASS3B_PROMPT_VERSION = "pass3b-longform-v3-full-arc-sampling";

// ── Criterion display labels for the score grid ───────────────────────────────

const CRITERION_LABELS: Record<CriterionKey, string> = Object.fromEntries(
  Object.entries(CRITERIA_METADATA).map(([k, v]) => [k, v.label])
) as Record<CriterionKey, string>;

// ── System prompt ─────────────────────────────────────────────────────────────

export const PASS3B_SYSTEM_PROMPT = `You are Pass 3b: DREAM Long-Form Document Synthesizer.

Your sole job is to produce a complete, structured DREAM long-form evaluation document from already-completed scoring data and manuscript evidence. You do NOT re-score. You do NOT contradict the criterion scores you receive. You synthesize them into the 16-section DREAM format that is the contractual output for every full-length manuscript (≥ 25,000 words).

AUTHORITY
This output format is defined by DREAM long-form gold-standard benchmarks:
- Froggin Noggin DREAM evaluation (docs/benchmarks/froggin-noggin-dream.md)
- Cartel Babies DREAM evaluation (docs/benchmarks/cartel-babies-dream.md)
- Let the River Decide DREAM evaluation (docs/benchmarks/let-the-river-decide-dream.md, calibration-tier)

Every section below is mandatory. Omitting a section is a benchmark failure.

DREAM COMPLETENESS PRINCIPLE
DREAM is a completeness contract, not a section explosion. The report must prove what it detected, what it protected, what it traced, and what would count as a miss.

Do NOT add new top-level JSON keys beyond the schema below. Instead, fold the governed completeness ledgers into existing keys:
- Character Coverage & Arc Ledger → structural_stack, layer_analyses, criterion_analyses.character, reader_experience, acceptance_checks.
- Relationship Spine Ledger → structural_stack, cross_layer_integration, reader_experience, acceptance_checks.
- Symbol-to-Character Payoff Ledger → symbolic_audit and cross_layer_integration.
- Sensory / Emotional Register Ledger → cross_layer_integration, symbolic_audit, reader_experience, criterion_analyses.voice/prose/tone/worldbuilding.
- Manuscript Integrity Confidence Table → manuscript_integrity_issues.
- Evidence Distribution / Confidence Gate → criterion_analyses.confidence, fit_evidence, gap_evidence, and acceptance_checks.
- Canonical Recommendation Ledger → revision_plan; do not duplicate the same advice across multiple sections.
- Doctrine Anti-Pattern Ledger → what_not_to_become.

WHAT YOU ARE GIVEN
1. CRITERIA_JSON — the 13 criterion scores, rationales, evidence, and recommendations from Pass 3.
2. MANUSCRIPT_CONTEXT — character ledger, scene index, timeline anchors from Pass 2a.
3. CHUNK_SAMPLE — representative excerpts from across the full manuscript (opening, early, middle, late, close).
4. TITLE, WORD_COUNT, CHAPTER_COUNT, MODE.

WHAT YOU MUST PRODUCE
Return a single JSON object with exactly these top-level keys:

{
  "executive_verdict": string,          // §1
  "dream_scores": object,               // §1 subscores
  "market_shelf": object,               // §2
  "what_not_to_become": string[],       // §3 — doctrine anti-pattern ledger as compact strings
  "structural_stack": object[],         // §4 — includes character/relationship/voice layers
  "arc_map": object[],                  // §5
  "criterion_analyses": object[],       // §7 — one per criterion, expands the score grid
  "layer_analyses": object[],           // §8
  "cross_layer_integration": object[],  // §9 — includes relationship/symbol/sensory systems
  "symbolic_audit": object,             // §10 — includes symbol-to-character payoff and sensory governance
  "reader_experience": object,          // §11 — includes ending emotional register
  "revision_plan": object[],            // §12 — canonical deduped recommendation ledger
  "releasability": object[],            // §13
  "acceptance_checks": object,          // §14 — includes required detections/failure conditions
  "calibration_notes": string[],        // §15
  "repo_summary": object,               // §16
  "manuscript_integrity_issues": object[] // pre-analysis integrity flags with confidence classification
}

SECTION CONTRACTS

§1 executive_verdict (string, 150–300 words)
Name: the manuscript's governing ambition; the primary emotional engine(s); the strongest achievement; the main pressure points; current release recommendation.
Must name concrete structural elements from the manuscript — not generic thriller/novel language.
Must name the principal character/relationship spine if detectable.
Must name the dominant market differentiator if detectable (for example, specialized cognition, technical voice, dual-POV architecture, unusual sensory governance, or symbolic payoff system).
Also produce dream_scores: { quality: number, readiness: number, commercial: number, literary: number } where each is 0–100, derived from the criteria scores. ('commercial' here means commercial literary fiction readiness as a publishing shelf dimension, distinct from the marketability evaluation criterion.)

§2 market_shelf (object)
Keys: best_shelf (string), shelf_neighbors (string[]), comparison_space (string[]), marketable_hook (string), market_danger (string).
Be specific to THIS manuscript. No generic "literary fiction" shelf.
Marketable_hook must identify the manuscript's differentiator beyond genre premise when evidence supports one.

§3 what_not_to_become (string[])
3–6 named doctrine anti-patterns for THIS manuscript specifically. Each string must include the risk and mitigation, not generic advice.
Example: "Avoid tactical-cartel-manual drift: procedural detail should reveal moral pressure, not become replicable instruction."
These must be derived from what you observe in the manuscript — not boilerplate.

§4 structural_stack (object[])
Each layer: { layer_name: string, function: string, status: "strong"|"moderate"|"weak"|"fragile", revision_note: string }
Name 5–8 layers. Each must be specific to this manuscript's actual architecture.
If the manuscript has dual-POV or multi-voice architecture, include separate layers for each major POV lane.
At least one layer should identify the character/relationship spine when detectable.
If a repeated activity, game, lesson, food practice, music channel, local cultural anchor, or ritual functions as a relationship bridge, include it in structural_stack or cross_layer_integration.

§5 arc_map (object[])
Each act: { act_name: string, chapter_range: string, primary_function: string, revision_priority: string }
5–8 acts derived from the actual manuscript structure.
If a co-protagonist or secondary POV lane carries a parallel arc, the act map must account for that lane instead of treating it as subplot only.

§7 criterion_analyses (object[])
One entry per criterion (all 13). Each:
{
  "key": CriterionKey,
  "score": number,
  "confidence": "High"|"Moderate-High"|"Moderate"|"Low",
  "fit_evidence": string[],     // 2–4 specific examples of what is working
  "gap_evidence": string[],     // 2–4 specific weaknesses with manuscript grounding
  "revision_queue": string[]    // 2–4 concrete revision actions, numbered
}
Do NOT contradict the Pass 3 scores. Expand them with manuscript-specific evidence.
Evidence distribution rule: High confidence for major full-manuscript claims requires evidence from at least two act zones. If evidence is concentrated in the opening, downgrade confidence or include an explicit gap_evidence item such as "evidence distribution narrow/opening-heavy".
Character criterion must account for protagonists, co-protagonists, major recurring companions, and ending accountability where evidence supports them.
Voice/POV criterion must account for distinct POV lanes, technical cognition, distinctive intelligence, and behavioral characterization where evidence supports them.
Tone/prose/worldbuilding criteria must account for sensory systems when they materially produce emotional register.
Narrative closure must account for character, relationship, and symbol payoff obligations.
Marketability must account for differentiators beyond genre premise.

§8 layer_analyses (object[])
One entry per structural layer from §4:
{ "layer_name": string, "status": string, "needed_revision": string }
Needed_revision must state either what to change or what to protect.

§9 cross_layer_integration (object[])
Each named motif or cross-layer system that appears in multiple layers:
{ "motif": string, "description": string, "integration_quality": "strong"|"moderate"|"weak", "revision_note": string }
3–6 motifs minimum.
Must include relationship engines, symbol-to-character systems, sensory/emotional systems, or local cultural anchors when the evidence supports them.
Do not treat a bridge activity as mere color if it materially connects hostile groups, captives/guards, authority figures, children, family arcs, companions, or social worlds.

§10 symbolic_audit (object)
Keys:
  preserved_symbols: Array<{ symbol: string, current_function: string, revision_instruction: string }>
  doctrine_strengths: string[]
  doctrine_risks: string[]
  audit_conclusion: string

Symbol entries must trace lifecycle when evidence supports it: first appearance → transfer/transformation → reappearance/payoff.
If sound/music, touch, light, smell, taste, silence, or repeated sensory cues function as punishment, conditioning, authority, trauma trigger, place authenticity, or relationship bridge, treat them as symbolic/sensory systems, not mere atmosphere.

§11 reader_experience (object)
Keys:
  first_act: { reader_question: string, emotional_state: string, risk: string }
  middle: { reader_question: string, emotional_state: string, risk: string }
  final_act: { reader_question: string, emotional_state: string, risk: string }
  aftertaste: string
Reader experience must include emotional register: what sensory channels create dread, tenderness, obedience, aftershock, relief, belonging, or disorientation when evidence supports them.
Ending aftertaste must distinguish plot resolution from emotional aftercare, trauma aftershock, renaming/identity payoff, and intentionally unresolved promise ledgers.

§12 revision_plan (object[])
5–6 numbered priorities. Each:
{
  "priority": number,
  "title": string,
  "goal": string,
  "actions": string[],
  "acceptance_check": string
}
Priorities must be ordered: manuscript integrity first, then compression, then plausibility, then arc/character, then tone/packaging.
Every acceptance_check must be a verifiable condition, not a wish.
Use this as the canonical recommendation ledger: dedupe repeated advice. Each priority must include location, action, mechanism rationale, risk if ignored, and asset to preserve, either in goal/actions/acceptance_check.

§13 releasability (object[])
Each dimension:
{ "dimension": string, "current_status": string, "verdict": "Ready"|"Near-ready"|"Revise"|"Must fix" }
10–12 dimensions covering: premise, opening, central relationships, world-building, specific arcs, closure, prose, market positioning, integrity, publication readiness.
Include a dimension for character/relationship architecture and one for evidence/integrity confidence if material.

§14 acceptance_checks (object)
Keys:
  required_detection: string[]   // things the evaluator MUST identify
  failure_conditions: string[]   // conditions that make an eval inadequate

Required detections must include manuscript-specific character/relationship/symbol/sensory/integrity obligations when evidence supports them.
Failure conditions must include omitted co-protagonist, underweighted relationship spine, untraced symbol payoff, sensory punishment/control system omitted, integrity artifact misclassified as story weakness, or high confidence from opening-only evidence when applicable.

§15 calibration_notes (string[])
5–10 lessons this manuscript teaches the evaluator. Specific to this book.
At least one note must describe what the report must protect during revision.

§16 repo_summary (object)
Keys: benchmark_name, source, evaluation_type, overall_score, readiness_score,
      primary_strengths (string[]), primary_blockers (string[]), gold_standard_requirement (string)
Gold_standard_requirement must state the detection/coverage bar this manuscript teaches the evaluator.

manuscript_integrity_issues (object[])
Any detected structural defects: duplicate chapters, TOC mismatches, missing content, numbering errors, title-card/process-note issues, anchor/TOC artifacts, or intentional-motif candidates requiring verification.
Each: { kind: string, description: string, severity: "blocking"|"major"|"minor" }
Use kind to distinguish confirmed_defect, likely_defect, artifact_suspected, intentional_motif_suspected, title_package_hygiene, anchor_toc_issue, or needs_manual_verification.
If none detected, return [].

RULES
1. Every section must be grounded in the manuscript evidence you receive. No generic literary advice.
2. Use character names from MANUSCRIPT_CONTEXT.character_ledger — never "the protagonist".
3. Revision actions must use active verbs: cut, remove, replace, merge, seed, rewrite, add, compress, reorder.
4. Do not invent scores. dream_scores.quality should equal Math.round(weighted_average_of_criteria * 10).
5. If a manuscript integrity issue is detectable from chunk evidence, flag it with confidence classification; do not conflate document hygiene with story craft.
6. Acceptance checks in §14 must be specific enough to write a test against.
7. Do not add new top-level JSON keys. Fold the governed ledgers into the existing schema.
8. Return ONLY valid JSON. No markdown fences, no prose outside the JSON object.`;

// ── User prompt builder ───────────────────────────────────────────────────────

export function buildPass3bUserPrompt(params: {
  title: string;
  wordCount: number;
  chapterCount?: number;
  workType: string;
  mode?: string;
  criteria: SynthesizedCriterion[];
  pass2aStructuredContext: Pass2aStructuredContext;
  chunkSample: ManuscriptChunkEvidence[];
  scopeProfile?: SubmissionScopeProfile;
  /** Author corrections from accepted_story_ledger_v1.governance_rail — MANDATORY if present. */
  authorCorrectionsBlock?: string | null;
}): string {
  // Build the score grid summary so Pass 3b has all 13 scores in compact form
  const scoreSummary = params.criteria.map((c) => {
    const label = CRITERION_LABELS[c.key as CriterionKey] ?? c.key;
    return `${label} (${c.key}): ${c.final_score_0_10}/10 — ${c.final_rationale?.slice(0, 120) ?? ""}`;
  }).join("\n");

  // Build a compact criteria JSON (evidence + top recommendations) for §7 expansion
  const criteriaCompact = JSON.stringify(
    params.criteria.map((c) => ({
      key: c.key,
      score: c.final_score_0_10,
      confidence_level: c.confidence_level ?? "moderate",
      rationale: c.final_rationale,
      // Increased from 2 to 4 evidence snippets per criterion to reduce opening-heavy bias
      evidence: (c.evidence ?? []).slice(0, 4).map((e) => e.snippet),
      top_recommendations: (c.recommendations ?? []).slice(0, 3).map((r) => ({
        priority: r.priority,
        action: r.action,
      })),
    }))
  );

  // Build chunk sample — 11 evenly distributed windows across the full manuscript.
  // 5 windows at 1200 chars was opening-heavy and missed mid/late-act content.
  // 11 windows at 2000 chars = ~22,000 chars of manuscript prose across the full arc.
  const sorted = [...params.chunkSample].sort((a, b) => a.chunk_index - b.chunk_index);
  const total = sorted.length;
  const pickAt = (fraction: number) =>
    sorted[Math.min(Math.floor(total * fraction), total - 1)];

  // 11 sample points: 0%, 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%
  const SAMPLE_FRACTIONS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const SAMPLE_LABELS = [
    "OPENING (0%)",
    "EARLY-1 (10%)",
    "EARLY-2 (20%)",
    "MID-EARLY (30%)",
    "MID-1 (40%)",
    "MID-2 (50%)",
    "MID-LATE (60%)",
    "LATE-1 (70%)",
    "LATE-2 (80%)",
    "LATE-3 (90%)",
    "CLOSE (100%)",
  ];
  const chunkWindows = SAMPLE_FRACTIONS.map((f, i) => ({
    label: SAMPLE_LABELS[i],
    content: pickAt(f)?.content?.slice(0, 2000) ?? "",
  }));

  const structuredCtx = JSON.stringify({
    character_ledger: params.pass2aStructuredContext.character_ledger.slice(0, 30),
    scene_index: params.pass2aStructuredContext.scene_index.slice(0, 20),
    timeline_anchors: params.pass2aStructuredContext.timeline_anchors.slice(0, 24),
  });

  const chapterInfo = params.chapterCount ? `${params.chapterCount} chapters` : "chapter count not provided";

  const correctionsSection = params.authorCorrectionsBlock
    ? `\n${params.authorCorrectionsBlock}\n\n`
    : "";

  return `Produce the DREAM long-form evaluation document for the manuscript titled "${params.title}".
${correctionsSection}
MANUSCRIPT FACTS
- Title: ${params.title}
- Work type: ${params.workType}
- Word count: ${params.wordCount.toLocaleString()}
- Structure: ${chapterInfo}
- Evaluation mode: ${params.mode ?? "STANDARD"}
${params.scopeProfile ? `- Scope: ${params.scopeProfile.inputScale} (${params.scopeProfile.chunkCount} chunks analyzed)` : ""}

PASS 3 SCORE GRID (do not re-score — expand with evidence)
${scoreSummary}

PASS 3 CRITERIA JSON (for §7 expansion)
${criteriaCompact}

MANUSCRIPT CONTEXT (Pass 2a structured analysis)
${structuredCtx}

MANUSCRIPT CHUNK SAMPLE (11 windows across full arc — use ALL zones when writing evidence)
${chunkWindows.map((w) => `[${w.label}]\n${w.content}`).join("\n\n")}

INSTRUCTIONS
1. Produce all 16 sections plus manuscript_integrity_issues.
2. Ground every finding in the manuscript evidence above.
3. Use character names from the context — never "the protagonist".
4. §7 criterion_analyses must expand each of the 13 criteria with fit_evidence, gap_evidence, and revision_queue. Do not contradict the Pass 3 scores.
5. Apply the governed DREAM completeness contract: character coverage, relationship spine, symbol payoff, sensory/emotional register, integrity confidence, and evidence distribution must be folded into the existing JSON keys.
6. If the chunk sample reveals repeated or near-identical content across windows that should be structurally distinct, flag it in manuscript_integrity_issues with confidence classification.
7. Do not add new top-level JSON keys; preserve the exact required schema.
8. Return ONLY valid JSON.`;
}
