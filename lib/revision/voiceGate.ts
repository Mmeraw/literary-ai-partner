export interface VoiceGateInput {
  candidateText: string;
  pov?: 'first' | 'second' | 'third' | 'unknown';
  tense?: 'past' | 'present' | 'unknown';
  forbiddenVoicePatterns?: RegExp[];
}

export interface VoiceGateResult {
  passed: boolean;
  reasons: VoiceGateReasonCode[];
}

export const VOICE_GATE_REASON = {
  POV_DRIFT: 'VOICE_DRIFT_POV',
  TENSE_DRIFT: 'VOICE_DRIFT_TENSE',
  FORBIDDEN_PATTERN: 'VOICE_DRIFT_FORBIDDEN_PATTERN',
} as const;

export type VoiceGateReasonCode =
  (typeof VOICE_GATE_REASON)[keyof typeof VOICE_GATE_REASON];

export const VOICE_GATE_REASON_CODES: VoiceGateReasonCode[] = Object.values(VOICE_GATE_REASON);

export function runVoiceGate(input: VoiceGateInput): VoiceGateResult {
  const text = input.candidateText ?? '';
  const reasons: VoiceGateReasonCode[] = [];

  if (input.pov === 'first' && /\b(he|she|they)\b/i.test(text) && !/\bI\b/.test(text)) {
    reasons.push(VOICE_GATE_REASON.POV_DRIFT);
  }

  if (input.tense === 'past' && /\b(is|are|walks|says|looks)\b/i.test(text) && !/\b(was|were|walked|said|looked)\b/i.test(text)) {
    reasons.push(VOICE_GATE_REASON.TENSE_DRIFT);
  }

  for (const pattern of input.forbiddenVoicePatterns ?? []) {
    if (pattern.test(text)) reasons.push(VOICE_GATE_REASON.FORBIDDEN_PATTERN);
  }

  return { passed: reasons.length === 0, reasons };
}
