export const NARRATIVE_PRESSURE_VECTOR_SOURCES = [
  'person',
  'institution',
  'environment',
  'illness',
  'internal_contradiction',
  'social_pressure',
  'trauma',
  'fate_mortality',
  'secrecy',
  'poverty',
  'systemic_constraint',
  'family_obligation',
] as const;

export type NarrativePressureVectorSource = typeof NARRATIVE_PRESSURE_VECTOR_SOURCES[number];

export type Layer8ValidationResult =
  | { severity: 'PASS'; isValid: true }
  | { severity: 'WARNING'; isValid: true; warning_summary: string }
  | { severity: 'HARD_FAIL'; isValid: false; error_summary: string };

export interface NarrativePressureVector {
  vector_source: NarrativePressureVectorSource;
  evidence_summary: string;
  structural_impact_score: number;
}

export interface Layer8Payload {
  narrative_pressure_vectors?: NarrativePressureVector[] | null;
}

function isNarrativePressureVectorSource(value: unknown): value is NarrativePressureVectorSource {
  return typeof value === 'string' && NARRATIVE_PRESSURE_VECTOR_SOURCES.includes(value as NarrativePressureVectorSource);
}

function malformedVectorReason(vector: unknown, index: number): string | null {
  if (!vector || typeof vector !== 'object' || Array.isArray(vector)) {
    return `narrative_pressure_vectors[${index}] must be an object.`;
  }

  const candidate = vector as Record<string, unknown>;
  if (!isNarrativePressureVectorSource(candidate.vector_source)) {
    return `narrative_pressure_vectors[${index}].vector_source is not canonical.`;
  }

  if (typeof candidate.evidence_summary !== 'string' || candidate.evidence_summary.trim().length < 20) {
    return `narrative_pressure_vectors[${index}].evidence_summary must contain at least 20 characters.`;
  }

  if (
    typeof candidate.structural_impact_score !== 'number' ||
    !Number.isInteger(candidate.structural_impact_score) ||
    candidate.structural_impact_score < 1 ||
    candidate.structural_impact_score > 5
  ) {
    return `narrative_pressure_vectors[${index}].structural_impact_score must be an integer from 1 to 5.`;
  }

  return null;
}

export function validateLayer8Governance(payload: Layer8Payload): Layer8ValidationResult {
  const vectors = Array.isArray(payload.narrative_pressure_vectors)
    ? payload.narrative_pressure_vectors
    : [];

  if (vectors.length === 0) {
    return {
      severity: 'HARD_FAIL',
      isValid: false,
      error_summary:
        'CRITICAL_GOVERNANCE_FAILURE: Manuscript lacks an identifying narrative pressure vector. A structural engine (human, environmental, internal, or systemic) is strictly required to compile downstream tracking maps.',
    };
  }

  const malformedReasons = vectors
    .map((vector, index) => malformedVectorReason(vector, index))
    .filter((reason): reason is string => Boolean(reason));

  if (malformedReasons.length > 0) {
    return {
      severity: 'HARD_FAIL',
      isValid: false,
      error_summary: `CRITICAL_GOVERNANCE_FAILURE: Malformed narrative pressure vector payload. ${malformedReasons.join(' ')}`,
    };
  }

  const highImpactVectors = vectors.filter((vector) => vector.structural_impact_score >= 3);
  if (highImpactVectors.length === 0) {
    return {
      severity: 'WARNING',
      isValid: true,
      warning_summary:
        'WARNING_GOVERNANCE_LOW_STAKES: Conflict elements are recognized, but their narrative tension indexes below standard dramatic requirements. Downstream analysis maps will populate, but story diagnostics will flag low thematic velocity.',
    };
  }

  return {
    severity: 'PASS',
    isValid: true,
  };
}
