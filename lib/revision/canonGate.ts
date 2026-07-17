export interface CanonGateInput {
  candidateText: string;
  knownEntities?: string[];
  allowedNewEntities?: string[];
  forbiddenFacts?: RegExp[];
}

export interface CanonGateResult {
  passed: boolean;
  reasons: CanonGateReasonCode[];
}

export const CANON_GATE_REASON = {
  UNSUPPORTED_FACT: 'UNSUPPORTED_FACT',
  CANON_DRIFT: 'CANON_DRIFT',
} as const;

export type CanonGateReasonCode =
  (typeof CANON_GATE_REASON)[keyof typeof CANON_GATE_REASON];

export const CANON_GATE_REASON_CODES: CanonGateReasonCode[] = Object.values(CANON_GATE_REASON);

export function runCanonGate(input: CanonGateInput): CanonGateResult {
  const text = input.candidateText ?? '';
  const reasons: CanonGateReasonCode[] = [];
  const known = new Set([...(input.knownEntities ?? []), ...(input.allowedNewEntities ?? [])].map((x) => x.toLowerCase()));

  if (known.size > 0) {
    const names: string[] = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
    const unsupported = names.filter((name) => !known.has(name.toLowerCase()));
    if (unsupported.length > 0) reasons.push(CANON_GATE_REASON.UNSUPPORTED_FACT);
  }

  for (const pattern of input.forbiddenFacts ?? []) {
    if (pattern.test(text)) reasons.push(CANON_GATE_REASON.CANON_DRIFT);
  }

  return { passed: reasons.length === 0, reasons };
}
