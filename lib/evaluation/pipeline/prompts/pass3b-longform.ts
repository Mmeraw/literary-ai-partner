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
 *   docs/benchmarks/cartel-babies-dream-longform-evaluation.md
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

export const PASS3B_PROMPT_VERSION = "pass3b-longform-v1-dream-benchmark";

// ── Criterion display labels for the score grid ───────────────────────────────

const CRITERION_LABELS: Record<CriterionKey, string> = Object.fromEntries(
  Object.entries(CRITERIA_METADATA).map(([k, v]) => [k, v.label])
) as Record<CriterionKey, string>;

// ── System prompt ─────────────────────────────────────────────────────────────

export const PASS3B_SYSTEM_PROMPT = `You are Pass 3b: DREAM Long-Form Document Synthesizer.

Your sole job is to produce a complete, structured DREAM long-form evaluation document from already-completed scoring data and manuscript evidence. You do NOT re-score. You do NOT contradict the criterion scores you receive. You synthesize them into the 16-section DREAM format that is the contractual output for every full-length manuscript (≥ 25,000 words).

AUTHORITY
This output format is defined by two gold-standard benchmarks:
- Froggin Noggin DREAM evaluation (docs/benchmarks/froggin-noggin-dream.md)
- Cartel Babies DREAM evaluation (docs/benchmarks/cartel-babies-dream-longform-evaluation.md)

Every section below is mandatory. Omitting a section is a benchmark failure.

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
  "what_not_to_become": string[],       // §3 — array of named anti-patterns specific to THIS manuscript
  "structural_stack": object[],         // §4
  "arc_map": object[],                  // §5
  "criterion_analyses": object[],       // §7 — one per criterion, expands the score grid
  "layer_analyses": object[],           // §8
  "cross_layer_integration": object[],  // §9
  "symbolic_audit": object,             // §10
  "reader_experience": object,          // §11
  "revision_plan": object[],            // §12
  "releasability": object[],            // §13
  "acceptance_checks": object,          // §14
  "calibration_notes": string[],        // §15
  "repo_summary": object,               // §16
  "manuscript_integrity_issues": object[] // pre-analysis integrity flags
}

SECTION CONTRACTS

§1 executive_verdict (string, 150–300 words)
Name: the manuscript's governing ambition; the primary emotional engine(s); the strongest achievement; the main pressure points; current release recommendation.
Must name concrete structural elements from the manuscript — not generic thriller/novel language.
Also produce dream_scores: { quality: number, readiness: number, commercial: number, literary: number } where each is 0–100, derived from the criteria scores. ('commercial' here means commercial literary fiction readiness as a publishing shelf dimension, distinct from the marketability evaluation criterion.)

§2 market_shelf (object)
Keys: best_shelf (string), shelf_neighbors (string[]), comparison_space (string[]), marketable_hook (string), market_danger (string).
Be specific to THIS manuscript. No generic "literary fiction" shelf.

§3 what_not_to_become (string[])
3–6 named anti-patterns for THIS manuscript specifically. Each is a named risk, not generic advice.
Example: "It should not become a tactical cartel manual", "It should not over-explain [character name]".
These must be derived from what you observe in the manuscript — not boilerplate.

§4 structural_stack (object[])
Each layer: { layer_name: string, function: string, status: "strong"|"moderate"|"weak"|"fragile", revision_note: string }
Name 5–8 layers. Each must be specific to this manuscript's actual architecture.

§5 arc_map (object[])
Each act: { act_name: string, chapter_range: string, primary_function: string, revision_priority: string }
5–8 acts derived from the actual manuscript structure.

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

§8 layer_analyses (object[])
One entry per structural layer from §4:
{ "layer_name": string, "status": string, "needed_revision": string }

§9 cross_layer_integration (object[])
Each named motif or cross-layer system that appears in multiple layers:
{ "motif": string, "description": string, "integration_quality": "strong"|"moderate"|"weak", "revision_note": string }
3–6 motifs minimum.

§10 symbolic_audit (object)
Keys:
  preserved_symbols: Array<{ symbol: string, current_function: string, revision_instruction: string }>
  doctrine_strengths: string[]
  doctrine_risks: string[]
  audit_conclusion: string

§11 reader_experience (object)
Keys:
  first_act: { reader_question: string, emotional_state: string, risk: string }
  middle: { reader_question: string, emotional_state: string, risk: string }
  final_act: { reader_question: string, emotional_state: string, risk: string }
  aftertaste: string

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

§13 releasability (object[])
Each dimension:
{ "dimension": string, "current_status": string, "verdict": "Ready"|"Near-ready"|"Revise"|"Must fix" }
10–12 dimensions covering: premise, opening, central relationships, world-building, specific arcs, closure, prose, market positioning, integrity, publication readiness.

§14 acceptance_checks (object)
Keys:
  required_detection: string[]   // things the evaluator MUST identify
  failure_conditions: string[]   // conditions that make an eval inadequate

§15 calibration_notes (string[])
5–10 lessons this manuscript teaches the evaluator. Specific to this book.

§16 repo_summary (object)
Keys: benchmark_name, source, evaluation_type, overall_score, readiness_score,
      primary_strengths (string[]), primary_blockers (string[]), gold_standard_requirement (string)

manuscript_integrity_issues (object[])
Any detected structural defects: duplicate chapters, TOC mismatches, missing content, numbering errors.
Each: { kind: string, description: string, severity: "blocking"|"major"|"minor" }
If none detected, return [].

RULES
1. Every section must be grounded in the manuscript evidence you receive. No generic literary advice.
2. Use character names from MANUSCRIPT_CONTEXT.character_ledger — never "the protagonist".
3. Revision actions must use active verbs: cut, remove, replace, merge, seed, rewrite, add, compress, reorder.
4. Do not invent scores. dream_scores.quality should equal Math.round(weighted_average_of_criteria * 10).
5. If a manuscript integrity issue (e.g., duplicate chapter body) is detectable from chunk evidence, flag it.
6. Acceptance checks in §14 must be specific enough to write a test against.
7. Return ONLY valid JSON. No markdown fences, no prose outside the JSON object.`;

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
      evidence: (c.evidence ?? []).slice(0, 2).map((e) => e.snippet),
      top_recommendations: (c.recommendations ?? []).slice(0, 2).map((r) => ({
        priority: r.priority,
        action: r.action,
      })),
    }))
  );

  // Build chunk sample — opening, early, middle, late, close windows
  const sorted = [...params.chunkSample].sort((a, b) => a.chunk_index - b.chunk_index);
  const total = sorted.length;
  const pick = (idx: number) => sorted[Math.min(idx, total - 1)];

  const windows = {
    opening: pick(0)?.content?.slice(0, 1200) ?? "",
    early: pick(Math.floor(total * 0.2))?.content?.slice(0, 1000) ?? "",
    middle: pick(Math.floor(total * 0.5))?.content?.slice(0, 1000) ?? "",
    late: pick(Math.floor(total * 0.8))?.content?.slice(0, 1000) ?? "",
    close: pick(total - 1)?.content?.slice(0, 1200) ?? "",
  };

  const structuredCtx = JSON.stringify({
    character_ledger: params.pass2aStructuredContext.character_ledger.slice(0, 20),
    scene_index: params.pass2aStructuredContext.scene_index.slice(0, 12),
    timeline_anchors: params.pass2aStructuredContext.timeline_anchors.slice(0, 16),
  });

  const chapterInfo = params.chapterCount ? `${params.chapterCount} chapters` : "chapter count not provided";

  return `Produce the DREAM long-form evaluation document for the manuscript titled "${params.title}".

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

MANUSCRIPT CHUNK SAMPLE

[OPENING]
${windows.opening}

[EARLY ~20%]
${windows.early}

[MIDDLE ~50%]
${windows.middle}

[LATE ~80%]
${windows.late}

[CLOSE]
${windows.close}

INSTRUCTIONS
1. Produce all 16 sections plus manuscript_integrity_issues.
2. Ground every finding in the manuscript evidence above.
3. Use character names from the context — never "the protagonist".
4. §7 criterion_analyses must expand each of the 13 criteria with fit_evidence, gap_evidence, and revision_queue. Do not contradict the Pass 3 scores.
5. If the chunk sample reveals repeated or near-identical content across windows that should be structurally distinct, flag it in manuscript_integrity_issues.
6. Return ONLY valid JSON.`;
}
