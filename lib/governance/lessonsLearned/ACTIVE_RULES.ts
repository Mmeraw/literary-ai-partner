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
  const blocking = violations.some((v) => v.severity === "ERROR");
  return {
    passed: !blocking,
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

const CANON_DOMAIN_SYNONYMS: Partial<Record<CriterionKey, string[]>> = {
  voice: ["pov", "point of view"],
  narrativeDrive: ["momentum", "drive", "propulsion"],
  sceneConstruction: ["scene", "staging"],
  worldbuilding: ["world", "setting"],
  proseControl: ["prose", "line level"],
  narrativeClosure: ["closure", "ending", "resolution"],
};

const PAIR_CONTRAST_MARKERS = [
  "however",
  "though",
  "although",
  "but",
  "yet",
  "while",
  "whereas",
  "despite",
  "in contrast",
] as const;

const PAIR_SCOPE_MARKERS = [
  "in places",
  "at times",
  "sometimes",
  "occasionally",
  "during",
  "when",
  "across",
  "in the opening",
  "in the middle",
  "in the final act",
  "at chapter level",
  "at scene level",
  "in longer reflective passages",
  "in flashback scenes",
] as const;

const WEAK_TENSION_MARKERS = ["fades", "falters", "wavers", "slips"] as const;

const POLARITY_PAIRS: Array<[RegExp, RegExp]> = [
  [/\b(strong|vivid|distinctive|confident|sharp|taut|rich)\b/i, /\b(weak|flat|generic|loose|thin|muted)\b/i],
  [/\b(consistent|steady|stable|even)\b/i, /\b(inconsistent|unstable|wavering|uneven|erratic)\b/i],
  [/\b(tight|controlled|disciplined)\b/i, /\b(sprawling|uncontrolled|slack|loose)\b/i],
  [/\b(clear|precise|crisp)\b/i, /\b(vague|muddled|imprecise|fuzzy)\b/i],
  [/\b(strong|propulsive|urgent|driving)\b/i, /\b(slow|sluggish|drags?|sags?|stalls?|slackens?|collapses?)\b/i],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function containsBoundedTerm(text: string, term: string): boolean {
  const normalizedText = normalizeForMatch(text);
  const normalizedTerm = normalizeForMatch(term);
  return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "i").test(normalizedText);
}

function buildCraftDomainTerms(): string[] {
  const terms = new Set<string>();

  for (const key of CRITERIA_KEYS) {
    terms.add(normalizeForMatch(key));
    for (const synonym of CANON_DOMAIN_SYNONYMS[key] ?? []) {
      terms.add(normalizeForMatch(synonym));
    }
  }

  return Array.from(terms);
}

const CRAFT_DOMAIN_TERMS = buildCraftDomainTerms();

function pairSharedAnchors(strength: string, risk: string): string[] {
  return CRAFT_DOMAIN_TERMS.filter(
    (term) => containsBoundedTerm(strength, term) && containsBoundedTerm(risk, term),
  );
}

function pairLocalDifferentiator(strength: string, risk: string): string | null {
  const joined = normalizeForMatch(`${strength}\n${risk}`);

  for (const marker of PAIR_CONTRAST_MARKERS) {
    if (joined.includes(normalizeForMatch(marker))) return marker;
  }

  for (const marker of PAIR_SCOPE_MARKERS) {
    if (joined.includes(normalizeForMatch(marker))) return marker;
  }

  return null;
}

function pairPolarityCollision(
  strength: string,
  risk: string,
): { positive: string; negative: string } | null {
  for (const [positivePattern, negativePattern] of POLARITY_PAIRS) {
    const sPos = strength.match(positivePattern);
    const sNeg = strength.match(negativePattern);
    const rPos = risk.match(positivePattern);
    const rNeg = risk.match(negativePattern);

    if (sPos && rNeg) {
      return { positive: sPos[0], negative: rNeg[0] };
    }

    if (rPos && sNeg) {
      return { positive: rPos[0], negative: sNeg[0] };
    }
  }

  return null;
}

function pairWeakTension(strength: string, risk: string): string | null {
  const joined = normalizeForMatch(`${strength}\n${risk}`);
  for (const marker of WEAK_TENSION_MARKERS) {
    if (joined.includes(marker)) return marker;
  }
  return null;
}

type Llr003Decision = "clean" | "audit_topical" | "warning_tension" | "error_polarity";

function llr003NoContradictoryDiagnosticFraming(input: RuleEvaluationInput): RuleResult {
  const strengths = input.convergence_result?.overall.top_3_strengths ?? [];
  const risks = input.convergence_result?.overall.top_3_risks ?? [];

  if (strengths.length === 0 || risks.length === 0) {
    return resultFromViolations([]);
  }

  const violations: RuleViolation[] = [];
  const pairs: Array<{
    strength: string;
    risk: string;
    shared_anchor: string[];
    canonical_anchor_ids: string[];
    matched_polarity?: { positive: string; negative: string };
    local_differentiator?: string;
    decision: Llr003Decision;
  }> = [];

  for (const strength of strengths) {
    for (const risk of risks) {
      const sharedAnchor = pairSharedAnchors(strength, risk);
      if (sharedAnchor.length === 0) continue;

      const canonicalAnchorIds = CRITERIA_KEYS.filter((key) => {
        const keyMatch = containsBoundedTerm(strength, key) && containsBoundedTerm(risk, key);
        const synonymMatch = (CANON_DOMAIN_SYNONYMS[key] ?? []).some(
          (syn) => containsBoundedTerm(strength, syn) && containsBoundedTerm(risk, syn),
        );
        return keyMatch || synonymMatch;
      }).map((key) => PIPELINE_CRITERION_CANON_ID_MAP[key]);

      const differentiator = pairLocalDifferentiator(strength, risk);
      const polarity = pairPolarityCollision(strength, risk);
      const weakTension = pairWeakTension(strength, risk);

      if (polarity && !differentiator) {
        violations.push(
          makeViolation(
            `Polarity collision on ${sharedAnchor.join(", ")} without pair-local scope/contrast qualifier.`,
            "ERROR",
            "overall",
          ),
        );

        pairs.push({
          strength,
          risk,
          shared_anchor: sharedAnchor,
          canonical_anchor_ids: canonicalAnchorIds,
          matched_polarity: polarity,
          decision: "error_polarity",
        });
        continue;
      }

      if (!polarity && weakTension && !differentiator) {
        violations.push(
          makeViolation(
            `Weak tension on ${sharedAnchor.join(", ")} without pair-local scope/contrast qualifier.`,
            "WARNING",
            "overall",
          ),
        );

        pairs.push({
          strength,
          risk,
          shared_anchor: sharedAnchor,
          canonical_anchor_ids: canonicalAnchorIds,
          decision: "warning_tension",
        });
        continue;
      }

      if (!polarity && !weakTension && !differentiator) {
        pairs.push({
          strength,
          risk,
          shared_anchor: sharedAnchor,
          canonical_anchor_ids: canonicalAnchorIds,
          decision: "audit_topical",
        });
        continue;
      }

      pairs.push({
        strength,
        risk,
        shared_anchor: sharedAnchor,
        canonical_anchor_ids: canonicalAnchorIds,
        matched_polarity: polarity ?? undefined,
        local_differentiator: differentiator ?? undefined,
        decision: "clean",
      });
    }
  }

  return resultFromViolations(violations, {
    rule_version: "llr-003-v2",
    craft_domain_source: "canon_derived",
    pairs,
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
      "Flags unscoped polarity collisions in strength/risk framing using pair-local canon-anchored evaluation.",
    enforcement_stages: ["post_convergence", "pre_artifact_generation"],
    severity: "ERROR",
    predicate: llr003NoContradictoryDiagnosticFraming,
    failure_message: "Contradictory framing found without pair-local scope boundary.",
    explanation: "Diagnostics must remain internally coherent at the strength/risk pair level.",
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