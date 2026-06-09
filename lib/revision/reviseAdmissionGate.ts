import { evaluateCardCandidateQuality, type CandidateQualityInput } from './candidateQuality';
import { runCanonGate } from './canonGate';
import { runVoiceGate } from './voiceGate';

export interface ReviseAdmissionOpportunity {
  opportunity_id: string;
  grounding_status?: string | null;
  preflight_status?: string | null;
  context_quality?: string | null;
  candidate_text_a?: string | null;
  candidate_text_b?: string | null;
  candidate_text_c?: string | null;
  evidence_anchor?: string | null;
  manuscript_context?: {
    before?: string | null;
    after?: string | null;
  } | null;
  known_entities?: string[];
  allowed_new_entities?: string[];
}

export interface ReviseAdmissionResult {
  admission_status: 'admission_passed' | 'withheld';
  reasons: string[];
  passedCandidateCount: number;
}

export interface WorkbenchAdmissionInput {
  id: string;
  readiness?: string | null;
  groundingStatus?: string | null;
  preflightStatus?: string | null;
  contextQuality?: string | null;
  anchor?: string | null;
  quoteHighlight?: string | null;
  quoteRest?: string | null;
  options?: Array<{
    key?: string | null;
    candidateText?: string | null;
    text?: string | null;
  }>;
  /** Six-part diagnostic fields — per canon, ALL must be populated for admission. */
  symptom?: string | null;
  cause?: string | null;
  fixDirection?: string | null;
  readerEffect?: string | null;
  revisionOperation?: string | null;
}

function optionText(
  opportunity: WorkbenchAdmissionInput,
  key: 'A' | 'B' | 'C',
): string | null {
  const option = opportunity.options?.find((item) => item.key === key);
  return option?.candidateText?.trim() || option?.text?.trim() || null;
}

export function toReviseAdmissionOpportunity(
  opportunity: WorkbenchAdmissionInput,
): ReviseAdmissionOpportunity {
  return {
    opportunity_id: opportunity.id,
    grounding_status: opportunity.groundingStatus,
    preflight_status: opportunity.preflightStatus,
    context_quality: opportunity.contextQuality,
    evidence_anchor: opportunity.anchor,
    manuscript_context: {
      before: opportunity.quoteHighlight,
      after: opportunity.quoteRest,
    },
    candidate_text_a: optionText(opportunity, 'A'),
    candidate_text_b: optionText(opportunity, 'B'),
    candidate_text_c: optionText(opportunity, 'C'),
  };
}

/** Minimum chars for a diagnostic field to count as populated. */
const DIAGNOSTIC_MIN_LENGTH = 10;

export function runWorkbenchAdmissionGate(
  opportunity: WorkbenchAdmissionInput,
): ReviseAdmissionResult {
  const reasons: string[] = [];

  if (opportunity.readiness !== 'ready_for_revise') {
    reasons.push('NOT_READY_FOR_REVISE');
  }

  // Six-part diagnostic completeness gate per SIPOC canon.
  // Every card the author sees must have diagnostic grounding.
  if (!opportunity.symptom || opportunity.symptom.trim().length < DIAGNOSTIC_MIN_LENGTH) {
    reasons.push('DIAGNOSTIC_MISSING_SYMPTOM');
  }
  if (!opportunity.cause || opportunity.cause.trim().length < DIAGNOSTIC_MIN_LENGTH) {
    reasons.push('DIAGNOSTIC_MISSING_CAUSE');
  }
  if (!opportunity.fixDirection || opportunity.fixDirection.trim().length < DIAGNOSTIC_MIN_LENGTH) {
    reasons.push('DIAGNOSTIC_MISSING_FIX_DIRECTION');
  }
  if (!opportunity.readerEffect || opportunity.readerEffect.trim().length < DIAGNOSTIC_MIN_LENGTH) {
    reasons.push('DIAGNOSTIC_MISSING_READER_EFFECT');
  }

  const result = runReviseAdmissionGate(toReviseAdmissionOpportunity(opportunity));
  const uniqueReasons = Array.from(new Set([...reasons, ...result.reasons]));

  return {
    admission_status:
      uniqueReasons.length === 0 && result.admission_status === 'admission_passed'
        ? 'admission_passed'
        : 'withheld',
    reasons: uniqueReasons,
    passedCandidateCount: result.passedCandidateCount,
  };
}

export function runReviseAdmissionGate(opportunity: ReviseAdmissionOpportunity): ReviseAdmissionResult {
  const reasons: string[] = [];

  if (opportunity.grounding_status !== 'supported') reasons.push('UNSUPPORTED_REVISION');
  if (opportunity.preflight_status !== 'passed') reasons.push('PREFLIGHT_NOT_PASSED');
  if (opportunity.context_quality !== 'clean') reasons.push('CONTEXT_INSUFFICIENT');

  const base = {
    anchor: opportunity.evidence_anchor,
    beforeContext: opportunity.manuscript_context?.before,
    afterContext: opportunity.manuscript_context?.after,
    knownEntities: opportunity.known_entities,
    allowedNewEntities: opportunity.allowed_new_entities,
  };

  const candidateInputs: CandidateQualityInput[] = [
    { key: 'A', text: opportunity.candidate_text_a, ...base },
    { key: 'B', text: opportunity.candidate_text_b, ...base },
    { key: 'C', text: opportunity.candidate_text_c, ...base },
  ];

  const quality = evaluateCardCandidateQuality(candidateInputs);
  reasons.push(...quality.reasons);

  const hardCandidateReasons = new Set<CandidateQualityInput['key'] | string>();
  for (const candidate of quality.candidateResults) {
    if (candidate.reasons.includes('GENERIC_PROSE')) hardCandidateReasons.add('GENERIC_PROSE');
    if (candidate.reasons.includes('NON_EXECUTABLE_PROSE')) hardCandidateReasons.add('NON_EXECUTABLE_PROSE');
    if (candidate.reasons.includes('NOT_EXECUTABLE')) hardCandidateReasons.add('NOT_EXECUTABLE');
  }
  reasons.push(...hardCandidateReasons);

  for (const input of candidateInputs) {
    if (!input.text) continue;
    const voice = runVoiceGate({ candidateText: input.text });
    const canon = runCanonGate({
      candidateText: input.text,
      knownEntities: opportunity.known_entities,
      allowedNewEntities: opportunity.allowed_new_entities,
    });
    if (!voice.passed) reasons.push(...voice.reasons);
    if (!canon.passed) reasons.push(...canon.reasons);
  }

  const uniqueReasons = Array.from(new Set(reasons));
  return {
    admission_status: uniqueReasons.length === 0 && quality.passed ? 'admission_passed' : 'withheld',
    reasons: uniqueReasons,
    passedCandidateCount: quality.passedCandidateCount,
  };
}
