import { runReviseAdmissionGate, type ReviseAdmissionOpportunity } from './reviseAdmissionGate';

export interface RegeneratedCandidates {
  candidate_text_a: string;
  candidate_text_b: string;
  candidate_text_c: string;
}

export interface CandidateRegenerator {
  (opportunity: ReviseAdmissionOpportunity, attempt: number): Promise<RegeneratedCandidates>;
}

export interface RegenerationResult {
  opportunity: ReviseAdmissionOpportunity;
  admitted: boolean;
  attempts: number;
  reasons: string[];
}

export async function regenerateUntilAdmitted(
  opportunity: ReviseAdmissionOpportunity,
  regenerate: CandidateRegenerator,
  maxAttempts = 2,
): Promise<RegenerationResult> {
  let current = { ...opportunity };
  let admission = runReviseAdmissionGate(current);

  if (admission.admission_status === 'admission_passed') {
    return { opportunity: current, admitted: true, attempts: 0, reasons: [] };
  }

  const eligibleForRegeneration =
    current.grounding_status === 'supported' &&
    current.preflight_status === 'passed' &&
    current.context_quality === 'clean' &&
    admission.passedCandidateCount < 2;

  if (!eligibleForRegeneration) {
    return { opportunity: current, admitted: false, attempts: 0, reasons: admission.reasons };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const regenerated = await regenerate(current, attempt);
    current = { ...current, ...regenerated };
    admission = runReviseAdmissionGate(current);

    if (admission.admission_status === 'admission_passed') {
      return { opportunity: current, admitted: true, attempts: attempt, reasons: [] };
    }
  }

  return {
    opportunity: current,
    admitted: false,
    attempts: maxAttempts,
    reasons: Array.from(new Set([...admission.reasons, 'CANDIDATE_QUALITY_FAILED_AFTER_REGENERATION'])),
  };
}
