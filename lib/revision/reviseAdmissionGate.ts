import {
  ADMISSION_CANDIDATE_QUALITY_REASON_CODES,
  evaluateCardCandidateQuality,
  type CandidateQualityInput,
} from './candidateQuality';
import { CANON_GATE_REASON, CANON_GATE_REASON_CODES, runCanonGate } from './canonGate';
import { runVoiceGate, VOICE_GATE_REASON_CODES } from './voiceGate';
import {
  checkRecommendationIntegrity,
  INTEGRITY_VIOLATION_CODES,
  meetsMinimumTier,
  type IntegrityResult,
  type IntegrityViolationCode,
} from '@/lib/evaluation/pipeline/recommendationIntegrityGate';

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
  mode?: string | null;
  localContextStatus?: string | null;
  localContextSource?: string | null;
}

export interface AdmissionGateResult {
  passed: boolean;
  reasons: string[];
  passedCandidateCount: number;
  candidateQualityPassed: boolean;
  diagnosticContractPassed: boolean;
  groundingPassed: boolean;
  integrityPassed: boolean;
  voicePassed: boolean;
  canonPassed: boolean;
  contextPassed: boolean;
  localOperationPassed: boolean;
}

export const DIAGNOSTIC_CONTRACT_REASON = {
  MISSING_SYMPTOM: 'DIAGNOSTIC_MISSING_SYMPTOM',
  MISSING_CAUSE: 'DIAGNOSTIC_MISSING_CAUSE',
  MISSING_FIX_DIRECTION: 'DIAGNOSTIC_MISSING_FIX_DIRECTION',
  MISSING_READER_EFFECT: 'DIAGNOSTIC_MISSING_READER_EFFECT',
} as const;

export type DiagnosticContractReasonCode =
  (typeof DIAGNOSTIC_CONTRACT_REASON)[keyof typeof DIAGNOSTIC_CONTRACT_REASON];

export const DIAGNOSTIC_CONTRACT_REASON_CODES: DiagnosticContractReasonCode[] = Object.values(DIAGNOSTIC_CONTRACT_REASON);

export const ADMISSION_REASON = {
  UNSUPPORTED_REVISION: 'UNSUPPORTED_REVISION',
  INSUFFICIENT_BEFORE_AFTER_CONTEXT: 'insufficient_before_after_context',
  NOT_LOCAL_OPERATION: 'not_local_operation',
  EVIDENCE_MISSING: 'EVIDENCE_MISSING',
  HARD_CONTEXT_BLOCK: 'HARD_CONTEXT_BLOCK',
  HARD_CANON_CONFLICT: 'HARD_CANON_CONFLICT',
  MISSING_CONCRETE_ACTION: 'MISSING_CONCRETE_ACTION',
  CONTEXT_INSUFFICIENT: 'CONTEXT_INSUFFICIENT',
  PREFLIGHT_NOT_PASSED: 'PREFLIGHT_NOT_PASSED',
  NOT_READY_FOR_REVISE: 'NOT_READY_FOR_REVISE',
  INTEGRITY_BELOW_PASS_STRONG: 'INTEGRITY_BELOW_PASS_STRONG',
} as const;

export type AdmissionReasonCode =
  (typeof ADMISSION_REASON)[keyof typeof ADMISSION_REASON];

export type IntegrityAdmissionReasonCode = `INTEGRITY_${IntegrityViolationCode}`;

export function integrityAdmissionReasonCode(code: IntegrityViolationCode): IntegrityAdmissionReasonCode {
  return `INTEGRITY_${code}`;
}

/** Exact admission reason codes emitted by runCopyPasteAdmissionGate. */
export const COPY_PASTE_ADMISSION_REASON_CODES: string[] = [
  ADMISSION_REASON.UNSUPPORTED_REVISION,
  ...DIAGNOSTIC_CONTRACT_REASON_CODES,
  ADMISSION_REASON.INTEGRITY_BELOW_PASS_STRONG,
  ...INTEGRITY_VIOLATION_CODES.map(integrityAdmissionReasonCode),
  ADMISSION_REASON.INSUFFICIENT_BEFORE_AFTER_CONTEXT,
  ADMISSION_REASON.NOT_LOCAL_OPERATION,
  ...ADMISSION_CANDIDATE_QUALITY_REASON_CODES,
  ...VOICE_GATE_REASON_CODES,
  ...CANON_GATE_REASON_CODES,
];

/** Exact admission reason codes emitted by runStrategyAdmissionGate. */
export const STRATEGY_ADMISSION_REASON_CODES: string[] = [
  ADMISSION_REASON.EVIDENCE_MISSING,
  ADMISSION_REASON.HARD_CONTEXT_BLOCK,
  ADMISSION_REASON.HARD_CANON_CONFLICT,
  ADMISSION_REASON.UNSUPPORTED_REVISION,
  ...DIAGNOSTIC_CONTRACT_REASON_CODES,
  ADMISSION_REASON.INTEGRITY_BELOW_PASS_STRONG,
  ...INTEGRITY_VIOLATION_CODES.map(integrityAdmissionReasonCode),
  ADMISSION_REASON.MISSING_CONCRETE_ACTION,
  ...ADMISSION_CANDIDATE_QUALITY_REASON_CODES,
  ...VOICE_GATE_REASON_CODES,
  ...CANON_GATE_REASON_CODES,
  ADMISSION_REASON.PREFLIGHT_NOT_PASSED,
  ADMISSION_REASON.NOT_READY_FOR_REVISE,
  ADMISSION_REASON.CONTEXT_INSUFFICIENT,
];

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

const HARD_CANDIDATE_REASONS = new Set<string>([
  ...ADMISSION_CANDIDATE_QUALITY_REASON_CODES.filter((code) =>
    ['GENERIC_PROSE', 'NON_EXECUTABLE_PROSE', 'NOT_EXECUTABLE', 'UNSUPPORTED_FACT', 'CONTEXT_MISMATCH'].includes(code),
  ),
  CANON_GATE_REASON.CANON_DRIFT,
]);

function diagnosticContractReasons(input: WorkbenchAdmissionInput): string[] {
  const reasons: string[] = [];
  if (!input.symptom || input.symptom.trim().length < DIAGNOSTIC_MIN_LENGTH) {
    reasons.push(DIAGNOSTIC_CONTRACT_REASON.MISSING_SYMPTOM);
  }
  if (!input.cause || input.cause.trim().length < DIAGNOSTIC_MIN_LENGTH) {
    reasons.push(DIAGNOSTIC_CONTRACT_REASON.MISSING_CAUSE);
  }
  if (!input.fixDirection || input.fixDirection.trim().length < DIAGNOSTIC_MIN_LENGTH) {
    reasons.push(DIAGNOSTIC_CONTRACT_REASON.MISSING_FIX_DIRECTION);
  }
  if (!input.readerEffect || input.readerEffect.trim().length < DIAGNOSTIC_MIN_LENGTH) {
    reasons.push(DIAGNOSTIC_CONTRACT_REASON.MISSING_READER_EFFECT);
  }
  return reasons;
}

function integrityReasons(input: WorkbenchAdmissionInput): string[] {
  const evidence = input.quoteHighlight || input.anchor || undefined;
  const result: IntegrityResult = checkRecommendationIntegrity({
    action: input.fixDirection ?? undefined,
    symptom: input.symptom ?? undefined,
    cause: input.cause ?? undefined,
    reader_effect: input.readerEffect ?? undefined,
    anchor_snippet: evidence,
  });

  if (meetsMinimumTier(result, 'revise_queue')) {
    return [];
  }

  const codes = result.violations.map((v) => v.code);
  const reasons: string[] = [ADMISSION_REASON.INTEGRITY_BELOW_PASS_STRONG];
  if (codes.length > 0) {
    reasons.push(...codes.map(integrityAdmissionReasonCode));
  }
  return reasons;
}

function candidateInputsFromOpportunity(
  opportunity: WorkbenchAdmissionInput,
): CandidateQualityInput[] {
  const base = {
    anchor: opportunity.anchor,
    beforeContext: opportunity.quoteHighlight,
    afterContext: opportunity.quoteRest,
    knownEntities: undefined as string[] | undefined,
    allowedNewEntities: undefined as string[] | undefined,
  };
  return [
    { key: 'A', text: optionText(opportunity, 'A'), ...base },
    { key: 'B', text: optionText(opportunity, 'B'), ...base },
    { key: 'C', text: optionText(opportunity, 'C'), ...base },
  ];
}

function candidateQualityResult(quality: ReturnType<typeof evaluateCardCandidateQuality>) {
  const hardReasons = new Set<string>();
  for (const candidate of quality.candidateResults) {
    for (const reason of candidate.reasons) {
      if (HARD_CANDIDATE_REASONS.has(reason)) {
        hardReasons.add(reason);
      }
    }
  }
  return { noHardReasons: hardReasons.size === 0, hardReasons: Array.from(hardReasons) };
}

function voiceAndCanonReasons(opportunity: WorkbenchAdmissionInput): string[] {
  const reasons: string[] = [];
  const candidates = candidateInputsFromOpportunity(opportunity);
  for (const input of candidates) {
    if (!input.text) continue;
    const voice = runVoiceGate({ candidateText: input.text });
    const canon = runCanonGate({
      candidateText: input.text,
      knownEntities: opportunity.options?.find((o) => o.key === input.key)?.text
        ? undefined
        : undefined,
    });
    if (!voice.passed) reasons.push(...voice.reasons);
    if (!canon.passed) reasons.push(...canon.reasons);
  }
  return reasons;
}

function isLocalContextVerified(input: WorkbenchAdmissionInput): boolean {
  const clean =
    input.contextQuality === 'clean' && input.preflightStatus === 'passed';
  const targeted =
    input.localContextStatus === 'verified' &&
    input.localContextSource === 'targeted_relook';
  return clean || targeted;
}

function hasConcreteAction(input: WorkbenchAdmissionInput): boolean {
  if (input.revisionOperation && input.revisionOperation !== 'needs_targeting') return true;
  const haystack = [
    input.fixDirection,
    input.symptom,
    input.cause,
    input.readerEffect,
  ]
    .join(' ')
    .toLowerCase();
  return /\b(?:replace|compress|trim|tighten|insert|add|delete|remove|cut|split|merge|reorder|rewrite|bridge|clarify|expand|sharpen|condense|surface|foreground|frame|move|strengthen|shorten|dramatize|convert|reframe|rework|relocate|redistribute|restructure|resequence|reposition|refactor|consolidate|collapse|fuse|spread|shift|transfer|transplant|rebalance|target|draft)\b/i.test(
    haystack,
  );
}

export function runCopyPasteAdmissionGate(
  opportunity: WorkbenchAdmissionInput,
): AdmissionGateResult {
  const reasons: string[] = [];
  const diagnostic = diagnosticContractReasons(opportunity);
  const integrity = integrityReasons(opportunity);
  const voiceCanon = voiceAndCanonReasons(opportunity);

  const candidateInputs = candidateInputsFromOpportunity(opportunity);
  const quality = evaluateCardCandidateQuality(candidateInputs);
  const { noHardReasons, hardReasons } = candidateQualityResult(quality);

  const groundingPassed =
    opportunity.groundingStatus === 'supported' ||
    opportunity.groundingStatus === 'supported_after_relook';
  const contextPassed = isLocalContextVerified(opportunity);
  const localOperationPassed =
    opportunity.mode === 'direct-rewrite' &&
    opportunity.revisionOperation !== 'needs_targeting';

  if (!groundingPassed) reasons.push(ADMISSION_REASON.UNSUPPORTED_REVISION);
  if (diagnostic.length > 0) reasons.push(...diagnostic);
  if (integrity.length > 0) reasons.push(...integrity);
  if (!contextPassed) reasons.push(ADMISSION_REASON.INSUFFICIENT_BEFORE_AFTER_CONTEXT);
  if (!localOperationPassed) reasons.push(ADMISSION_REASON.NOT_LOCAL_OPERATION);
  if (!quality.passed) reasons.push(...quality.reasons);
  if (!noHardReasons) reasons.push(...hardReasons);
  if (voiceCanon.length > 0) reasons.push(...voiceCanon);

  const uniqueReasons = Array.from(new Set(reasons));
  const passed = uniqueReasons.length === 0;

  return {
    passed,
    reasons: uniqueReasons,
    passedCandidateCount: quality.passedCandidateCount,
    candidateQualityPassed: quality.passed && noHardReasons,
    diagnosticContractPassed: diagnostic.length === 0,
    groundingPassed,
    integrityPassed: integrity.length === 0,
    voicePassed: voiceCanon.length === 0,
    canonPassed: voiceCanon.length === 0,
    contextPassed,
    localOperationPassed,
  };
}

export function runStrategyAdmissionGate(
  opportunity: WorkbenchAdmissionInput,
): AdmissionGateResult {
  const reasons: string[] = [];
  const diagnostic = diagnosticContractReasons(opportunity);
  const integrity = integrityReasons(opportunity);

  const hasEvidence =
    (opportunity.anchor ?? '').trim().length > 0 ||
    (opportunity.quoteHighlight ?? '').trim().length > 0;
  const needsTargeting = opportunity.readiness === 'needs_targeting';
  const adminRepairLabel = (opportunity as any).adminRepairLabel;
  const noHardContextBlock =
    opportunity.contextQuality !== 'blocked' &&
    (opportunity.preflightStatus !== 'blocked' || (needsTargeting && adminRepairLabel));
  const preflightReasons = (opportunity as any).preflightReasons ?? [];
  const noHardCanonConflict = !preflightReasons.some((reason: string) =>
    /canon_authority_blocked|canon_conflict|canon_drift|testimony_fabrication/i.test(reason),
  );

  const groundingPassed = needsTargeting
    ? true
    : opportunity.groundingStatus === 'supported' ||
      opportunity.groundingStatus === 'supported_after_relook';

  const candidateInputs = candidateInputsFromOpportunity(opportunity);
  const quality = evaluateCardCandidateQuality(candidateInputs);
  const { noHardReasons, hardReasons } = candidateQualityResult(quality);
  const voiceCanon = voiceAndCanonReasons(opportunity);

  if (!needsTargeting && !hasEvidence) reasons.push(ADMISSION_REASON.EVIDENCE_MISSING);
  if (!noHardContextBlock) reasons.push(ADMISSION_REASON.HARD_CONTEXT_BLOCK);
  if (!noHardCanonConflict) reasons.push(ADMISSION_REASON.HARD_CANON_CONFLICT);
  if (!groundingPassed) reasons.push(ADMISSION_REASON.UNSUPPORTED_REVISION);
  if (diagnostic.length > 0) reasons.push(...diagnostic);
  if (!needsTargeting && integrity.length > 0) reasons.push(...integrity);
  if (!hasConcreteAction(opportunity)) reasons.push(ADMISSION_REASON.MISSING_CONCRETE_ACTION);
  if (!noHardReasons) reasons.push(...hardReasons);
  if (!needsTargeting && !quality.passed) reasons.push(...quality.reasons);
  if (voiceCanon.length > 0) reasons.push(...voiceCanon);

  const uniqueReasons = Array.from(new Set(reasons));
  const passed = uniqueReasons.length === 0;

  return {
    passed,
    reasons: uniqueReasons,
    passedCandidateCount: quality.passedCandidateCount,
    candidateQualityPassed: noHardReasons,
    diagnosticContractPassed: diagnostic.length === 0,
    groundingPassed,
    integrityPassed: integrity.length === 0,
    voicePassed: voiceCanon.length === 0,
    canonPassed: voiceCanon.length === 0,
    contextPassed: noHardContextBlock,
    localOperationPassed: true,
  };
}

export function runWorkbenchAdmissionGate(
  opportunity: WorkbenchAdmissionInput,
): ReviseAdmissionResult {
  const legacyReasons: string[] = [];

  if (opportunity.readiness !== 'ready_for_revise') {
    legacyReasons.push(ADMISSION_REASON.NOT_READY_FOR_REVISE);
  }
  if (
    opportunity.preflightStatus !== 'passed' &&
    opportunity.preflightStatus !== 'limited_context'
  ) {
    legacyReasons.push(ADMISSION_REASON.PREFLIGHT_NOT_PASSED);
  }

  const defaultedOpportunity = {
    ...opportunity,
    mode: opportunity.mode ?? 'direct-rewrite',
    revisionOperation: opportunity.revisionOperation ?? 'replace_selected_passage',
  };

  const result = runCopyPasteAdmissionGate(defaultedOpportunity);
  const allReasons = Array.from(new Set([...legacyReasons, ...result.reasons]));

  if (!result.contextPassed) {
    allReasons.push(ADMISSION_REASON.CONTEXT_INSUFFICIENT);
  }

  return {
    admission_status: allReasons.length === 0 ? 'admission_passed' : 'withheld',
    reasons: allReasons,
    passedCandidateCount: result.passedCandidateCount,
  };
}

export function runReviseAdmissionGate(
  opportunity: ReviseAdmissionOpportunity,
): ReviseAdmissionResult {
  const reasons: string[] = [];

  if (opportunity.grounding_status !== 'supported') reasons.push(ADMISSION_REASON.UNSUPPORTED_REVISION);
  if (
    opportunity.preflight_status !== 'passed' &&
    opportunity.preflight_status !== 'limited_context'
  ) {
    reasons.push(ADMISSION_REASON.PREFLIGHT_NOT_PASSED);
  }
  if (opportunity.context_quality !== 'clean' && opportunity.context_quality !== 'limited') {
    reasons.push(ADMISSION_REASON.CONTEXT_INSUFFICIENT);
  }

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

  const hardCandidateReasons = new Set<string>();
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
