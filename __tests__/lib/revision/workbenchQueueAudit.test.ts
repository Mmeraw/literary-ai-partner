import {
  buildWorkbenchQueueAudit,
  isAuditLogEnabled,
  REVISION_WORKBENCH_QUEUE_CLASSIFIER_VERSION,
  analyzeDiagnosticDuplication,
  buildWorkbenchOpportunityTelemetry,
  classifyDiagnosticBoundary,
} from '@/lib/revision/workbenchQueueAudit'
import { classifyWorkbenchExecutabilityDetailed } from '@/lib/revision/workbenchQueueProjection'
import type { WorkbenchQueuePayload, WorkbenchOpportunity } from '@/lib/revision/workbenchQueue'

function makeOpportunity(overrides: Partial<WorkbenchOpportunity> = {}): WorkbenchOpportunity {
  return {
    id: 'opp-1', severity: 'must', scope: 'Passage', mode: 'direct-rewrite', source: 'evaluation',
    criterion: 'TONE', leverage: 'Evaluation', crumb: 'TONE · passage:1', title: 'Tone opportunity',
    issueStatement: 'Tone opportunity', meta: 'TONE · passage:1', confidence: 'high confidence',
    anchor: 'passage:1', quoteHighlight: 'The whole place sat in a strange stasis.', quoteRest: '',
    symptom: 'The sentence is flat.', cause: 'The verb choice is abstract.',
    fixDirection: 'Replace the sentence with a concrete image.', readerEffect: 'Readers will feel the moment.',
    mistakeProofing: 'Do not invent details.',
    diagnostic: {
      symptom: 'The sentence is flat.', cause: 'The verb choice is abstract.',
      fixStrategy: 'Replace the sentence with a concrete image.', readerImpact: 'Readers will feel the moment.',
      evidence: { quotedExcerpt: 'The whole place sat in a strange stasis.', locationLabel: 'passage:1' },
      operationTargeting: 'Passage · passage:1', mistakeProofing: 'Do not invent details.',
    },
    revisionOperation: 'replace_selected_passage', readiness: 'ready_for_revise', readinessReason: null,
    evidenceLocationScope: 'Passage', repairScope: 'Passage', groundingStatus: 'supported',
    contextQuality: 'clean', preflightStatus: 'passed', cardType: 'copy_paste_rewrite',
    trustedPathStatus: 'eligible',
    options: [
      { key: 'A', mechanism: 'Recommended repair', candidateText: 'A', text: 'A', rationale: 'A' },
      { key: 'B', mechanism: 'Rhythm variant', candidateText: 'B', text: 'B', rationale: 'B' },
      { key: 'C', mechanism: 'Bolder rendering shift', candidateText: 'C', text: 'C', rationale: 'C' },
    ],
    ...overrides,
  } as unknown as WorkbenchOpportunity
}

function makePayload(overrides: Partial<WorkbenchQueuePayload> = {}): WorkbenchQueuePayload {
  return {
    ok: true, error: null, manuscriptId: '7519', evaluationJobId: 'b099a623-6c01-4564-9984-e06151fcb1e4',
    revisionPackage: null,
    modeContract: {
      evaluation_mode: 'STANDARD', voice_preservation: 'BALANCED',
      source: 'evaluation_result_v2.confirmed_mode', policy_family: 'standard', voice_preservation_level: 'balanced',
    },
    manuscriptTitle: 'Let the River Decide',
    opportunities: [makeOpportunity({ id: 'opp-copy' })],
    needsTargeting: [makeOpportunity({ id: 'opp-strategy', cardType: 'revision_strategy', trustedPathStatus: 'unavailable_author_review_required', readiness: 'ready_for_revise' })],
    withheldUnsupported: [makeOpportunity({ id: 'opp-withheld', cardType: 'withheld', trustedPathStatus: 'impossible', readiness: 'ready_for_revise' })],
    readinessTotals: { ready_for_revise: 1, needs_targeting: 2, withheld_unsupported: 1 },
    totals: { must: 1, should: 0, could: 0 },
    scopes: { Line: 0, Passage: 1, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    criteria: { TONE: 1 }, synthesis: { admitted: 1, clustered: 0, held: 3, suppressed: 0 },
    ...overrides,
  }
}

describe('workbenchQueueAudit', () => {
  it('is disabled by default', () => {
    delete process.env.REVISION_WORKBENCH_AUDIT_LOG
    expect(isAuditLogEnabled()).toBe(false)
  })

  it('is enabled when REVISION_WORKBENCH_AUDIT_LOG=1', () => {
    process.env.REVISION_WORKBENCH_AUDIT_LOG = '1'
    expect(isAuditLogEnabled()).toBe(true)
    delete process.env.REVISION_WORKBENCH_AUDIT_LOG
  })

  it('builds a per-opportunity audit report with the requested fields', () => {
    const admissionsById = new Map([
      ['opp-copy', { copyPasteAdmissionPassed: true, copyPasteAdmissionReasons: [], strategyAdmissionPassed: true, strategyAdmissionReasons: [] }],
      ['opp-strategy', { copyPasteAdmissionPassed: false, copyPasteAdmissionReasons: ['insufficient_before_after_context'], strategyAdmissionPassed: true, strategyAdmissionReasons: [] }],
      ['opp-withheld', { copyPasteAdmissionPassed: false, copyPasteAdmissionReasons: ['canon_unclear'], strategyAdmissionPassed: false, strategyAdmissionReasons: ['canon_unclear'] }],
    ])
    const report = buildWorkbenchQueueAudit(makePayload(), { ledgerArtifactId: 'ledger-1', admissionsById })

    expect(report.type).toBe('workbench-queue-audit')
    expect(report.load.evaluationJobId).toBe('b099a623-6c01-4564-9984-e06151fcb1e4')
    expect(report.load.ledgerArtifactId).toBe('ledger-1')
    expect(report.load.classifierVersion).toBe(REVISION_WORKBENCH_QUEUE_CLASSIFIER_VERSION)
    expect(report.load.bucketCounts).toEqual({ opportunities: 1, needsTargeting: 1, withheldUnsupported: 1 })
    expect(report.load.orderedOpportunityIds).toEqual(['opp-copy', 'opp-strategy', 'opp-withheld'])

    const [first, second, third] = report.opportunities
    expect(first.opportunityId).toBe('opp-copy')
    expect(first.criterion).toBe('TONE')
    expect(first.evidenceLocationScope).toBe('Passage')
    expect(first.repairScope).toBe('Passage')
    expect(first.revisionOperation).toBe('replace_selected_passage')
    expect(first.groundingStatus).toBe('supported')
    expect(first.contextQuality).toBe('clean')
    expect(first.preflightStatus).toBe('passed')
    expect(first.readiness).toBe('ready_for_revise')
    expect(first.copyPasteAdmissionPassed).toBe(true)
    expect(first.copyPasteAdmissionReasons).toEqual([])
    expect(first.strategyAdmissionPassed).toBe(true)
    expect(first.strategyAdmissionReasons).toEqual([])
    expect(first.finalCardType).toBe('copy_paste_rewrite')
    expect(first.queueBucket).toBe('opportunities')
    expect(first.reasonForBucketOverride).toBeNull()
    expect(second.finalCardType).toBe('revision_strategy')
    expect(second.queueBucket).toBe('needsTargeting')
    expect(third.finalCardType).toBe('withheld')
    expect(third.queueBucket).toBe('withheldUnsupported')
    expect(third.reasonForBucketOverride).toBeNull()
  })

  it('flags a withheld card routed to needsTargeting as a bucket override', () => {
    const report = buildWorkbenchQueueAudit(makePayload({
      opportunities: [],
      needsTargeting: [makeOpportunity({ id: 'opp-withheld', cardType: 'withheld', trustedPathStatus: 'impossible', readiness: 'needs_targeting' })],
      withheldUnsupported: [],
    }))
    expect(report.opportunities[0].reasonForBucketOverride).toContain('withheld card routed to')
    expect(report.opportunities[0].reasonForBucketOverride).toContain('needs_targeting')
  })

  it('produces identical identity and projection hashes for identical loads and different hashes for different ordering or classification', () => {
    const admissionsById = new Map([
      ['opp-copy', { copyPasteAdmissionPassed: true, copyPasteAdmissionReasons: [], strategyAdmissionPassed: true, strategyAdmissionReasons: [] }],
      ['opp-strategy', { copyPasteAdmissionPassed: false, copyPasteAdmissionReasons: [], strategyAdmissionPassed: true, strategyAdmissionReasons: [] }],
      ['opp-withheld', { copyPasteAdmissionPassed: false, copyPasteAdmissionReasons: [], strategyAdmissionPassed: false, strategyAdmissionReasons: [] }],
    ])
    const reportA = buildWorkbenchQueueAudit(makePayload(), { admissionsById })
    const reportB = buildWorkbenchQueueAudit(makePayload(), { admissionsById })
    expect(reportA.load.identityHash).toBe(reportB.load.identityHash)
    expect(reportA.load.projectionHash).toBe(reportB.load.projectionHash)

    const reordered = makePayload({
      opportunities: [makeOpportunity({ id: 'opp-strategy' })],
      needsTargeting: [makeOpportunity({ id: 'opp-copy' })],
      withheldUnsupported: [],
    })
    const reportReordered = buildWorkbenchQueueAudit(reordered, { admissionsById })
    expect(reportReordered.load.identityHash).not.toBe(reportA.load.identityHash)
    expect(reportReordered.load.projectionHash).not.toBe(reportA.load.projectionHash)

    const changedClassification = makePayload({
      opportunities: [makeOpportunity({ id: 'opp-copy', cardType: 'withheld', trustedPathStatus: 'impossible' })],
      needsTargeting: [makeOpportunity({ id: 'opp-strategy', cardType: 'revision_strategy', trustedPathStatus: 'unavailable_author_review_required', readiness: 'ready_for_revise' })],
      withheldUnsupported: [makeOpportunity({ id: 'opp-withheld', cardType: 'withheld', trustedPathStatus: 'impossible', readiness: 'ready_for_revise' })],
    })
    const reportChanged = buildWorkbenchQueueAudit(changedClassification, { admissionsById })
    expect(reportChanged.load.identityHash).toBe(reportA.load.identityHash)
    expect(reportChanged.load.projectionHash).not.toBe(reportA.load.projectionHash)
  })

  it('changes projectionHash when admission reasons change but not when their order changes', () => {
    const first = new Map([
      ['opp-copy', { copyPasteAdmissionPassed: false, copyPasteAdmissionReasons: ['canon_unclear', 'context_missing'], strategyAdmissionPassed: false, strategyAdmissionReasons: ['canon_unclear'] }],
    ])
    const reordered = new Map([
      ['opp-copy', { copyPasteAdmissionPassed: false, copyPasteAdmissionReasons: ['context_missing', 'canon_unclear'], strategyAdmissionPassed: false, strategyAdmissionReasons: ['canon_unclear'] }],
    ])
    const changed = new Map([
      ['opp-copy', { copyPasteAdmissionPassed: false, copyPasteAdmissionReasons: ['context_missing', 'diagnosis_unsupported'], strategyAdmissionPassed: false, strategyAdmissionReasons: ['canon_unclear'] }],
    ])

    const reportFirst = buildWorkbenchQueueAudit(makePayload(), { admissionsById: first })
    const reportReordered = buildWorkbenchQueueAudit(makePayload(), { admissionsById: reordered })
    const reportChanged = buildWorkbenchQueueAudit(makePayload(), { admissionsById: changed })

    expect(reportReordered.load.projectionHash).toBe(reportFirst.load.projectionHash)
    expect(reportChanged.load.identityHash).toBe(reportFirst.load.identityHash)
    expect(reportChanged.load.projectionHash).not.toBe(reportFirst.load.projectionHash)
  })
})

describe('workbenchQueueAudit telemetry and duplication', () => {
  it('detects duplicate_within_source with propagated downstream copies only', () => {
    const opportunity = makeOpportunity({
      hydrationFailureReasons: ['insufficient_anchor_grounding', 'insufficient_anchor_grounding'],
    })
    const classification = classifyWorkbenchExecutabilityDetailed(opportunity)
    opportunity.executabilityReasons = classification.finalDecision.reasons
    const analysis = analyzeDiagnosticDuplication(opportunity, classification)

    const duplicate = analysis.duplicateDiagnostics.find(
      (d) => d.normalizedCode === 'insufficient_anchor_grounding',
    )
    expect(duplicate).toBeTruthy()
    expect(duplicate!.boundary.counts).toEqual({
      sourceCountsByCollection: {
        preflight: 0,
        hydration: 2,
        resBlocker: 0,
      },
      classificationInputCount: 0,
      classificationOutputCount: 0,
      presentationInputCount: 0,
      presentationOutputCount: 0,
    })
    expect(duplicate!.boundary.conditions).toEqual({
      withinSourceDuplicate: true,
      repeatedAcrossSources: false,
      classificationMergeDuplicate: false,
      presentationMergeDuplicate: false,
    })
    expect(duplicate!.boundary.duplicationType).toBe('duplicate_within_source')
  })

  it('detects repeated_across_sources and does not mislabel propagation as stage growth', () => {
    const opportunity = makeOpportunity({
      hydrationFailureReasons: ['canon_unclear'],
      resBlockerReasons: ['canon_unclear'],
    })
    const classification = classifyWorkbenchExecutabilityDetailed(opportunity)
    opportunity.executabilityReasons = classification.finalDecision.reasons
    const analysis = analyzeDiagnosticDuplication(opportunity, classification)

    const duplicate = analysis.duplicateDiagnostics.find((d) => d.normalizedCode === 'canon_unclear')
    expect(duplicate).toBeTruthy()
    expect(duplicate!.boundary.counts).toEqual({
      sourceCountsByCollection: {
        preflight: 0,
        hydration: 1,
        resBlocker: 1,
      },
      classificationInputCount: 0,
      classificationOutputCount: 0,
      presentationInputCount: 1,
      presentationOutputCount: 1,
    })
    expect(duplicate!.boundary.conditions).toEqual({
      withinSourceDuplicate: false,
      repeatedAcrossSources: true,
      classificationMergeDuplicate: false,
      presentationMergeDuplicate: false,
    })
    expect(duplicate!.boundary.duplicationType).toBe('repeated_across_sources')
  })

  it('does not let annotation fields participate in duplication classification', () => {
    const opportunity = makeOpportunity({
      readinessReason: 'annotation_only_duplicate',
      adminRepairReason: 'annotation_only_duplicate',
      adminActions: ['annotation_only_duplicate', 'annotation_only_duplicate'],
    })
    const classification = classifyWorkbenchExecutabilityDetailed(opportunity)
    opportunity.executabilityReasons = classification.finalDecision.reasons
    const analysis = analyzeDiagnosticDuplication(opportunity, classification)
    expect(
      analysis.duplicateDiagnostics.find((d) => d.normalizedCode === 'annotation_only_duplicate'),
    ).toBeUndefined()
  })

  it('captures raw boundary counts for a production-path duplicate and derives booleans before label', () => {
    const opportunity = makeOpportunity({
      preflightReasons: ['context_missing', 'context_missing'],
    })
    const classification = classifyWorkbenchExecutabilityDetailed(opportunity)
    opportunity.executabilityReasons = classification.finalDecision.reasons
    const analysis = analyzeDiagnosticDuplication(opportunity, classification)

    const duplicate = analysis.duplicateDiagnostics.find((d) => d.normalizedCode === 'context_missing')
    expect(duplicate).toBeTruthy()
    expect(duplicate!.boundary.counts).toEqual({
      sourceCountsByCollection: {
        preflight: 2,
        hydration: 0,
        resBlocker: 0,
      },
      classificationInputCount: 0,
      classificationOutputCount: 0,
      presentationInputCount: 2,
      presentationOutputCount: 2,
    })
    expect(duplicate!.boundary.conditions).toEqual({
      withinSourceDuplicate: true,
      repeatedAcrossSources: false,
      classificationMergeDuplicate: false,
      presentationMergeDuplicate: false,
    })
    expect(duplicate!.boundary.duplicationType).toBe('duplicate_within_source')
  })

  it('uses pure boundary helper for synthetic classification_merge_duplicate invariants', () => {
    const result = classifyDiagnosticBoundary({
      sourceCountsByCollection: {
        preflight: 1,
        hydration: 0,
        resBlocker: 0,
      },
      classificationInputCount: 1,
      classificationOutputCount: 2,
      presentationInputCount: 2,
      presentationOutputCount: 2,
    })

    expect(result.conditions).toEqual({
      withinSourceDuplicate: false,
      repeatedAcrossSources: false,
      classificationMergeDuplicate: true,
      presentationMergeDuplicate: false,
    })
    expect(result.duplicationType).toBe('classification_merge_duplicate')
  })

  it('uses pure boundary helper for synthetic presentation_merge_duplicate invariants', () => {
    const result = classifyDiagnosticBoundary({
      sourceCountsByCollection: {
        preflight: 1,
        hydration: 0,
        resBlocker: 0,
      },
      classificationInputCount: 1,
      classificationOutputCount: 1,
      presentationInputCount: 1,
      presentationOutputCount: 2,
    })

    expect(result.conditions).toEqual({
      withinSourceDuplicate: false,
      repeatedAcrossSources: false,
      classificationMergeDuplicate: false,
      presentationMergeDuplicate: true,
    })
    expect(result.duplicationType).toBe('presentation_merge_duplicate')
  })

  it('reports downgrade_prevented when needs_targeting exception turns withheld into strategy', () => {
    const opportunity = makeOpportunity({
      id: 'opp-downgrade',
      readiness: 'needs_targeting',
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      groundingStatus: 'supported',
    })
    const classification = classifyWorkbenchExecutabilityDetailed(opportunity)
    const telemetry = buildWorkbenchOpportunityTelemetry(opportunity, classification, 'needsTargeting')

    expect(telemetry.classification.finalDecision.cardType).toBe('revision_strategy')
    expect(telemetry.classification.counterfactualWithoutNeedsTargeting?.cardType).toBe('withheld')
    expect(telemetry.classification.needsTargetingEffect).toBe('downgrade_prevented')
  })

  it('builds complete opportunity telemetry and includes routing and classification', () => {
    const opportunity = makeOpportunity({
      id: 'opp-telemetry',
      cardType: 'revision_strategy',
      trustedPathStatus: 'unavailable_author_review_required',
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      groundingStatus: 'supported',
    })
    const classification = classifyWorkbenchExecutabilityDetailed(opportunity)
    const telemetry = buildWorkbenchOpportunityTelemetry(opportunity, classification, 'needsTargeting')

    expect(telemetry.opportunityId).toBe('opp-telemetry')
    expect(telemetry.criterion).toBe('TONE')
    expect(telemetry.routing.queueBucket).toBe('needsTargeting')
    expect(telemetry.gates.copyPaste).toEqual(classification.gates.copyPaste)
    expect(telemetry.gates.strategy).toEqual(classification.gates.strategy)
    expect(telemetry.classification.finalDecision).toEqual(classification.finalDecision)
    expect(telemetry.deduplicationAnalysis).toBeDefined()
    expect(telemetry.deduplicationAnalysis.stageTotals).toBeDefined()
  })

  it('produces identical identity and projection hashes with or without classifications', () => {
    const payload = makePayload()
    const opportunity = payload.opportunities[0]
    const classification = classifyWorkbenchExecutabilityDetailed(opportunity)
    const classificationsById = new Map([['opp-copy', classification]])
    const admissionsById = new Map([
      ['opp-copy', {
        copyPasteAdmissionPassed: classification.copyPasteAdmissionPassed,
        copyPasteAdmissionReasons: classification.copyPasteAdmissionReasons,
        strategyAdmissionPassed: classification.strategyAdmissionPassed,
        strategyAdmissionReasons: classification.strategyAdmissionReasons,
      }],
    ])

    const without = buildWorkbenchQueueAudit(payload, { admissionsById })
    const withClassifications = buildWorkbenchQueueAudit(payload, { admissionsById, classificationsById })

    expect(withClassifications.opportunityTelemetry).toHaveLength(1)
    expect(without.load.identityHash).toBe(withClassifications.load.identityHash)
    expect(without.load.projectionHash).toBe(withClassifications.load.projectionHash)
  })
})
