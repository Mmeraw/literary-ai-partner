import {
  type SlaeGroundingDecision,
  type SlaeGroundingStatus,
  isSlaeGroundingStatus,
} from '@/lib/revision/slae';

export type EvaluationBackwardRelookInput = {
  structuralOk: boolean;
  boundaryGateDecision: 'PASS' | 'FAIL';
  reasonCodes?: readonly string[];
  usedFallbackPath?: boolean;
  explicitGroundingStatus?: unknown;
  evidenceMismatchUnresolved?: boolean;
  manuscriptWideCertifiable?: boolean | null;
  partialEvaluation?: boolean | null;
};

export type EvaluationBackwardRelookDecision = SlaeGroundingDecision & {
  reportPersistence: 'allow' | 'block';
  jobStatus: 'complete' | 'failed';
  validityStatus: 'valid' | 'invalid' | 'quarantined';
  reasonCodes: string[];
};

const BLOCKING_REASON_CODES = new Set([
  'EVALUATION_ARTIFACT_VALIDATION_FAILED',
  'EVALUATION_GATE_REJECTED',
  'LONG_FORM_UNCERTIFIED_MANUSCRIPT_WIDE_SCORE',
  'LONG_FORM_PARTIAL_EVALUATION',
  'LONG_FORM_SAMPLED_COVERAGE',
  'FALLBACK_GENERATOR_USED',
  'UNRESOLVED_EVIDENCE_MISMATCH',
  'UNSUPPORTED_GROUNDING_STATUS',
]);

function normalizeReasonCodes(reasonCodes: readonly string[] | undefined): string[] {
  return Array.from(new Set((reasonCodes ?? []).map((code) => code.trim()).filter(Boolean)));
}

function explicitStatusAllowsReport(status: SlaeGroundingStatus): boolean {
  return status === 'supported' || status === 'supported_after_relook' || status === 'uncertain_after_relook_reportable';
}

export function runEvaluationBackwardRelook(
  input: EvaluationBackwardRelookInput,
): EvaluationBackwardRelookDecision {
  const reasonCodes = normalizeReasonCodes(input.reasonCodes);

  if (input.usedFallbackPath) reasonCodes.push('FALLBACK_GENERATOR_USED');
  if (input.evidenceMismatchUnresolved) reasonCodes.push('UNRESOLVED_EVIDENCE_MISMATCH');
  if (input.manuscriptWideCertifiable === false) reasonCodes.push('LONG_FORM_UNCERTIFIED_MANUSCRIPT_WIDE_SCORE');
  if (input.partialEvaluation === true) reasonCodes.push('LONG_FORM_PARTIAL_EVALUATION');

  const uniqueReasonCodes = normalizeReasonCodes(reasonCodes);
  const explicitStatus = input.explicitGroundingStatus;

  if (explicitStatus != null && !isSlaeGroundingStatus(explicitStatus)) {
    uniqueReasonCodes.push('UNSUPPORTED_GROUNDING_STATUS');
    return blocked(
      'unsupported_blocked',
      uniqueReasonCodes,
      'Explicit grounding status is non-canonical and blocks report persistence.',
    );
  }

  if (isSlaeGroundingStatus(explicitStatus) && !explicitStatusAllowsReport(explicitStatus)) {
    return blocked(explicitStatus, uniqueReasonCodes, 'Explicit grounding status blocks report persistence.');
  }

  if (!input.structuralOk) {
    uniqueReasonCodes.push('EVALUATION_ARTIFACT_VALIDATION_FAILED');
    return blocked('unsupported_blocked', uniqueReasonCodes, 'Structural artifact validation failed before persistence.');
  }

  if (input.boundaryGateDecision !== 'PASS') {
    uniqueReasonCodes.push('EVALUATION_GATE_REJECTED');
    return blocked('uncertain_after_relook_blocked', uniqueReasonCodes, 'Boundary quality gate failed before persistence.');
  }

  if (uniqueReasonCodes.some((code) => BLOCKING_REASON_CODES.has(code))) {
    return blocked('uncertain_after_relook_blocked', uniqueReasonCodes, 'Backward Relook found blocking grounding issue.');
  }

  return {
    status: isSlaeGroundingStatus(explicitStatus) ? explicitStatus : 'supported_after_relook',
    note: 'Evaluation artifact passed Backward Relook grounding checks.',
    reportPersistence: 'allow',
    jobStatus: 'complete',
    validityStatus: 'valid',
    reasonCodes: uniqueReasonCodes,
  };
}

function blocked(
  status: SlaeGroundingStatus,
  reasonCodes: string[],
  note: string,
): EvaluationBackwardRelookDecision {
  return {
    status,
    note,
    reportPersistence: 'block',
    jobStatus: 'failed',
    validityStatus: 'invalid',
    reasonCodes: normalizeReasonCodes(reasonCodes),
  };
}

export function assertReportPersistenceAllowed(decision: EvaluationBackwardRelookDecision): void {
  if (decision.reportPersistence !== 'allow') {
    throw new Error(
      `[EvaluationBackwardRelook] report persistence blocked; grounding_status=${decision.status}; reason_codes=${decision.reasonCodes.join(',') || 'none'}`,
    );
  }
}
