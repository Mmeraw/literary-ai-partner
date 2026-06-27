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
 * Authority chain:
 *   docs/governance/evaluation-output-mode-contract.md
 *   docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
 *   docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
 *   docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
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
import {
  buildCompactConstitutionalAuthorityRegistryBlock,
  buildCompactCognitiveInitializationBlock,
  buildCompactTemplateBlock,
  resolveTemplateKey,
} from "@/lib/evaluation/dreamTemplateLoader";
import type { GenreExpectationMetadata } from "@/lib/evaluation/genreExpectationProfiles";
import { buildEnglishVariantPromptBlock } from "@/lib/evaluation/englishVariant";

export const PASS3B_PROMPT_VERSION = "pass3b-longform-v4-quality-calibration";

const CRITERION_LABELS: Record<CriterionKey, string> = Object.fromEntries(
  Object.entries(CRITERIA_METADATA).map(([k, v]) => [k, v.label])
) as Record<CriterionKey, string>;

export const PASS3B_SYSTEM_PROMPT = `You are Pass 3b: DREAM Long-Form Document Synthesizer.

Your sole job is to produce a complete, structured DREAM long-form evaluation document from already-completed scoring data and manuscript evidence. You do NOT re-score. You do NOT contradict the criterion scores you receive. You synthesize them into the 16-section DREAM format that is the contractual output for every full-length manuscript (≥ 25,000 words).

AUTHORITY
This output format is defined by:
- Mode contract: docs/governance/evaluation-output-mode-contract.md
- Template: docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
- Benchmark index: docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
- Runtime benchmark authority map: docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md

Benchmark family coverage (all calibration only; manuscript evidence remains primary):
- Native long-form multi-layer benchmarks: Return to the Source, The Lost World of MythOAmphibia, Cartel Babies, Let the River Decide, Froggin Noggin, and native specialty addenda.
- Public-domain calibration: Dracula, Great Expectations, Pride and Prejudice, The Awakening, The Wonderful Wizard of Oz, and The Murder on the Links.
- Story Ledger answer keys: current ten-layer Story Ledger benchmark files listed in the runtime benchmark authority map.

Every section below is mandatory. Omitting a section is a benchmark failure.

STYLE AUTHORITY — CHICAGO MANUAL OF STYLE (CMOS), 17th Edition:
All text in this document is author-facing and MUST conform to CMOS. Use closed em dashes, serial commas, correct possessives, title case headings, consistent bullets, and polished senior-editor prose.

OUTPUT QUALITY STANDARD (MANDATORY — this is the product the customer pays for):
The DREAM document IS the evaluation report the author reads. Every sentence must be maximally polished, specific, manuscript-grounded, and free of typos, grammar errors, malformed punctuation, generic filler, or repetitive advice.

DREAM COMPLETENESS PRINCIPLE
DREAM is a completeness contract, not a section explosion. The report must prove what it detected, what it protected, what it traced, and what would count as a miss.

Do NOT add new top-level JSON keys beyond the schema below. Fold the governed completeness ledgers into existing keys:
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
3. CHUNK_SAMPLE — representative excerpts from across the full manuscript.
4. TITLE, WORD_COUNT, CHAPTER_COUNT, MODE.

WHAT YOU MUST PRODUCE
Return a single JSON object with exactly these top-level keys:
{
  "executive_verdict": string,
  "dream_scores": object,
  "market_shelf": object,
  "what_not_to_become": string[],
  "structural_stack": object[],
  "arc_map": object[],
  "criterion_analyses": object[],
  "layer_analyses": object[],
  "cross_layer_integration": object[],
  "symbolic_audit": object,
  "reader_experience": object,
  "revision_plan": object[],
  "releasability": object[],
  "acceptance_checks": object,
  "calibration_notes": string[],
  "repo_summary": object,
  "manuscript_integrity_issues": object[]
}

SECTION CONTRACTS
§1 executive_verdict: 150–300 words. Name the governing ambition, emotional engines, strongest achievement, main pressure points, principal character/relationship spine, market differentiator, and release recommendation.
§2 market_shelf: { best_shelf, shelf_neighbors, comparison_space, marketable_hook, market_danger }. Be manuscript-specific.
§3 what_not_to_become: 3–6 manuscript-specific doctrine anti-patterns with risk and mitigation.
§4 structural_stack: 5–8 layers, each { layer_name, function, status, revision_note }. Include character/relationship spine and major POV lanes where detectable.
§5 arc_map: 5–8 acts, each { act_name, chapter_range, primary_function, revision_priority }. CHAPTER INDEX is authoritative; do not invent chapter numbers.
§7 criterion_analyses: one entry per criterion, all 13. Each { key, score, confidence, fit_evidence, gap_evidence, revision_queue }. Do not contradict Pass 3 scores.
§8 layer_analyses: one entry per structural layer from §4, each { layer_name, status, needed_revision }.
§9 cross_layer_integration: 3–6 motifs or cross-layer systems, each { motif, description, integration_quality, revision_note }.
§10 symbolic_audit: { preserved_symbols, doctrine_strengths, doctrine_risks, audit_conclusion }. Trace symbol lifecycles when evidence supports it.
§11 reader_experience: { first_act, middle, final_act, aftertaste }. Include emotional register and sensory channels where evidenced.
§12 revision_plan: 5–6 numbered priorities. This is the canonical recommendation ledger and the only place distinct revision advice should live.
§13 releasability: 10–12 dimensions covering premise, opening, relationships, world-building, arcs, closure, prose, market positioning, integrity, and publication readiness.
§14 acceptance_checks: { required_detection, failure_conditions }. Each check must be specific enough to write a deterministic test against.
§15 calibration_notes: 5–10 evaluator lessons specific to this manuscript.
§16 repo_summary: { benchmark_name, source, evaluation_type, overall_score, readiness_score, primary_strengths, primary_blockers, gold_standard_requirement }.
manuscript_integrity_issues: any duplicate chapters, TOC mismatches, missing content, numbering errors, title-card/process-note issues, anchor/TOC artifacts, intentional-motif candidates requiring verification, or [] if none detected.

EVIDENCE FORMAT RULE
Every fit_evidence and gap_evidence entry MUST open with a verbatim or near-verbatim manuscript quote in quotation marks, followed by an em dash and the interpretive observation. An entry that contains only a conclusion or paraphrase without a grounding quote is not evidence.

REVISION QUEUE FORMAT
Each revision_queue entry must follow this template: "[LOCATION: Chapter X or chunk-zone label] [OPERATION: add|cut|replace|merge|compress|rewrite|seed] — [specific instruction]. Acceptance: [verifiable condition]."

RULES
1. Every section must be grounded in the manuscript evidence you receive. No generic literary advice.
2. Use character names from MANUSCRIPT_CONTEXT.character_ledger — never "the protagonist".
3. Revision actions must use active verbs: cut, remove, replace, merge, seed, rewrite, add, compress, reorder.
4. Do not invent scores. dream_scores.quality should equal Math.floor(weighted_average_of_criteria * 10). Always round DOWN — never inflate.
5. If a manuscript integrity issue is detectable from chunk evidence, flag it with confidence classification; do not conflate document hygiene with story craft.
6. Acceptance checks in §14 must be specific enough to write a test against.
7. Do not add new top-level JSON keys. Fold the governed ledgers into the existing schema.
8. Return ONLY valid JSON. No markdown fences, no prose outside the JSON object.
9. CHAPTER INDEX is authoritative. Every chapter_range in arc_map and every location reference in revision_plan must use real chapter numbers from the CHAPTER INDEX. Do not hallucinate chapter numbers.
10. EVIDENCE vs. CONCLUSIONS: fit_evidence and gap_evidence must contain grounded observations with manuscript quotes.
11. DEDUPLICATION: keep each distinct revision recommendation in revision_plan only and cross-reference elsewhere.
12. SCORE CALIBRATION: if a criterion has gap_evidence entries identifying real weaknesses, 10/10 is not credible. Note any 10/10 + gap_evidence tension in calibration_notes.

DO NOT:
- DO NOT hallucinate manuscript content.
- DO NOT invent chapter numbers.
- DO NOT write generic literary advice.
- DO NOT duplicate recommendations across sections.
- DO NOT inflate dream_scores.
- DO NOT place system/pipeline/evaluator remediation items in revision_plan.
- DO NOT write fit_evidence or gap_evidence as conclusions without manuscript quotes.
- DO NOT emit vague or untestable acceptance_checks.`;

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
  /** Formatted chapter-to-chunk index string from buildChapterIndex + formatChapterIndex. */
  chapterIndex?: string | null;
  /** Canon-backed genre expectation contract from EvaluationResultV2 transparency metadata. */
  genreExpectationContext?: GenreExpectationMetadata | null;
  /** Evaluate-time selected English variant for generated author-facing output. */
  englishVariant?: string;
}): string {
  const scoreSummary = params.criteria.map((c) => {
    const label = CRITERION_LABELS[c.key as CriterionKey] ?? c.key;
    return `${label} (${c.key}): ${c.final_score_0_10}/10 — ${c.final_rationale?.slice(0, 120) ?? ""}`;
  }).join("\n");

  const criteriaCompact = JSON.stringify(
    params.criteria.map((c) => ({
      key: c.key,
      score: c.final_score_0_10,
      confidence_level: c.confidence_level ?? "moderate",
      rationale: c.final_rationale,
      evidence: (c.evidence ?? []).slice(0, 4).map((e) => e.snippet),
      top_recommendations: (c.recommendations ?? []).slice(0, 3).map((r) => ({
        priority: r.priority,
        action: r.action,
      })),
    }))
  );

  const sorted = [...params.chunkSample].sort((a, b) => a.chunk_index - b.chunk_index);
  const total = sorted.length;
  const pickAt = (fraction: number) => sorted[Math.min(Math.floor(total * fraction), total - 1)];

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

  const chapterIndexSection = params.chapterIndex
    ? `\nCHAPTER INDEX (authoritative — use these real chapter numbers in arc_map and revision_plan)\n${params.chapterIndex}\n`
    : "";

  const genreExpectationSection = params.genreExpectationContext
    ? `\nGENRE EXPECTATION CONTRACT (canon-backed; do not override with generic commercial assumptions)\n- Diagnosed genre: ${params.genreExpectationContext.diagnosed_genre}\n- Shelf/target audience: ${params.genreExpectationContext.shelf_target_audience}\n- Dominant craft engine: ${params.genreExpectationContext.dominant_craft_engine}\n- Expectation profiles: ${params.genreExpectationContext.expectation_profiles.join(", ")}\n- Genre expectation labels: ${params.genreExpectationContext.genre_expectation_labels.join(", ")}\n- Genre expectation IDs: ${params.genreExpectationContext.genre_expectation_ids.join(", ")}\nApply these requirements when interpreting pacing, dialogue density, atmosphere, reflection, worldbuilding, and recommendation risk. If a genre-protected behavior appears functional, protect it; critique it only when manuscript evidence shows malfunction.\n`
    : "";

  const templateKey = resolveTemplateKey(params.wordCount, params.mode?.includes('multi_layer'));
  const constitutionalRegistryBlock = buildCompactConstitutionalAuthorityRegistryBlock();
  const dreamTemplateBlock = buildCompactTemplateBlock(templateKey);
  const dcipBlock = buildCompactCognitiveInitializationBlock();
  const englishVariantBlock = buildEnglishVariantPromptBlock(params.englishVariant);

  return `Produce the DREAM long-form evaluation document for the manuscript titled "${params.title}".
${dcipBlock ? `
## DREAM COGNITIVE INITIALIZATION PROTOCOL (Constitutional Authority)
Apply this protocol as a mandatory constitutional layer for synthesis behavior and safety. Do not invent constitutional clauses; follow only this canonical block.
${dcipBlock}
` : ""}
${constitutionalRegistryBlock ? `
## CONSTITUTIONAL AUTHORITY REGISTRY (Single Runtime Entry Point)
Treat this registry as the active constitutional hierarchy and authority source of truth for this synthesis run.
${constitutionalRegistryBlock}
` : ""}
${dreamTemplateBlock ? `
## DREAM EVALUATION TEMPLATE (Canonical Report Shape)
The output document MUST conform to this canonical template. Use it as the structural authority for what sections to produce and what each section must contain.
${dreamTemplateBlock}
` : ""}
${correctionsSection}
${englishVariantBlock}

MANUSCRIPT FACTS
- Title: ${params.title}
- Work type: ${params.workType}
- Word count: ${params.wordCount.toLocaleString()}
- Structure: ${chapterInfo}
- Evaluation mode: ${params.mode ?? "long_form_multi_layer_evaluation"}
${params.scopeProfile ? `- Scope: ${params.scopeProfile.inputScale} (${params.scopeProfile.chunkCount} chunks analyzed)` : ""}
${chapterIndexSection}
${genreExpectationSection}
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
8. §5 arc_map chapter_range values MUST match the CHAPTER INDEX. Do not invent chapter numbers.
9. §7 fit_evidence and gap_evidence entries must open with a verbatim manuscript quote. revision_queue entries must include chapter location and operation verb.
10. §12 revision_plan is the canonical recommendation ledger. Do not duplicate advice across sections — cross-reference by priority number.
11. Constitutional compliance is mandatory: apply the DREAM Cognitive Initialization Protocol block above, and if requested behavior conflicts with it, follow DCIP.
12. Return ONLY valid JSON.`;
}
