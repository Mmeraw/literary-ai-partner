import { validateStorygateSubmission } from '@/lib/storygate/storygateSubmissionValidator';
import { STORYGATE_REQUIRED_PACKAGE_FIELDS } from '@/lib/storygate/storygateRegistry';
import { buildCreatorApprovalV1 } from '@/lib/agent-readiness/creatorApprovalGate';

function completePackage(overrides: Record<string, unknown> = {}) {
  const base = Object.fromEntries(
    STORYGATE_REQUIRED_PACKAGE_FIELDS.map((field) => [field, `${field} approved content`]),
  );
  return {
    ...base,
    market_comparables: ['Comparable A by Author', 'Comparable B by Author'],
    sample_pages: 'First ten polished manuscript pages.',
    rights_declaration: 'confirmed',
    ...overrides,
  };
}

function approvedPackage() {
  return buildCreatorApprovalV1({
    manuscriptId: 6074,
    evaluationJobId: 'job-1',
    packageHash: 'package-hash-1',
    approvalState: 'approved',
    decidedBy: 'user-1',
    decidedAt: '2026-06-13T00:00:00.000Z',
  });
}

describe('storygate submission validator', () => {
  it('passes only complete creator-approved package fields with 9.0 readiness or better', () => {
    const result = validateStorygateSubmission({
      packageFields: completePackage(),
      creatorApproval: approvedPackage(),
      readinessScore: 9.1,
      createdAt: '2026-06-13T00:00:00.000Z',
    });

    expect(result).toEqual(expect.objectContaining({
      artifact_type: 'intake_validation_result_v1',
      artifact_version: 'storygate_submission_validator_v1',
      validator_id: 'storygate_submission_validator_v1',
      valid: true,
      eligible: true,
      packageGatePass: true,
      creatorApprovalGatePass: true,
      readinessGatePass: true,
      rightsGatePass: true,
      readinessThreshold: 9,
      failureCodes: [],
      created_at: '2026-06-13T00:00:00.000Z',
    }));
  });

  it('rejects missing required fields and placeholder package text', () => {
    const fields = completePackage({
      synopsis: '',
      market_position_statement: 'TBD',
    });

    const result = validateStorygateSubmission({
      packageFields: fields,
      creatorApproval: approvedPackage(),
      readinessScore: 9.5,
    });

    expect(result.valid).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.failureCodes).toEqual(['MISSING_REQUIRED_FIELDS', 'PLACEHOLDER_TEXT_DETECTED']);
    expect(result.missingFields).toEqual(['synopsis']);
    expect(result.placeholderFields).toEqual(['market_position_statement']);
  });

  it('rejects unconfirmed rights declarations and below-threshold readiness', () => {
    const result = validateStorygateSubmission({
      packageFields: completePackage({ rights_declaration: 'I think so' }),
      creatorApproval: approvedPackage(),
      readinessScore: 8.9,
    });

    expect(result.valid).toBe(false);
    expect(result.rightsGatePass).toBe(false);
    expect(result.readinessGatePass).toBe(false);
    expect(result.failureCodes).toEqual(['RIGHTS_DECLARATION_MISSING', 'SCORE_BELOW_THRESHOLD']);
  });

  it('allows a qualified professional equivalent assessment to satisfy readiness without lowering the 9.0 threshold', () => {
    const result = validateStorygateSubmission({
      packageFields: completePackage(),
      creatorApproval: approvedPackage(),
      readinessScore: 7.5,
      qualifiedProfessionalEquivalent: true,
    });

    expect(result.valid).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.readinessGatePass).toBe(true);
    expect(result.readinessThreshold).toBe(9);
  });

  it('rejects forbidden non-book Storygate scope terms', () => {
    const result = validateStorygateSubmission({
      packageFields: completePackage({ agent_pitch: 'This includes a screenplay conversion package.' }),
      creatorApproval: approvedPackage(),
      readinessScore: 9.4,
      requestedScopeText: 'film rights marketplace',
    });

    expect(result.valid).toBe(false);
    expect(result.failureCodes).toEqual(['FORBIDDEN_SCOPE_REQUESTED']);
    expect(result.forbiddenScopeTerms).toEqual(expect.arrayContaining([
      'film_rights_marketplace',
      'screenplay_conversion',
    ]));
  });

  it.each(['pending', 'rejected'] as const)('rejects %s creator approval before Storygate submission', (approvalState) => {
    const result = validateStorygateSubmission({
      packageFields: completePackage(),
      creatorApproval: buildCreatorApprovalV1({
        manuscriptId: 6074,
        evaluationJobId: 'job-1',
        packageHash: 'package-hash-1',
        approvalState,
      }),
      readinessScore: 9.4,
    });

    expect(result.valid).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.creatorApprovalGatePass).toBe(false);
    expect(result.failureCodes).toEqual(['CREATOR_APPROVAL_REQUIRED']);
  });

  it('rejects missing creator approval before Storygate submission', () => {
    const result = validateStorygateSubmission({
      packageFields: completePackage(),
      readinessScore: 9.4,
    });

    expect(result.valid).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.creatorApprovalGatePass).toBe(false);
    expect(result.failureCodes).toEqual(['CREATOR_APPROVAL_REQUIRED']);
  });
});
