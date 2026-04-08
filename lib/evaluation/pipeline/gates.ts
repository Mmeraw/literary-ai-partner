import type { ValidityState } from "@/lib/governance/types";
// RevisionGrade EG Validator Layer — Fail-Closed
// Enforces EG-6 (Evidence integrity + anchor parity),
// EG-7 (Generic language prohibition),
// EG-8 (Criterion completeness + canon-alignment assertion),
// EG-9 (Structural completeness)

import type { CriterionKey } from "@/lib/governance/canonicalCriteria";
import {
  CANONICAL_CRITERIA,
  STRUCTURAL_CRITERIA,
} from "@/lib/governance/canonicalCriteria";
import {
  normalizeForAnchorSearch,
} from "@/lib/revision/anchorContract";

// ---------------------------------------------------------------
//  CANON-ALIGNMENT ASSERTION (binds to verify-canon-ids.ts)
//  If CANONICAL_CRITERIA drifts from 13, this throws at import
//  time — fail-closed before any gate can run.
// ---------------------------------------------------------------

const EXPECTED_CANONICAL_COUNT = 13;
if (CANONICAL_CRITERIA.length !== EXPECTED_CANONICAL_COUNT) {
  throw new Error(
    `[EG] Canon drift detected: CANONICAL_CRITERIA has ${CANONICAL_CRITERIA.length} ` +
    `entries, expected ${EXPECTED_CANONICAL_COUNT}. ` +
    `Run scripts/verify-canon-ids.ts to diagnose.`
  );
}


// ---------------------------------------------------------------
//  TYPES
// ---------------------------------------------------------------



export interface EvidenceItem {
  anchor_snippet: string;
  location_hint?: string;
}

export interface EvaluationCriterion {
  criterionKey: CriterionKey;
  score: number;
  evidence: EvidenceItem[];
  reasoning: {
    mechanism: string;
    effect: string;
    falsePositiveCheck: string;
  };
}

export interface GateViolation {
  gate: string;
  criterionKey?: CriterionKey;
  message: string;
}

export interface GateResult {
  passed: boolean;
  validity: ValidityState;
  violations: GateViolation[];
}

/** Optional context for anchor-aware EG-6 validation */
export interface GateContext {
  sourceText?: string;
}


// ---------------------------------------------------------------
//  BANNED PHRASES (EG-7: Generic language prohibition)
// ---------------------------------------------------------------

const BANNED_PHRASES: ReadonlyArray<RegExp> = [
  /\boverall\b/i,
  /\bgenerally\b/i,
  /\bthe author\s+(does|manages|succeeds|fails)\b/i,
  /\bthis (chapter|section|passage) (is|was|does)\b/i,
  /\bcould be improved\b/i,
  /\bneeds work\b/i,
  /\bquite (good|effective|strong|weak)\b/i,
  /\bsomewhat (effective|lacking|weak)\b/i,
  /\ba (good|great|nice|decent) job\b/i,
  /\breasonably well\b/i,
];


// ---------------------------------------------------------------
//  EG-6: Evidence integrity + anchor parity
//  Every criterion must have at least one evidence item with a
//  non-empty anchor_snippet. When sourceText is provided via
//  GateContext, snippets are validated against the actual
//  manuscript using the repo's anchor infrastructure.
// ---------------------------------------------------------------

function enforceEG6(
  criteria: EvaluationCriterion[],
  ctx: GateContext = {},
): GateViolation[] {
  const violations: GateViolation[] = [];
  const normalizedSource = ctx.sourceText
    ? normalizeForAnchorSearch(ctx.sourceText)
    : null;

  for (const c of criteria) {
    if (!c.evidence || c.evidence.length === 0) {
      violations.push({
        gate: "EG-6",
        criterionKey: c.criterionKey,
        message: `No evidence items for ${c.criterionKey}`,
      });
      continue;
    }

    for (const e of c.evidence) {
      const snippet = (e.anchor_snippet ?? "").trim();
      if (snippet.length === 0) {
        violations.push({
          gate: "EG-6",
          criterionKey: c.criterionKey,
          message: `Empty anchor_snippet in ${c.criterionKey} evidence`,
        });
        continue;
      }

      // Anchor parity: if source is available, verify the snippet
      // actually exists in the manuscript text.
      if (normalizedSource) {
        const normalizedSnippet = normalizeForAnchorSearch(snippet);
        if (!normalizedSource.includes(normalizedSnippet)) {
          violations.push({
            gate: "EG-6",
            criterionKey: c.criterionKey,
            message:
              `Anchor snippet not found in source for ${c.criterionKey}: ` +
              `"${snippet.slice(0, 60)}..."`,
          });
        }
      }
    }
  }
  return violations;
}


// ---------------------------------------------------------------
//  EG-7: Generic language prohibition
//  No reasoning field may contain banned vague/generic phrases.
// ---------------------------------------------------------------

function enforceEG7(criteria: EvaluationCriterion[]): GateViolation[] {
  const violations: GateViolation[] = [];
  for (const c of criteria) {
    const fields = [
      { name: "mechanism", text: c.reasoning.mechanism },
      { name: "effect", text: c.reasoning.effect },
      { name: "falsePositiveCheck", text: c.reasoning.falsePositiveCheck },
    ];
    for (const f of fields) {
      for (const pattern of BANNED_PHRASES) {
        if (pattern.test(f.text)) {
          violations.push({
            gate: "EG-7",
            criterionKey: c.criterionKey,
            message: `Banned phrase in ${c.criterionKey}.reasoning.${f.name}: matched ${pattern}`,
          });
        }
      }
    }
  }
  return violations;
}


// ---------------------------------------------------------------
//  EG-8: Criterion completeness (canon-aligned)
//  All 13 canonical criteria must be present exactly once.
//  Count is bound to CANONICAL_CRITERIA (verified by the
//  import-time assertion above).
// ---------------------------------------------------------------

function enforceEG8(criteria: EvaluationCriterion[]): GateViolation[] {
  const violations: GateViolation[] = [];
  const seen = new Set<string>();
  for (const c of criteria) {
    if (seen.has(c.criterionKey)) {
      violations.push({
        gate: "EG-8",
        criterionKey: c.criterionKey,
        message: `Duplicate criterion: ${c.criterionKey}`,
      });
    }
    seen.add(c.criterionKey);
  }
  for (const key of CANONICAL_CRITERIA) {
    if (!seen.has(key)) {
      violations.push({
        gate: "EG-8",
        criterionKey: key,
        message: `Missing criterion: ${key}`,
      });
    }
  }
  // Reject any key not in the canon
  for (const c of criteria) {
    if (!CANONICAL_CRITERIA.includes(c.criterionKey)) {
      violations.push({
        gate: "EG-8",
        criterionKey: c.criterionKey,
        message: `Non-canonical criterion: ${c.criterionKey}`,
      });
    }
  }
  return violations;
}


// ---------------------------------------------------------------
//  EG-9: Structural completeness
//  Every STRUCTURAL_CRITERIA member must score >= 4 to pass.
//  Fail-closed: missing structural criteria = automatic fail.
// ---------------------------------------------------------------

const STRUCTURAL_MINIMUM_SCORE = 4;

function enforceEG9(criteria: EvaluationCriterion[]): GateViolation[] {
  const violations: GateViolation[] = [];
  const criteriaMap = new Map(
    criteria.map((c) => [c.criterionKey, c])
  );
  for (const key of STRUCTURAL_CRITERIA) {
    const c = criteriaMap.get(key);
    if (!c) {
      violations.push({
        gate: "EG-9",
        criterionKey: key,
        message: `Structural criterion ${key} missing (fail-closed)`,
      });
      continue;
    }
    if (c.score < STRUCTURAL_MINIMUM_SCORE) {
      violations.push({
        gate: "EG-9",
        criterionKey: key,
        message: `${key} scored ${c.score} (minimum: ${STRUCTURAL_MINIMUM_SCORE})`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------
//  PUBLIC API
//  Runs all EG gates. Fail-closed: if any gate produces
//  violations, the result is INVALID.
// ---------------------------------------------------------------

export function runEvaluationGates(
  criteria: EvaluationCriterion[] | null | undefined,
  ctx: GateContext = {},
): GateResult {
  const normalizedCriteria = Array.isArray(criteria) ? criteria : [];

  const violations: GateViolation[] = [
    ...enforceEG6(normalizedCriteria, ctx),
    ...enforceEG7(normalizedCriteria),
    ...enforceEG8(normalizedCriteria),
    ...enforceEG9(normalizedCriteria),
  ];

  if (!Array.isArray(criteria)) {
    violations.push({
      gate: "EG-8",
      message: "Criteria payload missing or invalid (expected non-empty criteria array)",
    });
  }

  return {
    passed: violations.length === 0,
    validity: violations.length === 0 ? "VALID" : "INVALID",
    violations,
  };
}

// ---------------------------------------------------------------
//  ADAPTER: Convert raw LLM resultJson to EvaluationCriterion[]
//  Maps camelCase schema keys (from schemas/criteria-keys.ts)
//  to UPPER_CASE canonical keys (from canonicalCriteria.ts).
//  Returns null if resultJson has no parseable criteria.
// ---------------------------------------------------------------

const SCHEMA_TO_CANON: Record<string, CriterionKey> = {
  concept: "CONCEPT",
  momentum: "MOMENTUM",
  character: "CHARACTER",
  voice: "POVVOICE",
  sceneConstruction: "SCENE",
  dialogue: "DIALOGUE",
  theme: "THEME",
  worldbuilding: "WORLD",
  pacing: "PACING",
  proseControl: "PROSE",
  tone: "TONE",
  narrativeClosure: "CLOSURE",
  marketability: "MARKET",
};

const LEGACY_SCORE_LABEL_TO_CANON: Record<string, CriterionKey> = {
  "Narrative Architecture": "CONCEPT",
  "Character Interiority": "CHARACTER",
  "Dialogue Authenticity": "DIALOGUE",
  "Prose Rhythm & Musicality": "PROSE",
  "Symbolic Layering": "THEME",
  "Emotional Calibration": "TONE",
  "Tension & Pacing": "PACING",
  "Sensory Immersion": "WORLD",
  "Thematic Coherence": "CLOSURE",
  "Point of View Integrity": "POVVOICE",
  "Reader Engagement": "MOMENTUM",
  "Subtext & Implication": "SCENE",
  "Voice Distinctiveness": "MARKET",
};

export function adaptResultToCriteria(
  resultJson: Record<string, unknown>,
): EvaluationCriterion[] | null {
  const raw = resultJson?.criteria;
  if (Array.isArray(raw) && raw.length > 0) {
    const criteria: EvaluationCriterion[] = [];
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as Record<string, unknown>;

      const schemaKey = String(rec.key ?? "");
      const canonKey = SCHEMA_TO_CANON[schemaKey];
      if (!canonKey) continue;

      const score = Number(rec.score_0_10 ?? rec.score ?? 0);
      const evidence: EvidenceItem[] = Array.isArray(rec.evidence)
        ? (rec.evidence as Record<string, unknown>[]).map((e) => ({
            anchor_snippet: String(e.anchor_snippet ?? e.snippet ?? ""),
            location_hint: e.location_hint ? String(e.location_hint) : undefined,
          }))
        : [];

      criteria.push({
        criterionKey: canonKey,
        score,
        evidence,
        reasoning: {
          mechanism: String(rec.mechanism ?? rec.rationale ?? ""),
          effect: String(rec.effect ?? ""),
          falsePositiveCheck: String(rec.false_positive_check ?? rec.falsePositiveCheck ?? ""),
        },
      });
    }

    return criteria.length > 0 ? criteria : null;
  }

  const legacyScores = resultJson?.scores;
  if (!legacyScores || typeof legacyScores !== "object" || Array.isArray(legacyScores)) {
    return null;
  }

  const criteria: EvaluationCriterion[] = [];
  for (const [legacyLabel, value] of Object.entries(legacyScores as Record<string, unknown>)) {
    const canonKey = LEGACY_SCORE_LABEL_TO_CANON[legacyLabel];
    if (!canonKey || typeof value !== "object" || value === null) continue;

    const rec = value as Record<string, unknown>;
    const score = Number(rec.score ?? 0);
    const evidence: EvidenceItem[] = Array.isArray(rec.evidence)
      ? (rec.evidence as unknown[]).map((snippet) => ({
          anchor_snippet: String(snippet ?? ""),
        }))
      : [];

    criteria.push({
      criterionKey: canonKey,
      score,
      evidence,
      reasoning: {
        mechanism: String(rec.justification ?? ""),
        effect: "",
        falsePositiveCheck: "",
      },
    });
  }

  return criteria.length > 0 ? criteria : null;
}
