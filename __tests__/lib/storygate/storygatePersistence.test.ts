import { buildPersistedCreatorApprovalV1 } from '@/lib/agent-readiness/packagePersistence';
import { STORYGATE_REQUIRED_PACKAGE_FIELDS } from '@/lib/storygate/storygateRegistry';
import { buildAccessLogEventV1, buildStorygateSubmissionRequestV1 } from '@/lib/storygate/storygatePersistence';

const packageFields = Object.fromEntries(
  STORYGATE_REQUIRED_PACKAGE_FIELDS.map((field) => [field, field === 'rights_declaration' ? 'confirmed' : `${field} approved content`]),
);

describe('storygate_submission_v1 persistence helpers', () => {
  it('builds a validated durable Storygate submission request with hash', () => {
    const approval = buildPersistedCreatorApprovalV1({
      manuscriptId: 123,
      evaluationJobId: '11111111-1111-4111-8111-111111111111',
      packageHash: 'b'.repeat(64),
      approvalState: 'approved',
      decidedBy: '22222222-2222-4222-8222-222222222222',
      decidedAt: '2026-06-13T00:02:00.000Z',
    });

    const submission = buildStorygateSubmissionRequestV1({
      manuscriptId: 123,
      evaluationJobId: '11111111-1111-4111-8111-111111111111',
      packageHash: 'b'.repeat(64),
      creatorUserId: '22222222-2222-4222-8222-222222222222',
      projectTitle: 'Governed Novel',
      primaryGenre: 'upmarket suspense',
      creatorName: 'Creator Name',
      creatorEmail: 'creator@example.com',
      packageFields,
      creatorApproval: approval,
      readinessScore: 9.1,
      createdAt: '2026-06-13T00:03:00.000Z',
    });

    expect(submission.artifact_type).toBe('storygate_submission_request_v1');
    expect(submission.status).toBe('SUBMITTED');
    expect(submission.validation_result.valid).toBe(true);
    expect(submission.validation_result.eligible).toBe(true);
    expect(submission.submission_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('audit events carry structured validators and failure codes for access governance', () => {
    const audit = buildAccessLogEventV1({
      eventId: '33333333-3333-4333-8333-333333333333',
      actionType: 'request_access',
      actorUserId: '44444444-4444-4444-8444-444444444444',
      listingId: '55555555-5555-4555-8555-555555555555',
      requesterId: '44444444-4444-4444-8444-444444444444',
      verificationState: 'verified',
      validatorsRun: ['storygate_access_control_v1'],
      timestampUtc: '2026-06-13T00:04:00.000Z',
    });

    expect(audit.artifact_type).toBe('access_log_event_v1');
    expect(audit.action_type).toBe('request_access');
    expect(audit.validators_run).toEqual(['storygate_access_control_v1']);
    expect(audit.failure_codes).toEqual([]);
    expect(audit.canon_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
