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
  | "tonal_pressure"
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

export type GenreExpectationMetadata = {
  diagnosed_genre: string;
  shelf_target_audience: string;
  dominant_craft_engine: DominantCraftEngine;
  expectation_profiles: ExpectationProfile[];
  genre_expectation_ids: string[];
  genre_expectation_labels: string[];
  resolution_notes: string[];
};

export type GenreExpectationDetail = {
  id: string;
  label: string;
  reader_promise: string;
  craft_expectations: string[];
  protected_behaviors: string[];
  failure_modes: string[];
  pacing_norm: string;
  dialogue_norm: string;
};

export type ResolvedExpectationContext = {
  work_type: string;
  diagnosed_genre: string;
  shelf_target_audience: string;
  dominant_craft_engine: DominantCraftEngine;
  expectation_profiles: ExpectationProfile[];
  genre_expectations: GenreExpectationDetail[];
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
  /\b(increase momentum|add a decision beat|strengthen hook|clearer next step|accelerate|speed up|raise the pace|faster pacing|make (?:it|this|the scene) move faster)\b/i;

const DIALOGUE_QUANTITY_DIRECTIVE_RE =
  /\b(add (?:more )?dialogue|increase dialogue|more dialogue|more exchanges|convert (?:reflection|summary|interiority|narration) into dialogue|turn (?:reflection|summary|interiority|narration) into dialogue)\b/i;

const WORLDBUILDING_REDUCTION_DIRECTIVE_RE =
  /\b(?:cut|trim|reduce|compress|remove|speed past|minimize)\b.{0,48}\b(?:lore|worldbuilding|world-building|invented terminology|exposition|setup|council scene|travel scene)\b/i;

const GENERIC_COMMERCIAL_DIRECTIVE_RE =
  /\b(?:make (?:it|this) more commercial|commercial pacing|more market-friendly|broaden appeal by speeding|page-turner pacing)\b/i;

const MALFUNCTION_EVIDENCE_RE =
  /\b(stall(?:s|ed|ing)?|unclear|confus(?:e|ing|ion)|diffus(?:e|ing)|break(?:s|ing)|not landing|undercut(?:s|ting)?|reader (?:loses|lost)|fails? to|malfunction(?:ing)?)\b/i;

function genreExpectation(detail: GenreExpectationDetail): GenreExpectationDetail {
  return detail;
}

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

const GENRE_EXPECTATION_RULES: Array<{ pattern: RegExp; profiles: ExpectationProfile[]; detail: GenreExpectationDetail }> = [
  {
    pattern: /spiritual memoir|faith memoir|religious memoir/,
    profiles: ["reflection_forward", "voice_forward", "slow_burn"],
    detail: genreExpectation({
      id: "spiritual_memoir",
      label: "Spiritual memoir",
      reader_promise: "Interior transformation, testimony, doubt, meaning-making, and earned spiritual/emotional insight.",
      craft_expectations: ["reflective causality", "voice credibility", "scene-to-insight progression", "ethical self-witnessing"],
      protected_behaviors: ["long reflection", "prayer/meditation passages", "low dialogue density", "associative memory structure"],
      failure_modes: ["unearned revelation", "abstract testimony without embodied scene", "unclear transformation arc", "flattened complexity"],
      pacing_norm: "Reflective and accumulative; forward motion may be internal rather than event-driven.",
      dialogue_norm: "Dialogue may be sparse; quoted speech is valuable when it reveals relationship, rupture, or revelation, not as a quantity target.",
    }),
  },
  {
    pattern: /memoir|testimony|personal essay|confessional|reflection|creative nonfiction/,
    profiles: ["reflection_forward", "voice_forward"],
    detail: genreExpectation({
      id: "memoir_creative_nonfiction",
      label: "Memoir / creative nonfiction",
      reader_promise: "A truthful-feeling consciousness making meaning from lived experience through voice, memory, scene, and reflection.",
      craft_expectations: ["reflective architecture", "narrator credibility", "scene/reflection balance", "emotional specificity", "ethical distance"],
      protected_behaviors: ["introspection", "memory-driven structure", "thematic repetition", "sparse dialogue", "slower contemplative pacing"],
      failure_modes: ["reflection that does not transform the reader's understanding", "scene summary without sensory grounding", "chronology without meaning pressure", "dialogue that sounds reconstructed but unearned"],
      pacing_norm: "Memoir pacing may move by insight, pressure, memory association, and emotional accumulation rather than plot acceleration.",
      dialogue_norm: "Sparse dialogue is genre-normal; evaluate whether dialogue is credible and purposeful, not whether there is enough of it.",
    }),
  },
  {
    pattern: /literary speculative|speculative literary|magical realism|slipstream/,
    profiles: ["world_concept_forward", "mood_forward", "voice_forward"],
    detail: genreExpectation({
      id: "literary_speculative",
      label: "Literary speculative fiction",
      reader_promise: "A speculative premise that deepens theme, estrangement, mood, and human consequence rather than only explaining mechanics.",
      craft_expectations: ["idea resonance", "metaphoric coherence", "controlled ambiguity", "human consequence of the impossible"],
      protected_behaviors: ["unresolved mystery", "atmospheric pacing", "conceptual ambiguity", "voice-forward exposition"],
      failure_modes: ["speculative rules too vague to support consequence", "idea overwhelms character pressure", "ambiguity without pattern"],
      pacing_norm: "May privilege wonder, unease, and idea pressure over commercial acceleration.",
      dialogue_norm: "Dialogue should reveal worldview and pressure; quantity is secondary to conceptual and emotional charge.",
    }),
  },
  {
    pattern: /epic fantasy|high fantasy|quest fantasy|secondary world fantasy/,
    profiles: ["world_concept_forward", "slow_burn", "emotional_payoff_forward"],
    detail: genreExpectation({
      id: "epic_fantasy",
      label: "Epic fantasy",
      reader_promise: "Large-scale world, power systems, history, quest/war stakes, and character destiny accumulating over breadth.",
      craft_expectations: ["worldbuilding load management", "quest/war structure", "magic/power coherence", "ensemble clarity", "lore-to-conflict integration"],
      protected_behaviors: ["measured setup", "lore density when dramatized", "ensemble staging", "chapter-scale travel or council scenes"],
      failure_modes: ["lore without present pressure", "unclear rules of power", "too many names without role anchoring", "quest stakes delayed beyond reader trust"],
      pacing_norm: "Can tolerate slower setup and worldbuilding when each passage clarifies stakes, culture, power, or character obligation.",
      dialogue_norm: "Dialogue often carries politics, oaths, hierarchy, and lore; assess clarity and subtext rather than raw speed.",
    }),
  },
  {
    pattern: /urban fantasy|paranormal fantasy/,
    profiles: ["world_concept_forward", "propulsion_forward", "voice_forward"],
    detail: genreExpectation({
      id: "urban_fantasy",
      label: "Urban fantasy / paranormal fantasy",
      reader_promise: "A recognizable world disrupted by supernatural rules, voice, investigation, danger, and escalating hidden-world consequence.",
      craft_expectations: ["rule clarity", "voice drive", "hidden-world reveal pacing", "threat escalation", "mundane/magical contrast"],
      protected_behaviors: ["voicey banter", "procedural discovery", "localized lore drops"],
      failure_modes: ["rules arrive after consequences", "banter deflates danger", "world logic contradicts stakes"],
      pacing_norm: "Generally expects active discovery and escalation, with room for voice-forward pauses.",
      dialogue_norm: "Dialogue may carry banter, threat, and exposition; evaluate whether it sharpens character and hidden-world rules.",
    }),
  },
  {
    pattern: /military science fiction|military sci-fi|military sf/,
    profiles: ["world_concept_forward", "propulsion_forward", "puzzle_forward"],
    detail: genreExpectation({
      id: "military_science_fiction",
      label: "Military science fiction",
      reader_promise: "Operational pressure, technology constraints, command decisions, tactical clarity, and cost under stress.",
      craft_expectations: ["operational clarity", "chain-of-command credibility", "technology consequence", "tactical cause-and-effect", "mission stakes"],
      protected_behaviors: ["technical exposition when it governs action", "briefing scenes", "procedural constraint"],
      failure_modes: ["battle geography unclear", "tech solves problems without cost", "orders lack consequence", "rank/command logic implausible"],
      pacing_norm: "Can pause for briefing or tech explanation when it changes tactical options; action sequences require spatial clarity.",
      dialogue_norm: "Dialogue often encodes command, protocol, and stress; judge precision and pressure, not lyricism.",
    }),
  },
  {
    pattern: /science fiction|sci-fi|\bsf\b|space opera|cyberpunk|cli-fi/,
    profiles: ["world_concept_forward"],
    detail: genreExpectation({
      id: "science_fiction",
      label: "Science fiction",
      reader_promise: "A speculative system or technology changes human choices, society, risk, or identity in legible consequence.",
      craft_expectations: ["concept consequence", "rule coherence", "exposition placement", "human stakes", "novum clarity"],
      protected_behaviors: ["conceptual exposition", "systems thinking", "idea-driven pacing"],
      failure_modes: ["concept without human pressure", "rules introduced after payoff", "exposition detached from choice"],
      pacing_norm: "May slow to clarify concept or system, but explanation should alter stakes or reader understanding.",
      dialogue_norm: "Dialogue should reveal pressure, ethics, expertise, or social world; technical exchange is valid when consequential.",
    }),
  },
  {
    pattern: /fantasy|worldbuilding/,
    profiles: ["world_concept_forward"],
    detail: genreExpectation({
      id: "fantasy_general",
      label: "Fantasy",
      reader_promise: "A coherent invented or magical reality whose rules, wonder, danger, and emotional stakes shape the story.",
      craft_expectations: ["rule coherence", "wonder", "cost of magic/power", "setting pressure", "character desire within the world"],
      protected_behaviors: ["worldbuilding passages", "mythic register", "formal or archaic diction when controlled"],
      failure_modes: ["world detail without story pressure", "magic without cost", "unclear stakes inside invented terms"],
      pacing_norm: "Worldbuilding can slow local pace when it produces wonder, danger, obligation, or orientation.",
      dialogue_norm: "Dialogue may carry custom, rank, and lore; assess whether it clarifies relationship and stakes.",
    }),
  },
  {
    pattern: /psychological suspense|suspense|domestic suspense/,
    profiles: ["dread_forward", "slow_burn", "puzzle_forward"],
    detail: genreExpectation({
      id: "suspense",
      label: "Suspense",
      reader_promise: "Anticipation, uncertainty, threat proximity, withheld information, and dread accumulating before revelation.",
      craft_expectations: ["threat calibration", "withheld-information control", "dread escalation", "reader question management"],
      protected_behaviors: ["slow-burn dread", "delayed reveal", "uncertainty", "atmospheric pressure"],
      failure_modes: ["withholding without pattern", "threat becomes static", "reader cannot track what is feared", "reveal delay exhausts trust"],
      pacing_norm: "Suspense may move slowly if uncertainty and threat intensify; speed is not automatically better.",
      dialogue_norm: "Dialogue should create concealment, subtext, suspicion, or pressure; silence can be a valid suspense mechanism.",
    }),
  },
  {
    pattern: /thriller|action thriller|action|commercial thriller|commercial/,
    profiles: ["propulsion_forward"],
    detail: genreExpectation({
      id: "thriller",
      label: "Thriller / action thriller",
      reader_promise: "Urgency, danger, escalation, decisive action, reversals, and consequence pressure.",
      craft_expectations: ["escalation", "decision beats", "stakes visibility", "scene turns", "cause-and-effect velocity"],
      protected_behaviors: ["brief tactical reflection", "setup that immediately changes danger"],
      failure_modes: ["static danger", "delayed decisions", "unclear stakes", "reflection that interrupts active threat without payoff"],
      pacing_norm: "Usually benefits from visible turns, decisions, and escalation; reflective pauses must sharpen threat or choice.",
      dialogue_norm: "Dialogue should pressure decisions, reveal threat, or create reversals; long unpressurized exchanges may weaken velocity.",
    }),
  },
  {
    pattern: /mystery|detective|whodunit|cozy mystery/,
    profiles: ["puzzle_forward"],
    detail: genreExpectation({
      id: "mystery",
      label: "Mystery / detective fiction",
      reader_promise: "A fair-play question, clue trail, suspect pressure, concealment, and satisfying revelation logic.",
      craft_expectations: ["clue placement", "red herring control", "investigative progression", "suspect differentiation", "reveal fairness"],
      protected_behaviors: ["interview scenes", "procedural detail", "delayed answer"],
      failure_modes: ["clues unavailable to reader", "suspects blur", "investigation stalls without new information", "solution feels arbitrary"],
      pacing_norm: "Progress is measured by information state change, not only action speed.",
      dialogue_norm: "Dialogue often functions as testimony, misdirection, or clue delivery; assess information pressure and voice distinction.",
    }),
  },
  {
    pattern: /crime|noir|police procedural/,
    profiles: ["puzzle_forward", "dread_forward"],
    detail: genreExpectation({
      id: "crime_fiction",
      label: "Crime fiction / noir / procedural",
      reader_promise: "Moral pressure, criminal consequence, investigative or procedural logic, and social/world texture.",
      craft_expectations: ["procedural credibility", "motive pressure", "consequence chain", "moral atmosphere", "world specificity"],
      protected_behaviors: ["procedural scenes", "noir reflection", "institutional detail"],
      failure_modes: ["case logic unclear", "motive thin", "atmosphere replaces consequence", "procedure implausible"],
      pacing_norm: "Can move through procedure and atmosphere when each beat changes risk, knowledge, or moral pressure.",
      dialogue_norm: "Dialogue should carry power, evasion, threat, or institutional texture.",
    }),
  },
  {
    pattern: /romance|romantic comedy|romantasy/,
    profiles: ["emotional_payoff_forward"],
    detail: genreExpectation({
      id: "romance",
      label: "Romance",
      reader_promise: "A central relationship arc with chemistry, vulnerability, obstacles, intimacy escalation, and emotionally satisfying commitment or resolution.",
      craft_expectations: ["relationship progression", "romantic tension", "emotional intimacy", "barrier logic", "earned HEA/HFN or genre-appropriate payoff"],
      protected_behaviors: ["interiority around desire", "banter", "longing", "relationship-focused pacing"],
      failure_modes: ["chemistry asserted but not dramatized", "barrier dissolves too easily", "intimacy jumps without vulnerability", "payoff unearned"],
      pacing_norm: "Pacing follows emotional escalation and relationship turns, not only external plot speed.",
      dialogue_norm: "Dialogue is often a primary chemistry engine; assess subtext, desire, conflict, and vulnerability.",
    }),
  },
  {
    pattern: /gothic|southern gothic|atmospheric/,
    profiles: ["atmosphere_forward", "dread_forward"],
    detail: genreExpectation({
      id: "gothic_atmospheric",
      label: "Gothic / atmospheric fiction",
      reader_promise: "Place, dread, repression, secrets, symbolic pressure, and emotional/psychological haunting.",
      craft_expectations: ["atmospheric accumulation", "symbolic setting", "repression/secrecy", "tonal control", "slow revelation"],
      protected_behaviors: ["slow dread", "ornate atmosphere", "ambiguity", "symbolic repetition"],
      failure_modes: ["atmosphere without pressure", "symbolism too opaque", "secret lacks consequence", "tone becomes monotonous"],
      pacing_norm: "Atmosphere can be the engine; movement is often pressure accumulation and revelation, not speed.",
      dialogue_norm: "Silence, evasion, and subtext may be as important as spoken exchange.",
    }),
  },
  {
    pattern: /horror|dread|terror|body horror|folk horror/,
    profiles: ["dread_forward", "atmosphere_forward"],
    detail: genreExpectation({
      id: "horror",
      label: "Horror",
      reader_promise: "Fear, dread, violation, uncanny pressure, vulnerability, and escalating threat to body, mind, community, or reality.",
      craft_expectations: ["threat escalation", "dread modulation", "sensory specificity", "vulnerability", "release/withholding rhythm"],
      protected_behaviors: ["slow dread", "unease", "ambiguity before reveal", "atmospheric pause"],
      failure_modes: ["threat unclear", "fear image repeated without escalation", "reveal deflates dread", "shock without consequence"],
      pacing_norm: "Can be slow, fast, or pulsed; the key is fear pressure and escalation, not generic momentum.",
      dialogue_norm: "Dialogue should expose fear, denial, group fracture, or uncanny mismatch; silence can carry horror.",
    }),
  },
  {
    pattern: /historical fiction|historical novel/,
    profiles: ["hybrid_literary_commercial", "world_concept_forward"],
    detail: genreExpectation({
      id: "historical_fiction",
      label: "Historical fiction",
      reader_promise: "Immersive period reality, human stakes shaped by history, credible social constraints, and emotional immediacy.",
      craft_expectations: ["period specificity", "historical pressure", "social constraint", "anachronism control", "scene-level immediacy"],
      protected_behaviors: ["contextual detail", "period language texture", "slower social setup"],
      failure_modes: ["research dump", "anachronistic psychology", "history not affecting choice", "setting detached from stakes"],
      pacing_norm: "Context is valid when it changes social risk, choice, or reader immersion.",
      dialogue_norm: "Dialogue should feel period-aware without becoming unreadable or exposition-heavy.",
    }),
  },
  {
    pattern: /comedy|comic novel|humor|humour/,
    profiles: ["voice_forward", "propulsion_forward"],
    detail: genreExpectation({
      id: "comedy",
      label: "Comedy / comic fiction",
      reader_promise: "Comic voice, setup/payoff, timing, escalation of absurdity or social pressure, and emotional or satirical payoff.",
      craft_expectations: ["comic timing", "setup/payoff", "voice consistency", "escalating complication", "tonal permission"],
      protected_behaviors: ["digressive jokes", "banter", "heightened voice", "absurd escalation"],
      failure_modes: ["jokes stall scene pressure", "tone undercuts stakes unintentionally", "setup lacks payoff", "same comic beat repeats"],
      pacing_norm: "Pacing is timing-sensitive; pauses and digressions are valid when they create payoff or escalation.",
      dialogue_norm: "Dialogue may carry banter, timing, and joke rhythm; assess payoff and character pressure.",
    }),
  },
  {
    pattern: /satire|satirical/,
    profiles: ["voice_forward", "experimental_form_forward"],
    detail: genreExpectation({
      id: "satire",
      label: "Satire",
      reader_promise: "A sharp comic or critical lens exposing systems, hypocrisy, absurdity, or moral contradiction.",
      craft_expectations: ["target clarity", "comic escalation", "system critique", "tonal control", "character as pressure point"],
      protected_behaviors: ["exaggeration", "irony", "rhetorical voice", "formal play"],
      failure_modes: ["target unclear", "joke repeats without escalation", "characters become only mouthpieces", "critique overwhelms story"],
      pacing_norm: "Can pause for rhetorical or comic force when the satirical target sharpens.",
      dialogue_norm: "Dialogue may be heightened or stylized; judge target clarity and comic pressure.",
    }),
  },
  {
    pattern: /drama|domestic drama|family drama/,
    profiles: ["emotional_payoff_forward", "mood_forward"],
    detail: genreExpectation({
      id: "drama",
      label: "Drama / domestic drama",
      reader_promise: "Emotional escalation, relationship pressure, moral choice, and consequence inside scenes of human conflict.",
      craft_expectations: ["relationship turn logic", "emotional escalation", "scene pressure", "subtext", "earned catharsis"],
      protected_behaviors: ["interiority", "quiet scenes", "subtext-heavy dialogue", "domestic detail"],
      failure_modes: ["scene does not turn", "emotion is stated rather than pressured", "conflict repeats without change", "catharsis unearned"],
      pacing_norm: "Pacing follows emotional turns and pressure shifts, not only external event count.",
      dialogue_norm: "Dialogue should reveal subtext, fracture, intimacy, or avoidance; silence can be meaningful.",
    }),
  },
  {
    pattern: /young adult|\bya\b/,
    profiles: ["voice_forward", "emotional_payoff_forward", "propulsion_forward"],
    detail: genreExpectation({
      id: "young_adult",
      label: "Young adult",
      reader_promise: "Immediate voice, identity pressure, agency, emotional stakes, and age-appropriate intensity.",
      craft_expectations: ["teen voice credibility", "agency", "identity stakes", "relationship pressure", "accessible momentum"],
      protected_behaviors: ["heightened interiority", "voice-forward narration", "relationship focus"],
      failure_modes: ["adult retrospective voice flattens immediacy", "agency withheld too long", "stakes feel adult-imposed rather than lived"],
      pacing_norm: "Often benefits from accessible momentum, but emotional immediacy can carry quieter passages.",
      dialogue_norm: "Dialogue should feel age-credible, specific, and pressure-bearing without generic slang.",
    }),
  },
  {
    pattern: /middle grade|\bmg\b/,
    profiles: ["voice_forward", "propulsion_forward", "emotional_payoff_forward"],
    detail: genreExpectation({
      id: "middle_grade",
      label: "Middle grade",
      reader_promise: "Clear voice, wonder, friendship/family stakes, agency, readability, and emotionally safe but meaningful consequence.",
      craft_expectations: ["age-accessible voice", "clear scene goals", "wonder", "agency", "emotional legibility"],
      protected_behaviors: ["direct emotion", "adventure clarity", "friendship focus"],
      failure_modes: ["abstract interiority beyond age frame", "stakes too opaque", "voice reads adult", "scene goal unclear"],
      pacing_norm: "Usually needs clearer local goals and movement, with room for wonder and emotional processing.",
      dialogue_norm: "Dialogue should be age-credible and clear; humor and friendship dynamics often carry engagement.",
    }),
  },
  {
    pattern: /literary|upmarket/,
    profiles: ["mood_forward", "voice_forward"],
    detail: genreExpectation({
      id: "literary_upmarket",
      label: "Literary / upmarket fiction",
      reader_promise: "Voice, interiority, thematic resonance, emotional complexity, and crafted ambiguity with sufficient narrative pressure.",
      craft_expectations: ["voice control", "thematic resonance", "interiority", "symbolic patterning", "pressure through implication"],
      protected_behaviors: ["contemplative pacing", "ambiguity", "atmosphere", "low external plot density"],
      failure_modes: ["beautiful stasis without pressure", "ambiguity without pattern", "theme stated rather than dramatized", "voice monotony"],
      pacing_norm: "May privilege implication, mood, and emotional accumulation over commercial acceleration.",
      dialogue_norm: "Dialogue may be sparse or subtextual; judge precision, pressure, and voice fit.",
    }),
  },
  {
    pattern: /experimental|fragment|braid|lyric|formally experimental/,
    profiles: ["experimental_form_forward", "voice_forward"],
    detail: genreExpectation({
      id: "experimental_form",
      label: "Experimental / lyric / braided form",
      reader_promise: "Formal pattern, juxtaposition, language, recursion, and reader discovery through structure.",
      craft_expectations: ["formal coherence", "pattern recognition", "productive fragmentation", "language pressure", "reader orientation signals"],
      protected_behaviors: ["fragmentation", "nonlinear movement", "lyric repetition", "white space", "associative logic"],
      failure_modes: ["fragmentation without pattern", "reader orientation collapses", "repetition does not accrue", "form obscures stakes entirely"],
      pacing_norm: "Movement may be associative or formal; evaluate pattern and accrual, not conventional plot speed.",
      dialogue_norm: "Dialogue may be absent, stylized, or fragmentary; assess formal purpose and voice pressure.",
    }),
  },
  {
    pattern: /slow burn|slow-burn|contemplative|meditative/,
    profiles: ["slow_burn", "reflection_forward", "mood_forward"],
    detail: genreExpectation({
      id: "contemplative_slow_burn",
      label: "Contemplative / slow-burn fiction",
      reader_promise: "Gradual pressure, mood, implication, interior or atmospheric accumulation, and delayed but meaningful turn.",
      craft_expectations: ["accumulation", "mood modulation", "delayed turn control", "reader trust", "subtle consequence"],
      protected_behaviors: ["slow pacing", "quiet scenes", "atmosphere", "delayed revelation", "low dialogue density"],
      failure_modes: ["accumulation becomes static", "turn delayed without pressure", "mood repeats without modulation"],
      pacing_norm: "Slow is valid when pressure accumulates; the test is accrual, not speed.",
      dialogue_norm: "Dialogue may be minimal; silence and observation can carry the scene if pressure accrues.",
    }),
  },
  {
    pattern: /cookbook|self-help|how-to|instructional nonfiction|professional nonfiction/,
    profiles: ["world_concept_forward"],
    detail: genreExpectation({
      id: "instructional_nonfiction",
      label: "Instructional / practical nonfiction",
      reader_promise: "Clear usable guidance, sequence, credibility, examples, and reader outcome—not novelistic scene propulsion.",
      craft_expectations: ["instructional clarity", "sequence", "credibility", "reader usability", "example quality"],
      protected_behaviors: ["lists", "steps", "direct address", "procedural repetition"],
      failure_modes: ["unclear sequence", "unsupported credibility", "missing examples", "reader outcome vague"],
      pacing_norm: "Pacing means usability and cognitive load, not dramatic acceleration.",
      dialogue_norm: "Dialogue is usually not required; evaluate examples, instructions, and reader clarity instead.",
    }),
  },
];

const CRAFT_ENGINE_PROFILE_MAP: Record<DominantCraftEngine, ExpectationProfile[]> = {
  propulsion: ["propulsion_forward"],
  tonal_pressure: ["mood_forward"],
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
  if (value.includes("propulsion") || value.includes("drive") || value.includes("pace")) return "propulsion";
  if (value.includes("atmosphere")) return "atmosphere";
  if (value.includes("tonal") || value.includes("tone")) return "tonal_pressure";
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
  const genreExpectations = new Map<string, GenreExpectationDetail>();
  const notes: string[] = [];

  const workTypeProfiles = WORK_TYPE_PROFILE_MAP[normalizeKey(workType)] ?? [];
  for (const profile of workTypeProfiles) profiles.add(profile);
  if (workTypeProfiles.length > 0) notes.push(`work_type:${workType}=>${workTypeProfiles.join(",")}`);

  const genreSignal = `${diagnosedGenre} ${shelfTargetAudience}`.toLowerCase();
  for (const rule of GENRE_EXPECTATION_RULES) {
    if (rule.pattern.test(genreSignal)) {
      for (const profile of rule.profiles) profiles.add(profile);
      notes.push(`genre_signal:${rule.pattern.source}=>${rule.profiles.join(",")}`);
      genreExpectations.set(rule.detail.id, rule.detail);
      notes.push(`genre_expectation:${rule.detail.id}`);
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

  if (genreExpectations.size === 0) {
    genreExpectations.set("hybrid_general", {
      id: "hybrid_general",
      label: "Hybrid / general narrative",
      reader_promise:
        "Reader promise must be inferred from diagnosed genre, target audience, dominant craft engine, and manuscript evidence rather than a generic commercial default.",
      craft_expectations: ["genre fit", "reader promise fulfillment", "dominant craft engine execution"],
      protected_behaviors: ["genre-appropriate pacing", "voice-preserving restraint"],
      failure_modes: ["reader promise unclear", "dominant craft engine does not produce reader-facing effect"],
      pacing_norm: "Assess whether pacing serves the resolved reader promise; do not assume faster is better.",
      dialogue_norm: "Assess whether dialogue serves scene function, voice, and comprehension; do not assume more dialogue is better.",
    });
    notes.push("fallback:genre_expectation:hybrid_general");
  }

  return {
    work_type: workType,
    diagnosed_genre: diagnosedGenre,
    shelf_target_audience: shelfTargetAudience,
    dominant_craft_engine: craftEngine,
    expectation_profiles: Array.from(profiles),
    genre_expectations: Array.from(genreExpectations.values()),
    resolution_notes: notes,
  };
}

export function recommendationNeedsProfileEvidence(rec: {
  action: string;
  expected_impact?: string;
  mechanism?: string;
  anchor_snippet?: string;
}): boolean {
  const text = [rec.action, rec.expected_impact ?? "", rec.mechanism ?? ""].join(" ");
  return (
    MOMENTUM_DIRECTIVE_RE.test(text) ||
    DIALOGUE_QUANTITY_DIRECTIVE_RE.test(text) ||
    WORLDBUILDING_REDUCTION_DIRECTIVE_RE.test(text) ||
    GENERIC_COMMERCIAL_DIRECTIVE_RE.test(text)
  );
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

  const signalText = [rec.action, rec.expected_impact ?? "", rec.mechanism ?? ""].join(" ");

  if (hasExplicitProfileMalfunctionEvidence(rec)) {
    return { allowed: true, reason: "explicit_malfunction_evidence_present" };
  }

  const genreExpectationIds = new Set(context.genre_expectations.map((detail) => detail.id));

  if (genreExpectationIds.has("epic_fantasy") && WORLDBUILDING_REDUCTION_DIRECTIVE_RE.test(signalText)) {
    return {
      allowed: false,
      reason:
        "profile_guard_suppressed: epic fantasy protects lore/worldbuilding density unless explicit malfunction evidence is present",
    };
  }

  if (GENERIC_COMMERCIAL_DIRECTIVE_RE.test(signalText)) {
    const commercialProtected = context.expectation_profiles.some((profile) =>
      profile === "mood_forward" ||
      profile === "reflection_forward" ||
      profile === "atmosphere_forward" ||
      profile === "dread_forward" ||
      profile === "experimental_form_forward",
    );

    if (commercialProtected) {
      return {
        allowed: false,
        reason:
          "profile_guard_suppressed: commercial-fiction advice requires explicit malfunction evidence for protected genre/craft-engine profiles",
      };
    }
  }

  const intersectsProtectedProfile = context.expectation_profiles.some((profile) =>
    PROTECTED_MOMENTUM_PROFILES.has(profile),
  );

  if (!intersectsProtectedProfile) {
    return { allowed: true, reason: "profile_allows_propulsion_guidance" };
  }

  return {
    allowed: false,
    reason:
      "profile_guard_suppressed: mood/reflection/atmosphere/dread-forward profile requires explicit malfunction evidence for propulsion directives",
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isExpectationProfile(value: string): value is ExpectationProfile {
  return [
    "propulsion_forward",
    "slow_burn",
    "mood_forward",
    "atmosphere_forward",
    "dread_forward",
    "reflection_forward",
    "voice_forward",
    "emotional_payoff_forward",
    "puzzle_forward",
    "world_concept_forward",
    "experimental_form_forward",
    "hybrid_literary_commercial",
  ].includes(value as ExpectationProfile);
}

function isDominantCraftEngine(value: string): value is DominantCraftEngine {
  return [
    "propulsion",
    "tonal_pressure",
    "atmosphere",
    "reflection",
    "voice",
    "emotional_payoff",
    "puzzle",
    "world_concept",
    "experimental_form",
    "hybrid",
    "unknown",
  ].includes(value as DominantCraftEngine);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function genreExpectationContextForMetadata(
  context: ResolvedExpectationContext,
): GenreExpectationMetadata {
  return {
    diagnosed_genre: context.diagnosed_genre,
    shelf_target_audience: context.shelf_target_audience,
    dominant_craft_engine: context.dominant_craft_engine,
    expectation_profiles: context.expectation_profiles,
    genre_expectation_ids: context.genre_expectations.map((detail) => detail.id),
    genre_expectation_labels: context.genre_expectations.map((detail) => detail.label),
    resolution_notes: context.resolution_notes,
  };
}

export function isGenreExpectationMetadata(value: unknown): value is GenreExpectationMetadata {
  if (!isRecord(value)) return false;
  return (
    typeof value.diagnosed_genre === "string" &&
    typeof value.shelf_target_audience === "string" &&
    typeof value.dominant_craft_engine === "string" &&
    isDominantCraftEngine(value.dominant_craft_engine) &&
    isStringArray(value.expectation_profiles) &&
    value.expectation_profiles.every(isExpectationProfile) &&
    isStringArray(value.genre_expectation_ids) &&
    isStringArray(value.genre_expectation_labels) &&
    isStringArray(value.resolution_notes)
  );
}

export function extractGenreExpectationMetadataFromEvaluationPayload(
  payload: unknown,
): GenreExpectationMetadata | null {
  if (!isRecord(payload)) return null;
  const governance = isRecord(payload.governance) ? payload.governance : null;
  const transparency = governance && isRecord(governance.transparency) ? governance.transparency : null;
  const context = transparency?.genre_expectation_context;
  return isGenreExpectationMetadata(context) ? context : null;
}
