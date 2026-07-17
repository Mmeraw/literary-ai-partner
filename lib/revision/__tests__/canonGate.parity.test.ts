import {
  CANON_GATE_REASON,
  CANON_GATE_REASON_CODES,
  runCanonGate,
} from '@/lib/revision/canonGate'

describe('canonGate reason-code parity', () => {
  it('emits every exported canon-gate reason code from at least one fixture', () => {
    const observed = new Set<string>()

    const unsupported = runCanonGate({
      candidateText: 'Voldemort arrived.',
      knownEntities: ['Harry'],
    })
    expect(unsupported.passed).toBe(false)
    unsupported.reasons.forEach((r) => observed.add(r))

    const drift = runCanonGate({
      candidateText: 'The ring appeared.',
      forbiddenFacts: [/ring/],
    })
    expect(drift.passed).toBe(false)
    drift.reasons.forEach((r) => observed.add(r))

    expect(new Set(observed)).toEqual(new Set(CANON_GATE_REASON_CODES))
  })

  it('only returns reasons contained in the exported code set', () => {
    const result = runCanonGate({
      candidateText: 'Voldemort arrived with the ring.',
      knownEntities: ['Harry'],
      forbiddenFacts: [/ring/],
    })
    expect(result.reasons.length).toBeGreaterThan(0)
    for (const reason of result.reasons) {
      expect(CANON_GATE_REASON_CODES).toContain(reason)
    }
  })

  it('uses the exact exported constants so the set cannot drift from the emitter', () => {
    expect(CANON_GATE_REASON.UNSUPPORTED_FACT).toBe('UNSUPPORTED_FACT')
    expect(CANON_GATE_REASON.CANON_DRIFT).toBe('CANON_DRIFT')
    expect(CANON_GATE_REASON_CODES.sort()).toEqual([
      'CANON_DRIFT',
      'UNSUPPORTED_FACT',
    ])
  })
})
