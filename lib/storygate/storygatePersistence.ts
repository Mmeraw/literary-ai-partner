import { createHash } from 'crypto';
import type { CreatorApprovalV1 } from '@/lib/agent-readiness/creatorApprovalGate';
import { validateStorygateSubmission, type StorygateSubmissionValidationResultV1 } from '@/lib/storygate/storygateSubmissionValidator';
import type { StorygateAccessDecision, StorygateListingVisibility, StorygateSubmissionStatus, StorygateVerificationState } from '@/lib/storygate/storygateRegistry';

export type StorygateSubmissionRequestV1 = {
  artifact_type: 'storygate_submission_request_v1';
  artifact_version: 'storygate_submission_request_v1';
  manuscript_id: string;
  evaluation_job_id: string;
  package_hash: string;
  creator_user_id: string;
  project_title: string;
  primary_genre: string;
  creator_name: string;
  creator_email: string;
  package_fields: Record<string, unknown>;
  readiness_score: number | null;
  qualified_professional_equivalent: boolean;
  status: StorygateSubmissionStatus;
  validation_result: StorygateSubmissionValidationResultV1;
  submission_hash: string;
  created_at: string;
};

export type ProjectListingV1 = {
  artifact_type: 'project_listing_v1';
  listing_id: string;
  manuscript_id: string;
  creator_email: string;
  visibility: StorygateListingVisibility;
  access_requires_approval: true;
};

export type AccessRequestV1 = {
  artifact_type: 'access_request_v1';
  request_id: string;
  listing_id: string;
  requester_id: string;
  decision: Extract<StorygateAccessDecision, 'requested'>;
  verification_state: StorygateVerificationState;
  requested_at: string;
};

export type AccessUnlockGrantV1 = {
  artifact_type: 'access_unlock_grant_v1';
  grant_id: string;
  listing_id: string;
  requester_id: string;
  allowed_artifacts: string[];
  granted_at: string;
  revoked_at: string | null;
};

export type AccessLogActionType = 'listing_created' | 'request_access' | 'grant_access' | 'deny_access' | 'view' | 'download' | 'verify_industry' | 'revoke_access';

export type AccessLogEventV1 = {
  artifact_type: 'access_log_event_v1';
  event_id: string;
  action_type: AccessLogActionType;
  listing_id: string | null;
  requester_id: string | null;
  actor_user_id: string;
  timestamp_utc: string;
  validators_run: string[];
  failure_codes: string[];
  verification_state: StorygateVerificationState | null;
  canon_hash: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashStorygatePayload(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function buildStorygateSubmissionRequestV1(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
  packageHash: string;
  creatorUserId: string;
  projectTitle: string;
  primaryGenre: string;
  creatorName: string;
  creatorEmail: string;
  packageFields: Record<string, unknown>;
  creatorApproval: CreatorApprovalV1;
  readinessScore?: number | null;
  qualifiedProfessionalEquivalent?: boolean;
  requestedScopeText?: string | null;
  createdAt?: string;
}): StorygateSubmissionRequestV1 {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const validation = validateStorygateSubmission({
    packageFields: input.packageFields,
    creatorApproval: input.creatorApproval,
    readinessScore: input.readinessScore ?? null,
    qualifiedProfessionalEquivalent: input.qualifiedProfessionalEquivalent ?? false,
    requestedScopeText: input.requestedScopeText ?? null,
    createdAt,
  });

  const payload = {
    artifact_type: 'storygate_submission_request_v1' as const,
    artifact_version: 'storygate_submission_request_v1' as const,
    manuscript_id: String(input.manuscriptId),
    evaluation_job_id: input.evaluationJobId,
    package_hash: input.packageHash,
    creator_user_id: input.creatorUserId,
    project_title: input.projectTitle.trim(),
    primary_genre: input.primaryGenre.trim(),
    creator_name: input.creatorName.trim(),
    creator_email: input.creatorEmail.trim(),
    package_fields: input.packageFields,
    readiness_score: input.readinessScore ?? null,
    qualified_professional_equivalent: input.qualifiedProfessionalEquivalent ?? false,
    status: 'SUBMITTED' as const,
    validation_result: validation,
    created_at: createdAt,
  };

  return {
    ...payload,
    submission_hash: hashStorygatePayload(payload),
  };
}

export function buildAccessLogEventV1(input: {
  eventId: string;
  actionType: AccessLogActionType;
  actorUserId: string;
  listingId?: string | null;
  requesterId?: string | null;
  verificationState?: StorygateVerificationState | null;
  validatorsRun: string[];
  failureCodes?: string[];
  timestampUtc?: string;
}): AccessLogEventV1 {
  const event = {
    artifact_type: 'access_log_event_v1' as const,
    event_id: input.eventId,
    action_type: input.actionType,
    listing_id: input.listingId ?? null,
    requester_id: input.requesterId ?? null,
    actor_user_id: input.actorUserId,
    timestamp_utc: input.timestampUtc ?? new Date().toISOString(),
    validators_run: input.validatorsRun,
    failure_codes: input.failureCodes ?? [],
    verification_state: input.verificationState ?? null,
  };

  return {
    ...event,
    canon_hash: hashStorygatePayload(event),
  };
}
