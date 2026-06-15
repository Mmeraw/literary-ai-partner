export type CreatorApprovalState = 'pending' | 'approved' | 'rejected';

export type CreatorApprovalV1 = {
  artifact_type: 'creator_approval_v1';
  artifact_version: 'creator_approval_v1';
  approval_state: CreatorApprovalState;
  approved: boolean;
  manuscript_id: string;
  evaluation_job_id: string;
  package_hash: string;
  decided_by: string | null;
  decided_at: string | null;
};

export type CreatorApprovalGateResult =
  | { ok: true; approval: CreatorApprovalV1 }
  | {
      ok: false;
      failure: {
        artifact_type: 'failure_diagnosis_v1';
        failed_gate: 'ARCG09_CREATOR_APPROVAL_GATE';
        failed_invariant: 'storygate_requires_creator_approved_agent_readiness_package';
        blocking_artifact: 'creator_approval_v1';
        diagnostic_code: 'CREATOR_APPROVAL_REQUIRED';
        approval_state: CreatorApprovalState | 'missing';
        retryable: boolean;
        remediation: string;
        user_safe_summary: string;
      };
    };

export function buildCreatorApprovalV1(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
  packageHash: string;
  approvalState: CreatorApprovalState;
  decidedBy?: string | null;
  decidedAt?: string | null;
}): CreatorApprovalV1 {
  return {
    artifact_type: 'creator_approval_v1',
    artifact_version: 'creator_approval_v1',
    approval_state: input.approvalState,
    approved: input.approvalState === 'approved',
    manuscript_id: String(input.manuscriptId).trim(),
    evaluation_job_id: input.evaluationJobId.trim(),
    package_hash: input.packageHash.trim(),
    decided_by: input.decidedBy ?? null,
    decided_at: input.decidedAt ?? null,
  };
}

export function evaluateCreatorApprovalGate(input: {
  approval?: CreatorApprovalV1 | null;
}): CreatorApprovalGateResult {
  const approval = input.approval ?? null;
  const approvalState = approval?.approval_state ?? 'missing';

  if (approval?.approval_state === 'approved' && approval.approved === true) {
    return { ok: true, approval };
  }

  return {
    ok: false,
    failure: {
      artifact_type: 'failure_diagnosis_v1',
      failed_gate: 'ARCG09_CREATOR_APPROVAL_GATE',
      failed_invariant: 'storygate_requires_creator_approved_agent_readiness_package',
      blocking_artifact: 'creator_approval_v1',
      diagnostic_code: 'CREATOR_APPROVAL_REQUIRED',
      approval_state: approvalState,
      retryable: approvalState === 'pending' || approvalState === 'missing',
      remediation: approvalState === 'rejected'
        ? 'Creator rejected this package. Generate or edit a new package and request approval again.'
        : 'Creator must explicitly approve the Agent Readiness package before Storygate submission.',
      user_safe_summary: approvalState === 'rejected'
        ? 'This package was rejected and cannot be submitted to Storygate.'
        : 'Storygate submission requires creator approval of the package first.',
    },
  };
}
