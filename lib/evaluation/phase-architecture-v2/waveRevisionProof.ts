import type { WaveRevisionPlanArtifact, WaveRunRecord } from '../waveRevision';

export type WaveRevisionProofStatus =
  | 'complete'
  | 'skipped'
  | 'timeout'
  | 'failed'
  | 'missing';

export type WaveRevisionProofDecision = {
  ok: boolean;
  status: WaveRevisionProofStatus;
  code: string;
  reason: string;
  quality_gate_label: 'Quality Gate';
  wave_label: 'WAVE Revision';
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasReasonCodes(plan: WaveRevisionPlanArtifact): boolean {
  return Array.isArray(plan.reason_codes) && plan.reason_codes.some(isNonEmptyString);
}

/**
 * Phase Architecture v2 WAVE proof validator.
 *
 * This helper does not run WAVE. It validates whether the post-evaluation WAVE
 * handoff produced an explicit proof state and keeps WAVE naming separate from
 * deterministic Quality Gate naming.
 */
export function deriveWaveRevisionProof(
  plan?: WaveRevisionPlanArtifact | null,
  runRecord?: WaveRunRecord | null,
): WaveRevisionProofDecision {
  if (!plan || !runRecord) {
    return {
      ok: false,
      status: 'missing',
      code: 'WAVE_PROOF_MISSING',
      reason: 'WAVE Revision proof requires both wave_revision_plan_v1 and wave run metadata.',
      quality_gate_label: 'Quality Gate',
      wave_label: 'WAVE Revision',
    };
  }

  if (plan.status !== runRecord.status) {
    return {
      ok: false,
      status: 'failed',
      code: 'WAVE_PROOF_STATUS_MISMATCH',
      reason: `WAVE plan status ${plan.status} does not match run status ${runRecord.status}.`,
      quality_gate_label: 'Quality Gate',
      wave_label: 'WAVE Revision',
    };
  }

  switch (plan.status) {
    case 'complete': {
      const modulesRun = typeof plan.modules_run === 'number' && plan.modules_run > 0;
      const runModulesRun = typeof runRecord.modules_run === 'number' && runRecord.modules_run > 0;
      const hasRevisionSession = isNonEmptyString(plan.revision_session_id);

      if (!modulesRun || !runModulesRun || !hasRevisionSession || !runRecord.gate_result.passed) {
        return {
          ok: false,
          status: 'failed',
          code: 'WAVE_COMPLETE_PROOF_INCOMPLETE',
          reason: 'WAVE complete proof requires modules_run, revision_session_id, and passed WAVE gate metadata.',
          quality_gate_label: 'Quality Gate',
          wave_label: 'WAVE Revision',
        };
      }

      return {
        ok: true,
        status: 'complete',
        code: 'WAVE_REVISION_COMPLETE_PROOF_VALID',
        reason: 'WAVE Revision completed with persisted plan and run metadata.',
        quality_gate_label: 'Quality Gate',
        wave_label: 'WAVE Revision',
      };
    }

    case 'skipped': {
      if (!hasReasonCodes(plan) || runRecord.gate_result.passed) {
        return {
          ok: false,
          status: 'failed',
          code: 'WAVE_SKIPPED_PROOF_INCOMPLETE',
          reason: 'WAVE skipped proof requires reason_codes and a failed WAVE gate result.',
          quality_gate_label: 'Quality Gate',
          wave_label: 'WAVE Revision',
        };
      }

      return {
        ok: true,
        status: 'skipped',
        code: 'WAVE_REVISION_SKIPPED_PROOF_VALID',
        reason: 'WAVE Revision was explicitly skipped with reason codes.',
        quality_gate_label: 'Quality Gate',
        wave_label: 'WAVE Revision',
      };
    }

    case 'timeout': {
      if (plan.retryable !== true) {
        return {
          ok: false,
          status: 'failed',
          code: 'WAVE_TIMEOUT_PROOF_INCOMPLETE',
          reason: 'WAVE timeout proof requires retryable=true.',
          quality_gate_label: 'Quality Gate',
          wave_label: 'WAVE Revision',
        };
      }

      return {
        ok: false,
        status: 'timeout',
        code: 'WAVE_REVISION_TIMEOUT_RETRYABLE',
        reason: 'WAVE Revision timed out and is retryable; this is explicit but not a successful proof.',
        quality_gate_label: 'Quality Gate',
        wave_label: 'WAVE Revision',
      };
    }

    case 'failed':
    default:
      return {
        ok: false,
        status: 'failed',
        code: 'WAVE_REVISION_FAILED_BLOCKING',
        reason: plan.reason ?? runRecord.error ?? 'WAVE Revision failed.',
        quality_gate_label: 'Quality Gate',
        wave_label: 'WAVE Revision',
      };
  }
}
