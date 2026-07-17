#!/usr/bin/env tsx
/**
 * Phase A workbench telemetry audit.
 *
 * Run with:
 *   MANUSCRIPT_ID=7519 \
 *   EVALUATION_JOB_ID=9ee70f12-1e8d-4729-9163-5eb9845b70b1 \
 *   REVISION_WORKBENCH_AUDIT_LOG=1 \
 *   WORKER_ALLOW_SERVICE_ROLE_DEV=1 \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx tsx -r ./scripts/pipeline/stub-server-only.cjs -r tsconfig-paths/register scripts/audit-phase-a-workbench-telemetry.ts
 *
 * Scope is observability only. It does not change classification, routing, or UI.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue'
import { listRevisionLedgerDecisions } from '@/lib/revision/ledger'
import { classifyWorkbenchExecutabilityDetailed } from '@/lib/revision/workbenchQueueProjection'
import { buildWorkbenchQueueAudit } from '@/lib/revision/workbenchQueueAudit'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PRODUCTION_SUPABASE_URL = 'https://xtumxjnzdswuumndcbwc.supabase.co'
const MANUSCRIPT_ID = process.env.MANUSCRIPT_ID ?? '7519'
const EVALUATION_JOB_ID = process.env.EVALUATION_JOB_ID ?? '9ee70f12-1e8d-4729-9163-5eb9845b70b1'

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? PRODUCTION_SUPABASE_URL
process.env.REVISION_WORKBENCH_AUDIT_LOG = process.env.REVISION_WORKBENCH_AUDIT_LOG ?? '1'
process.env.WORKER_ALLOW_SERVICE_ROLE_DEV = process.env.WORKER_ALLOW_SERVICE_ROLE_DEV ?? '1'

function classifyAll(opportunities: Awaited<ReturnType<typeof getWorkbenchQueue>>) {
  const classifications = new Map()
  const all = [...opportunities.opportunities, ...opportunities.needsTargeting, ...opportunities.withheldUnsupported]
  for (const opportunity of all) {
    const detailed = classifyWorkbenchExecutabilityDetailed(opportunity)
    classifications.set(opportunity.id, detailed)
  }
  return classifications
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createAdminClient()

  const { data: manuscript, error: manuscriptError } = await supabase
    .from('manuscripts')
    .select('id, user_id')
    .eq('id', Number(MANUSCRIPT_ID))
    .maybeSingle()

  if (manuscriptError || !manuscript) {
    console.error(`Failed to locate manuscript ${MANUSCRIPT_ID}:`, manuscriptError?.message ?? 'not found')
    process.exit(1)
  }

  const ownerId = typeof manuscript.user_id === 'string' ? manuscript.user_id : null
  if (!ownerId) {
    console.error(`Manuscript ${MANUSCRIPT_ID} has no user_id`)
    process.exit(1)
  }

  const user = { id: ownerId, email: null }

  console.error(`[audit] loading workbench queue for ${EVALUATION_JOB_ID}...`)
  const first = await getWorkbenchQueue({ user, manuscriptId: MANUSCRIPT_ID, evaluationJobId: EVALUATION_JOB_ID })

  if (!first.ok) {
    console.error('[audit] getWorkbenchQueue failed:', first.error)
    process.exit(1)
  }

  console.error('[audit] reloading workbench queue to check short-window stability...')
  const second = await getWorkbenchQueue({ user, manuscriptId: MANUSCRIPT_ID, evaluationJobId: EVALUATION_JOB_ID })

  console.error('[audit] loading ledger decisions...')
  const decisions = await listRevisionLedgerDecisions({ user, manuscriptId: MANUSCRIPT_ID, evaluationJobId: EVALUATION_JOB_ID })

  const firstClassifications = classifyAll(first)
  const secondClassifications = classifyAll(second)

  const admissionsById = new Map()
  for (const [id, classification] of firstClassifications) {
    admissionsById.set(id, {
      copyPasteAdmissionPassed: classification.copyPasteAdmissionPassed,
      copyPasteAdmissionReasons: classification.copyPasteAdmissionReasons,
      strategyAdmissionPassed: classification.strategyAdmissionPassed,
      strategyAdmissionReasons: classification.strategyAdmissionReasons,
    })
  }

  const firstReport = buildWorkbenchQueueAudit(first, {
    ledgerArtifactId: first.revisionPackage?.revision_opportunity_ledger_artifact_id ?? null,
    admissionsById,
    classificationsById: firstClassifications,
  })
  const secondReport = buildWorkbenchQueueAudit(second, {
    ledgerArtifactId: second.revisionPackage?.revision_opportunity_ledger_artifact_id ?? null,
    admissionsById,
    classificationsById: secondClassifications,
  })

  const allFirst = [...first.opportunities, ...first.needsTargeting, ...first.withheldUnsupported]
  const truePromotions = firstReport.opportunityTelemetry?.filter(
    (t) => t.classification.needsTargetingPromotionApplied,
  ) ?? []

  const duplicateFindings = (firstReport.opportunityTelemetry ?? []).flatMap((t) =>
    t.deduplicationAnalysis.duplicateDiagnostics.map((dup) => ({
      opportunityId: t.opportunityId,
      criterion: t.criterion,
      normalizedCode: dup.normalizedCode,
      rawVariants: dup.rawVariants,
      duplicationType: dup.boundary.duplicationType,
      boundary: dup.boundary,
      authoritativeSourceOccurrences: dup.authoritativeSourceOccurrences,
      classificationInputOccurrences: dup.classificationInputOccurrences,
      classificationOutputOccurrences: dup.classificationOutputOccurrences,
      presentationInputOccurrences: dup.presentationInputOccurrences,
      presentationOutputOccurrences: dup.presentationOutputOccurrences,
    })),
  )

  const contradictions = (firstReport.opportunityTelemetry ?? []).filter((t) => {
    const bucketMismatch =
      (t.classification.finalDecision.cardType === 'withheld' && t.routing.queueBucket !== 'withheldUnsupported') ||
      (t.classification.finalDecision.cardType === 'revision_strategy' && t.routing.queueBucket !== 'needsTargeting') ||
      (t.classification.finalDecision.cardType === 'copy_paste_rewrite' && t.routing.queueBucket !== 'opportunities')
    return bucketMismatch
  })

  const summary = {
    type: 'phase-a-workbench-telemetry-summary',
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
    firstLoadIdentityHash: firstReport.load.identityHash,
    secondLoadIdentityHash: secondReport.load.identityHash,
    identityHashesMatch: firstReport.load.identityHash === secondReport.load.identityHash,
    firstLoadProjectionHash: firstReport.load.projectionHash,
    secondLoadProjectionHash: secondReport.load.projectionHash,
    projectionHashesMatch: firstReport.load.projectionHash === secondReport.load.projectionHash,
    bucketCounts: firstReport.load.bucketCounts,
    queueTotals: {
      opportunities: first.opportunities.length,
      needsTargeting: first.needsTargeting.length,
      withheldUnsupported: first.withheldUnsupported.length,
      total: allFirst.length,
    },
    ledgerDecisionCount: decisions.length,
    ledgerDecisionIds: decisions.map((d) => d.opportunity_id),
    truePromotionCount: truePromotions.length,
    truePromotions: truePromotions.map((t) => ({
      opportunityId: t.opportunityId,
      criterion: t.criterion,
      baseCardType: t.classification.baseDecision.cardType,
      finalCardType: t.classification.finalDecision.cardType,
      transitionReason: t.classification.transitionReason,
    })),
    duplicateDiagnosticCount: duplicateFindings.length,
    duplicateDiagnostics: duplicateFindings,
    contradictionCount: contradictions.length,
    contradictions: contradictions.map((t) => ({
      opportunityId: t.opportunityId,
      criterion: t.criterion,
      finalCardType: t.classification.finalDecision.cardType,
      queueBucket: t.routing.queueBucket,
    })),
    firstReport,
    secondReport,
    note: 'Phase A observability only. No classification or routing behavior was changed.',
  }

  console.log(JSON.stringify(summary, null, 2))

  const outDir = resolve(process.cwd(), '.tmp')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `audit-phase-a-${EVALUATION_JOB_ID}.json`)
  writeFileSync(outPath, JSON.stringify(summary, null, 2))
  console.error('[audit] wrote report to', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
