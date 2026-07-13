/**
 * Workbench Queue Audit — instrumentation-only, no behavior change.
 *
 * Emits structured per-opportunity and per-load diagnostics for the Revise
 * Workbench queue. The goal is to make classification, admission, and queue
 * identity observable so we can diagnose b099a623 (17/17 withheld) and the
 * reported non-deterministic queue / ledger persistence issues.
 */

import type { WorkbenchOpportunity, WorkbenchQueuePayload, WorkbenchScope } from './workbenchQueue'

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
