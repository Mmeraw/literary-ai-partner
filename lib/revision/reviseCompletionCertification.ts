import crypto from 'crypto';

export type ReviseCompletionDecision =
  | 'accepted_a'
  | 'accepted_b'
  | 'accepted_c'
  | 'custom'
  | 'keep_original'
  | 'reject'
  | 'deferred';

export type ReviseCompletionType = 'full' | 'partial' | 'needs_targeting_deferred';
export type ReviseCompletionFailureCode =
  | 'COMPLETION_PREMATURE'
  | 'COMPLETION_PENDING_SYNC'
  | 'COMPLETION_CERT_INVALID';

export type ReviseCompletionDecisionRow = {
  id?: string | null;
  opportunity_id?: string | null;
  decision?: string | null;
  created_at?: string | null;
};

export type ReviseCompletionCertificationInput = {
  manuscriptId: string | number;
  evaluationJobId: string;
  readyOpportunityIds: string[];
  decisions: ReviseCompletionDecisionRow[];
  needsTargetingCount?: number;
  withheldUnsupportedCount?: number;
  pendingSyncCount?: number;
  trustedPathStatus?: string;
  certifiedAt?: string;
};

export type ReviseCompletionCertificationV1 = {
  artifact_type: 'revision_completion_record_v1';
  artifact_version: 'revision_completion_record_v1';
  gate_id: 'RCG07_COMPLETION_CERTIFICATION';
  stage_id: 'RS08_COMPLETION';
  status: 'certified';
  certification_status: 'certified';
  manuscript_id: string;
  evaluation_job_id: string;
  completion_type: ReviseCompletionType;
  decision_count: number;
  decided_count: number;
  total_ready: number;
  pending_sync_count: number;
  needs_targeting_count: number;
  withheld_unsupported_count: number;
  unresolved_ready_opportunity_ids: string[];
  decision_counts: Record<ReviseCompletionDecision, number>;
  source_decision_ids: string[];
  completed_at: string;
  certified_at: string;
  revision_hash: string;
  certification_hash: string;
  trusted_path_status: string;
  governance: {
    invariant: 'all_ready_for_revise_items_have_persisted_canonical_decisions';
    no_pending_sync_entries: true;
    needs_targeting_does_not_block_completion: true;
  };
};

export type ReviseCompletionFailureDiagnosisV1 = {
  artifact_type: 'failure_diagnosis_v1';
  artifact_version: 'failure_diagnosis_v1';
  failed_stage: 'RS08_COMPLETION';
  failed_gate: 'RCG07_COMPLETION_CERTIFICATION';
  failed_invariant: string;
  blocking_artifact: 'revision_completion_record_v1';
  retryable: boolean;
  remediation: string;
  diagnostic_code: ReviseCompletionFailureCode;
  user_safe_summary: string;
  admin_summary: string;
  details: {
    manuscript_id: string;
    evaluation_job_id: string;
    total_ready: number;
    decided_count: number;
    pending_sync_count: number;
    unresolved_ready_opportunity_ids: string[];
    invalid_decision_opportunity_ids: string[];
  };
  created_at: string;
};

export type ReviseCompletionCertificationResult =
  | { ok: true; record: ReviseCompletionCertificationV1 }
  | { ok: false; failure: ReviseCompletionFailureDiagnosisV1 };

const CANONICAL_DECISIONS: readonly ReviseCompletionDecision[] = [
  'accepted_a',
  'accepted_b',
  'accepted_c',
  'custom',
  'keep_original',
  'reject',
  'deferred',
] as const;

const CANONICAL_DECISION_SET = new Set<string>(CANONICAL_DECISIONS);

function normalizeId(value: string | number): string {
  return String(value).trim();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function hashCertificationPayload(payload: Omit<ReviseCompletionCertificationV1, 'certification_hash'>): string {
  // The timestamp is recorded in the cert but excluded from the hash so the
  // certification hash is deterministic for the same decisions and state.
  // This makes the Final Review Apply fingerprint idempotent across retries.
  const payloadToHash = { ...payload };
  delete (payloadToHash as any).certified_at;
  delete (payloadToHash as any).completed_at;
  return crypto.createHash('sha256').update(stableStringify(payloadToHash), 'utf8').digest('hex');
}

function emptyDecisionCounts(): Record<ReviseCompletionDecision, number> {
  return {
    accepted_a: 0,
    accepted_b: 0,
    accepted_c: 0,
    custom: 0,
    keep_original: 0,
    reject: 0,
    deferred: 0,
  };
}

function failure(input: {
  code: ReviseCompletionFailureCode;
  invariant: string;
  retryable: boolean;
  remediation: string;
  userSafeSummary: string;
  adminSummary: string;
  manuscriptId: string;
  evaluationJobId: string;
  totalReady: number;
  decidedCount: number;
  pendingSyncCount: number;
  unresolvedReadyOpportunityIds: string[];
  invalidDecisionOpportunityIds: string[];
  createdAt: string;
}): ReviseCompletionCertificationResult {
  return {
    ok: false,
    failure: {
      artifact_type: 'failure_diagnosis_v1',
      artifact_version: 'failure_diagnosis_v1',
      failed_stage: 'RS08_COMPLETION',
      failed_gate: 'RCG07_COMPLETION_CERTIFICATION',
      failed_invariant: input.invariant,
      blocking_artifact: 'revision_completion_record_v1',
      retryable: input.retryable,
      remediation: input.remediation,
      diagnostic_code: input.code,
      user_safe_summary: input.userSafeSummary,
      admin_summary: input.adminSummary,
      details: {
        manuscript_id: input.manuscriptId,
        evaluation_job_id: input.evaluationJobId,
        total_ready: input.totalReady,
        decided_count: input.decidedCount,
        pending_sync_count: input.pendingSyncCount,
        unresolved_ready_opportunity_ids: input.unresolvedReadyOpportunityIds,
        invalid_decision_opportunity_ids: input.invalidDecisionOpportunityIds,
      },
      created_at: input.createdAt,
    },
  };
}

export function buildReviseCompletionCertification(
  input: ReviseCompletionCertificationInput,
): ReviseCompletionCertificationResult {
  const manuscriptId = normalizeId(input.manuscriptId);
  const evaluationJobId = normalizeId(input.evaluationJobId);
  const certifiedAt = input.certifiedAt ?? new Date().toISOString();
  const readyOpportunityIds = [...new Set(input.readyOpportunityIds.map((id) => id.trim()).filter(Boolean))].sort();
  const pendingSyncCount = Math.max(0, input.pendingSyncCount ?? 0);
  const needsTargetingCount = Math.max(0, input.needsTargetingCount ?? 0);
  const withheldUnsupportedCount = Math.max(0, input.withheldUnsupportedCount ?? 0);
  const trustedPathStatus = typeof input.trustedPathStatus === 'string' && input.trustedPathStatus.trim().length > 0
    ? input.trustedPathStatus.trim()
    : 'not_requested';

  const latestDecisionByOpportunity = new Map<string, ReviseCompletionDecisionRow>();
  for (const decision of input.decisions) {
    const opportunityId = decision.opportunity_id?.trim();
    if (!opportunityId) continue;
    if (!latestDecisionByOpportunity.has(opportunityId)) {
      latestDecisionByOpportunity.set(opportunityId, decision);
    }
  }

  const invalidDecisionOpportunityIds = [...latestDecisionByOpportunity.entries()]
    .filter(([, decision]) => !CANONICAL_DECISION_SET.has(decision.decision ?? ''))
    .map(([opportunityId]) => opportunityId)
    .sort();

  const unresolvedReadyOpportunityIds = readyOpportunityIds
    .filter((opportunityId) => !latestDecisionByOpportunity.has(opportunityId))
    .sort();

  const decisionCounts = emptyDecisionCounts();
  const sourceDecisionIds: string[] = [];
  for (const opportunityId of readyOpportunityIds) {
    const decision = latestDecisionByOpportunity.get(opportunityId);
    if (!decision || !CANONICAL_DECISION_SET.has(decision.decision ?? '')) continue;
    decisionCounts[decision.decision as ReviseCompletionDecision] += 1;
    if (decision.id?.trim()) sourceDecisionIds.push(decision.id.trim());
  }

  const decidedCount = readyOpportunityIds.length - unresolvedReadyOpportunityIds.length;

  if (!manuscriptId || !evaluationJobId) {
    return failure({
      code: 'COMPLETION_CERT_INVALID',
      invariant: 'completion_certification_requires_manuscript_and_evaluation_ids',
      retryable: false,
      remediation: 'Rebuild the Final Review runtime context with canonical manuscript_id and evaluation_job_id before certification.',
      userSafeSummary: 'Final Review is unavailable because required revision identifiers are missing.',
      adminSummary: 'RCG07 blocked because manuscript_id or evaluation_job_id was empty.',
      manuscriptId,
      evaluationJobId,
      totalReady: readyOpportunityIds.length,
      decidedCount,
      pendingSyncCount,
      unresolvedReadyOpportunityIds,
      invalidDecisionOpportunityIds,
      createdAt: certifiedAt,
    });
  }

  if (pendingSyncCount > 0) {
    return failure({
      code: 'COMPLETION_PENDING_SYNC',
      invariant: 'no_pending_sync_entries',
      retryable: true,
      remediation: 'Sync pending author decisions to the revision ledger, then retry Final Review.',
      userSafeSummary: 'Final Review is waiting for your latest revision decisions to finish syncing.',
      adminSummary: `RCG07 blocked with ${pendingSyncCount} pending sync entr${pendingSyncCount === 1 ? 'y' : 'ies'}.`,
      manuscriptId,
      evaluationJobId,
      totalReady: readyOpportunityIds.length,
      decidedCount,
      pendingSyncCount,
      unresolvedReadyOpportunityIds,
      invalidDecisionOpportunityIds,
      createdAt: certifiedAt,
    });
  }

  if (invalidDecisionOpportunityIds.length > 0) {
    return failure({
      code: 'COMPLETION_CERT_INVALID',
      invariant: 'all_persisted_decisions_are_canonical',
      retryable: false,
      remediation: 'Inspect revision_ledger_decisions for non-canonical decision values; do not certify completion until corrected.',
      userSafeSummary: 'Final Review is unavailable because a revision decision needs support review.',
      adminSummary: `RCG07 blocked by non-canonical decisions on opportunities: ${invalidDecisionOpportunityIds.join(', ')}.`,
      manuscriptId,
      evaluationJobId,
      totalReady: readyOpportunityIds.length,
      decidedCount,
      pendingSyncCount,
      unresolvedReadyOpportunityIds,
      invalidDecisionOpportunityIds,
      createdAt: certifiedAt,
    });
  }

  if (unresolvedReadyOpportunityIds.length > 0) {
    return failure({
      code: 'COMPLETION_PREMATURE',
      invariant: 'all_ready_for_revise_items_have_persisted_canonical_decisions',
      retryable: true,
      remediation: 'Return to Revise Workbench and decide every Ready for Revise card before Final Review.',
      userSafeSummary: 'Final Review unlocks after every ready revision card has a saved decision.',
      adminSummary: `RCG07 blocked because ${unresolvedReadyOpportunityIds.length} ready opportunit${unresolvedReadyOpportunityIds.length === 1 ? 'y is' : 'ies are'} undecided.`,
      manuscriptId,
      evaluationJobId,
      totalReady: readyOpportunityIds.length,
      decidedCount,
      pendingSyncCount,
      unresolvedReadyOpportunityIds,
      invalidDecisionOpportunityIds,
      createdAt: certifiedAt,
    });
  }

  const deferredReadyCount = decisionCounts.deferred;
  const unresolvedNonReadyCount = needsTargetingCount + withheldUnsupportedCount;
  const completionType: ReviseCompletionType = deferredReadyCount > 0
    ? 'partial'
    : unresolvedNonReadyCount > 0
      ? 'needs_targeting_deferred'
      : 'full';

  const recordWithoutHash: Omit<ReviseCompletionCertificationV1, 'certification_hash'> = {
    artifact_type: 'revision_completion_record_v1',
    artifact_version: 'revision_completion_record_v1',
    gate_id: 'RCG07_COMPLETION_CERTIFICATION',
    stage_id: 'RS08_COMPLETION',
    status: 'certified',
    certification_status: 'certified',
    manuscript_id: manuscriptId,
    evaluation_job_id: evaluationJobId,
    completion_type: completionType,
    decision_count: decidedCount,
    decided_count: decidedCount,
    total_ready: readyOpportunityIds.length,
    pending_sync_count: pendingSyncCount,
    needs_targeting_count: needsTargetingCount,
    withheld_unsupported_count: withheldUnsupportedCount,
    unresolved_ready_opportunity_ids: [],
    decision_counts: decisionCounts,
    source_decision_ids: sourceDecisionIds.sort(),
    completed_at: certifiedAt,
    certified_at: certifiedAt,
    revision_hash: '',
    trusted_path_status: trustedPathStatus,
    governance: {
      invariant: 'all_ready_for_revise_items_have_persisted_canonical_decisions',
      no_pending_sync_entries: true,
      needs_targeting_does_not_block_completion: true,
    },
  };

  return {
    ok: true,
    record: {
      ...recordWithoutHash,
      revision_hash: hashCertificationPayload(recordWithoutHash),
      certification_hash: hashCertificationPayload(recordWithoutHash),
    },
  };
}

export function assertReviseCompletionCertified(input: ReviseCompletionCertificationInput): ReviseCompletionCertificationV1 {
  const result = buildReviseCompletionCertification(input);
  if (result.ok === false) {
    throw new Error(`${result.failure.diagnostic_code}: ${result.failure.user_safe_summary}`);
  }
  return result.record;
}
