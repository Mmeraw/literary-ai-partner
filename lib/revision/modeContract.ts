import type { EvaluationMode, VoicePreservationMode } from '@/lib/evaluation/modeDetection';
import type { ConfirmedMode } from '@/lib/evaluation/modeGate';

export type RevisionModeContractSource = 'evaluation_result_v2.confirmed_mode' | 'evaluation_jobs';

export type RevisionModeContract = {
  evaluation_mode: EvaluationMode;
  voice_preservation: VoicePreservationMode;
  source: RevisionModeContractSource;
  policy_family: string | null;
  voice_preservation_level: string | null;
};

type JobModeFields = {
  policy_family?: unknown;
  voice_preservation_level?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeEvaluationMode(value: unknown): EvaluationMode {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/[-\s]+/g, '_').toUpperCase()
    : '';

  if (normalized === 'TRANSGRESSIVE' || normalized === 'DARK_FICTION') return 'TRANSGRESSIVE';
  if (normalized === 'TESTIMONY') return 'TESTIMONY';
  return 'STANDARD';
}

export function normalizeVoicePreservationMode(value: unknown): VoicePreservationMode {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/[-\s]+/g, '_').toUpperCase()
    : '';

  if (normalized === 'MAXIMUM' || normalized === 'STRICT') return 'MAXIMUM';
  if (normalized === 'POLISHED' || normalized === 'EXPRESSIVE') return 'POLISHED';
  return 'BALANCED';
}

function confirmedModeFromEvaluationPayload(payload: unknown): ConfirmedMode | null {
  if (!isRecord(payload) || !isRecord(payload.confirmed_mode)) return null;
  return {
    evaluationMode: normalizeEvaluationMode(payload.confirmed_mode.evaluationMode),
    voicePreservationMode: normalizeVoicePreservationMode(payload.confirmed_mode.voicePreservationMode),
  };
}

export function resolveRevisionModeContract(input: {
  evaluationPayload?: unknown;
  job?: JobModeFields | null;
}): RevisionModeContract {
  const jobPolicyFamily = typeof input.job?.policy_family === 'string'
    ? input.job.policy_family
    : null;
  const jobVoicePreservation = typeof input.job?.voice_preservation_level === 'string'
    ? input.job.voice_preservation_level
    : null;

  const confirmedMode = confirmedModeFromEvaluationPayload(input.evaluationPayload);
  if (confirmedMode) {
    return {
      evaluation_mode: confirmedMode.evaluationMode,
      voice_preservation: confirmedMode.voicePreservationMode,
      source: 'evaluation_result_v2.confirmed_mode',
      policy_family: jobPolicyFamily,
      voice_preservation_level: jobVoicePreservation,
    };
  }

  return {
    evaluation_mode: normalizeEvaluationMode(jobPolicyFamily),
    voice_preservation: normalizeVoicePreservationMode(jobVoicePreservation),
    source: 'evaluation_jobs',
    policy_family: jobPolicyFamily,
    voice_preservation_level: jobVoicePreservation,
  };
}

export function modeContractToConfirmedMode(contract: RevisionModeContract): ConfirmedMode {
  return {
    evaluationMode: contract.evaluation_mode,
    voicePreservationMode: contract.voice_preservation,
  };
}

export function modeContractForMetadata(contract: RevisionModeContract): Record<string, unknown> {
  return {
    evaluation_mode: contract.evaluation_mode,
    voice_preservation: contract.voice_preservation,
    source: contract.source,
  };
}

export function hasExplicitRevisionModeContract(contract: RevisionModeContract | null | undefined): contract is RevisionModeContract {
  if (!contract) return false;
  if (contract.source === 'evaluation_result_v2.confirmed_mode') return true;
  return typeof contract.policy_family === 'string' && contract.policy_family.trim().length > 0 &&
    typeof contract.voice_preservation_level === 'string' && contract.voice_preservation_level.trim().length > 0;
}

export function policyFamilyForEvaluationMode(mode: EvaluationMode): 'standard' | 'transgressive' | 'testimony' {
  if (mode === 'TRANSGRESSIVE') return 'transgressive';
  if (mode === 'TESTIMONY') return 'testimony';
  return 'standard';
}

export function voicePreservationLevelForMode(mode: VoicePreservationMode): 'maximum' | 'balanced' | 'polished' {
  if (mode === 'MAXIMUM') return 'maximum';
  if (mode === 'POLISHED') return 'polished';
  return 'balanced';
}
