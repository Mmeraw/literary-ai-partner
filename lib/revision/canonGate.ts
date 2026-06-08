export interface CanonGateInput {
  candidateText: string;
  knownEntities?: string[];
  allowedNewEntities?: string[];
  forbiddenFacts?: RegExp[];
}

export interface CanonGateResult {
  passed: boolean;
  reasons: string[];
}

export function runCanonGate(input: CanonGateInput): CanonGateResult {
  const text = input.candidateText ?? '';
  const reasons: string[] = [];
  const known = new Set([...(input.knownEntities ?? []), ...(input.allowedNewEntities ?? [])].map((x) => x.toLowerCase()));

  if (known.size > 0) {
    const names: string[] = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
    const unsupported = names.filter((name) => !known.has(name.toLowerCase()));
    if (unsupported.length > 0) reasons.push('UNSUPPORTED_FACT');
  }

  for (const pattern of input.forbiddenFacts ?? []) {
    if (pattern.test(text)) reasons.push('CANON_DRIFT');
  }

  return { passed: reasons.length === 0, reasons };
}
