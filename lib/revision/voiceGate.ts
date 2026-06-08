export interface VoiceGateInput {
  candidateText: string;
  pov?: 'first' | 'second' | 'third' | 'unknown';
  tense?: 'past' | 'present' | 'unknown';
  forbiddenVoicePatterns?: RegExp[];
}

export interface VoiceGateResult {
  passed: boolean;
  reasons: string[];
}

export function runVoiceGate(input: VoiceGateInput): VoiceGateResult {
  const text = input.candidateText ?? '';
  const reasons: string[] = [];

  if (input.pov === 'first' && /\b(he|she|they)\b/i.test(text) && !/\bI\b/.test(text)) {
    reasons.push('VOICE_DRIFT_POV');
  }

  if (input.tense === 'past' && /\b(is|are|walks|says|looks)\b/i.test(text) && !/\b(was|were|walked|said|looked)\b/i.test(text)) {
    reasons.push('VOICE_DRIFT_TENSE');
  }

  for (const pattern of input.forbiddenVoicePatterns ?? []) {
    if (pattern.test(text)) reasons.push('VOICE_DRIFT_FORBIDDEN_PATTERN');
  }

  return { passed: reasons.length === 0, reasons };
}
