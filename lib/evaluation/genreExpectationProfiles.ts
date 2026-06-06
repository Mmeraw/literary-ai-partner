export type ExpectationProfile =
  | "propulsion_forward"
  | "slow_burn"
  | "mood_forward"
  | "atmosphere_forward"
  | "dread_forward"
  | "reflection_forward"
  | "voice_forward"
  | "emotional_payoff_forward"
  | "puzzle_forward"
  | "world_concept_forward"
  | "experimental_form_forward"
  | "hybrid_literary_commercial";

export type DominantCraftEngine =
  | "propulsion"
  | "mood"
  | "atmosphere"
  | "reflection"
  | "voice"
  | "emotional_payoff"
  | "puzzle"
  | "world_concept"
  | "experimental_form"
  | "hybrid"
  | "unknown";

export type RecommendationGuardDecision = {
  allowed: boolean;
  reason: string;
};

export type ResolvedExpectationContext = {
  work_type: string;
  diagnosed_genre: string;
  shelf_target_audience: string;
  dominant_craft_engine: DominantCraftEngine;
  expectation_profiles: ExpectationProfile[];
  resolution_notes: string[];
};

export type ExpectationResolutionInput = {
  workType?: string | null;
  diagnosedGenre?: string | null;
  shelfTargetAudience?: string | null;
  dominantCraftEngine?: DominantCraftEngine | string | null;
};

const PROTECTED_MOMENTUM_PROFILES = new Set<ExpectationProfile>([
  "mood_forward",
  "reflection_forward",
  "atmosphere_forward",
  "dread_forward",
]);

const MOMENTUM_DIRECTIVE_RE =
  /\b(increase momentum|add a decision beat|strengthen hook|clearer next step)\b/i;

const MALFUNCTION_EVIDENCE_RE =
  /\b(stall(?:ed|ing)?|unclear|confus(?:e|ing|ion)|diffus(?:e|ing)|break(?:s|ing)|not landing|undercut(?:s|ting)?|reader (?:loses|lost)|fails? to|malfunction(?:ing)?)\b/i;

const WORK_TYPE_PROFILE_MAP: Record<string, ExpectationProfile[]> = {
  personalessayreflection: ["reflection_forward", "voice_forward"],
  memoirvignette: ["reflection_forward", "mood_forward"],
  memoirchapternarrative: ["reflection_forward", "slow_burn"],
  creativenonfiction: ["reflection_forward", "experimental_form_forward"],
  professionalnonfictionsample: ["world_concept_forward"],
  opinioneditorial: ["propulsion_forward"],
  academicanalyticalprose: ["world_concept_forward", "puzzle_forward"],
  flashfictionmicro: ["propulsion_forward"],
  shortstory: ["hybrid_literary_commercial"],
  novelchapter: ["hybrid_literary_commercial"],
  literaryfictiongeneral: ["mood_forward", "voice_forward"],
  genrefictiongeneral: ["propulsion_forward"],
  prosescene: ["propulsion_forward"],
  scriptscenefilmtv: ["propulsion_forward"],
  featurescreenplay: ["propulsion_forward"],
  televisionpilot: ["propulsion_forward"],
  televisionepisode: ["propulsion_forward"],
  stageplayscript: ["emotional_payoff_forward"],
  querypackage: ["propulsion_forward"],
  synopsis: ["propulsion_forward"],
  pitchorlogline: ["propulsion_forward"],
  treatmentorseriesbible: ["world_concept_forward", "propulsion_forward"],
  outlineorproposal: ["world_concept_forward"],
  hybridexperimental: ["experimental_form_forward", "hybrid_literary_commercial"],
  otheruserdefined: ["hybrid_literary_commercial"],
};

const GENRE_PROFILE_RULES: Array<{ pattern: RegExp; profiles: ExpectationProfile[] }> = [
  { pattern: /thriller|suspense|action|commercial/, profiles: ["propulsion_forward"] },
  { pattern: /mystery|crime|detective|puzzle/, profiles: ["puzzle_forward"] },
  { pattern: /romance/, profiles: ["emotional_payoff_forward"] },
  { pattern: /literary|upmarket/, profiles: ["mood_forward", "voice_forward"] },
  { pattern: /memoir|testimony|essay|reflection|nonfiction/, profiles: ["reflection_forward"] },
  { pattern: /gothic|atmospheric/, profiles: ["atmosphere_forward"] },
  { pattern: /horror|dread|terror/, profiles: ["dread_forward"] },
  { pattern: /fantasy|science fiction|sci-fi|speculative|worldbuilding/, profiles: ["world_concept_forward"] },
  { pattern: /experimental|fragment|braid|lyric/, profiles: ["experimental_form_forward"] },
  { pattern: /slow burn|slow-burn|contemplative/, profiles: ["slow_burn"] },
];

const CRAFT_ENGINE_PROFILE_MAP: Record<DominantCraftEngine, ExpectationProfile[]> = {
  propulsion: ["propulsion_forward"],
  mood: ["mood_forward"],
  atmosphere: ["atmosphere_forward"],
  reflection: ["reflection_forward"],
  voice: ["voice_forward"],
  emotional_payoff: ["emotional_payoff_forward"],
  puzzle: ["puzzle_forward"],
  world_concept: ["world_concept_forward"],
  experimental_form: ["experimental_form_forward"],
  hybrid: ["hybrid_literary_commercial"],
  unknown: [],
};

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function coerceCraftEngine(raw: string | DominantCraftEngine | null | undefined): DominantCraftEngine {
  const value = String(raw ?? "").toLowerCase().trim();
  if (!value) return "unknown";
  if (value.includes("propulsion") || value.includes("momentum") || value.includes("pace")) return "propulsion";
  if (value.includes("atmosphere")) return "atmosphere";
  if (value.includes("mood")) return "mood";
  if (value.includes("reflect")) return "reflection";
  if (value.includes("voice")) return "voice";
  if (value.includes("emotional") || value.includes("relationship")) return "emotional_payoff";
  if (value.includes("puzzle") || value.includes("mystery")) return "puzzle";
  if (value.includes("world") || value.includes("concept") || value.includes("speculative")) return "world_concept";
  if (value.includes("experimental") || value.includes("form")) return "experimental_form";
  if (value.includes("hybrid")) return "hybrid";
  return "unknown";
}

export function resolveExpectationProfiles(input: ExpectationResolutionInput): ResolvedExpectationContext {
  const workType = String(input.workType ?? "unknown").trim() || "unknown";
  const diagnosedGenre = String(input.diagnosedGenre ?? workType).trim() || "unknown";
  const shelfTargetAudience = String(input.shelfTargetAudience ?? diagnosedGenre).trim() || "unknown";
  const craftEngine = coerceCraftEngine(input.dominantCraftEngine);

  const profiles = new Set<ExpectationProfile>();
  const notes: string[] = [];

  const workTypeProfiles = WORK_TYPE_PROFILE_MAP[normalizeKey(workType)] ?? [];
  for (const profile of workTypeProfiles) profiles.add(profile);
  if (workTypeProfiles.length > 0) notes.push(`work_type:${workType}=>${workTypeProfiles.join(",")}`);

  const genreSignal = `${diagnosedGenre} ${shelfTargetAudience}`.toLowerCase();
  for (const rule of GENRE_PROFILE_RULES) {
    if (rule.pattern.test(genreSignal)) {
      for (const profile of rule.profiles) profiles.add(profile);
      notes.push(`genre_signal:${rule.pattern.source}=>${rule.profiles.join(",")}`);
    }
  }

  for (const profile of CRAFT_ENGINE_PROFILE_MAP[craftEngine]) profiles.add(profile);
  if (CRAFT_ENGINE_PROFILE_MAP[craftEngine].length > 0) {
    notes.push(`dominant_craft_engine:${craftEngine}=>${CRAFT_ENGINE_PROFILE_MAP[craftEngine].join(",")}`);
  }

  if (profiles.size === 0) {
    profiles.add("hybrid_literary_commercial");
    notes.push("fallback:hybrid_literary_commercial");
  }

  return {
    work_type: workType,
    diagnosed_genre: diagnosedGenre,
    shelf_target_audience: shelfTargetAudience,
    dominant_craft_engine: craftEngine,
    expectation_profiles: Array.from(profiles),
    resolution_notes: notes,
  };
}

export function recommendationNeedsProfileEvidence(rec: {
  action: string;
  expected_impact?: string;
  mechanism?: string;
  anchor_snippet?: string;
}): boolean {
  return MOMENTUM_DIRECTIVE_RE.test(rec.action);
}

export function hasExplicitProfileMalfunctionEvidence(rec: {
  action: string;
  expected_impact?: string;
  mechanism?: string;
  anchor_snippet?: string;
}): boolean {
  const signalText = [rec.action, rec.expected_impact ?? "", rec.mechanism ?? ""].join(" ");
  const hasMalfunctionSignal = MALFUNCTION_EVIDENCE_RE.test(signalText);
  const hasAnchor = (rec.anchor_snippet ?? "").trim().length > 0;
  return hasMalfunctionSignal && hasAnchor;
}

export function shouldSuppressByExpectationProfile(
  context: ResolvedExpectationContext,
  rec: {
    action: string;
    expected_impact?: string;
    mechanism?: string;
    anchor_snippet?: string;
  },
): RecommendationGuardDecision {
  if (!recommendationNeedsProfileEvidence(rec)) {
    return { allowed: true, reason: "action_not_profile_sensitive" };
  }

  const intersectsProtectedProfile = context.expectation_profiles.some((profile) =>
    PROTECTED_MOMENTUM_PROFILES.has(profile),
  );

  if (!intersectsProtectedProfile) {
    return { allowed: true, reason: "profile_allows_propulsion_guidance" };
  }

  if (hasExplicitProfileMalfunctionEvidence(rec)) {
    return { allowed: true, reason: "explicit_malfunction_evidence_present" };
  }

  return {
    allowed: false,
    reason:
      "profile_guard_suppressed: mood/reflection/atmosphere/dread-forward profile requires explicit malfunction evidence for propulsion directives",
  };
}
