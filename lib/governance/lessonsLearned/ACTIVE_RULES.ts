import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { CriterionKey } from "@/schemas/criteria-keys";
import type {
  LessonsLearnedRule,
  RuleResult,
  RuleEvaluationInput,
  RuleViolation,
  RuleSeverity,
} from "./types";

const PIPELINE_CRITERION_CANON_ID_MAP: Record<CriterionKey, string> = {
  concept: "CRIT-CONCEPT-001",
  narrativeDrive: "CRIT-MOMENTUM-001",
  character: "CRIT-CHARACTER-001",
  voice: "CRIT-POVVOICE-001",
  sceneConstruction: "CRIT-SCENE-001",
  dialogue: "CRIT-DIALOGUE-001",
  theme: "CRIT-THEME-001",
  worldbuilding: "CRIT-WORLD-001",
  pacing: "CRIT-PACING-001",
  proseControl: "CRIT-PROSE-001",
  tone: "CRIT-TONE-001",
  narrativeClosure: "CRIT-CLOSURE-001",
  marketability: "CRIT-MARKET-001",
};

type CriterionNarrative = {
  key: CriterionKey;
  rationale: string;
};

function collectNarratives(input: RuleEvaluationInput): CriterionNarrative[] {
  const fromPass = (criteria?: { key: CriterionKey; rationale: string }[]) =>
    (criteria ?? []).map((c) => ({ key: c.key, rationale: c.rationale ?? "" }));

  return [
    ...fromPass(input.structural_result?.criteria),
    ...fromPass(input.diagnostic_result?.criteria),
    ...fromPass(input.convergence_result?.criteria.map((c) => ({ key: c.key, rationale: c.final_rationale }))),
  ];
}

function collectCorpus(input: RuleEvaluationInput): string {
  const lines: string[] = [];
  for (const c of collectNarratives(input)) {
    lines.push(c.rationale);
  }

  const overall = input.convergence_result?.overall;
  if (overall) {
    lines.push(overall.one_paragraph_summary);
    lines.push(...overall.top_3_strengths);
    lines.push(...overall.top_3_risks);
  }

  return lines.join("\n").toLowerCase();
}

function makeViolation(message: string, severity: RuleSeverity, location?: string): RuleViolation {
  return { message, severity, location };
}

function resultFromViolations(violations: RuleViolation[], evidence?: unknown): RuleResult {
  return {
    passed: violations.length === 0,
    violations,
    evidence,
  };
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function keywordHit(corpus: string, keywords: string[]): string[] {
  return keywords.filter((k) => corpus.includes(k));
}

function extractTopicalTokens(values: string[]): Set<string> {
  const stopWords = new Set(["the", "and", "or", "of", "for", "in", "to", "with", "a", "an"]);
  const tokens = new Set<string>();
  for (const value of values) {
    for (const tok of normalizeToken(value).split(" ")) {
      if (!tok || tok.length < 4 || stopWords.has(tok)) continue;
      tokens.add(tok);
    }
  }
  return tokens;
}

function llr001BlurNotMultiplicity(input: RuleEvaluationInput): RuleResult {
  const corpus = collectCorpus(input);
  const multiplicityTerms = keywordHit(corpus, [
    "too many ideas",
    "too many concepts",
    "multiplicity",
    "overloaded",
    "too much going on",
  ]);

  if (multiplicityTerms.length === 0) {
    return resultFromViolations([]);
  }

  const boundaryEvidenceTerms = keywordHit(corpus, [
    "blur",
    "overlap",
    "boundary",
    "boundary issue",
    "signal",
    "segmentation",
    "cohesion",
    "scope confusion",
  ]);

  const violations: RuleViolation[] = [];
  if (boundaryEvidenceTerms.length === 0) {
    violations.push(
      makeViolation(
        "Multiplicity framing used without structural boundary evidence (blur/overlap/signal).",
        "ERROR",
        "cross-criteria",
      ),
    );
  }

  return resultFromViolations(violations, {
    multiplicityTerms,
    boundaryEvidenceTerms,
  });
}

function llr002AuthorityTransferClarity(input: RuleEvaluationInput): RuleResult {
  const corpus = collectCorpus(input);

  const povShiftSignals = keywordHit(corpus, [
    "pov shift",
    "point of view shift",
    "voice shift",
    "authority shift",
    "narrative handoff",
    "transfer",
  ]);

  if (povShiftSignals.length === 0) {
    return resultFromViolations([]);
  }

  const transferMarkers = keywordHit(corpus, [
    "because",
    "due to",
    "justified",
    "signaled",
    "marker",
    "handoff",
    "transition",
  ]);

  const violations: RuleViolation[] = [];
  if (transferMarkers.length === 0) {
    violations.push(
      makeViolation(
        "POV/authority shift identified without explicit transfer marker or justification.",
        "ERROR",
        "voice|authority",
      ),
    );
  }

  return resultFromViolations(violations, {
    povShiftSignals,
    transferMarkers,
  });
}

function llr003NoContradictoryDiagnosticFraming(input: RuleEvaluationInput): RuleResult {
  const strengths = input.convergence_result?.overall.top_3_strengths ?? [];
  const risks = input.convergence_result?.overall.top_3_risks ?? [];

  if (strengths.length === 0 || risks.length === 0) {
    return resultFromViolations([]);
  }

  const strengthTokens = extractTopicalTokens(strengths);
  const riskTokens = extractTopicalTokens(risks);

  const overlap = Array.from(strengthTokens).filter((token) => riskTokens.has(token));

  const corpus = collectCorpus(input);
  const contextualDifferentiators = keywordHit(corpus, [
    "in contrast",
    "however",
    "though",
    "although",
    "but",
    "yet",
    "while",
    "despite",
    "context",
    "when",
    "whereas",
    "may",
    "could",
    "sometimes",
    "occasionally",
    "in places",
    "at chapter level",
    "at scene level",
  ]);

  const violations: RuleViolation[] = [];
  if (overlap.length > 0 && contextualDifferentiators.length === 0) {
    violations.push(
      makeViolation(
        `Same topical element appears in strengths and risks without contextual differentiation: ${overlap.join(", ")}`,
        "ERROR",
        "overall",
      ),
    );
  }

  return resultFromViolations(violations, {
    overlap,
    contextualDifferentiators,
  });
}

function llr004CanonAwareTerminologyDiscipline(input: RuleEvaluationInput): RuleResult {
  const narratives = collectNarratives(input);
  const corpus = collectCorpus(input);

  const nonCanonicalTerms = keywordHit(corpus, [
    "vibes",
    "plot hole",
    "just make it cleaner",
    "generic writing advice",
    "it just feels off",
  ]);

  const criteriaSeen = new Set(narratives.map((n) => n.key));
  const criteriaMissingFromRegistry = Array.from(criteriaSeen).filter((key) => {
    const canonId = PIPELINE_CRITERION_CANON_ID_MAP[key];
    return !input.registry.has(canonId);
  });

  const violations: RuleViolation[] = [];

  if (nonCanonicalTerms.length > 0) {
    violations.push(
      makeViolation(
        `Non-canonical terminology detected: ${nonCanonicalTerms.join(", ")}`,
        "ERROR",
        "cross-criteria",
      ),
    );
  }

  if (criteriaMissingFromRegistry.length > 0) {
    violations.push(
      makeViolation(
        `Criteria referenced without active canon mapping: ${criteriaMissingFromRegistry.join(", ")}`,
        "ERROR",
        "registry",
      ),
    );
  }

  return resultFromViolations(violations, {
    nonCanonicalTerms,
    criteriaMissingFromRegistry,
  });
}

function llr005NoGenericCanonFreeCritique(input: RuleEvaluationInput): RuleResult {
  const corpus = collectCorpus(input);
  const anchorSignals = keywordHit(corpus, [
    "criterion",
    "criteria",
    "wave",
    "sceneconstruction",
    "canon",
    "anchor",
  ]);

  const explicitCriteriaMentions = CRITERIA_KEYS.filter((k) => corpus.includes(k.toLowerCase()));
  const canonMentions = Object.values(PIPELINE_CRITERION_CANON_ID_MAP).filter((id) => corpus.includes(id.toLowerCase()));

  const violations: RuleViolation[] = [];
  if (anchorSignals.length === 0 && explicitCriteriaMentions.length === 0 && canonMentions.length === 0) {
    violations.push(
      makeViolation(
        "Critique appears generic and canon-free (no criteria/wave/structure/canon anchors found).",
        "ERROR",
        "cross-criteria",
      ),
    );
  }

  return resultFromViolations(violations, {
    anchorSignals,
    explicitCriteriaMentions,
    canonMentions,
  });
}

export const ACTIVE_RULES: LessonsLearnedRule[] = [
  {
    rule_id: "LLR-001",
    canon_reference: "VOL-V / VII.2",
    name: "Blur, Not Multiplicity",
    description:
      "Prevents false diagnosis of 'too many ideas' unless blur/overlap/boundary evidence is explicitly present.",
    enforcement_stages: ["post_diagnostic", "post_convergence", "pre_artifact_generation"],
    severity: "ERROR",
    predicate: llr001BlurNotMultiplicity,
    failure_message: "Multiplicity framing without boundary evidence is disallowed.",
    explanation: "Canonical diagnostics require structural evidence for multiplicity claims.",
  },
  {
    rule_id: "LLR-002",
    canon_reference: "VOL-V / VII.2",
    name: "Authority Transfer Clarity",
    description: "POV/authority shift claims must include explicit transfer markers or justification.",
    enforcement_stages: ["post_diagnostic", "post_convergence", "pre_artifact_generation"],
    severity: "ERROR",
    predicate: llr002AuthorityTransferClarity,
    failure_message: "Authority transfer detected without signaling/justification.",
    explanation: "Authority handoffs must be explicit and auditable.",
  },
  {
    rule_id: "LLR-003",
    canon_reference: "VOL-V / VII.2",
    name: "No Contradictory Diagnostic Framing",
    description:
      "The same element cannot be labeled both strength and weakness without context differentiation.",
    enforcement_stages: ["post_convergence", "pre_artifact_generation"],
    severity: "ERROR",
    predicate: llr003NoContradictoryDiagnosticFraming,
    failure_message: "Contradictory framing found without contextual boundary.",
    explanation: "Diagnostics must remain internally coherent.",
  },
  {
    rule_id: "LLR-004",
    canon_reference: "VOL-V / VII.2",
    name: "Canon-Aware Terminology Discipline",
    description:
      "Detects non-canonical terminology and ensures referenced criteria map to active canonical registry entries.",
    enforcement_stages: ["post_structural", "post_diagnostic", "post_convergence", "pre_artifact_generation"],
    severity: "ERROR",
    predicate: llr004CanonAwareTerminologyDiscipline,
    failure_message: "Canon terminology discipline violated.",
    explanation: "All diagnostics must remain canon-aligned and registry-grounded.",
  },
  {
    rule_id: "LLR-005",
    canon_reference: "VOL-V / VII.2",
    name: "No Generic Canon-Free Critique",
    description:
      "Critique must include at least one canon anchor (criteria/wave/structure/canon) to avoid generic ungoverned output.",
    enforcement_stages: ["post_convergence", "pre_artifact_generation"],
    severity: "ERROR",
    predicate: llr005NoGenericCanonFreeCritique,
    failure_message: "Output appears generic and canon-free.",
    explanation: "Governed diagnostics require explicit canon anchoring.",
  },
];
