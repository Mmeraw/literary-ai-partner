#!/usr/bin/env tsx
/**
 * Operator-only diagnostic audit for evaluation b099a623.
 *
 * Run with:
 *   REVISION_WORKBENCH_AUDIT_LOG=1 \
 *   WORKER_ALLOW_SERVICE_ROLE_DEV=1 \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx tsx -r ./scripts/pipeline/stub-server-only.cjs -r tsconfig-paths/register scripts/audit-b099a623.ts
 *
 * This script does not change classification, persistence, or UI behavior.
 * It loads the canonical workbench queue projection for manuscript 7519
 * twice and emits per-opportunity / per-load audit diagnostics to stdout
 * and to `.tmp/audit-b099a623-workbench.json`.
 *
 * Limitation: two sequential calls in the same process prove short-window
 * canonical-projection stability; they do not prove stability across browser
 * reloads, deployments, hydration states, or cached sessions.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue'
import { listRevisionLedgerDecisions } from '@/lib/revision/ledger'
import { classifyWorkbenchExecutability } from '@/lib/revision/workbenchQueueProjection'
import { buildWorkbenchQueueAudit, type WorkbenchAdmissionDetails } from '@/lib/revision/workbenchQueueAudit'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PRODUCTION_SUPABASE_URL = 'https://xtumxjnzdswuumndcbwc.supabase.co'
const MANUSCRIPT_ID = '7519'
const EVALUATION_JOB_ID = 'b099a623-6c01-4564-9984-e06151fcb1e4'

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? PRODUCTION_SUPABASE_URL
process.env.REVISION_WORKBENCH_AUDIT_LOG = process.env.REVISION_WORKBENCH_AUDIT_LOG ?? '1'
process.env.WORKER_ALLOW_SERVICE_ROLE_DEV = process.env.WORKER_ALLOW_SERVICE_ROLE_DEV ?? '1'

function buildAdmissionsById(payload: Awaited<ReturnType<typeof getWorkbenchQueue>>): Map<string, WorkbenchAdmissionDetails> {
  const admissions = new Map<string, WorkbenchAdmissionDetails>()
  const all = [...payload.opportunities, ...payload.needsTargeting, ...payload.withheldUnsupported]
  for (const opportunity of all) {
    const executability = classifyWorkbenchExecutability(opportunity)
    admissions.set(opportunity.id, {
      copyPasteAdmissionPassed: executability.copyPasteAdmissionPassed,
      copyPasteAdmissionReasons: executability.copyPasteAdmissionReasons,
      strategyAdmissionPassed: executability.strategyAdmissionPassed,
      strategyAdmissionReasons: executability.strategyAdmissionReasons,
    })
  }
  return admissions
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
    console.error('Failed to locate manuscript 7519:', manuscriptError?.message ?? 'not found')
    process.exit(1)
  }

  const ownerId = typeof manuscript.user_id === 'string' ? manuscript.user_id : null
  if (!ownerId) {
    console.error('Manuscript 7519 has no user_id')
    process.exit(1)
  }

  const user = { id: ownerId, email: null }

  console.error('[audit] loading workbench queue for b099a623...')
  const first = await getWorkbenchQueue({
    user,
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
  })

  if (!first.ok) {
    console.error('[audit] getWorkbenchQueue failed:', first.error)
    process.exit(1)
  }

  console.error('[audit] reloading workbench queue to check short-window canonical projection stability...')
  const second = await getWorkbenchQueue({
    user,
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
  })

  console.error('[audit] loading ledger decisions...')
  const decisions = await listRevisionLedgerDecisions({
    user,
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
  })

  const firstAdmissions = buildAdmissionsById(first)
  const secondAdmissions = buildAdmissionsById(second)

  const firstReport = buildWorkbenchQueueAudit(first, {
    ledgerArtifactId: first.revisionPackage?.revision_opportunity_ledger_artifact_id ?? null,
    admissionsById: firstAdmissions,
  })
  const secondReport = buildWorkbenchQueueAudit(second, {
    ledgerArtifactId: second.revisionPackage?.revision_opportunity_ledger_artifact_id ?? null,
    admissionsById: secondAdmissions,
  })

  const summary = {
    type: 'b099a623-audit-summary',
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
    firstLoadIdentityHash: firstReport.load.identityHash,
    secondLoadIdentityHash: secondReport.load.identityHash,
    identityHashesMatch: firstReport.load.identityHash === secondReport.load.identityHash,
    firstLoadProjectionHash: firstReport.load.projectionHash,
    secondLoadProjectionHash: secondReport.load.projectionHash,
    projectionHashesMatch: firstReport.load.projectionHash === secondReport.load.projectionHash,
    firstOpportunityCount: firstReport.load.orderedOpportunityIds.length,
    secondOpportunityCount: secondReport.load.orderedOpportunityIds.length,
    opportunityIdsMatch:
      JSON.stringify(firstReport.load.orderedOpportunityIds) ===
      JSON.stringify(secondReport.load.orderedOpportunityIds),
    bucketCounts: firstReport.load.bucketCounts,
    ledgerDecisionCount: decisions.length,
    ledgerDecisionIds: decisions.map((d) => d.opportunity_id),
    note: 'Two sequential calls in one process prove short-window canonical projection stability, not cross-browser-reload/deployment stability.',
    firstReport,
    secondReport,
  }

  console.log(JSON.stringify(summary, null, 2))

  const outDir = resolve(process.cwd(), '.tmp')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'audit-b099a623-workbench.json')
  writeFileSync(outPath, JSON.stringify(summary, null, 2))
  console.error('[audit] wrote report to', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
