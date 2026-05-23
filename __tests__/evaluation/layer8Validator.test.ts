import {
  NARRATIVE_PRESSURE_VECTOR_SOURCES,
  validateLayer8Governance,
} from '../../lib/evaluation/governance/layer8Validator';

describe('Layer 8 narrative pressure validator', () => {
  it('hard-fails when no narrative pressure vectors are present', () => {
    expect(validateLayer8Governance({ narrative_pressure_vectors: [] })).toEqual({
      severity: 'HARD_FAIL',
      isValid: false,
      error_summary:
        'CRITICAL_GOVERNANCE_FAILURE: Manuscript lacks an identifying narrative pressure vector. A structural engine (human, environmental, internal, or systemic) is strictly required to compile downstream tracking maps.',
    });
  });

  it('emits a non-blocking warning for present but low-impact pressure vectors', () => {
    const result = validateLayer8Governance({
      narrative_pressure_vectors: [
        {
          vector_source: 'internal_contradiction',
          evidence_summary: 'The narrator hesitates around an unresolved personal contradiction.',
          structural_impact_score: 2,
        },
      ],
    });

    expect(result).toMatchObject({
      severity: 'WARNING',
      isValid: true,
    });
  });

  it('passes when at least one meaningful pressure vector is present', () => {
    expect(validateLayer8Governance({
      narrative_pressure_vectors: [
        {
          vector_source: 'environment',
          evidence_summary: 'The mountain weather and terrain repeatedly force route changes and risk escalation.',
          structural_impact_score: 4,
        },
      ],
    })).toEqual({
      severity: 'PASS',
      isValid: true,
    });
  });

  it('includes non-villain literary pressure sources in the canonical taxonomy', () => {
    expect(NARRATIVE_PRESSURE_VECTOR_SOURCES).toEqual(expect.arrayContaining([
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
    ]));
  });
});
