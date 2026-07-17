import {
  HELD_REASON_SOURCE_REGISTRY,
  REPAIR_STEP_ORDER,
  buildRecoveryPlan,
  collectCanonicalReasons,
  getHeldReasonInfo,
  isTerminalRecoveryState,
  isValidRecoveryTransition,
  normalizeHeldReasonCode,
  type HeldOpportunityInput,
} from '@/lib/revision/heldRecoveryInventory'

function heldFixture(
  id: string,
  overrides: Partial<HeldOpportunityInput> = {},
): HeldOpportunityInput {
  return {
    id,
    groundingStatus: 'uncertain_after_relook_reportable',
    contextQuality: 'limited',
    preflightStatus: 'limited_context',
    preflightReasons: [],
    finalDecision: {
      cardType: 'withheld',
      reasons: ['context_missing'],
    },
    ...overrides,
  }
}

describe('HELD_REASON_SOURCE_REGISTRY', () => {
  it('only final_decision is authoritative for routing', () => {
    const routingSources = HELD_REASON_SOURCE_REGISTRY.filter((s) => s.authoritativeForRouting)
    expect(routingSources).toHaveLength(1)
    expect(routingSources[0]!.source).toBe('final_decision')
    expect(routingSources[0]!.canonicalField).toContain('finalDecision')
  })

  it('marks executabilityReasons as a non-authoritative presentation copy', () => {
    const executability = HELD_REASON_SOURCE_REGISTRY.find((s) => s.source === 'executability')
    expect(executability).toBeDefined()
    expect(executability!.authoritativeForRecoveryPlanning).toBe(false)
    expect(executability!.authoritativeForRouting).toBe(false)
    expect(executability!.mayContainDuplicates).toBe(true)
  })

  it('documents all canonical held-reason producers', () => {
    const expectedSources = [
      'grounding',
      'grounding_note',
      'preflight',
      'hydration',
      'res_blocker',
      'copy_paste_admission',
      'strategy_admission',
      'executability',
      'base_decision',
      'final_decision',
      'integrity',
      'candidate_quality',
      'voice_gate',
      'canon_gate',
    ]
    const actual = HELD_REASON_SOURCE_REGISTRY.map((s) => s.source).sort()
    expect(actual).toEqual([...expectedSources].sort())
  })

  it('marks preflight, hydration, and res_blocker as duplicate-prone', () => {
    const duplicateProne = HELD_REASON_SOURCE_REGISTRY.filter((s) => s.mayContainDuplicates)
    const sources = duplicateProne.map((s) => s.source)
    expect(sources).toContain('preflight')
    expect(sources).toContain('hydration')
    expect(sources).toContain('res_blocker')
  })
})

describe('getHeldReasonInfo', () => {
  it('classifies truncated_anchor as an anchor repair with high confidence', () => {
    const info = getHeldReasonInfo('truncated_anchor')
    expect(info.repairFamily).toBe('anchor')
    expect(info.recoverable).toBe(true)
    expect(info.automaticRecoveryAllowed).toBe(true)
    expect(info.recoveryConfidence).toBe('high')
    expect(info.isHardBlocker).toBe(false)
    expect(info.allowedTerminalOutcomes).toContain('copy_paste_rewrite')
    expect(info.allowedTerminalOutcomes).toContain('revision_strategy')
  })

  it('classifies candidate_quality_failed as a candidate regeneration issue', () => {
    const info = getHeldReasonInfo('candidate_quality_failed')
    expect(info.repairFamily).toBe('candidates')
    expect(info.recoverable).toBe(true)
    expect(info.allowedTerminalOutcomes).toContain('copy_paste_rewrite')
  })

  it('classifies candidate_quality_failed_after_regen as low-confidence', () => {
    const info = getHeldReasonInfo('candidate_quality_failed_after_regen')
    expect(info.repairFamily).toBe('candidates')
    expect(info.recoveryConfidence).toBe('low')
    expect(info.automaticRecoveryAllowed).toBe(false)
    expect(info.allowedTerminalOutcomes).not.toContain('copy_paste_rewrite')
  })

  it('classifies hard_canon_conflict as a hard blocker', () => {
    const info = getHeldReasonInfo('HARD_CANON_CONFLICT')
    expect(info.isHardBlocker).toBe(true)
    expect(info.recoverable).toBe(false)
    expect(info.automaticRecoveryAllowed).toBe(false)
    expect(info.repairFamily).toBe('none')
    expect(info.allowedTerminalOutcomes).toEqual(['withheld'])
    expect(info.allowedAuthorActions).toContain('dismiss')
    expect(info.allowedAuthorActions).toContain('save_as_note')
    expect(info.allowedAuthorActions).toContain('provide_context')
  })

  it('classifies testimony_fabrication_risk as a hard blocker', () => {
    const info = getHeldReasonInfo('testimony_fabrication_risk')
    expect(info.isHardBlocker).toBe(true)
    expect(info.allowedTerminalOutcomes).toEqual(['withheld'])
    expect(info.automaticRecoveryAllowed).toBe(false)
  })

  it('classifies diagnosis_unsupported as a diagnosis repair', () => {
    const info = getHeldReasonInfo('diagnosis_unsupported')
    expect(info.repairFamily).toBe('diagnosis')
    expect(info.recoverable).toBe(true)
  })

  it('normalizes mixed-case and spaced reason codes', () => {
    const a = getHeldReasonInfo('Truncated Anchor')
    const b = getHeldReasonInfo('truncated-anchor')
    expect(a.reasonCode).toBe(b.reasonCode)
    expect(a.reasonCode).toBe('truncated_anchor')
  })

  it('fails closed on unknown reason codes', () => {
    const info = getHeldReasonInfo('totally_unknown_reason_xyz')
    expect(info.recoverable).toBe(false)
    expect(info.automaticRecoveryAllowed).toBe(false)
    expect(info.repairFamily).toBe('none')
    expect(info.allowedTerminalOutcomes).toEqual(['withheld'])
    expect(info.isHardBlocker).toBe(false)
  })
})

describe('collectCanonicalReasons', () => {
  it('prefers explicit hydration/res blocker arrays over deriving them from preflight', () => {
    const input = heldFixture('split-test', {
      preflightReasons: ['hydration_anchor_truncated', 'insufficient_anchor_grounding'],
      hydrationFailureReasons: ['hydration_context_not_found'],
      resBlockerReasons: ['insufficient_anchor_grounding'],
      finalDecision: { cardType: 'withheld', reasons: ['context_missing'] },
    })
    const set = collectCanonicalReasons(input)
    const sources = set.canonicalReasons.map((o) => o.source)
    expect(sources).toContain('hydration')
    expect(sources).toContain('res_blocker')
    expect(sources).toContain('final_decision')
  })

  it('splits preflight reasons by hydration prefix when explicit arrays are absent', () => {
    const input = heldFixture('derive-test', {
      preflightReasons: ['hydration_anchor_truncated', 'insufficient_anchor_grounding'],
    })
    const set = collectCanonicalReasons(input)
    expect(set.canonicalReasons.some((o) => o.source === 'hydration' && o.code === 'hydration_anchor_truncated')).toBe(true)
    expect(set.canonicalReasons.some((o) => o.source === 'res_blocker' && o.code === 'insufficient_anchor_grounding')).toBe(true)
  })

  it('carries routing and state metadata', () => {
    const input = heldFixture('meta-test', {
      groundingStatus: 'unsupported_blocked',
      contextQuality: 'blocked',
      preflightStatus: 'blocked',
      finalDecision: { cardType: 'withheld', reasons: [] },
    })
    const set = collectCanonicalReasons(input)
    expect(set.finalCardType).toBe('withheld')
    expect(set.groundingStatus).toBe('unsupported_blocked')
    expect(set.contextQuality).toBe('blocked')
    expect(set.preflightStatus).toBe('blocked')
  })
})

describe('recovery state machine', () => {
  it('terminal states are terminal', () => {
    expect(isTerminalRecoveryState('reclassified')).toBe(true)
    expect(isTerminalRecoveryState('dismissed')).toBe(true)
    expect(isTerminalRecoveryState('recovery_attempt_failed_terminal')).toBe(true)
    expect(isTerminalRecoveryState('held')).toBe(false)
    expect(isTerminalRecoveryState('recovery_attempt_running')).toBe(false)
  })

  it('requires pending before running and recovered before reclassified', () => {
    expect(isValidRecoveryTransition('held', 'recovery_attempt_running')).toBe(false)
    expect(isValidRecoveryTransition('held', 'recovery_attempt_pending')).toBe(true)
    expect(isValidRecoveryTransition('recovery_attempt_pending', 'recovery_attempt_running')).toBe(true)
    expect(isValidRecoveryTransition('recovery_attempt_running', 'recovered_pending_reclassification')).toBe(true)
    expect(isValidRecoveryTransition('recovered_pending_reclassification', 'reclassified')).toBe(true)
  })

  it('allows retryable failures to return to pending', () => {
    expect(isValidRecoveryTransition('recovery_attempt_running', 'recovery_attempt_failed_retryable')).toBe(true)
    expect(isValidRecoveryTransition('recovery_attempt_failed_retryable', 'recovery_attempt_pending')).toBe(true)
  })

  it('forbids terminal states from leaving', () => {
    expect(isValidRecoveryTransition('reclassified', 'held')).toBe(false)
    expect(isValidRecoveryTransition('dismissed', 'held')).toBe(false)
  })
})

describe('buildRecoveryPlan contract properties', () => {
  it('does not mutate the input opportunity or finalDecision', () => {
    const input = heldFixture('mutate-test', {
      finalDecision: { cardType: 'withheld', reasons: ['truncated_anchor'] },
    })
    const before = JSON.stringify(input)
    buildRecoveryPlan(input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('does not mutate a deeply frozen nested input and preserves nested references', () => {
    function deepFreeze<T>(obj: T): T {
      if (obj === null || typeof obj !== 'object') return obj
      if (Object.isFrozen(obj)) return obj
      Object.freeze(obj)
      if (Array.isArray(obj)) {
        obj.forEach(deepFreeze)
      } else {
        Object.values(obj as Record<string, unknown>).forEach(deepFreeze)
      }
      return obj
    }

    const input = deepFreeze<HeldOpportunityInput>({
      id: 'deep-frozen-1',
      groundingStatus: 'uncertain_after_relook_reportable',
      contextQuality: 'limited',
      preflightStatus: 'blocked',
      preflightReasons: ['truncated_anchor', 'hydration_context_not_found'],
      hydrationFailureReasons: ['hydration_anchor_truncated'],
      resBlockerReasons: ['insufficient_anchor_grounding'],
      copyPasteAdmissionReasons: ['TOO_SHORT'],
      strategyAdmissionReasons: ['EVIDENCE_MISSING'],
      baseDecision: { cardType: 'copy_paste_rewrite', reasons: ['ledger_conflict_possible'] },
      finalDecision: { cardType: 'copy_paste_rewrite', reasons: ['safe_local_copy_paste_rewrite'] },
      executabilityReasons: ['context_missing'],
      groundingNote: 'Grounding annotation',
    })

    const beforeJson = JSON.stringify(input)
    const originalFinalDecision = input.finalDecision
    const originalBaseDecision = input.baseDecision
    const originalArrays = {
      preflight: input.preflightReasons,
      hydration: input.hydrationFailureReasons,
      res: input.resBlockerReasons,
      copyPaste: input.copyPasteAdmissionReasons,
      strategy: input.strategyAdmissionReasons,
      baseReasons: input.baseDecision?.reasons,
      finalReasons: input.finalDecision?.reasons,
      executability: input.executabilityReasons,
    }

    const plan = buildRecoveryPlan(input)

    expect(input.finalDecision).toBe(originalFinalDecision)
    expect(input.baseDecision).toBe(originalBaseDecision)
    expect(input.preflightReasons).toBe(originalArrays.preflight)
    expect(input.hydrationFailureReasons).toBe(originalArrays.hydration)
    expect(input.resBlockerReasons).toBe(originalArrays.res)
    expect(input.copyPasteAdmissionReasons).toBe(originalArrays.copyPaste)
    expect(input.strategyAdmissionReasons).toBe(originalArrays.strategy)
    expect(input.baseDecision?.reasons).toBe(originalArrays.baseReasons)
    expect(input.finalDecision?.reasons).toBe(originalArrays.finalReasons)
    expect(input.executabilityReasons).toBe(originalArrays.executability)
    expect(JSON.stringify(input)).toBe(beforeJson)

    expect(plan.opportunityId).toBe('deep-frozen-1')
    expect(plan.recoverable).toBe(true)
    expect(plan.automaticRecoveryAllowed).toBe(true)
    expect(plan.hardBlockers).toEqual([])
    expect(plan.unknownCanonicalReasons).toEqual([])
    expect(plan.requiredRepairs).toEqual([
      'expand_anchor',
      're_ground',
      'repair_diagnosis',
      'regenerate_candidates',
      'rerun_admission',
      'reclassify',
    ])
    expect(plan.expectedTerminalOutcomes).toContain('copy_paste_rewrite')
  })

  it('returns an identical plan for identical input (deterministic)', () => {
    const input = heldFixture('idempotent-test', {
      finalDecision: {
        cardType: 'withheld',
        reasons: ['truncated_anchor', 'context_missing', 'canon_unclear', 'diagnosis_unsupported'],
      },
    })
    const a = buildRecoveryPlan(input)
    const b = buildRecoveryPlan(input)
    expect(a).toEqual(b)
  })

  it('deduplicates duplicated reason strings and does not duplicate repair steps', () => {
    const input = heldFixture('dedup-test', {
      finalDecision: {
        cardType: 'withheld',
        reasons: [
          'truncated_anchor',
          'truncated_anchor',
          'insufficient_anchor_grounding',
          'insufficient_anchor_grounding',
        ],
      },
    })
    const plan = buildRecoveryPlan(input)
    expect(plan.hardBlockers).toHaveLength(0)
    expect(plan.unknownCanonicalReasons).toHaveLength(0)
    const stepSet = new Set(plan.requiredRepairs)
    expect(stepSet.size).toBe(plan.requiredRepairs.length)
    expect(plan.requiredRepairs).toContain('expand_anchor')
    expect(plan.requiredRepairs).toContain('re_ground')
  })

  it('orders repair steps by dependency', () => {
    const input = heldFixture('order-test', {
      finalDecision: {
        cardType: 'withheld',
        reasons: [
          'truncated_anchor',
          'context_missing',
          'canon_unclear',
          'diagnosis_unsupported',
          'candidate_quality_failed',
        ],
      },
    })
    const plan = buildRecoveryPlan(input)
    const positions = new Map(plan.requiredRepairs.map((step, i) => [step, i]))
    expect(positions.get('expand_anchor')).toBeLessThan(positions.get('re_ground') ?? Infinity)
    expect(positions.get('re_ground')).toBeLessThan(positions.get('repair_diagnosis') ?? Infinity)
    expect(positions.get('repair_diagnosis')).toBeLessThan(positions.get('regenerate_candidates') ?? Infinity)
    expect(positions.get('regenerate_candidates')).toBeLessThan(positions.get('rerun_admission') ?? Infinity)
    expect(positions.get('rerun_admission')).toBeLessThan(positions.get('reclassify') ?? Infinity)
  })

  it('makes hard blockers dominate recoverable reasons and fail closed', () => {
    const input = heldFixture('hard-blocker-test', {
      finalDecision: {
        cardType: 'withheld',
        reasons: ['truncated_anchor', 'testimony_fabrication_risk'],
      },
      preflightReasons: ['testimony_fabrication_risk'],
    })
    const plan = buildRecoveryPlan(input)
    expect(plan.recoverable).toBe(false)
    expect(plan.automaticRecoveryAllowed).toBe(false)
    expect(plan.expectedTerminalOutcomes).toEqual(['withheld'])
    expect(plan.hardBlockers).toContain('testimony_fabrication_risk')
    expect(plan.allowedAuthorActions).toContain('dismiss')
    expect(plan.allowedAuthorActions).toContain('save_as_note')
    expect(plan.allowedAuthorActions).toContain('provide_context')
    // Candidates should not be auto-generated while a hard blocker is present.
    expect(plan.requiredRepairs).not.toContain('regenerate_candidates')
  })

  it('fails closed and audits unknown reasons', () => {
    const input = heldFixture('unknown-test', {
      finalDecision: {
        cardType: 'withheld',
        reasons: ['truncated_anchor', 'totally_unknown_reason_xyz'],
      },
    })
    const plan = buildRecoveryPlan(input)
    expect(plan.recoverable).toBe(false)
    expect(plan.automaticRecoveryAllowed).toBe(false)
    expect(plan.expectedTerminalOutcomes).toEqual(['withheld'])
    expect(plan.unknownCanonicalReasons).toContain('totally_unknown_reason_xyz')
  })
})

describe('seven acceptance-corpus reason combinations', () => {
  // Reconstructed from the attachment as structured fixtures with stable IDs.
  // These prove the reason combinations in the acceptance corpus; they do not
  // yet prove real persisted records emit these exact combinations.
  const fixtures: Array<{ input: HeldOpportunityInput; label: string; expectations: {
    recoverable: boolean
    automaticRecoveryAllowed: boolean
    families: string[]
    firstRepair: string
    includesCandidates: boolean
    terminalOutcomes: string[]
    hardBlockers?: string[]
  } }> = [
    {
      label: 'diamonds-held-01: insufficient anchor grounding (Calvin/Monty action)',
      input: heldFixture('diamonds-held-01', {
        groundingStatus: 'uncertain_after_relook_reportable',
        contextQuality: 'limited',
        finalDecision: {
          cardType: 'withheld',
          reasons: [
            'context_missing',
            'canon_unclear',
            'diagnosis_unsupported',
            'insufficient_anchor_grounding',
            'insufficient_anchor_grounding',
          ],
        },
      }),
      expectations: {
        recoverable: true,
        automaticRecoveryAllowed: true,
        families: ['anchor', 'context', 'candidates', 'diagnosis'],
        firstRepair: 'expand_anchor',
        includesCandidates: true,
        terminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      },
    },
    {
      label: 'diamonds-held-02: candidate quality failure after regeneration (slogan)',
      input: heldFixture('diamonds-held-02', {
        groundingStatus: 'unsupported_blocked',
        contextQuality: 'limited',
        finalDecision: {
          cardType: 'withheld',
          reasons: [
            'context_missing',
            'canon_unclear',
            'diagnosis_unsupported',
            'candidate_quality_failed',
            'candidate_quality_unsupported_facts',
            'candidate_quality_failed_after_regen',
            'candidate_quality_failed',
            'candidate_quality_unsupported_facts',
            'candidate_quality_failed_after_regen',
          ],
        },
      }),
      expectations: {
        recoverable: true,
        automaticRecoveryAllowed: false,
        families: ['context', 'diagnosis', 'candidates'],
        firstRepair: 'retrieve_context',
        includesCandidates: true,
        terminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      },
    },
    {
      label: 'diamonds-held-03: insufficient anchor grounding (Calvin stakes beat)',
      input: heldFixture('diamonds-held-03', {
        groundingStatus: 'uncertain_after_relook_reportable',
        contextQuality: 'limited',
        finalDecision: {
          cardType: 'withheld',
          reasons: [
            'context_missing',
            'canon_unclear',
            'diagnosis_unsupported',
            'insufficient_anchor_grounding',
            'insufficient_anchor_grounding',
          ],
        },
      }),
      expectations: {
        recoverable: true,
        automaticRecoveryAllowed: true,
        families: ['anchor', 'context', 'candidates', 'diagnosis'],
        firstRepair: 'expand_anchor',
        includesCandidates: true,
        terminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      },
    },
    {
      label: 'diamonds-held-04: insufficient anchor grounding (Monty stakes beat)',
      input: heldFixture('diamonds-held-04', {
        groundingStatus: 'uncertain_after_relook_reportable',
        contextQuality: 'limited',
        finalDecision: {
          cardType: 'withheld',
          reasons: [
            'context_missing',
            'canon_unclear',
            'diagnosis_unsupported',
            'insufficient_anchor_grounding',
            'insufficient_anchor_grounding',
          ],
        },
      }),
      expectations: {
        recoverable: true,
        automaticRecoveryAllowed: true,
        families: ['anchor', 'context', 'candidates', 'diagnosis'],
        firstRepair: 'expand_anchor',
        includesCandidates: true,
        terminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      },
    },
    {
      label: 'diamonds-held-05: candidate quality failure (Monty diamond/cobalt reference)',
      input: heldFixture('diamonds-held-05', {
        groundingStatus: 'unsupported_blocked',
        contextQuality: 'limited',
        finalDecision: {
          cardType: 'withheld',
          reasons: [
            'context_missing',
            'canon_unclear',
            'diagnosis_unsupported',
            'candidate_quality_failed',
            'candidate_quality_unsupported_facts',
            'candidate_quality_failed_after_regen',
            'candidate_quality_failed',
            'candidate_quality_unsupported_facts',
            'candidate_quality_failed_after_regen',
          ],
        },
      }),
      expectations: {
        recoverable: true,
        automaticRecoveryAllowed: false,
        families: ['context', 'diagnosis', 'candidates'],
        firstRepair: 'retrieve_context',
        includesCandidates: true,
        terminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      },
    },
    {
      label: 'diamonds-held-06: unsupported factual suggestion (Sri Prasanna/kidnappings)',
      input: heldFixture('diamonds-held-06', {
        groundingStatus: 'unsupported_blocked',
        contextQuality: 'blocked',
        finalDecision: {
          cardType: 'withheld',
          reasons: [
            'context_missing',
            'canon_unclear',
            'diagnosis_unsupported',
            'insufficient_anchor_grounding',
            'insufficient_anchor_grounding',
          ],
        },
        preflightReasons: ['testimony_fabrication_risk'],
      }),
      expectations: {
        recoverable: false,
        automaticRecoveryAllowed: false,
        families: ['anchor', 'context', 'diagnosis'],
        firstRepair: 'expand_anchor',
        includesCandidates: false,
        terminalOutcomes: ['withheld'],
        hardBlockers: ['testimony_fabrication_risk'],
      },
    },
    {
      label: 'diamonds-held-07: truncated anchor (metaphor sentence)',
      input: heldFixture('diamonds-held-07', {
        groundingStatus: 'uncertain_after_relook_reportable',
        contextQuality: 'limited',
        finalDecision: {
          cardType: 'withheld',
          reasons: [
            'context_missing',
            'canon_unclear',
            'diagnosis_unsupported',
            'truncated_anchor',
            'truncated_anchor',
          ],
        },
      }),
      expectations: {
        recoverable: true,
        automaticRecoveryAllowed: true,
        families: ['anchor', 'context', 'candidates', 'diagnosis'],
        firstRepair: 'expand_anchor',
        includesCandidates: true,
        terminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      },
    },
  ]

  it.each(fixtures)('$label', ({ input, expectations }) => {
    const plan = buildRecoveryPlan(input)
    expect(plan.recoverable).toBe(expectations.recoverable)
    expect(plan.automaticRecoveryAllowed).toBe(expectations.automaticRecoveryAllowed)
    expect([...plan.reasonFamilySet].sort()).toEqual([...expectations.families].sort())
    expect(plan.requiredRepairs[0]).toBe(expectations.firstRepair)
    expect(plan.requiredRepairs.includes('regenerate_candidates')).toBe(expectations.includesCandidates)
    expect(plan.expectedTerminalOutcomes.sort()).toEqual([...expectations.terminalOutcomes].sort())
    if (expectations.hardBlockers) {
      for (const blocker of expectations.hardBlockers) {
        expect(plan.hardBlockers).toContain(blocker)
      }
    }
    // finalDecision must remain untouched and still route as withheld.
    expect(input.finalDecision?.cardType).toBe('withheld')
  })
})

describe('REPAIR_STEP_ORDER', () => {
  it('places anchor and context before re-ground, diagnosis, candidates, admission, and reclassification', () => {
    const order = REPAIR_STEP_ORDER
    expect(order.indexOf('expand_anchor')).toBeLessThan(order.indexOf('re_ground'))
    expect(order.indexOf('retrieve_context')).toBeLessThan(order.indexOf('re_ground'))
    expect(order.indexOf('re_ground')).toBeLessThan(order.indexOf('repair_diagnosis'))
    expect(order.indexOf('repair_diagnosis')).toBeLessThan(order.indexOf('regenerate_candidates'))
    expect(order.indexOf('regenerate_candidates')).toBeLessThan(order.indexOf('rerun_admission'))
    expect(order.indexOf('rerun_admission')).toBeLessThan(order.indexOf('reclassify'))
  })
})

describe('HELD_REASON_INVENTORY coverage', () => {
  it('covers all canonical preflight/hydration reasons observed in production', () => {
    const observed = [
      'truncated_anchor',
      'insufficient_anchor_grounding',
      'context_missing',
      'canon_unclear',
      'diagnosis_unsupported',
      'candidate_quality_failed',
      'candidate_quality_unsupported_facts',
      'candidate_quality_failed_after_regen',
      'testimony_fabrication_risk',
      'canon_authority_blocked',
      'recommendation_requires_rewrite',
      'rationale_contaminated',
      'hydration_context_not_found',
      'hydration_anchor_truncated',
    ]
    for (const code of observed) {
      const info = getHeldReasonInfo(code)
      expect(info.reasonCode).not.toBe('unknown')
      expect(info.reasonCode).toBe(normalizeHeldReasonCode(code))
    }
  })
})
