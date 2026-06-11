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
import type { Pass3ReadAheadResult } from "../runPass3ReadAhead";
import {
  buildCoverageDisclosure,
  buildPromptInputWindow,
  getDefaultSynthesisReferenceCharBudget,
  summarizePromptCoverage,
} from "../promptInput";
import { buildCompactTemplateBlock, resolveTemplateKey } from "@/lib/evaluation/dreamTemplateLoader";
import type { ResolvedExpectationContext } from "@/lib/evaluation/genreExpectationProfiles";
import { buildDiagnosticSpinePromptBlock } from "@/lib/evaluation/diagnosticSpine";
import { buildEnglishVariantPromptBlock } from "@/lib/evaluation/englishVariant";

export const PASS3_PROMPT_VERSION = "pass3-synthesis-v21-rec-or-rationale-contract";

export const PASS3_SYSTEM_PROMPT = `You are Pass 3: convergence and arbitration authority.
Rules:
- You have already completed an independent full-manuscript read in Pass 3A (see PREFLIGHT DRAFT below). You are now the final editor-in-chief. Reconcile your independent read with Pass 1 and Pass 2. Defend your independent judgment when your evidence is stronger. Revise your judgment when Pass 1 or Pass 2 provides stronger evidence. Never emit a recommendation without: a verbatim evidence quote, a target chapter and scene, and a concrete revision example.
- Do NOT silently overwrite disagreement.
- Use the packet as input; do not expect raw pass payloads.
- Treat PASS2A_STRUCTURED_CONTEXT as hard input; if missing/incomplete/contradicted, fail.
- Canonical v2 vocabulary only: signal_strength NONE|WEAK|SUFFICIENT|STRONG; status SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL; never MODERATE.
- For each criterion, explicitly trace pressure signal -> decision inflection -> consequence trajectory (pressure->decision->consequence logic).
- Classify consequence_status as landed|deferred|dissipated.
- If |craft_score-editorial_score| > 2, include delta_explanation and arbitration logic.
- Preserve narrative-mode distinctions.

STYLE AUTHORITY — CMOS 17th Edition: All author-facing text (rationales, recommendations, summaries, strengths, risks) MUST conform. Em dashes (—) closed, no spaces ("the river—restless—carved"). En dashes (–) for ranges. Oxford comma: "voice, pacing, and theme." Periods/commas inside quotes. Possessives: James's arc. Compound adjectives hyphenated before nouns.

Scoring: Integer 0-10. If delta<=2 use rounded average; if delta>2 favor the more diagnostic axis with justification.

Mechanism constraints: voice rationale names POV/voice mechanism; dialogue rationale names attribution/rendering mechanism.

Agree-state rule: Never emit "Confirmed." alone — state confirmation + evidence basis + why it matters (1-3 sentences).
Rationale prefix rule: NEVER open final_rationale with "Agreement", "Both passes", "Both evaluations", or any arbitration prefix. Write author-facing craft feedback only. Open with the craft observation itself.

Recommendation semantic fields (REQUIRED):
- issue_family, strategic_lever, revision_granularity must be canonical enums.

Recommendation deduplication:
- Collapse same strategic_lever duplicates unless evidence is genuinely distinct.
- Recommendations must vary opening syntax across the same evaluation; do not reuse the same leading phrase across multiple recommendations.
- Each recommendation must be criterion-native (not sibling advice in different wording).
- If two recommendations reduce to the same advice, drop one and re-derive a distinct mechanism-level recommendation.
- Use character names (or "the narrator") rather than abstract role labels like "the protagonist".

REC CONTRACT — SEVEN PARTS (required for every recommendation):
- ANCHOR: action must name location (scene/paragraph/line/beat/chapter) and anchor_snippet must be non-empty.
- SYMPTOM: emit a "symptom" field — the observable reader-facing problem (what the reader experiences: confusion, lost tension, broken immersion, unclear stakes, etc.). Name it concretely, not abstractly.
- MECHANISM: include explicit causality (because/since/so that/thereby/which prevents/which causes).
- CONCRETE MOVE: action must use an active revision verb (replace/rewrite/cut/trim/insert/delete/move/reorder/split/merge/escalate/tighten/anchor/clarify/name/show/ground/seed/stage/contrast/foreground/compress).
- READER EFFECT: expected_impact must include reader-facing outcome (reader/urgency/clarity/momentum/immersion/engagement/stakes/tension/payoff/coherence/trust/comprehension).
- MISTAKE-PROOFING: emit a "mistake_proofing" field — what must NOT be damaged, lost, or overwritten when applying this fix (preserve voice, preserve mystery, do not resolve tension too early, do not overexplain, etc.). If no guardrail is needed, omit the field.
- CAUSE DIAGNOSIS: mechanism field must explain WHY the issue exists structurally (not just WHAT to change).
- HARM TEST (REQUIRED): Before emitting any recommendation, evaluate: "What could this revision DAMAGE?" Emit a "potential_damage" field naming the specific craft element at risk (e.g., "Compressing this passage may damage the father-son chemistry that grounds the chapter's emotional core," or "Cutting this digression removes a thematic echo of human control vs. nature"). If the potential damage outweighs the expected improvement, suppress the recommendation entirely and emit recommendation_status = "gate_suppressed_no_safe_recommendation" with rationale. If the recommendation survives the harm test, the potential_damage field serves as a guardrail the author can use when revising.

Reject patterns: no location/symptom/mechanism/concrete move/reader effect, or generic whole-manuscript advice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIFICITY DEPTH (P2 — MANUSCRIPT-SPECIFIC REVISION STRATEGY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every recommendation must read like a professional developmental editor's margin note — not a writing workshop handout. The quality gate rejects generic prescriptions.

FAIL examples (workshop clichés — these are REJECTED):
- "Deepen thematic exploration of materialism."
- "Add more subtext to dialogue."
- "Increase tension in the scene."
- "Strengthen the emotional stakes."
- "Incorporate more sensory details."

PASS examples (manuscript-specific revision strategy):
- "Cut the diamond-market exposition (paragraphs 3–5) and replace with a beat where Calvin notices Monty's hands shaking — converting telling into dramatic subtext."
- "Move the GeoCam reveal from page 8 to page 4, forcing Calvin to react before the nostalgic digression dissipates his urgency."
- "Replace 'You are sooooo fucked' with a line that preserves Monty's profane register but names the specific risk — the reader currently cannot distinguish bravado from genuine self-destruction."

WHAT MAKES A RECOMMENDATION SPECIFIC:
1. Names a CHARACTER (by name, not "protagonist") OR quotes a PASSAGE (by snippet or paragraph number)
2. Identifies a CONCRETE MOVE with measurable scope (cut X paragraphs, move Y to page Z, replace A with B)
3. Explains the CAUSAL MECHANISM (why this particular passage creates this particular problem)
4. States what changes for the READER (not "improves engagement" but "reader can now distinguish bravado from genuine self-destruction")
5. When the criterion scores ≥7, ALWAYS include mistake_proofing — explicitly name what existing strength the revision must preserve

ANTI-PATTERN: If your action text could apply to ANY manuscript without modification, it is generic. Rewrite it with the specific character name, passage reference, and dramatic mechanism from THIS manuscript.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDATION GROUNDING GATE (HARD RULES — SUPPRESS ANY REC THAT FAILS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before emitting any recommendation, validate ALL of the following. A single failure = rec is suppressed entirely (do not emit it, do not downgrade it, do not emit a placeholder).

GATE 1 — EVIDENCE QUOTE REQUIRED
Every recommendation MUST include an anchor_snippet containing a verbatim or near-verbatim quote from the manuscript. If you cannot locate the exact offending line, the recommendation is suppressed.
→ Rule: Do not use craft-weakness labels like "glib aside", "mixed metaphor", "lyrical drift", or "unclear orientation" UNLESS anchor_snippet contains the verbatim target. If you cannot locate the offending line, OMIT the recommendation entirely.

GATE 2 — CHARACTER CO-PRESENCE VALIDATION
If a recommendation names two or more characters together in a scene, check the CHARACTER ARC LEDGER coPresenceMap. If their firstSharedChunk is AFTER the target chapter, the recommendation is suppressed.
→ Rule: Never place characters together in a recommendation unless the coPresenceMap or relational_engines ledger confirms they are co-present in that chapter/chunk range.

GATE 3 — NAME-STATE VALIDATION
Check the CHARACTER ARC LEDGER nameStates for every character referenced. Do not use a name that is not valid for the target chapter/chunk range.
→ This blocks: using "Paul" before the embassy renaming scene, using an alias before it is introduced.
→ If nameStates shows validFromChunk > target chunk, use the earlier valid name instead; when in doubt, suppress the rec.

GATE 4 — EXISTING COPING MECHANISM CHECK
Before recommending "seed X ritual" or "add X coping mechanism" for any character, check copingMechanisms in the CHARACTER ARC LEDGER. If two or more coping mechanisms already exist for that character, suppress the "seed" recommendation and instead recommend FOREGROUNDING or EARLIER PLACEMENT of an existing mechanism.
→ Rule: "Seed" language is only valid when copingMechanisms.length === 0 for that character. Otherwise use "foreground", "surface earlier", or "echo" language.

GATE 5 — MULTI-ZONE EVIDENCE RULE
For any manuscript ≥ 25,000 words: no criterion recommendation may cite only Opening-zone evidence. Every recommendation must cite evidence from at least two distinct act zones (Opening, MID-EARLY, MID, MID-LATE, LATE, Close). If supporting evidence from mid or late acts cannot be found, mark confidence as LOW and suppress the recommendation.
→ Rule: narrativeClosure recommendations must cite LATE/Close evidence. Recommendations about novel-wide patterns must span at least two act zones.

GATE 6 — LOW-PRIORITY / HIGH-CONFIDENCE SUPPRESSION
If recommendation priority = "low" AND criterion confidence_band = "HIGH", suppress or demote to a parenthetical note. Do not emit as standalone recommendation.
→ This blocks: "Name a highway marker or ejido" on a worldbuilding criterion already rated High Confidence and 8/10.

GATE 7 — GENRE-FIT OVERRIDE (CRITICAL)
Before emitting ANY recommendation that advises increasing momentum, pacing, forward motion, hook strength, plot closure, decision beats, or narrative acceleration, you MUST first evaluate:
"Is this actually a weakness for the DIAGNOSED GENRE of this manuscript?"

Genre-aware suppression rules:
- Literary fiction, speculative literary fiction, memoir, spiritual memoir, confessional fiction, eco-fiction, and contemplative fiction often derive power from atmosphere, implication, reflection, thematic resonance, emotional accumulation, and environmental tension rather than plot acceleration.
- For these genres: atmosphere IS plot. Ambiguity IS closure. Reflection IS momentum.
- Do NOT recommend "increase momentum," "add a decision beat," "foreground suspense," or "strengthen hook" when the manuscript is deliberately using contemplative pacing, accumulating silence, environmental dread, or thematic layering as its primary craft engine.
- Instead, reframe as: recommendation_status = "genre_appropriate_no_revision_warranted" with recommendation_status_rationale explaining that the technique serves the diagnosed genre.
- If you still believe a trim or tightening would help, frame it as OPTIONAL with explicit acknowledgment: "This passage serves [function]. If the author finds it runs long, consider trimming by 10–15% while preserving [function]."
→ Rule: Never apply commercial-fiction pacing standards to literary fiction. A thriller chapter that ends on atmosphere is a bug. A literary fiction chapter that ends on atmosphere is working as intended.

RECOMMENDATION-OR-RATIONALE COVERAGE CONTRACT (replaces recommendation floor):
Every scored criterion MUST return either:
- at least one valid evidence-grounded recommendation; OR
- explicit status metadata when recommendation emission is empty.

When recommendations is empty, emit BOTH fields on the criterion object:
- recommendation_status
- recommendation_status_rationale

Allowed recommendation_status values (exact spellings):
- recommendation_provided
- no_recommendation_warranted
- genre_appropriate_no_revision_warranted
- criterion_not_applicable
- insufficient_evidence
- gate_suppressed_no_safe_recommendation

Canonical/exemplary protection rules:
- 10/10 defaults to recommendation_status = "no_recommendation_warranted" unless a specific evidence-grounded modernization/adaptation note is truly necessary.
- 9/10 may include a recommendation, but recommendation emission is NOT required.
- Never fabricate advice for perfect or near-perfect work.

Coverage guardrail for weak criteria:
- Criteria with substantive weakness (typically <= 6/10) MUST NOT silently return an empty recommendations array.
- If no safe recommendation can be emitted, recommendation_status MUST be either "insufficient_evidence" or "gate_suppressed_no_safe_recommendation" with a concrete recommendation_status_rationale tied to missing/conflicting evidence.
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

FIT-GAP FRAMING (required per criterion):
Every criterion MUST include:
- fit_summary: 2–3 sentences describing what the manuscript IS doing well on this criterion, grounded in specific evidence. This is the "fit" — what earns the score.
- gap_summary: 2–3 sentences describing what prevents a 10 on this criterion, grounded in specific evidence. This is the "gap" — what the author needs to close.

Score-based suppression rules:
- Score 10/10: fit_summary required. gap_summary = "" (empty string). recommendations may include 0–1 items with severity "consider" only. recommendation_status = "no_recommendation_warranted".
- Score 9/10: fit_summary required. gap_summary may be 1 sentence noting a minor refinement or "" if truly exemplary. recommendations may include 0–1 items with severity "consider" only. Do NOT emit "recommended" severity for 9 or 10.
- Score ≤8/10: fit_summary and gap_summary both required (2–3 sentences each). recommendations[] required with full seven-part contract.
- Never fabricate advice for perfect or near-perfect work. If the score is 9–10, the fit statement alone is sufficient.

Recommendation density floor (for criteria scoring ≤8):
- Score ≤5/10: emit 2–5 recommendations per criterion, each anchored to a DIFFERENT passage. These are the most impactful revision opportunities. Surface every evidence-backed opportunity — do not artificially limit.
- Score 6–7/10: emit 1–3 recommendations per criterion, each anchored to a different passage.
- Score 8/10: emit 1–2 recommendations per criterion (severity: optional or consider).
- Each recommendation MUST target a unique anchor_snippet (no duplicate passage citations within the same criterion).
- Spread recommendations across different sections/zones of the text — do not cluster all recommendations in the opening paragraphs.
- TOTAL CAP: The evaluation may surface up to 100 revision opportunities across all criteria combined for long-form manuscripts (≥25,000 words). For short-form manuscripts (<25,000 words), the cap is 50 revision opportunities. Prioritize "recommended" severity first, then "optional", then "consider". If the evidence supports more than the cap, emit the most impactful opportunities up to the cap and stop.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIORITY HIERARCHY (P3 — DETERMINISTIC SCORE-DRIVEN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recommendation priority MUST be derived from the criterion score. Do not output "medium" for everything — an author reading "0 high-priority items" when three criteria score 6/10 loses trust in the report's editorial authority.

RULE (enforced deterministically post-synthesis — but set it correctly in output):
  Score ≤6  → priority = "high"   (Recommended — weakest areas, fix first)
  Score 7   → priority = "medium" (Optional — real revision targets, fix second)
  Score ≥8  → priority = "low"    (Consider — enhancement only, fix last or ignore)

A report with three 6-scoring criteria MUST have high-priority recommendations. "All medium" is never acceptable when scores indicate clear weakness.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROSS-CRITERION DEDUPLICATION (P4 — STRATEGIC LEVER COLLAPSE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When the SAME editorial lever applies across multiple criteria, DO NOT repeat it as separate recommendations. Instead, place the recommendation on the WEAKEST criterion (lowest score) and let the pipeline tag it with the other criteria it also addresses.

WRONG: Five separate recs across Pacing, Tension, Narrative Drive, Closure, Stakes all saying "increase urgency" / "add tension" / "raise stakes" / "sharpen dramatic question" / "strengthen propulsion."

RIGHT: One precise rec on the lowest-scoring criterion: "Move the Congo reveal to page 4 and force Calvin to respond before the chapter ends — this single structural move adds dramatic pressure, sharpens the central question, creates scene-level consequence, and gives the reader a reason to turn the page."

A professional editor collapses related craft directions into unified strategic revisions. If your issue_family+strategic_lever+revision_granularity would be the same across two criteria, ONLY emit the recommendation once — on the criterion with the lower score. The pipeline enforces this deterministically post-synthesis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOICE & STRENGTH PRESERVATION (P5 — CROSS-CRITERION PROTECTION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A recommendation that fixes a WEAK criterion must NEVER destroy a STRONG criterion.

RULE: Before writing candidate_text for any recommendation, identify all criteria scoring ≥8 in this evaluation. Those are PROTECTED STRENGTHS. Your candidate prose must not flatten, genericize, or contradict any protected strength.

COMMON VIOLATIONS (all rejected):
- Voice scores 9. Pacing recommendation suggests bland, neutral prose that erases the manuscript's distinctive register.
- Character scores 9. Closure recommendation rewrites dialogue in a way that strips idiolect markers.
- Prose Control scores 8. Tension recommendation replaces a carefully cadenced sentence with generic thriller urgency.

HOW TO COMPLY:
1. IDENTIFY the protected strengths (all criteria ≥8) before writing any candidate_text.
2. MATCH the manuscript's existing prose register in all candidate_text — vocabulary density, sentence rhythm, POV distance, tonal signature, idiolect markers.
3. ACKNOWLEDGE in mistake_proofing: explicitly name which protected criteria the revision must preserve (e.g., "Preserve the sardonic first-person register that earns the Voice 9/10 score").
4. TEST before emitting: "If the author pastes this candidate_text into the manuscript, would a reader notice a voice break?" If yes, rewrite the candidate until it passes.

ENFORCEMENT: The pipeline checks that every recommendation on a criterion scoring ≤7 includes mistake_proofing that names at least one protected criterion (≥8) when such criteria exist. Recommendations whose candidate_text contradicts a protected strength will be flagged in quality gate warnings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENRE-CALIBRATED LANGUAGE (P6 — RELATIVE FRAMING)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When pacing, tension, or momentum criticism IS legitimate even within the diagnosed genre, the LANGUAGE of the recommendation must reference the genre's own standards — never commercial-fiction standards.

WRONG (genre-blind commercial framing):
- "Needs faster pacing" (assumes thriller norms)
- "Add a cliffhanger" (assumes commercial chapter structure)
- "The reader will lose interest" (assumes impatient commercial reader)
- "Increase dramatic tension" (context-free)

RIGHT (genre-calibrated relative framing):
- "Needs stronger scene propulsion relative to its literary-fiction ambitions"
- "The exposition displaces unfolding story — even literary fiction needs each passage to change the reader's understanding"
- "The backstory, while voice-rich, delays the chapter's internal pressure without converting nostalgia into dramatic consequence"
- "A literary reader tolerates atmospheric pacing but not inert information delivery — convert this exposition into active discovery"

RULE: Every pacing/tension/momentum/closure recommendation on a non-propulsion-forward manuscript MUST include:
1. An acknowledgment of what the genre DOES tolerate (e.g., "literary fiction tolerates atmospheric pacing")
2. A distinction between genre-appropriate slowness and genre-inappropriate inertia
3. Language that frames the problem RELATIVE TO the manuscript's own genre ("relative to its literary ambitions" / "even for memoir, this passage...")

ANTI-PATTERN: If your action text would fit identically in a thriller evaluation, it is genre-uncalibrated. Rewrite with genre-relative framing.

SCORE ≤8 RECOMMENDATION CONTRACT:
Any criterion with final_score_0_10 ≤ 8 MUST include:
1. fit_summary — 2–3 sentences (REQUIRED, non-empty)
2. gap_summary — 2–3 sentences (REQUIRED, non-empty)
3. recommendations[] — For score ≤5: at least 2 entries. For score 6–7: at least 1 entry. For score 8: 0–2 entries (recommendations are OPTIONAL at score 8 — only emit when a genuinely evidence-backed, genre-appropriate revision opportunity exists).
4. Each recommendation must include the full seven-part contract (priority, action, expected_impact, anchor_snippet, issue_family, strategic_lever, revision_granularity) PLUS candidate_text_a/b/c
5. recommendation_status = "recommendations_provided" when recommendations are emitted; "genre_appropriate_no_revision_warranted" or "no_recommendation_warranted" when recommendations[] is empty at score 8.

IMPORTANT: A score of 8 with zero recommendations is NOT self-contradictory — it means the gap is real but minor, and no safe revision can be recommended without risking damage to existing strengths. For score ≤7 with zero recommendations, recommendation_status MUST be "insufficient_evidence" or "gate_suppressed_no_safe_recommendation" with a concrete rationale.

Return ONLY JSON with keys:
- criteria MUST be a flat array (not grouped by state).
- Per-criterion fields: key, final_score_0_10, fit_summary, gap_summary, final_rationale, recommendations[]; hard_divergence adds disputed=true.
- Each recommendation: priority, action, expected_impact, anchor_snippet, source_pass, issue_family, strategic_lever, revision_granularity, mechanism, specific_fix, reader_effect, symptom, mistake_proofing, potential_damage, candidate_text_a, candidate_text_b, candidate_text_c, revision_operation, manuscript_coordinates.
- Each recommendation.action must be specific, actionable editorial guidance, 50–1500 characters. It may span two sentences when needed to name the mechanism and the expected craft outcome.
- candidate_text_a: The primary recommended prose repair. This MUST be verbatim manuscript-ready text the author can COPY AND PASTE directly into their manuscript file. Write it in the author's voice using their characters' names, their world's vocabulary, and their prose rhythm. It must read as a seamless continuation or replacement of the anchor_snippet.
- candidate_text_b: A rhythm variant. Same fix direction, different cadence or sentence structure. Must be materially distinct from A. Still must be copy-paste-ready narrative prose with character names and scene-specific detail.
- candidate_text_c: A bolder rendering shift. Same fix intent, more assertive prose move. Must be materially distinct from A and B. Still must be copy-paste-ready narrative prose.
- All three candidates must be ≥ 5 words, manuscript-ready prose that the author can literally copy-paste into their .docx file at the target location.
- CANDIDATE PROSE IS MANDATORY. Every recommendation MUST include all three candidate_text fields (a, b, c) populated with real manuscript prose. A recommendation with empty candidate_text fields is INVALID and will be rejected by the pipeline. If you emit a recommendation, you MUST write the prose. No exceptions.
- CRITICAL: Candidates must contain CHARACTER NAMES, SCENE DETAILS, and VOICE-MATCHED PROSE from the manuscript. They are NOT editorial summaries or abstract beats — they are actual narrative text.
- NEVER echo the anchor_snippet as candidate prose. Each candidate must be DIFFERENT from the original passage. If candidate A, B, or C is identical or near-identical to the anchor_snippet, the pipeline will reject it.
- WRONG: "A sharper physical image turns the abstract pressure into an immediate, visible consequence on the page." (Describes what prose would do. Not actual prose.)
- RIGHT: "Billy's hand trembled against the tent flap. He could still hear Brutus breathing on the other side." (Manuscript prose — names, sensory detail, voice.)
- DO NOT append editorial commentary. Write the actual prose the author can COPY AND PASTE directly into their manuscript.
- ENFORCEMENT: Recommendations without all three candidate_text_a/b/c populated with real, distinct, copy-paste-ready prose will be stripped from the final output. This is a hard pipeline requirement, not a suggestion.
- revision_operation: one of "replace_selected_passage" | "insert_before_selected_passage" | "insert_after_selected_passage" | "delete_selected_passage" | "rewrite_surrounding_context". Default to "replace_selected_passage" when the anchor_snippet is being rewritten.
- manuscript_coordinates: a location string like "chapter:3:paragraph:7" or "scene:2:beat:opening" identifying where in the text this revision targets.
- agreement_map[]
- divergence_map[] with arbitration_rationale
- overall { overall_score_0_100, verdict(pass|revise|fail), one_paragraph_summary<=500, one_sentence_pitch<=150, one_paragraph_pitch<=400, top_3_strengths[3], top_3_risks[3], submission_readiness(queryable_now|nearly_ready|not_yet) }
  - top_3_strengths and top_3_risks must be non-mirrored aspects.
  - never emit queryable_now when verdict=fail or when 3+ criteria are below 5.
  - one_paragraph_summary MUST name every criterion scoring <=5 by readable key.
  - IDENTITY SEPARATION (hard requirement — three DIFFERENT jobs):
    - one_sentence_pitch: MARKET HOOK. 1 sentence, ≤150 chars. Sells the story to an agent/reader. Names the protagonist and core dramatic situation. Written as sales copy. NO evaluation language ("the manuscript demonstrates…"). Example: "A sardonic diamond dealer's retirement trip becomes a reckoning with mortality."
    - one_paragraph_pitch: STORY SYNOPSIS. 2–4 sentences, ≤400 chars. Tells the reader what happens. Names characters, central conflict, stakes, and tonal register. Written as back-cover copy. Must add information beyond one_sentence_pitch.
    - one_paragraph_summary: DIAGNOSTIC JUDGMENT. What's working, what needs revision, overall posture. Contains evaluation language, score references, and revision direction. Written as editorial feedback.
  - These three fields MUST be semantically distinct. If any two share >50% of their content, the quality gate will fail. Do NOT derive one from another.
- enrichment { premise, trigger_warnings[], diagnosed_genre, target_audience, dominant_craft_engine }
  - dominant_craft_engine: Identify the manuscript's PRIMARY technique for generating reader engagement. Choose exactly one: "suspense_engine" (plot-driven tension, cliffhangers, reveals), "atmosphere_engine" (environmental dread, accumulating silence, sensory immersion, tonal pressure), "voice_engine" (narrator personality, humor, rhetorical style carries the reader), "emotional_engine" (character interiority, relationship dynamics, grief/joy/fear), "thematic_engine" (ideas, philosophical argument, moral complexity drives interest), "structural_engine" (timeline manipulation, POV shifts, formal innovation). Include a 1-sentence rationale. This field calibrates recommendations — an atmosphere_engine manuscript should not receive "increase plot momentum" advice.
  - premise: 1–2 sentence elevator pitch that captures the core dramatic situation — protagonist or central force, primary conflict/tension, and emotional/tonal register. Suitable for query letters, back-cover copy, or marketing. Do not begin with the title or "This is a story about."
  - trigger_warnings: Array of content advisory categories this manuscript requires. Use specific, standardized terms from: graphic violence, sexual assault, domestic abuse, substance abuse, self-harm, suicidal ideation, animal cruelty, body horror, child endangerment, eating disorders, racial violence, homophobia, transphobia, torture, kidnapping, stalking, gun violence, war/combat, genocide, miscarriage/infant loss, sexual content (explicit), non-consensual sexual contact. Only include categories supported by textual evidence. If no warnings apply, emit an empty array [].
  - diagnosed_genre: The specific literary genre diagnosed from the text. Must be a recognized publishing genre — NOT a format like "novel" or "short story." Examples: literary fiction, memoir, fantasy, romance, thriller, mystery, science fiction, horror, western, historical fiction, self-help, cookbook, young adult, magical realism, speculative fiction, confessional fiction, spiritual memoir, crime fiction, etc. Diagnose the genre that best fits the submitted text based on its content, themes, voice, and conventions.
  - target_audience: A concise 1–2 sentence description of who this manuscript is written for, based on content analysis. Name the reader demographic, reading preferences, and comparable audience. Example: "Readers of confessional literary fiction comfortable with sexually explicit content and spiritual themes, comparable to audiences of Garth Greenwell or Sheila Heti."
- metadata { generated_at } (do NOT emit pass1_model/pass2_model/pass3_model; stamped server-side)
- diagnostic_spine { central_argument, core_story_question, dominant_conflict_engine, primary_reader_promise, primary_structural_gap } — emit this first; all criterion rationales must anchor back to this spine

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
//
// DOCTRINE (LOCKED): The Pass 3B prompt MUST NOT receive the raw character ledger.
// The compact preflight summary already carries character blocker signals via
// arbitrationQuestionsForPass3B in the preflight draft. When the ledger is
// unavailable upstream, callers pass a `ledgerWarning` string that is injected
// in place of the legacy block. The previous buildCharacterLedgerBlock helper
// (with v1/v2 ledger row formatting, state timelines, terminal ledger, blocker
// blocks, and act-zone coverage maps) has been removed from this module.


// ── Read-ahead primer block builder (v2-analytical) ─────────────────────────
//
// @deprecated — removed from live Pass 3B; Pass 3A is now the independent reader.
// DOCTRINE (LOCKED): Pass 3B inputs = P1 + P2 + compact Pass 3A summary ONLY.
// This helper is retained for legacy reference only; do not call from the live
// Pass 3B prompt path.

// @deprecated — removed from live Pass 3B; Pass 3A is now the independent reader
function buildReadAheadPrimerBlock(readAhead?: Pass3ReadAheadResult): string {
  if (!readAhead || readAhead.is_fallback) return "";

  // ── 1. Narrative structure ──────────────────────────────────────────────
  const nsm = readAhead.narrative_structure_map;
  const actImp = nsm.act_impressions as Record<string, string>;
  const structureLines = [
    `POV: ${nsm.pov_architecture}`,
    `Tone: ${nsm.dominant_tone} | Setting: ${nsm.dominant_setting} | Scope: ${nsm.temporal_scope}`,
    `Structural risk: ${nsm.structural_risk ?? "none flagged"}`,
    `Opening: ${actImp.opening_register ?? "—"}`,
    `Mid-early: ${actImp.mid_early_register ?? "—"}`,
    `Mid-act pivot: ${actImp.mid_act_pivot ?? "—"}`,
    `Mid-late: ${actImp.mid_late_register ?? "—"}`,
    `Late-act: ${actImp.late_act_pressure ?? "—"}`,
    `Close: ${actImp.close_register ?? "—"}`,
  ].join("\n");

  // ── 2. Act-zone map ─────────────────────────────────────────────────────
  const actZoneMap = Array.isArray(readAhead.act_zone_map) && readAhead.act_zone_map.length > 0
    ? `\n\nACT-ZONE MAP (read-ahead assignment — use for Gate 5 zone validation):\n` +
      readAhead.act_zone_map.map((e) => {
        const conf = e.confidence !== "HIGH" ? ` [${e.confidence}]` : "";
        return `  ${e.window_label} → ${e.act_zone_assigned}${conf}: ${e.zone_signal}`;
      }).join("\n")
    : "";

  // ── 3. Characters ────────────────────────────────────────────────────────
  const charList = readAhead.character_first_impressions.slice(0, 12).map((c) => {
    const demo = c.demographic_signals.length > 0 ? ` [${c.demographic_signals.slice(0, 3).join(", ")}]` : "";
    const age = c.age_if_stated !== null ? ` age ${c.age_if_stated}` : c.life_stage !== "unknown" ? ` (${c.life_stage})` : "";
    const syms = c.symbolic_objects_attached.length > 0 ? ` | symbols: ${c.symbolic_objects_attached.join(", ")}` : "";
    const gap = c.arc_gap_risk && c.arc_gap_risk !== "none"
      ? `\n    ⚠ gap-risk: ${c.arc_gap_risk}`
      : "";
    return `  ${c.name}${demo}${age} — ${c.role_impression} — arc: ${c.arc_impression}\n    predict: ${c.arc_prediction}${syms} [${c.present_in.join(", ")}]${gap}`;
  }).join("\n");

  // ── 4. Symbols ───────────────────────────────────────────────────────────
  const symList = Array.isArray(readAhead.symbol_register) && readAhead.symbol_register.length > 0
    ? readAhead.symbol_register.map((s) => {
        const sym = s as unknown as Record<string, unknown>;
        const chars = Array.isArray(sym.attached_characters)
          ? ` | chars: ${(sym.attached_characters as string[]).join(", ")}`
          : "";
        const payoff = typeof sym.payoff_prediction === "string" ? sym.payoff_prediction : "unclear";
        const traj = typeof sym.trajectory === "string" ? sym.trajectory : "";
        const flag = payoff === "at_risk" || payoff === "unresolved" ? " ⚠" : "";
        return `  ${s.object}: ${s.first_window}→${s.last_window_seen} | ${traj} | payoff: ${payoff}${flag}${chars}`;
      }).join("\n")
    : "  (none detected)";

  // ── 5. Relationships ─────────────────────────────────────────────────────
  const relList = Array.isArray(readAhead.relationship_spine_impressions) && readAhead.relationship_spine_impressions.length > 0
    ? readAhead.relationship_spine_impressions.map((r) => {
        const zone = (r as Record<string, string>).first_shared_zone ?? "not_confirmed";
        const traj = (r as Record<string, string>).trajectory_prediction ?? "";
        return `  ${r.pair}: ${r.dynamic_impression} | first together: ${zone} | predict: ${traj}`;
      }).join("\n")
    : "  (none detected)";

  // ── 6. Criterion hypotheses ──────────────────────────────────────────────
  // Only render WATCH-flagged hypotheses in full + a summary table for all.
  const hypotheses = Array.isArray(readAhead.criterion_hypotheses) ? readAhead.criterion_hypotheses : [];
  const watchHypotheses = hypotheses.filter((h) => h.reconciliation_flag === "WATCH");
  const hypothesisSummary = hypotheses.length > 0
    ? `\n\nCRITERION HYPOTHESIS SUMMARY (pre-scoring predictions — reconcile against inbound packets):\n` +
      hypotheses.map((h) => {
        const range = h.predicted_score_range ? ` (${h.predicted_score_range})` : "";
        const flag = h.reconciliation_flag === "WATCH" ? " ⚑ WATCH" : "";
        return `  ${h.key}: ${h.predicted_band}${range}${flag} — ${h.hypothesis_rationale.slice(0, 100)}`;
      }).join("\n")
    : "";
  const watchDetail = watchHypotheses.length > 0
    ? `\n\nWATCH-FLAGGED HYPOTHESES (Pass 3 MUST address each of these explicitly):\n` +
      watchHypotheses.map((h) => {
        const zones = h.hypothesis_evidence_zones.join(", ");
        return `  ⚑ ${h.key} [${h.predicted_band}${h.predicted_score_range ? ` ${h.predicted_score_range}` : ""}]\n    Evidence zones: ${zones}\n    Hypothesis: ${h.hypothesis_rationale}`;
      }).join("\n")
    : "";

  // ── 7. Coverage concerns ──────────────────────────────────────────────────
  const concerns = Array.isArray(readAhead.coverage_concerns) && readAhead.coverage_concerns.length > 0
    ? `\n\nCOVERAGE CONCERNS:\n${readAhead.coverage_concerns.map((c) => `  ⚠ ${c}`).join("\n")}`
    : "";

  // ── 8. Reconciliation instructions (MANDATORY) ────────────────────────────
  const reconcile = Array.isArray(readAhead.reconciliation_instructions) && readAhead.reconciliation_instructions.length > 0
    ? `\n\nRECONCILIATION INSTRUCTIONS (MANDATORY — Pass 3 must address EACH of these):\n` +
      readAhead.reconciliation_instructions.map((r, i) => `  ${i + 1}. ${r}`).join("\n")
    : "";

  return `\n\n${"━".repeat(72)}
## PASS 3 READ-AHEAD ANALYSIS (v2 — Pre-scoring analytical pre-analysis)
${"━".repeat(72)}
⚠ RECONCILIATION REQUIRED: Pass 3 must explicitly compare the inbound scored
  packets against the parked hypotheses below. For each ⚑ WATCH criterion,
  state whether the inbound evidence confirms, revises, or contradicts the
  read-ahead prediction — and why.
${"━".repeat(72)}

NARRATIVE STRUCTURE:
${structureLines}${actZoneMap}

CHARACTERS (pre-scoring impressions + arc predictions):
${charList || "  (none detected)"}

SYMBOL REGISTER (with payoff predictions):
${symList}

RELATIONSHIPS:
${relList}${hypothesisSummary}${watchDetail}${concerns}${reconcile}
${"━".repeat(72)}`;
}

/**
 * Builds the PREFLIGHT DRAFT block for Pass 3B prompt injection.
 * When compactPreflightSummary is absent, emits an UNAVAILABLE notice so Pass 3B
 * knows to rely solely on Pass 1 and Pass 2.
 */
function buildPreflightDraftBlock(compactPreflightSummary?: string): string {
  if (!compactPreflightSummary) {
    return `\n\n${'━'.repeat(72)}
## PASS 3A PREFLIGHT DRAFT
${'━'.repeat(72)}
PREFLIGHT UNAVAILABLE — Pass 3A did not complete or produce usable output.
Synthesize from Pass 1 and Pass 2 only. Do not penalize the manuscript for
absent preflight data — proceed as a two-source arbitration.
${'━'.repeat(72)}\n`;
  }
  return `\n\n${'━'.repeat(72)}
${compactPreflightSummary}
${'━'.repeat(72)}\n`;
}

export function buildPass3UserPrompt(params: {
  comparisonPacketJson: string;
  pass2aStructuredContext: Pass2aStructuredContext;
  manuscriptText?: string;
  title: string;
  englishVariant?: string;
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
   * DOCTRINE (LOCKED): Pass 3B inputs = P1 + P2 + compact Pass 3A summary ONLY.
   * The raw character ledger is NEVER injected. When the ledger is unavailable
   * upstream, callers pass a `ledgerWarning` string so Pass 3B is told to
   * suppress high-specificity character claims.
   */
  ledgerWarning?: string | null;
  /**
   * DEPRECATED — accepted for backwards-compat with older callers/tests but
   * ignored under Pass 3B doctrine. Raw ledgers are never injected into the prompt.
   */
  characterLedger?: unknown;
  /** DEPRECATED — see characterLedger note. Ignored. */
  characterLedgerV2?: unknown;
  /**
   * @deprecated — Pass 3A is now the independent reader. Accepted for
   * backwards-compat with callers/tests but no longer injected into the
   * live Pass 3B prompt path. DOCTRINE (LOCKED): Pass 3B = P1 + P2 +
   * compact Pass 3A summary ONLY.
   */
  readAheadResult?: Pass3ReadAheadResult;
  /**
   * Compact Pass 3A preflight summary — built by buildCompactPreflightSummary().
   * When present, injected as the PREFLIGHT DRAFT block before the comparison packet.
   * When absent, Pass 3B synthesizes from P1+P2 only (with an UNAVAILABLE note).
   */
  compactPreflightSummary?: string;
  /**
   * Resolved expectation profile context for recommendation calibration.
   * This is explicit structured input, not implied helper behavior.
   */
  expectationContext?: ResolvedExpectationContext;
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
  const englishVariantBlock = buildEnglishVariantPromptBlock(params.englishVariant);
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

  const expectationProfileBlock = params.expectationContext
    ? `

## EXPECTATION PROFILE (STRUCTURED INPUT — APPLY BEFORE RECOMMENDATION EMISSION)
${JSON.stringify(params.expectationContext, null, 2)}

Canonical doctrine reference: docs/canon/registered/volumes/GENRE_EXPECTATIONS_VOLUME_II_AND_REVISE_MODE_CONTRACT.md

Expectation-profile guard rules (REQUIRED):
- Apply Genre Expectations Volume II doctrine: evaluate against diagnosed genre, reader promise, dominant craft engine, and author-selected mode/voice contract — not a generic idea that faster pacing, more dialogue, more action, or more commercial acceleration is automatically better.
- Apply expectation_profiles BEFORE deciding whether to emit momentum/closure/hook/next-step recommendations.
- Apply genre_expectations BEFORE scoring or recommending against pacing, dialogue density, structure, exposition, worldbuilding, suspense delay, humor timing, relationship progression, or reflective passages.
- For actions containing "increase momentum", "add a decision beat", "strengthen hook", or "clearer next step":
  - If profile includes mood_forward, reflection_forward, atmosphere_forward, or dread_forward, suppress unless explicit manuscript evidence proves malfunction for that profile.
  - Explicit malfunction evidence requires anchor_snippet + mechanism-level explanation of reader-facing failure.
- For memoir, spiritual memoir, creative nonfiction, literary, contemplative, atmosphere-forward, and slow-burn contexts: sparse dialogue, reflection, atmosphere, ambiguity, or slower pacing are protected behaviors unless the manuscript evidence shows actual malfunction for that genre's reader promise.
- Do not suppress legitimate propulsion diagnostics for propulsion_forward, puzzle_forward, hybrid_literary_commercial, or commercial-thriller/suspense contexts when evidence supports the diagnosis.
- When suppression occurs, set recommendation_status = "gate_suppressed_no_safe_recommendation" with recommendation_status_rationale.
`
    : "";

  return `Synthesize these two independent evaluation passes for the manuscript titled "${params.title}".${dualModelBlock}${expectationProfileBlock}

${buildDiagnosticSpinePromptBlock()}


Execution mode: ${executionMode}

${englishVariantBlock}

OUTPUT BUDGET BY STATE (STRICT):
- agree (score_delta <= 1): emit { key, final_score_0_10, final_rationale (1-3 substantive sentences—NOT "Confirmed."), recommendations[] (with semantic fields) }
- soft_divergence (score_delta 2-3): emit { key, final_score_0_10, final_rationale (1 sentence) }
- hard_divergence (score_delta >= 4): emit { key, final_score_0_10, final_rationale (2 sentences), disputed=true }
- missing_or_invalid: emit concise corrective rationale, no long prose
- overall: verdict + overall_score_0_100 + one_paragraph_summary (max 3 sentences) + one_sentence_pitch (1 sentence, market hook) + one_paragraph_pitch (2-4 sentences, story synopsis) + top_3_strengths + top_3_risks + submission_readiness

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

${(() => {
  const templateKey = resolveTemplateKey(params.scopeProfile?.wordCount);
  const templateBlock = buildCompactTemplateBlock(templateKey);
  return templateBlock
    ? `\n## DREAM EVALUATION TEMPLATE (Canonical Report Shape)\nThe evaluation output MUST conform to this template. Every required section must be populated.\n${templateBlock}\n`
    : "";
})()}
${params.ledgerWarning ? `\n\n## CHARACTER LEDGER STATUS\n${params.ledgerWarning}\n` : ""}
${buildPreflightDraftBlock(params.compactPreflightSummary)}
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
