/**
 * Workbench Queue Audit — instrumentation-only, no behavior change.
 *
 * Emits structured per-opportunity and per-load diagnostics for the Revise
 * Workbench queue. The goal is to make classification, admission, and queue
 * identity observable so we can diagnose b099a623 (17/17 withheld) and the
 * reported non-deterministic queue / ledger persistence issues.
 */

import type { WorkbenchOpportunity, WorkbenchQueuePayload, WorkbenchScope } from './workbenchQueue'
import {
  classifyWorkbenchExecutabilityDetailedWithoutNeedsTargeting,
  type WorkbenchExecutabilityClassification,
} from './workbenchQueueProjection'
import type { RecommendationExecutabilityDecision } from './recommendationExecutability'
import type { AdmissionGateResult } from './reviseAdmissionGate'

export type WorkbenchAdmissionDetails = {
  copyPasteAdmissionPassed: boolean
  copyPasteAdmissionReasons: string[]
  strategyAdmissionPassed: boolean
  strategyAdmissionReasons: string[]
}

export type WorkbenchQueueOpportunityAudit = {
  opportunityId: string
  criterion: string
  evidenceLocationScope: WorkbenchScope
  repairScope: WorkbenchScope
  revisionOperation: string
  groundingStatus: string | null | undefined
  contextQuality: string | null | undefined
  preflightStatus: string | null | undefined
  readiness: string | null | undefined
  copyPasteAdmissionPassed: boolean
  copyPasteAdmissionReasons: string[]
  strategyAdmissionPassed: boolean
  strategyAdmissionReasons: string[]
  finalCardType: string | null | undefined
  queueBucket: 'opportunities' | 'needsTargeting' | 'withheldUnsupported' | 'unknown'
  reasonForBucketOverride: string | null
}

export type WorkbenchQueueLoadAudit = {
  evaluationJobId: string | null
  ledgerArtifactId: string | null
  classifierVersion: string
  modeContractSource: string | null
  modeContractEvaluationMode: string | null
  identityHash: string
  projectionHash: string
  orderedOpportunityIds: string[]
  bucketCounts: {
    opportunities: number
    needsTargeting: number
    withheldUnsupported: number
  }
  timestamp: string
}

export type WorkbenchQueueAuditReport = {
  type: 'workbench-queue-audit'
  load: WorkbenchQueueLoadAudit
  opportunities: WorkbenchQueueOpportunityAudit[]
  opportunityTelemetry?: WorkbenchOpportunityTelemetry[]
}

export type DiagnosticCollection =
  | 'preflight'
  | 'hydration'
  | 'res_blocker'
  | 'copy_paste_admission'
  | 'strategy_admission'
  | 'executability_output'
  | 'withheld_adapter_input'
  | 'strategy_unsafe_reasons_input'
  | 'withheld_adapter_output'
  | 'strategy_unsafe_reasons_output'

export type DiagnosticOccurrence = {
  rawCode: string
  normalizedCode: string
  collection: DiagnosticCollection
  rawIndex: number
  stage:
    | 'authoritative_source'
    | 'classification_input'
    | 'classification_output'
    | 'presentation_input'
    | 'presentation_output'
}

export type DiagnosticBoundaryCounts = {
  sourceCountsByCollection: {
    preflight: number
    hydration: number
    resBlocker: number
  }
  classificationInputCount: number
  classificationOutputCount: number
  presentationInputCount: number
  presentationOutputCount: number
}

export type DiagnosticBoundaryConditions = {
  withinSourceDuplicate: boolean
  repeatedAcrossSources: boolean
  classificationMergeDuplicate: boolean
  presentationMergeDuplicate: boolean
}

export type DiagnosticBoundaryDuplicationType =
  | 'none'
  | 'duplicate_within_source'
  | 'repeated_across_sources'
  | 'classification_merge_duplicate'
  | 'presentation_merge_duplicate'
  | 'mixed'

export type DiagnosticBoundaryClassification = {
  counts: DiagnosticBoundaryCounts
  conditions: DiagnosticBoundaryConditions
  duplicationType: DiagnosticBoundaryDuplicationType
}

export type DuplicateDiagnostic = {
  normalizedCode: string
  rawVariants: string[]
  authoritativeSourceOccurrences: DiagnosticOccurrence[]
  classificationInputOccurrences: DiagnosticOccurrence[]
  classificationOutputOccurrences: DiagnosticOccurrence[]
  presentationInputOccurrences: DiagnosticOccurrence[]
  presentationOutputOccurrences: DiagnosticOccurrence[]
  boundary: DiagnosticBoundaryClassification
}

export type DiagnosticDuplicationAnalysis = {
  duplicateDiagnostics: DuplicateDiagnostic[]
  allAuthoritativeSourceCodes: string[]
  authoritativeSourceCountByCode: Record<string, number>
  stageTotals: {
    authoritativeSource: number
    classificationInput: number
    classificationOutput: number
    presentationInput: number
    presentationOutput: number
  }
}

export type WorkbenchOpportunityTelemetry = {
  opportunityId: string
  sourceOpportunityId: string | undefined
  sourceCriterion: string | undefined
  criterion: string
  readiness: string | null | undefined
  sourceState: {
    groundingStatus: string | null | undefined
    groundingNote: string | null | undefined
    contextQuality: string | null | undefined
    preflightStatus: string | null | undefined
    readinessReason: string | null
    preflightNote: string | null
  }
  rawDiagnostics: {
    preflightReasons: string[]
    hydrationFailureReasons: string[]
    resBlockerReasons: string[]
    adminRepairReason: string | null
    adminActions: string[]
  }
  annotations: {
    readinessReason: string | null
    groundingNote: string | null
    preflightNote: string | null
    adminRepairReason: string | null
    adminActions: string[]
  }
  gates: {
    copyPaste: AdmissionGateResult
    strategy: AdmissionGateResult
  }
  classification: {
    baseDecision: RecommendationExecutabilityDecision
    needsTargetingPromotionApplied: boolean
    needsTargetingOverrideApplied: boolean
    transitionReason: string | null
    finalDecision: RecommendationExecutabilityDecision
    counterfactualWithoutNeedsTargeting: RecommendationExecutabilityDecision | null
    needsTargetingEffect:
      | 'none'
      | 'reason_merged'
      | 'promoted_from_withheld'
      | 'downgrade_prevented'
      | 'indeterminate'
  }
  projectionDiagnostics: {
    executabilityReasons: string[]
  }
  presentationDiagnostics: {
    withheldAdapterInput: string[]
    strategyUnsafeReasonsInput: string[]
  }
  deduplicationAnalysis: DiagnosticDuplicationAnalysis
  routing: {
    queueBucket: 'opportunities' | 'needsTargeting' | 'withheldUnsupported' | 'unknown'
  }
}

export const REVISION_WORKBENCH_QUEUE_CLASSIFIER_VERSION = 'workbench-queue-projection:2026-07-13'

function cyrb53Hash(value: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 0x5f3759df)
    h2 = Math.imul(h2 ^ ch, 0x1ef41a9f)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b) ^ Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 0x85ebca6b) ^ Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

function hashOrderedOpportunityIds(ids: string[]): string {
  return cyrb53Hash(ids.join('\x1f'))
}

function hashProjection(entries: unknown[]): string {
  return cyrb53Hash(JSON.stringify(entries))
}

/**
 * Admission reasons are set-like diagnostic values. Normalize them before
 * hashing so source-order noise does not create false projection changes,
 * while any real addition/removal still changes the projection hash.
 */
function normalizedAdmissionReasons(reasons: string[] | undefined): string[] {
  return Array.from(new Set((reasons ?? []).map((reason) => reason.trim()).filter(Boolean))).sort()
}

function normalizeDiagnosticCode(code: string): string {
  return code.trim().toLowerCase()
}

function decisionsEqual(
  a: RecommendationExecutabilityDecision,
  b: RecommendationExecutabilityDecision,
): boolean {
  return (
    a.cardType === b.cardType &&
    a.trustedPathStatus === b.trustedPathStatus &&
    JSON.stringify(a.reasons) === JSON.stringify(b.reasons)
  )
}

function asDiagnosticCode(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function collectOccurrences(
  items: string[],
  collection: DiagnosticCollection,
  stage: DiagnosticOccurrence['stage'],
): DiagnosticOccurrence[] {
  return items
    .map((raw, rawIndex) => {
      const rawCode = asDiagnosticCode(raw)
      if (!rawCode) return null
      return {
        rawCode,
        normalizedCode: normalizeDiagnosticCode(rawCode),
        collection,
        rawIndex,
        stage,
      }
    })
    .filter((o): o is DiagnosticOccurrence => o !== null)
}

function countByCollection(occurrences: DiagnosticOccurrence[]): Map<DiagnosticCollection, number> {
  const counts = new Map<DiagnosticCollection, number>()
  for (const o of occurrences) {
    counts.set(o.collection, (counts.get(o.collection) ?? 0) + 1)
  }
  return counts
}

function computeStageTotals(
  occurrences: DiagnosticOccurrence[],
): DiagnosticDuplicationAnalysis['stageTotals'] {
  return {
    authoritativeSource: occurrences.filter((o) => o.stage === 'authoritative_source').length,
    classificationInput: occurrences.filter((o) => o.stage === 'classification_input').length,
    classificationOutput: occurrences.filter((o) => o.stage === 'classification_output').length,
    presentationInput: occurrences.filter((o) => o.stage === 'presentation_input').length,
    presentationOutput: occurrences.filter((o) => o.stage === 'presentation_output').length,
  }
}

function deriveDuplicationType(
  conditions: DiagnosticBoundaryConditions,
): DiagnosticBoundaryDuplicationType {
  const activeConditions = [
    conditions.withinSourceDuplicate,
    conditions.repeatedAcrossSources,
    conditions.classificationMergeDuplicate,
    conditions.presentationMergeDuplicate,
  ].filter(Boolean).length

  if (activeConditions === 0) return 'none'
  if (activeConditions > 1) return 'mixed'
  if (conditions.withinSourceDuplicate) return 'duplicate_within_source'
  if (conditions.repeatedAcrossSources) return 'repeated_across_sources'
  if (conditions.classificationMergeDuplicate) return 'classification_merge_duplicate'
  return 'presentation_merge_duplicate'
}

function parseRenderedDiagnosticCodes(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export function classifyDiagnosticBoundary(
  counts: DiagnosticBoundaryCounts,
): DiagnosticBoundaryClassification {
  const sourceCounts = counts.sourceCountsByCollection
  const distinctAuthoritativeSourceCollections = [
    sourceCounts.preflight,
    sourceCounts.hydration,
    sourceCounts.resBlocker,
  ].filter((count) => count > 0).length

  const conditions: DiagnosticBoundaryConditions = {
    withinSourceDuplicate: Object.values(sourceCounts).some((count) => count > 1),
    repeatedAcrossSources: distinctAuthoritativeSourceCollections > 1,
    classificationMergeDuplicate:
      counts.classificationOutputCount > counts.classificationInputCount,
    presentationMergeDuplicate:
      counts.presentationOutputCount > counts.presentationInputCount,
  }

  return {
    counts,
    conditions,
    duplicationType: deriveDuplicationType(conditions),
  }
}

export function analyzeDiagnosticDuplication(
  opportunity: WorkbenchOpportunity,
  classification: WorkbenchExecutabilityClassification,
): DiagnosticDuplicationAnalysis {
  const occurrences: DiagnosticOccurrence[] = []

  // Authoritative source diagnostics only (annotations are intentionally excluded).
  occurrences.push(
    ...collectOccurrences(opportunity.preflightReasons ?? [], 'preflight', 'authoritative_source'),
  )
  occurrences.push(
    ...collectOccurrences(
      opportunity.hydrationFailureReasons ?? [],
      'hydration',
      'authoritative_source',
    ),
  )
  occurrences.push(
    ...collectOccurrences(opportunity.resBlockerReasons ?? [], 'res_blocker', 'authoritative_source'),
  )

  // Classification boundary: exact classifier input and output occurrences.
  occurrences.push(
    ...collectOccurrences(
      classification.gates.copyPaste.reasons,
      'copy_paste_admission',
      'classification_input',
    ),
  )
  occurrences.push(
    ...collectOccurrences(
      classification.gates.strategy.reasons,
      'strategy_admission',
      'classification_input',
    ),
  )
  occurrences.push(
    ...collectOccurrences(
      classification.finalDecision.reasons,
      'executability_output',
      'classification_output',
    ),
  )

  // Presentation boundary: adapter input arrays and rendered output content.
  const withheldAdapterInput = [
    ...(opportunity.executabilityReasons ?? []),
    ...(opportunity.preflightReasons ?? []),
    ...(opportunity.resBlockerReasons ?? []),
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))

  const strategyUnsafeReasonsInput = opportunity.executabilityReasons ?? []

  const withheldAdapterOutput = parseRenderedDiagnosticCodes(withheldAdapterInput.join('; '))
  const strategyUnsafeReasonsOutput = parseRenderedDiagnosticCodes(
    opportunity.strategyCardViewModel?.scaffold?.reasonCopyPasteIsUnsafe,
  )

  occurrences.push(
    ...collectOccurrences(
      withheldAdapterInput,
      'withheld_adapter_input',
      'presentation_input',
    ),
  )
  occurrences.push(
    ...collectOccurrences(
      strategyUnsafeReasonsInput,
      'strategy_unsafe_reasons_input',
      'presentation_input',
    ),
  )
  occurrences.push(
    ...collectOccurrences(
      withheldAdapterOutput,
      'withheld_adapter_output',
      'presentation_output',
    ),
  )
  occurrences.push(
    ...collectOccurrences(
      strategyUnsafeReasonsOutput,
      'strategy_unsafe_reasons_output',
      'presentation_output',
    ),
  )

  const byCode = new Map<string, DiagnosticOccurrence[]>()
  for (const occurrence of occurrences) {
    const list = byCode.get(occurrence.normalizedCode) ?? []
    list.push(occurrence)
    byCode.set(occurrence.normalizedCode, list)
  }

  const duplicateDiagnostics: DuplicateDiagnostic[] = []
  for (const [normalizedCode, list] of byCode) {
    const authoritativeSourceOccurrences = list.filter((o) => o.stage === 'authoritative_source')
    const classificationInputOccurrences = list.filter((o) => o.stage === 'classification_input')
    const classificationOutputOccurrences = list.filter((o) => o.stage === 'classification_output')
    const presentationInputOccurrences = list.filter((o) => o.stage === 'presentation_input')
    const presentationOutputOccurrences = list.filter((o) => o.stage === 'presentation_output')

    const sourceCounts = countByCollection(authoritativeSourceOccurrences)
    const boundary = classifyDiagnosticBoundary({
      sourceCountsByCollection: {
        preflight: sourceCounts.get('preflight') ?? 0,
        hydration: sourceCounts.get('hydration') ?? 0,
        resBlocker: sourceCounts.get('res_blocker') ?? 0,
      },
      classificationInputCount: classificationInputOccurrences.length,
      classificationOutputCount: classificationOutputOccurrences.length,
      presentationInputCount: presentationInputOccurrences.length,
      presentationOutputCount: presentationOutputOccurrences.length,
    })

    if (boundary.duplicationType === 'none') {
      continue
    }

    duplicateDiagnostics.push({
      normalizedCode,
      rawVariants: Array.from(new Set(list.map((o) => o.rawCode))),
      authoritativeSourceOccurrences,
      classificationInputOccurrences,
      classificationOutputOccurrences,
      presentationInputOccurrences,
      presentationOutputOccurrences,
      boundary,
    })
  }

  duplicateDiagnostics.sort((a, b) => a.normalizedCode.localeCompare(b.normalizedCode))

  const authoritativeSourceOccurrences = occurrences.filter(
    (o) => o.stage === 'authoritative_source',
  )
  const allAuthoritativeSourceCodes = Array.from(
    new Set(authoritativeSourceOccurrences.map((o) => o.rawCode)),
  )
  const authoritativeSourceCountByCode: Record<string, number> = {}
  for (const occurrence of occurrences) {
    if (occurrence.stage === 'authoritative_source') {
      authoritativeSourceCountByCode[occurrence.normalizedCode] =
        (authoritativeSourceCountByCode[occurrence.normalizedCode] ?? 0) + 1
    }
  }

  return {
    duplicateDiagnostics,
    allAuthoritativeSourceCodes,
    authoritativeSourceCountByCode,
    stageTotals: computeStageTotals(occurrences),
  }
}

function classifyNeedsTargetingEffect(
  opportunity: WorkbenchOpportunity,
  classification: WorkbenchExecutabilityClassification,
): WorkbenchOpportunityTelemetry['classification'] {
  const counterfactual = classifyWorkbenchExecutabilityDetailedWithoutNeedsTargeting(opportunity)

  const actualFinal = classification.finalDecision
  const counterfactualFinal = counterfactual.finalDecision
  const reasonsEqual = decisionsEqual(
    { ...actualFinal, reasons: actualFinal.reasons },
    { ...counterfactualFinal, reasons: counterfactualFinal.reasons },
  )

  let effect: WorkbenchOpportunityTelemetry['classification']['needsTargetingEffect'] = 'indeterminate'

  if (opportunity.readiness !== 'needs_targeting') {
    effect = 'none'
  } else if (
    classification.needsTargetingPromotionApplied &&
    classification.baseDecision.cardType === 'withheld' &&
    actualFinal.cardType === 'revision_strategy'
  ) {
    effect = 'promoted_from_withheld'
  } else if (
    counterfactualFinal.cardType === 'withheld' &&
    actualFinal.cardType === 'revision_strategy'
  ) {
    effect = 'downgrade_prevented'
  } else if (
    counterfactualFinal.cardType === actualFinal.cardType &&
    !reasonsEqual
  ) {
    effect = 'reason_merged'
  } else if (counterfactualFinal.cardType === actualFinal.cardType && reasonsEqual) {
    effect = 'none'
  } else {
    effect = 'indeterminate'
  }

  return {
    baseDecision: classification.baseDecision,
    needsTargetingPromotionApplied: classification.needsTargetingPromotionApplied,
    needsTargetingOverrideApplied: classification.needsTargetingOverrideApplied,
    transitionReason: classification.promotionTransitionReason,
    finalDecision: actualFinal,
    counterfactualWithoutNeedsTargeting: counterfactualFinal,
    needsTargetingEffect: effect,
  }
}

export function buildWorkbenchOpportunityTelemetry(
  opportunity: WorkbenchOpportunity,
  classification: WorkbenchExecutabilityClassification,
  queueBucket: WorkbenchOpportunityTelemetry['routing']['queueBucket'],
): WorkbenchOpportunityTelemetry {
  const classificationWithEffect = classifyNeedsTargetingEffect(opportunity, classification)
  const executabilityReasons = classification.finalDecision.reasons

  const withheldAdapterInput = [
    ...(opportunity.executabilityReasons ?? []),
    ...(opportunity.preflightReasons ?? []),
    ...(opportunity.resBlockerReasons ?? []),
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))

  const strategyUnsafeReasonsInput =
    opportunity.strategyCardViewModel?.scaffold?.reasonCopyPasteIsUnsafe?.trim()
      ? []
      : (opportunity.executabilityReasons ?? [])

  return {
    opportunityId: opportunity.id,
    sourceOpportunityId: (opportunity as any).sourceOpportunityId,
    sourceCriterion: (opportunity as any).sourceCriterion,
    criterion: opportunity.criterion,
    readiness: opportunity.readiness,
    sourceState: {
      groundingStatus: opportunity.groundingStatus,
      groundingNote: opportunity.groundingNote ?? null,
      contextQuality: opportunity.contextQuality,
      preflightStatus: opportunity.preflightStatus,
      readinessReason: opportunity.readinessReason ?? null,
      preflightNote: opportunity.preflightNote ?? null,
    },
    rawDiagnostics: {
      preflightReasons: opportunity.preflightReasons ?? [],
      hydrationFailureReasons: opportunity.hydrationFailureReasons ?? [],
      resBlockerReasons: opportunity.resBlockerReasons ?? [],
      adminRepairReason: opportunity.adminRepairReason ?? null,
      adminActions: opportunity.adminActions ?? [],
    },
    annotations: {
      readinessReason: opportunity.readinessReason ?? null,
      groundingNote: opportunity.groundingNote ?? null,
      preflightNote: opportunity.preflightNote ?? null,
      adminRepairReason: opportunity.adminRepairReason ?? null,
      adminActions: opportunity.adminActions ?? [],
    },
    gates: {
      copyPaste: classification.gates.copyPaste,
      strategy: classification.gates.strategy,
    },
    classification: classificationWithEffect,
    projectionDiagnostics: {
      executabilityReasons,
    },
    presentationDiagnostics: {
      withheldAdapterInput,
      strategyUnsafeReasonsInput,
    },
    deduplicationAnalysis: analyzeDiagnosticDuplication(opportunity, classification),
    routing: {
      queueBucket,
    },
  }
}

export function isAuditLogEnabled(): boolean {
  const value = process.env.REVISION_WORKBENCH_AUDIT_LOG
  return value === '1' || value === 'true' || value === 'yes'
}

function bucketForOpportunity(
  opportunity: WorkbenchOpportunity,
  buckets: {
    opportunities: Set<string>
    needsTargeting: Set<string>
    withheldUnsupported: Set<string>
  },
): WorkbenchQueueOpportunityAudit['queueBucket'] {
  if (buckets.opportunities.has(opportunity.id)) return 'opportunities'
  if (buckets.needsTargeting.has(opportunity.id)) return 'needsTargeting'
  if (buckets.withheldUnsupported.has(opportunity.id)) return 'withheldUnsupported'
  return 'unknown'
}

function reasonForBucketOverride(
  opportunity: WorkbenchOpportunity,
  queueBucket: WorkbenchQueueOpportunityAudit['queueBucket'],
): string | null {
  if (opportunity.cardType === 'withheld' && queueBucket !== 'withheldUnsupported') {
    return `withheld card routed to '${queueBucket}' because readiness === '${opportunity.readiness ?? 'unknown'}' took precedence over cardType in partitionWorkbenchQueue`
  }
  return null
}

export function buildWorkbenchQueueAudit(
  payload: WorkbenchQueuePayload,
  context?: {
    ledgerArtifactId?: string | null
    admissionsById?: Map<string, WorkbenchAdmissionDetails>
    classificationsById?: Map<string, WorkbenchExecutabilityClassification>
  },
): WorkbenchQueueAuditReport {
  const opportunityIds = new Map<string, WorkbenchOpportunity>()
  for (const opportunity of payload.opportunities) opportunityIds.set(opportunity.id, opportunity)
  for (const opportunity of payload.needsTargeting) opportunityIds.set(opportunity.id, opportunity)
  for (const opportunity of payload.withheldUnsupported) opportunityIds.set(opportunity.id, opportunity)

  const bucketById = {
    opportunities: new Set(payload.opportunities.map((o) => o.id)),
    needsTargeting: new Set(payload.needsTargeting.map((o) => o.id)),
    withheldUnsupported: new Set(payload.withheldUnsupported.map((o) => o.id)),
  }

  const orderedOpportunityIds = [
    ...payload.opportunities,
    ...payload.needsTargeting,
    ...payload.withheldUnsupported,
  ].map((opportunity) => opportunity.id)

  const identityHash = hashOrderedOpportunityIds(orderedOpportunityIds)

  const projectionEntries = orderedOpportunityIds.map((id) => {
    const opportunity = opportunityIds.get(id)
    const admission = context?.admissionsById?.get(id)
    const queueBucket = opportunity ? bucketForOpportunity(opportunity, bucketById) : 'unknown'
    return [
      id,
      queueBucket,
      opportunity?.cardType ?? null,
      opportunity?.trustedPathStatus ?? null,
      admission?.copyPasteAdmissionPassed ?? false,
      normalizedAdmissionReasons(admission?.copyPasteAdmissionReasons),
      admission?.strategyAdmissionPassed ?? false,
      normalizedAdmissionReasons(admission?.strategyAdmissionReasons),
    ]
  })

  const projectionHash = hashProjection(projectionEntries)
  const ledgerArtifactId =
    context?.ledgerArtifactId ?? payload.revisionPackage?.revision_opportunity_ledger_artifact_id ?? null
  const modeContractSource = payload.modeContract?.source ?? null
  const modeContractEvaluationMode = payload.modeContract?.evaluation_mode ?? null

  const opportunities: WorkbenchQueueOpportunityAudit[] = orderedOpportunityIds.map((id) => {
    const opportunity = opportunityIds.get(id)
    if (!opportunity) {
      return {
        opportunityId: id,
        criterion: 'unknown',
        evidenceLocationScope: 'Passage',
        repairScope: 'Passage',
        revisionOperation: 'unknown',
        groundingStatus: null,
        contextQuality: null,
        preflightStatus: null,
        readiness: null,
        copyPasteAdmissionPassed: false,
        copyPasteAdmissionReasons: ['opportunity_not_found_in_payload'],
        strategyAdmissionPassed: false,
        strategyAdmissionReasons: ['opportunity_not_found_in_payload'],
        finalCardType: 'unknown',
        queueBucket: bucketById.opportunities.has(id)
          ? 'opportunities'
          : bucketById.needsTargeting.has(id)
            ? 'needsTargeting'
            : bucketById.withheldUnsupported.has(id)
              ? 'withheldUnsupported'
              : 'unknown',
        reasonForBucketOverride: null,
      }
    }

    const admission = context?.admissionsById?.get(id)
    const queueBucket = bucketForOpportunity(opportunity, bucketById)

    return {
      opportunityId: opportunity.id,
      criterion: opportunity.criterion,
      evidenceLocationScope: opportunity.evidenceLocationScope ?? opportunity.scope ?? 'Passage',
      repairScope: opportunity.repairScope ?? opportunity.scope ?? 'Passage',
      revisionOperation: opportunity.revisionOperation,
      groundingStatus: opportunity.groundingStatus,
      contextQuality: opportunity.contextQuality,
      preflightStatus: opportunity.preflightStatus,
      readiness: opportunity.readiness,
      copyPasteAdmissionPassed: admission?.copyPasteAdmissionPassed ?? false,
      copyPasteAdmissionReasons: admission?.copyPasteAdmissionReasons ?? [],
      strategyAdmissionPassed: admission?.strategyAdmissionPassed ?? false,
      strategyAdmissionReasons: admission?.strategyAdmissionReasons ?? [],
      finalCardType: opportunity.cardType,
      queueBucket,
      reasonForBucketOverride: reasonForBucketOverride(opportunity, queueBucket),
    }
  })

  const opportunityTelemetry: WorkbenchOpportunityTelemetry[] = []
  if (context?.classificationsById) {
    for (const id of orderedOpportunityIds) {
      const opportunity = opportunityIds.get(id)
      const classification = context.classificationsById.get(id)
      if (!opportunity || !classification) continue
      const queueBucket = opportunity
        ? bucketForOpportunity(opportunity, bucketById)
        : 'unknown'
      opportunityTelemetry.push(
        buildWorkbenchOpportunityTelemetry(opportunity, classification, queueBucket),
      )
    }
  }

  return {
    type: 'workbench-queue-audit',
    load: {
      evaluationJobId: payload.evaluationJobId,
      ledgerArtifactId,
      classifierVersion: REVISION_WORKBENCH_QUEUE_CLASSIFIER_VERSION,
      modeContractSource,
      modeContractEvaluationMode,
      identityHash,
      projectionHash,
      orderedOpportunityIds,
      bucketCounts: {
        opportunities: payload.opportunities.length,
        needsTargeting: payload.needsTargeting.length,
        withheldUnsupported: payload.withheldUnsupported.length,
      },
      timestamp: new Date().toISOString(),
    },
    opportunities,
    opportunityTelemetry,
  }
}

export function logWorkbenchQueueAudit(report: WorkbenchQueueAuditReport): void {
  if (!isAuditLogEnabled()) return
  console.info('[REVISION_WORKBENCH_AUDIT]', JSON.stringify(report))
}

export type RevisionLedgerAudit = {
  type: 'revision-ledger-audit'
  action: 'sync' | 'read'
  evaluationJobId: string
  manuscriptId: string | number
  decisionCount: number
  decisionIds: string[]
  timestamp: string
}

export function logRevisionLedgerAudit(audit: RevisionLedgerAudit): void {
  if (!isAuditLogEnabled()) return
  console.info('[REVISION_WORKBENCH_AUDIT]', JSON.stringify(audit))
}
