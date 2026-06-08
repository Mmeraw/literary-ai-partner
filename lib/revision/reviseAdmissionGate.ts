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
