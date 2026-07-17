import {
  VOICE_GATE_REASON,
  VOICE_GATE_REASON_CODES,
  runVoiceGate,
} from '@/lib/revision/voiceGate'

describe('voiceGate reason-code parity', () => {
  it('emits every exported voice-gate reason code from at least one fixture', () => {
    const observed = new Set<string>()

    const pov = runVoiceGate({
      candidateText: 'He walked down the hall.',
      pov: 'first',
      tense: 'past',
    })
    expect(pov.passed).toBe(false)
    pov.reasons.forEach((r) => observed.add(r))

    const tense = runVoiceGate({
      candidateText: 'The door is red.',
      tense: 'past',
    })
    expect(tense.passed).toBe(false)
    tense.reasons.forEach((r) => observed.add(r))

    const forbidden = runVoiceGate({
      candidateText: 'The bell tolled.',
      forbiddenVoicePatterns: [/tolled/],
    })
    expect(forbidden.passed).toBe(false)
    forbidden.reasons.forEach((r) => observed.add(r))

    expect(new Set(observed)).toEqual(new Set(VOICE_GATE_REASON_CODES))
  })

  it('only returns reasons contained in the exported code set', () => {
    const result = runVoiceGate({
      candidateText: 'He walked down the hall and the door is red.',
      pov: 'first',
      tense: 'past',
      forbiddenVoicePatterns: [/walked/],
    })
    expect(result.reasons.length).toBeGreaterThan(0)
    for (const reason of result.reasons) {
      expect(VOICE_GATE_REASON_CODES).toContain(reason)
    }
  })

  it('uses the exact exported constants so the set cannot drift from the emitter', () => {
    expect(VOICE_GATE_REASON.POV_DRIFT).toBe('VOICE_DRIFT_POV')
    expect(VOICE_GATE_REASON.TENSE_DRIFT).toBe('VOICE_DRIFT_TENSE')
    expect(VOICE_GATE_REASON.FORBIDDEN_PATTERN).toBe('VOICE_DRIFT_FORBIDDEN_PATTERN')
    expect(VOICE_GATE_REASON_CODES.sort()).toEqual([
      'VOICE_DRIFT_FORBIDDEN_PATTERN',
      'VOICE_DRIFT_POV',
      'VOICE_DRIFT_TENSE',
    ])
  })
})
