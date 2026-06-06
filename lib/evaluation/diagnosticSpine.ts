/**
 * Diagnostic Spine — diagnostic_spine_v1
 *
 * ─────────────────────────────────────────────────────────────────────
 * CANONICAL DEFINITION AND DISTINCTION FROM golden_spine_v1
 * ─────────────────────────────────────────────────────────────────────
 *
 * DO NOT conflate diagnostic_spine_v1 with golden_spine_v1. They are
 * separate constructs with different purposes, layers, and scopes.
 *
 * golden_spine_v1  (lib/evaluation/goldenSpine/goldenSpineAudit.ts):
 *   - Long-form manuscripts only (≥25,000 words)
 *   - Deterministic heuristic — no LLM calls
 *   - Motif / object continuity ledger: payoff tracking across chapters
 *   - Post-evaluation layer, runs in canonGovernanceRunner after Pass 3
 *   - Persisted as artifact_type = 'golden_spine_v1' in evaluation_artifacts
 *   - Purpose: structural manuscript-scale continuity audit
 *
 * diagnostic_spine_v1  (THIS FILE):
 *   - All evaluation modes: short-form, long-form, multi-layer
 *   - LLM-extracted by Pass 3 during synthesis — not a heuristic
 *   - Editorial thesis extraction: answers "what is this work about?"
 *   - Anchors all 13 criterion rationales and recommendations in Pass 3
 *   - Stored on SynthesisOutput — not a separate evaluation_artifacts row
 *   - For long-form: coexists with golden_spine_v1 and Story Ledger
 *   - For multi-layer: does NOT replace Golden Spine or Story Ledger
 *   - For short-form: local to the submitted excerpt, no continuity claims
 *
 * ─────────────────────────────────────────────────────────────────────
 *
 * Produced by Pass 3 and exposed as a top-level SynthesisOutput field.
 *
 * Required fields:
 *   central_argument         — the governing thesis or dramatic argument
 *   core_story_question      — spine question the narrative must answer
 *   dominant_conflict_engine — primary force generating narrative pressure
 *   primary_reader_promise   — what the opening contract promises
 *   primary_structural_gap   — biggest gap between promise and execution
 */

export type DiagnosticSpine = {
  /**
   * The governing thesis or dramatic argument the manuscript is making.
   * Not a plot summary. The intellectual/emotional claim being prosecuted.
   *
   * Example (Sister): "Public harm reduction is incompatible with private
   * emotional harm reduction — and the protagonist cannot pursue both."
   *
   * Example (River): "Environmental stillness is a form of threat as real
   * as any human antagonist."
   */
  central_argument: string;

  /**
   * The spine question the story must answer by its end.
   * Formulated as a specific dramatic question, not a theme label.
   *
   * Example (Cartel Babies): "Can institutional complicity be resisted
   * from inside it, or does it always consume its resistors?"
   */
  core_story_question: string;

  /**
   * The primary force generating narrative pressure throughout the manuscript.
   * Distinct from genre and setting. Names the engine, not the surface.
   *
   * Examples: "harm-reduction paradox", "bureaucratic decay", "environmental
   * dread", "mythic obligation vs individual will", "institutional pressure"
   */
  dominant_conflict_engine: string;

  /**
   * What the opening chapter/pages implicitly contract to deliver.
   * Decoded from tone, stakes, character introduction, and opening image.
   *
   * Example (River): "A slow accumulation of environmental dread
   * culminating in an irreversible ecological or personal rupture."
   */
  primary_reader_promise: string;

  /**
   * The largest gap between what was promised and what has been delivered
   * in the evaluated excerpt. Names a specific structural failure.
   *
   * This is not a criterion score — it is a holistic diagnostic before
   * criterion-level analysis begins.
   */
  primary_structural_gap: string;

  /**
   * Confidence level for this spine extraction.
   * "high" — LLM returned all fields with substantive content.
   * "partial" — one or more fields were thin or inferred.
   * "unavailable" — LLM did not produce a usable spine; defaults used.
   */
  confidence: "high" | "partial" | "unavailable";
};

/** Sentinel spine returned when extraction fails or is absent. */
export const UNAVAILABLE_SPINE: DiagnosticSpine = {
  central_argument: "",
  core_story_question: "",
  dominant_conflict_engine: "",
  primary_reader_promise: "",
  primary_structural_gap: "",
  confidence: "unavailable",
};

/** Minimum non-whitespace length for a field to be considered substantive. */
const MIN_FIELD_CHARS = 15;

function extractSpineString(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function isSubstantive(value: string): boolean {
  return value.replace(/\s/g, "").length >= MIN_FIELD_CHARS;
}

/**
 * Extract a DiagnosticSpine from the raw LLM obj emitted by Pass 3.
 * Called inside parsePass3Response when obj["diagnostic_spine"] is present.
 * Returns UNAVAILABLE_SPINE if the block is absent or malformed.
 */
export function extractDiagnosticSpine(rawObj: unknown): DiagnosticSpine {
  if (!rawObj || typeof rawObj !== "object") return UNAVAILABLE_SPINE;

  const spine = rawObj as Record<string, unknown>;

  const central_argument = extractSpineString(spine["central_argument"]);
  const core_story_question = extractSpineString(spine["core_story_question"]);
  const dominant_conflict_engine = extractSpineString(spine["dominant_conflict_engine"]);
  const primary_reader_promise = extractSpineString(spine["primary_reader_promise"]);
  const primary_structural_gap = extractSpineString(spine["primary_structural_gap"]);

  if (!central_argument && !core_story_question && !dominant_conflict_engine) {
    return UNAVAILABLE_SPINE;
  }

  const substantiveCount = [
    central_argument,
    core_story_question,
    dominant_conflict_engine,
    primary_reader_promise,
    primary_structural_gap,
  ].filter(isSubstantive).length;

  const confidence: DiagnosticSpine["confidence"] =
    substantiveCount >= 5 ? "high" : substantiveCount >= 3 ? "partial" : "unavailable";

  return {
    central_argument,
    core_story_question,
    dominant_conflict_engine,
    primary_reader_promise,
    primary_structural_gap,
    confidence,
  };
}

/**
 * Build the Pass 3 prompt block that instructs the LLM to produce a
 * diagnostic_spine before evaluating criteria.
 *
 * This block is injected into the Pass 3 user prompt so that the spine
 * is anchored to the manuscript evidence — not generated in a vacuum.
 */
export function buildDiagnosticSpinePromptBlock(): string {
  return `
## DIAGNOSTIC SPINE (diagnostic_spine_v1 — required)
Before evaluating any criterion, extract the manuscript's governing thesis.
Return this as a top-level "diagnostic_spine" object in your JSON:

{
  "central_argument": "The governing thesis or dramatic argument the manuscript makes. Not plot. The intellectual/emotional claim prosecuted by the story. 1-2 sentences, specific.",
  "core_story_question": "The specific dramatic question the narrative must answer by its end. Not a theme label — a testable question. 1 sentence.",
  "dominant_conflict_engine": "The primary force generating narrative pressure throughout. Names the engine, not surface genre. E.g., 'harm-reduction paradox', 'bureaucratic decay', 'environmental dread'. 3-8 words.",
  "primary_reader_promise": "What the opening chapter implicitly contracts to deliver. Decoded from tone, stakes, character introduction, and opening image. 1-2 sentences.",
  "primary_structural_gap": "The largest gap between what was promised and what has been delivered in this evaluated excerpt. Specific structural failure. 1-2 sentences."
}

Rules:
- Do NOT use genre labels as central_argument (e.g., "This is a literary novel" is invalid).
- central_argument must make a claim that could be argued against.
- dominant_conflict_engine must name the mechanism, not the surface (not "a conflict between good and evil" but "sibling inheritance rivalry over a dying patriarch's silence").
- primary_structural_gap must be honest and specific — this is the most important editorial truth the evaluation delivers.
- The spine is emitted BEFORE criteria scoring begins. All 13 criterion rationales must anchor back to this spine.
- Recommendation governance: do not emit recommendations that contradict primary_reader_promise or central_argument. Suppress contradictory recommendations instead of forcing generic advice.
- If the spine is weak/unclear, lower confidence explicitly; for long-form or multi-layer contexts, treat absent/weak spine as a regeneration-level defect, not a silent pass.
`.trim();
}
