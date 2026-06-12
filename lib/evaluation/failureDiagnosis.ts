import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import {
  upsertEvaluationArtifact,
  type ArtifactType,
} from '@/lib/evaluation/artifactPersistence';

export type FailureDiagnosisV1 = {
  artifact_type: 'failure_diagnosis_v1';
  version: 1;
  job_id: string;
  created_at: string;
  phase: string | null;
  phase_status?: string | null;
  failure_code: string | null;
  failure_point: {
    stage: string;
    gate?: string;
    artifact_type?: string;
    failed_check?: string;
  };
  user_safe_summary: string;
  admin_summary: string;
  developer_summary: string;
  failed_checks: string[];
  failed_criteria: string[];
  blocking_reasons: string[];
  score_caps?: Array<{
    criterion: string;
    original_score?: number;
    effective_score?: number;
    confidence?: number;
    reason?: string;
  }>;
  artifact_inventory: {
    last_successful_artifact?: string;
    first_missing_or_failed_artifact?: string;
    present_artifacts: string[];
    missing_expected_artifacts: string[];
  };
  repair_status: {
    attempted: boolean;
    mechanism?: string;
    used_source?: string;
    expected_source?: string;
    outcome?: 'not_attempted' | 'applied' | 'failed' | 'not_applicable';
  };
  backward_kick_status: {
    triggered: boolean;
    reason: string;
    retry_policy?: {
      max_retries?: number;
      retryable?: boolean;
      classification?: string;
    };
  };
  recommended_next_action: string;
  evidence_refs: Array<{
    artifact_type?: string;
    log_stage?: string;
    field_path?: string;
    excerpt?: string;
  }>;
};

export type FailureDiagnosisContext = {
  pipelineStage?: string;
  reasonCodes?: string[];
  diagnostics?: unknown;
};

type FailureDiagnosisArtifactRow = {
  artifact_type: string;
  created_at?: string;
  content?: unknown | null;
};

type FailureDiagnosisBuildInput = {
  jobId: string;
  createdAt: string;
  phase: string | null;
  phaseStatus?: string | null;
  failureCode: string | null;
  errorMessage: string;
  artifacts?: FailureDiagnosisArtifactRow[];
  failureContext?: FailureDiagnosisContext;
};

type ArtifactInventory = FailureDiagnosisV1['artifact_inventory'];
type RepairStatus = FailureDiagnosisV1['repair_status'];

const RELEVANT_ARTIFACT_TYPES: readonly ArtifactType[] = [
  'accepted_story_ledger_v1',
  'pass12_handoff_v1',
  'pass3_preflight_draft_v1',
  'pass_outputs_diagnostic_v1',
  'quality_gate_diagnostics_v1',
  'artifact_consistency_gate_v1',
  'evaluation_result_v2',
  'unified_evaluation_document_v1',
  'report_render_manifest_v1',
  'author_exposure_certification_v1',
] as const;

const EXPECTED_ARTIFACT_CHAIN = [
  'accepted_story_ledger_v1',
  'pass12_handoff_v1',
  'pass3_preflight_draft_v1',
  'pass_outputs_diagnostic_v1',
  'quality_gate_diagnostics_v1',
  'artifact_consistency_gate_v1',
  'evaluation_result_v2',
  'unified_evaluation_document_v1',
  'report_render_manifest_v1',
  'author_exposure_certification_v1',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCriterionKeysFromText(value: string): string[] {
  return CRITERIA_KEYS.filter((criterion) =>
    new RegExp(`\\b${escapeRegExp(criterion)}\\b`, 'i').test(value),
  );
}

function listLabel(values: string[]): string {
  return values.join(', ');
}

function phaseLabel(phase: string | null): string {
  switch (phase) {
    case 'phase_1a':
      return 'Phase 1A';
    case 'phase_2':
      return 'Phase 2';
    case 'phase_3':
      return 'Phase 3';
    case 'review_gate':
      return 'Review Gate';
    case 'wave_revision':
      return 'WAVE Revision';
    default:
      return phase && phase.trim().length > 0 ? phase : 'Unknown stage';
  }
}

function firstFailureArtifact(failureCode: string | null): string | undefined {
  switch (failureCode) {
    case 'PHASE2_PASS12_FAILED':
      return 'pass12_handoff_v1';
    case 'QG_FAILED':
      return 'quality_gate_diagnostics_v1';
    case 'ARTIFACT_CONSISTENCY_GATE_FAILED':
      return 'artifact_consistency_gate_v1';
    case 'TEMPLATE_COMPLETENESS_GATE_FAILED':
      return 'evaluation_result_v2';
    default:
      if (failureCode?.includes('CERTIFICATION')) return 'author_exposure_certification_v1';
      if (failureCode?.includes('HASH')) return 'author_exposure_certification_v1';
      if (failureCode?.includes('UNIFIED') || failureCode?.includes('UED')) {
        return 'unified_evaluation_document_v1';
      }
      return undefined;
  }
}

function buildArtifactInventory(
  artifacts: FailureDiagnosisArtifactRow[],
  failureCode: string | null,
): ArtifactInventory {
  const presentArtifacts = uniqueStrings(
    artifacts
      .map((artifact) => asString(artifact.artifact_type))
      .filter((artifactType): artifactType is string => Boolean(artifactType)),
  );

  const missingExpectedArtifacts = EXPECTED_ARTIFACT_CHAIN.filter(
    (artifactType) => !presentArtifacts.includes(artifactType),
  );

  const lastSuccessfulArtifact =
    [...EXPECTED_ARTIFACT_CHAIN].reverse().find((artifactType) => presentArtifacts.includes(artifactType)) ??
    presentArtifacts[presentArtifacts.length - 1];

  return {
    last_successful_artifact: lastSuccessfulArtifact,
    first_missing_or_failed_artifact:
      firstFailureArtifact(failureCode) ?? missingExpectedArtifacts[0] ?? undefined,
    present_artifacts: presentArtifacts,
    missing_expected_artifacts: missingExpectedArtifacts,
  };
}

function findArtifact(
  artifacts: FailureDiagnosisArtifactRow[],
  artifactType: string,
): FailureDiagnosisArtifactRow | null {
  return artifacts.find((artifact) => artifact.artifact_type === artifactType) ?? null;
}

function parseFailedCheckIds(failedChecks: string[]): string[] {
  return uniqueStrings(
    failedChecks.map((check) => {
      const [id] = check.split(':', 1);
      return id?.trim() || null;
    }),
  );
}

function buildRepairStatus(
  diagnostics: Record<string, unknown> | null,
  failureCode: string | null,
): RepairStatus {
  const summaryRepair = isRecord(diagnostics?.summary_repair)
    ? diagnostics.summary_repair
    : null;

  if (summaryRepair) {
    return {
      attempted: summaryRepair.attempted === true,
      mechanism: asString(summaryRepair.mechanism) ?? undefined,
      used_source: asString(summaryRepair.used_source) ?? undefined,
      expected_source: asString(summaryRepair.expected_source) ?? undefined,
      outcome:
        asString(summaryRepair.outcome) as RepairStatus['outcome'] | null ?? 'not_attempted',
    };
  }

  if (failureCode === 'ARTIFACT_CONSISTENCY_GATE_FAILED') {
    return {
      attempted: true,
      mechanism: 'artifact_consistency_gate_v1',
      outcome: 'failed',
    };
  }

  return {
    attempted: false,
    outcome: 'not_attempted',
  };
}

function buildBackwardKickStatus(failureCode: string | null): FailureDiagnosisV1['backward_kick_status'] {
  if (
    failureCode === 'QG_FAILED' ||
    failureCode === 'ARTIFACT_CONSISTENCY_GATE_FAILED' ||
    failureCode === 'TEMPLATE_COMPLETENESS_GATE_FAILED'
  ) {
    return {
      triggered: false,
      reason: `${failureCode} classified terminal/no-retry by selfCorrectionPolicy.`,
      retry_policy: {
        retryable: false,
        classification: 'terminal',
      },
    };
  }

  return {
    triggered: false,
    reason: 'No backward-kick metadata was recorded before failure finalization.',
  };
}

function buildQGScoreCaps(
  diagnosticsArtifact: Record<string, unknown> | null,
): FailureDiagnosisV1['score_caps'] | undefined {
  const perCriterion = Array.isArray(diagnosticsArtifact?.per_criterion)
    ? diagnosticsArtifact.per_criterion
    : [];
  const defaultCap = asNumber(diagnosticsArtifact?.score_cap_for_low_confidence);

  const scoreCaps = perCriterion
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .filter((entry) => entry.score_cap_applies === true || entry.violated === true)
    .map((entry) => ({
      criterion: asString(entry.criterion_key) ?? 'unknown',
      original_score: asNumber(entry.score),
      effective_score: entry.violated === true ? defaultCap : undefined,
      confidence: asNumber(entry.confidence),
      reason: asStringArray(entry.reasons).join('; ') || undefined,
    }));

  return scoreCaps.length > 0 ? scoreCaps : undefined;
}

function buildTemplateFailure(
  phase: string | null,
  failureCode: string | null,
  diagnostics: Record<string, unknown> | null,
  artifactInventory: ArtifactInventory,
  errorMessage: string,
): FailureDiagnosisV1 {
  const violations = Array.isArray(diagnostics?.violations) ? diagnostics.violations : [];
  const failedChecks = uniqueStrings(
    violations
      .filter((violation): violation is Record<string, unknown> => isRecord(violation))
      .map((violation) => asString(violation.code)),
  );
  const failedCriteria = uniqueStrings(
    violations
      .filter((violation): violation is Record<string, unknown> => isRecord(violation))
      .map((violation) => asString(violation.criterion)),
  );
  const summary = asString(diagnostics?.summary) ?? errorMessage;

  return {
    artifact_type: 'failure_diagnosis_v1',
    version: 1,
    job_id: '',
    created_at: '',
    phase,
    phase_status: null,
    failure_code: failureCode,
    failure_point: {
      stage: phaseLabel(phase),
      gate: 'TemplateCompletenessGate',
      artifact_type: 'evaluation_result_v2',
      failed_check: failedChecks[0],
    },
    user_safe_summary: 'The evaluation stopped before report release because required report content was incomplete.',
    admin_summary: `Template completeness gate blocked canonical persistence: ${summary}`,
    developer_summary: `Template completeness gate reported ${failedChecks.length || 0} blocking violation(s). ${summary}`,
    failed_checks: failedChecks,
    failed_criteria: failedCriteria,
    blocking_reasons: failedChecks.length > 0 ? failedChecks : [failureCode ?? 'TEMPLATE_COMPLETENESS_GATE_FAILED'],
    artifact_inventory: artifactInventory,
    repair_status: {
      attempted: false,
      mechanism: 'template_completeness_gate',
      outcome: 'not_applicable',
    },
    backward_kick_status: buildBackwardKickStatus(failureCode),
    recommended_next_action:
      'Repair the blocking template completeness violations before re-attempting canonical persistence.',
    evidence_refs: [
      {
        log_stage: 'template_completeness_gate',
        field_path: 'summary',
        excerpt: summary,
      },
    ],
  };
}

function buildArtifactConsistencyFailure(
  phase: string | null,
  failureCode: string | null,
  diagnosticsArtifact: Record<string, unknown> | null,
  artifactInventory: ArtifactInventory,
): FailureDiagnosisV1 {
  const checks = Array.isArray(diagnosticsArtifact?.checks) ? diagnosticsArtifact.checks : [];
  const failedChecks = checks
    .filter((check): check is Record<string, unknown> => isRecord(check) && check.status === 'fail')
    .map((check) => asString(check.check_id))
    .filter((checkId): checkId is string => Boolean(checkId));
  const failedCriteria = uniqueStrings(
    checks
      .filter((check): check is Record<string, unknown> => isRecord(check) && check.status === 'fail')
      .flatMap((check) =>
        Array.isArray(check.affected_criteria)
          ? check.affected_criteria.map((criterion) => asString(criterion))
          : [],
      ),
  );
  const blockingReasons = asStringArray(diagnosticsArtifact?.blocking_reasons);
  const failedDetail =
    checks.find((check) => isRecord(check) && check.status === 'fail' && asString(check.details)) as
      | Record<string, unknown>
      | undefined;
  const detail = asString(failedDetail?.details) ?? 'Artifact consistency gate failed.';

  return {
    artifact_type: 'failure_diagnosis_v1',
    version: 1,
    job_id: '',
    created_at: '',
    phase,
    phase_status: null,
    failure_code: failureCode,
    failure_point: {
      stage: phaseLabel(phase),
      gate: 'ArtifactConsistencyGateV1',
      artifact_type: 'artifact_consistency_gate_v1',
      failed_check: failedChecks[0] ?? blockingReasons[0],
    },
    user_safe_summary:
      'The evaluation stopped before release because the final report package did not pass consistency checks.',
    admin_summary: `Consistency gate blocked canonical persistence: ${detail}`,
    developer_summary:
      `artifact_consistency_gate_v1 failed ${blockingReasons.length} invariant(s): ${blockingReasons.join(', ') || detail}`,
    failed_checks: failedChecks,
    failed_criteria: failedCriteria,
    blocking_reasons: blockingReasons.length > 0 ? blockingReasons : [failureCode ?? 'ARTIFACT_CONSISTENCY_GATE_FAILED'],
    artifact_inventory: artifactInventory,
    repair_status: buildRepairStatus(diagnosticsArtifact, failureCode),
    backward_kick_status: buildBackwardKickStatus(failureCode),
    recommended_next_action:
      'Repair the failing artifact consistency invariant(s) before persisting evaluation_result_v2 or author-facing artifacts.',
    evidence_refs: [
      {
        artifact_type: 'artifact_consistency_gate_v1',
        field_path: 'checks',
        excerpt: detail,
      },
    ],
  };
}

function buildQGFailure(
  phase: string | null,
  failureCode: string | null,
  diagnosticsArtifact: Record<string, unknown> | null,
  failureContextDiagnostics: Record<string, unknown> | null,
  artifactInventory: ArtifactInventory,
  errorMessage: string,
): FailureDiagnosisV1 {
  const failedChecksRaw = asStringArray(diagnosticsArtifact?.failed_checks);
  const failedChecks = parseFailedCheckIds(failedChecksRaw);
  const artifactFailedCriteria = Array.isArray(diagnosticsArtifact?.failed_criteria)
    ? diagnosticsArtifact.failed_criteria
    : [];
  const failedCriteria = uniqueStrings([
    ...artifactFailedCriteria.flatMap((entry) =>
      isRecord(entry) ? [asString(entry.criterion_key)] : [],
    ),
    ...failedChecksRaw.flatMap((entry) => extractCriterionKeysFromText(entry)),
  ]);
  const scoreCaps = buildQGScoreCaps(diagnosticsArtifact);
  const repairStatus = buildRepairStatus(failureContextDiagnostics, failureCode);
  const primaryCheck = failedChecks[0] ?? null;
  const primaryExcerpt = failedChecksRaw[0] ?? errorMessage;

  const developerDetails: string[] = [];
  if (scoreCaps?.length) {
    const firstCap = scoreCaps[0];
    developerDetails.push(
      `${firstCap.criterion} carried score ${firstCap.original_score ?? 'unknown'} with confidence ${firstCap.confidence ?? 'unknown'}${firstCap.effective_score !== undefined ? ` and was capped to ${firstCap.effective_score}` : ''}.`,
    );
    if (firstCap.reason) {
      developerDetails.push(firstCap.reason);
    }
  }
  if (repairStatus.attempted) {
    developerDetails.push(
      `Deterministic repair ${repairStatus.outcome === 'applied' ? 'applied' : 'ran'} via ${repairStatus.mechanism ?? 'summary_repair'} using ${repairStatus.used_source ?? 'unknown source'}; expected ${repairStatus.expected_source ?? 'unknown source'}.`,
    );
  }

  const adminSummary =
    primaryCheck === 'v2_summary_weakness_presence' && failedCriteria.length > 0
      ? `Overview omitted QG-normalized bottom weakness: ${listLabel(failedCriteria)}.`
      : `QualityGateV2 blocked finalization: ${primaryExcerpt}`;

  return {
    artifact_type: 'failure_diagnosis_v1',
    version: 1,
    job_id: '',
    created_at: '',
    phase,
    phase_status: null,
    failure_code: failureCode,
    failure_point: {
      stage: phaseLabel(phase),
      gate: 'QualityGateV2',
      artifact_type: 'quality_gate_diagnostics_v1',
      failed_check: primaryCheck ?? undefined,
    },
    user_safe_summary:
      'The evaluation stopped before release because a final quality gate found a blocking consistency issue.',
    admin_summary: adminSummary,
    developer_summary:
      developerDetails.length > 0
        ? developerDetails.join(' ')
        : `QualityGateV2 failed with ${failedChecks.length || 1} blocking check(s): ${primaryExcerpt}`,
    failed_checks: failedChecks,
    failed_criteria: failedCriteria,
    blocking_reasons: failedChecks.length > 0 ? failedChecks : [failureCode ?? 'QG_FAILED'],
    ...(scoreCaps ? { score_caps: scoreCaps } : {}),
    artifact_inventory: artifactInventory,
    repair_status: repairStatus,
    backward_kick_status: buildBackwardKickStatus(failureCode),
    recommended_next_action:
      primaryCheck === 'v2_summary_weakness_presence'
        ? 'Run post-QG consistency repair/gate using QG-normalized criteria before canonical persistence.'
        : 'Repair the failing QualityGateV2 check and rerun Phase 3 before canonical persistence.',
    evidence_refs: [
      {
        artifact_type: 'quality_gate_diagnostics_v1',
        field_path: 'failed_checks',
        excerpt: primaryExcerpt,
      },
      ...(scoreCaps?.[0]
        ? [
            {
              artifact_type: 'quality_gate_diagnostics_v1',
              field_path: `per_criterion.${scoreCaps[0].criterion}`,
              excerpt: scoreCaps[0].reason ?? undefined,
            },
          ]
        : []),
    ],
  };
}

function buildPhase2Pass12Failure(
  phase: string | null,
  failureCode: string | null,
  artifactInventory: ArtifactInventory,
  artifacts: FailureDiagnosisArtifactRow[],
  errorMessage: string,
): FailureDiagnosisV1 {
  const pass12Present = Boolean(findArtifact(artifacts, 'pass12_handoff_v1'));
  const preflightPresent = Boolean(findArtifact(artifacts, 'pass3_preflight_draft_v1'));
  const developerSummary = pass12Present
    ? 'pass12_handoff_v1 existed, but the Phase 2/3 handoff path still failed before downstream continuation completed.'
    : 'pass12_handoff_v1 was missing at failure finalization, so Phase 3 had no canonical Pass 1/2 handoff artifact to consume.';

  return {
    artifact_type: 'failure_diagnosis_v1',
    version: 1,
    job_id: '',
    created_at: '',
    phase,
    phase_status: null,
    failure_code: failureCode,
    failure_point: {
      stage: phaseLabel(phase ?? 'phase_2'),
      gate: 'Pass1/2Handoff',
      artifact_type: 'pass12_handoff_v1',
      failed_check: pass12Present ? 'handoff_recovery_failed' : 'handoff_artifact_missing',
    },
    user_safe_summary: 'The evaluation stopped while reconciling earlier passes into the final handoff.',
    admin_summary: pass12Present
      ? 'Phase 2 handoff recovery failed despite a persisted pass12_handoff_v1 artifact.'
      : 'Phase 2 could not find the required pass12_handoff_v1 artifact.',
    developer_summary: `${developerSummary} pass3_preflight_draft_v1 present=${preflightPresent}. Last error: ${errorMessage}`,
    failed_checks: [pass12Present ? 'handoff_recovery_failed' : 'handoff_artifact_missing'],
    failed_criteria: [],
    blocking_reasons: [failureCode ?? 'PHASE2_PASS12_FAILED'],
    artifact_inventory: artifactInventory,
    repair_status: {
      attempted: false,
      mechanism: 'pass12_handoff_recovery',
      outcome: 'not_attempted',
    },
    backward_kick_status: buildBackwardKickStatus(failureCode),
    recommended_next_action:
      'Restore or rebuild the canonical pass12_handoff_v1 artifact before resuming Phase 2/3 handoff processing.',
    evidence_refs: [
      {
        artifact_type: 'pass12_handoff_v1',
        field_path: 'artifact_presence',
        excerpt: pass12Present ? 'present' : 'missing',
      },
    ],
  };
}

function buildGenericFailure(
  phase: string | null,
  failureCode: string | null,
  artifactInventory: ArtifactInventory,
  errorMessage: string,
): FailureDiagnosisV1 {
  return {
    artifact_type: 'failure_diagnosis_v1',
    version: 1,
    job_id: '',
    created_at: '',
    phase,
    phase_status: null,
    failure_code: failureCode,
    failure_point: {
      stage: phaseLabel(phase),
      artifact_type: firstFailureArtifact(failureCode),
    },
    user_safe_summary: 'The evaluation stopped because a blocking technical issue was detected before release.',
    admin_summary: errorMessage,
    developer_summary: errorMessage,
    failed_checks: failureCode ? [failureCode] : [],
    failed_criteria: [],
    blocking_reasons: failureCode ? [failureCode] : ['unknown_failure'],
    artifact_inventory: artifactInventory,
    repair_status: {
      attempted: false,
      outcome: 'not_attempted',
    },
    backward_kick_status: buildBackwardKickStatus(failureCode),
    recommended_next_action: 'Inspect the persisted diagnostics and repair the blocking failure before retrying the job.',
    evidence_refs: [
      {
        log_stage: phase ?? 'processor',
        field_path: 'last_error',
        excerpt: errorMessage,
      },
    ],
  };
}

export function buildFailureDiagnosisV1(input: FailureDiagnosisBuildInput): FailureDiagnosisV1 {
  const diagnostics = isRecord(input.failureContext?.diagnostics)
    ? input.failureContext.diagnostics
    : null;
  const artifacts = input.artifacts ?? [];
  const artifactInventory = buildArtifactInventory(artifacts, input.failureCode);
  const qualityGateArtifactContent = findArtifact(artifacts, 'quality_gate_diagnostics_v1')?.content;
  const artifactConsistencyContent = findArtifact(artifacts, 'artifact_consistency_gate_v1')?.content;

  let diagnosis: FailureDiagnosisV1;
  if (input.failureCode === 'QG_FAILED') {
    diagnosis = buildQGFailure(
      input.phase,
      input.failureCode,
      isRecord(qualityGateArtifactContent)
        ? qualityGateArtifactContent
        : null,
      diagnostics,
      artifactInventory,
      input.errorMessage,
    );
  } else if (input.failureCode === 'ARTIFACT_CONSISTENCY_GATE_FAILED') {
    diagnosis = buildArtifactConsistencyFailure(
      input.phase,
      input.failureCode,
      isRecord(artifactConsistencyContent)
        ? artifactConsistencyContent
        : diagnostics,
      artifactInventory,
    );
  } else if (input.failureCode === 'TEMPLATE_COMPLETENESS_GATE_FAILED') {
    diagnosis = buildTemplateFailure(
      input.phase,
      input.failureCode,
      diagnostics,
      artifactInventory,
      input.errorMessage,
    );
  } else if (input.failureCode === 'PHASE2_PASS12_FAILED') {
    diagnosis = buildPhase2Pass12Failure(
      input.phase,
      input.failureCode,
      artifactInventory,
      artifacts,
      input.errorMessage,
    );
  } else {
    diagnosis = buildGenericFailure(
      input.phase,
      input.failureCode,
      artifactInventory,
      input.errorMessage,
    );
  }

  return {
    ...diagnosis,
    job_id: input.jobId,
    created_at: input.createdAt,
    phase_status: input.phaseStatus ?? null,
  };
}

async function loadRelevantArtifacts(
  supabase: SupabaseClient,
  jobId: string,
): Promise<FailureDiagnosisArtifactRow[]> {
  const rows = await Promise.all(
    RELEVANT_ARTIFACT_TYPES.map(async (artifactType) => {
      const { data, error } = await supabase
        .from('evaluation_artifacts')
        .select('artifact_type, created_at, content')
        .eq('job_id', jobId)
        .eq('artifact_type', artifactType)
        .maybeSingle();

      if (error) {
        console.warn('[FailureDiagnosis] artifact read failed', {
          job_id: jobId,
          artifact_type: artifactType,
          error: error.message,
        });
        return null;
      }

      if (!isRecord(data) || typeof data.artifact_type !== 'string') {
        return null;
      }

      return {
        artifact_type: data.artifact_type,
        created_at: asString(data.created_at) ?? undefined,
        content: 'content' in data ? data.content ?? null : null,
      } satisfies FailureDiagnosisArtifactRow;
    }),
  );

  return rows.filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function persistFailureDiagnosisArtifact(params: {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  createdAt: string;
  phase: string | null;
  phaseStatus?: string | null;
  failureCode: string | null;
  errorMessage: string;
  failureContext?: FailureDiagnosisContext;
}): Promise<FailureDiagnosisV1> {
  const artifacts = await loadRelevantArtifacts(params.supabase, params.jobId);
  const packet = buildFailureDiagnosisV1({
    jobId: params.jobId,
    createdAt: params.createdAt,
    phase: params.phase,
    phaseStatus: params.phaseStatus,
    failureCode: params.failureCode,
    errorMessage: params.errorMessage,
    artifacts,
    failureContext: params.failureContext,
  });

  await upsertEvaluationArtifact({
    supabase: params.supabase,
    jobId: params.jobId,
    manuscriptId: params.manuscriptId,
    artifactType: 'failure_diagnosis_v1',
    artifactVersion: 'failure_diagnosis_v1',
    sourceHash: createHash('sha256')
      .update(
        JSON.stringify({
          job_id: packet.job_id,
          created_at: packet.created_at,
          failure_code: packet.failure_code,
          failure_point: packet.failure_point,
          failed_checks: packet.failed_checks,
          failed_criteria: packet.failed_criteria,
          blocking_reasons: packet.blocking_reasons,
        }),
        'utf8',
      )
      .digest('hex'),
    content: packet,
  });

  return packet;
}
