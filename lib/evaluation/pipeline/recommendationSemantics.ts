/**
 * Recommendation Semantics Utilities
 *
 * Normalization helpers for the semantic recommendation fields:
 * issue_family, strategic_lever, revision_granularity, redundancy_key.
 *
 * These utilities are used by:
 *   - runPass3Synthesis (pre-QualityGate normalization)
 *   - qualityGate (redundancy key comparison)
 *   - downstream report assembly
 */

import type { IssueFamily, StrategicLever, RevisionGranularity } from "./types";

// ── Canonical value sets ───────────────────────────────────────────────────

export const ISSUE_FAMILY_VALUES: readonly IssueFamily[] = [
  "pacing",
  "dialogue",
  "closure",
  "characterization",
  "exposition",
  "tension",
  "prose_control",
  "scene_structure",
  "voice",
  "market_positioning",
  "concept",
  "theme",
  "worldbuilding",
] as const;

export const STRATEGIC_LEVER_VALUES: readonly StrategicLever[] = [
  "momentum_visibility",
  "dialogue_exposition_density",
  "scene_goal_clarity",
  "closure_state_lock",
  "character_voice_differentiation",
  "tension_escalation",
  "exposition_load_reduction",
  "prose_compression",
  "market_signal_clarity",
  "pov_rendering_precision",
  "structural_commitment",
  "thematic_grounding",
  "sensory_specificity",
] as const;

export const REVISION_GRANULARITY_VALUES: readonly RevisionGranularity[] = [
  "line",
  "beat",
  "scene",
  "chapter",
  "manuscript",
] as const;

// ── Normalization lookup tables ────────────────────────────────────────────

const ISSUE_FAMILY_ALIASES: Record<string, IssueFamily> = {
  // pacing
  rhythm: "pacing",
  momentum: "pacing",
  "scene rhythm": "pacing",
  "narrative momentum": "pacing",
  "forward momentum": "pacing",
  "action beats": "pacing",
  // dialogue
  "dialogue tags": "dialogue",
  attribution: "dialogue",
  "dialogue rendering": "dialogue",
  // exposition
  "info dump": "exposition",
  "information loading": "exposition",
  backstory: "exposition",
  "expository load": "exposition",
  // tension
  stakes: "tension",
  conflict: "tension",
  "narrative tension": "tension",
  "dramatic tension": "tension",
  // prose_control
  prose: "prose_control",
  "prose clarity": "prose_control",
  style: "prose_control",
  grammar: "prose_control",
  "prose and style": "prose_control",
  "prose_and_style": "prose_control",
  // scene_structure
  scene: "scene_structure",
  structure: "scene_structure",
  "scene construction": "scene_structure",
  "pacing and structure": "scene_structure",
  "pacing_and_structure": "scene_structure",
  // characterization
  character: "characterization",
  "character arc": "characterization",
  "character motivation": "characterization",
  // voice
  "point of view": "voice",
  pov: "voice",
  "narrative voice": "voice",
  // closure
  ending: "closure",
  resolution: "closure",
  "narrative closure": "closure",
  // market_positioning
  market: "market_positioning",
  marketability: "market_positioning",
  commercial: "market_positioning",
};

const STRATEGIC_LEVER_ALIASES: Record<string, StrategicLever> = {
  // momentum_visibility
  "forward momentum": "momentum_visibility",
  "increase momentum": "momentum_visibility",
  "interleave action": "momentum_visibility",
  "vary rhythm": "momentum_visibility",
  "vary scene rhythm": "momentum_visibility",
  "scene momentum": "momentum_visibility",
  "reduce reflective drag": "momentum_visibility",
  "action beats": "momentum_visibility",
  // dialogue_exposition_density
  "dialogue exposition": "dialogue_exposition_density",
  "reduce exposition in dialogue": "dialogue_exposition_density",
  "dialogue info density": "dialogue_exposition_density",
  "on the nose dialogue": "dialogue_exposition_density",
  "dialogue density": "dialogue_exposition_density",
  // scene_goal_clarity
  "scene goal": "scene_goal_clarity",
  "goal clarity": "scene_goal_clarity",
  "scene objective": "scene_goal_clarity",
  "scene objectives": "scene_goal_clarity",
  // closure_state_lock
  "lock closure": "closure_state_lock",
  "commit to resolution": "closure_state_lock",
  "resolve ambiguity": "closure_state_lock",
  // character_voice_differentiation
  "character voice": "character_voice_differentiation",
  "differentiate voices": "character_voice_differentiation",
  "distinct voice": "character_voice_differentiation",
  "voice differentiation": "character_voice_differentiation",
  "character distinction": "character_voice_differentiation",
  // tension_escalation
  "escalate tension": "tension_escalation",
  "raise stakes": "tension_escalation",
  "increase stakes": "tension_escalation",
  escalation: "tension_escalation",
  // exposition_load_reduction
  "reduce exposition": "exposition_load_reduction",
  "trim backstory": "exposition_load_reduction",
  "compress backstory": "exposition_load_reduction",
  "reduce info dump": "exposition_load_reduction",
  // prose_compression
  "tighten prose": "prose_compression",
  "compress prose": "prose_compression",
  "reduce wordiness": "prose_compression",
  "cut wordiness": "prose_compression",
  // pov_rendering_precision
  "pov precision": "pov_rendering_precision",
  "psychic distance": "pov_rendering_precision",
  "focalization": "pov_rendering_precision",
  "direct thought": "pov_rendering_precision",
};

// ── Normalization helpers ──────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Attempts to map a free-form string to a canonical IssueFamily value.
 * Returns undefined if no match is found — caller decides how to handle.
 */
export function normalizeIssueFamily(raw: unknown): IssueFamily | undefined {
  if (typeof raw !== "string") return undefined;
  const normalized = normalize(raw);
  if ((ISSUE_FAMILY_VALUES as readonly string[]).includes(normalized.replace(/ /g, "_"))) {
    return normalized.replace(/ /g, "_") as IssueFamily;
  }
  return ISSUE_FAMILY_ALIASES[normalized];
}

/**
 * Attempts to map a free-form string to a canonical StrategicLever value.
 * Returns undefined if no match is found.
 */
export function normalizeStrategicLever(raw: unknown): StrategicLever | undefined {
  if (typeof raw !== "string") return undefined;
  const normalized = normalize(raw);
  if ((STRATEGIC_LEVER_VALUES as readonly string[]).includes(normalized.replace(/ /g, "_"))) {
    return normalized.replace(/ /g, "_") as StrategicLever;
  }
  return STRATEGIC_LEVER_ALIASES[normalized];
}

/**
 * Attempts to map a free-form string to a canonical RevisionGranularity value.
 * Returns undefined if no match is found.
 */
const REVISION_GRANULARITY_ALIASES: Record<string, RevisionGranularity> = {
  paragraph: "beat",
  sentence: "line",
  word: "line",
  passage: "beat",
  block: "beat",
  section: "chapter",
  part: "chapter",
  novel: "manuscript",
  book: "manuscript",
  full: "manuscript",
  global: "manuscript",
};

export function normalizeRevisionGranularity(raw: unknown): RevisionGranularity | undefined {
  if (typeof raw !== "string") return undefined;
  const normalized = normalize(raw);
  const asCanon = normalized.replace(/ /g, "_");
  if ((REVISION_GRANULARITY_VALUES as readonly string[]).includes(asCanon)) {
    return asCanon as RevisionGranularity;
  }
  return REVISION_GRANULARITY_ALIASES[normalized];
}

/**
 * Builds a deterministic collapse key for semantic deduplication.
 * Format: issue_family:strategic_lever:revision_granularity
 * Components that are unknown fall back to "unknown".
 */
export function buildRedundancyKey(
  issue_family: IssueFamily | undefined,
  strategic_lever: StrategicLever | undefined,
  revision_granularity: RevisionGranularity | undefined,
): string {
  return [
    issue_family ?? "unknown",
    strategic_lever ?? "unknown",
    revision_granularity ?? "unknown",
  ].join(":");
}

/**
 * Returns true if two redundancy keys are considered semantically the same
 * (ignoring the granularity dimension, since same-lever recs at different
 * granularities may still be justified if their evidence differs).
 */
export function sameStrategicLever(keyA: string, keyB: string): boolean {
  const [, leverA] = keyA.split(":");
  const [, leverB] = keyB.split(":");
  return leverA !== "unknown" && leverA === leverB;
}

/**
 * Returns true if two redundancy keys are considered fully redundant:
 * same lever AND same granularity.
 */
export function fullyRedundant(keyA: string, keyB: string): boolean {
  const [, leverA, granA] = keyA.split(":");
  const [, leverB, granB] = keyB.split(":");
  return leverA !== "unknown" && leverA === leverB && granA !== "unknown" && granA === granB;
}
