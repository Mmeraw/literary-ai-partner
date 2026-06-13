import { AGENT_READINESS_REQUIRED_SECTION_TYPES, buildAgentReadinessPackageV1, buildPersistedCreatorApprovalV1 } from '@/lib/agent-readiness/packagePersistence';
import { evaluateCreatorApprovalGate } from '@/lib/agent-readiness/creatorApprovalGate';
import { STORYGATE_REQUIRED_PACKAGE_FIELDS } from '@/lib/storygate/storygateRegistry';
import { buildAccessLogEventV1, buildStorygateSubmissionRequestV1 } from '@/lib/storygate/storygatePersistence';

describe('Evaluation → UED → Revise → RCG07 → Agent Readiness → Creator Approval → Storygate conformance', () => {
  it('carries only persisted governed artifacts through the chain', () => {
    const evaluation = {
      artifact_type: 'evaluation_result_v2',
      status: 'complete',
      job_id: '11111111-1111-4111-8111-111111111111',
      manuscript_id: 123,
    } as const;
    const ued = {
      artifact_type: 'unified_evaluation_document_v1',
      source_job_id: evaluation.job_id,
      persisted: true,
    } as const;
    const revise = {
      artifact_type: 'revision_completion_record_v1',
      source_artifact: ued.artifact_type,
      gate_id: 'RCG07_COMPLETION_CERTIFICATION',
      certified: true,
    } as const;

    const packageAssembly = buildAgentReadinessPackageV1({
      manuscriptId: evaluation.manuscript_id,
      evaluationJobId: evaluation.job_id,
      userId: '22222222-2222-4222-8222-222222222222',
      manuscriptTitle: 'Governed Novel',
      approvedSections: AGENT_READINESS_REQUIRED_SECTION_TYPES.map((section_type) => ({
        section_type,
        content: `${section_type} approved content`,
      })),
      packageVersion: 1,
      createdAt: '2026-06-13T00:00:00.000Z',
    });

    expect(evaluation.status).toBe('complete');
    expect(ued.persisted).toBe(true);
    expect(revise.certified).toBe(true);
    expect(packageAssembly.ok).toBe(true);
    if (!packageAssembly.ok) return;

    const creatorApproval = buildPersistedCreatorApprovalV1({
      manuscriptId: evaluation.manuscript_id,
      evaluationJobId: evaluation.job_id,
      packageHash: packageAssembly.package.package_hash,
      approvalState: 'approved',
      decidedBy: '22222222-2222-4222-8222-222222222222',
      decidedAt: '2026-06-13T00:05:00.000Z',
    });

    const packageFields = Object.fromEntries(
      STORYGATE_REQUIRED_PACKAGE_FIELDS.map((field) => [
        field,
        field === 'rights_declaration' ? 'confirmed' : `${field} creator-approved content`,
      ]),
    );

    const submission = buildStorygateSubmissionRequestV1({
      manuscriptId: evaluation.manuscript_id,
      evaluationJobId: evaluation.job_id,
      packageHash: packageAssembly.package.package_hash,
      creatorUserId: '22222222-2222-4222-8222-222222222222',
      projectTitle: 'Governed Novel',
      primaryGenre: 'upmarket suspense',
      creatorName: 'Creator Name',
      creatorEmail: 'creator@example.com',
      packageFields,
      creatorApproval,
      readinessScore: 9.2,
      createdAt: '2026-06-13T00:06:00.000Z',
    });

    const audit = buildAccessLogEventV1({
      eventId: '33333333-3333-4333-8333-333333333333',
      actionType: 'listing_created',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      validatorsRun: ['storygate_submission_validator_v1'],
      failureCodes: submission.validation_result.failureCodes,
      timestampUtc: '2026-06-13T00:07:00.000Z',
    });

    expect(evaluateCreatorApprovalGate({ approval: creatorApproval }).ok).toBe(true);
    expect(submission.validation_result.valid).toBe(true);
    expect(submission.validation_result.eligible).toBe(true);
    expect(submission.package_hash).toBe(packageAssembly.package.package_hash);
    expect(audit.failure_codes).toEqual([]);
    expect(audit.validators_run).toEqual(['storygate_submission_validator_v1']);
  });
});
