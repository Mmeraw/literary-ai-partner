#!/usr/bin/env tsx
/**
 * Operator-only ledger persistence proof for evaluation b099a623.
 *
 * Run a controlled deferred decision end-to-end and compare write, read-back,
 * list, Final Review, and workbench reopen paths. If write mode is enabled,
 * the script inserts a temporary deferred row, verifies it round-trips, and
 * deletes it.
 *
 *   LEDGER_PERSISTENCE_WRITE_PROOF=1 \
 *   WORKER_ALLOW_SERVICE_ROLE_DEV=1 \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx tsx -r ./scripts/pipeline/stub-server-only.cjs -r tsconfig-paths/register scripts/audit-ledger-persistence-b099a623.ts
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';
import {
  listRevisionLedgerDecisions,
  syncRevisionLedgerDecisions,
  type SyncRevisionLedgerEntryInput,
} from '@/lib/revision/ledger';
import { getFinalReviewPayload } from '@/lib/revision/finalReview';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRODUCTION_SUPABASE_URL = 'https://xtumxjnzdswuumndcbwc.supabase.co';
const MANUSCRIPT_ID = '7519';
const EVALUATION_JOB_ID = 'b099a623-6c01-4564-9984-e06151fcb1e4';
const TEST_OPPORTUNITY_ID = 'OPP-001';

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? PRODUCTION_SUPABASE_URL;
process.env.WORKER_ALLOW_SERVICE_ROLE_DEV = process.env.WORKER_ALLOW_SERVICE_ROLE_DEV ?? '1';

const writeMode = process.env.LEDGER_PERSISTENCE_WRITE_PROOF === '1';

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createAdminClient();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from('manuscripts')
    .select('id, user_id, title')
    .eq('id', Number(MANUSCRIPT_ID))
    .maybeSingle();

  if (manuscriptError || !manuscript) {
    console.error('Failed to locate manuscript', MANUSCRIPT_ID, manuscriptError?.message ?? 'not found');
    process.exit(1);
  }

  const ownerId = typeof manuscript.user_id === 'string' ? manuscript.user_id : null;
  if (!ownerId) {
    console.error('Manuscript has no user_id');
    process.exit(1);
  }

  const user = { id: ownerId, email: null as string | null };

  console.error('[proof] loading canonical workbench queue for', EVALUATION_JOB_ID);
  const queue = await getWorkbenchQueue({
    user,
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
  });

  if (!queue.ok) {
    console.error('[proof] getWorkbenchQueue failed:', queue.error);
    process.exit(1);
  }

  const allOpportunities = [...queue.opportunities, ...queue.needsTargeting, ...queue.withheldUnsupported];
  const targetOpportunity = allOpportunities.find((o) => o.id === TEST_OPPORTUNITY_ID);

  if (!targetOpportunity) {
    console.error('[proof] target opportunity', TEST_OPPORTUNITY_ID, 'not found in canonical queue');
    console.error('[proof] available ids:', allOpportunities.map((o) => o.id).join(', '));
    process.exit(1);
  }

  console.error('[proof] loading ledger decisions before write...');
  const beforeList = await listRevisionLedgerDecisions({
    user,
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
  });

  const beforeFinalReview = await getFinalReviewPayload({
    user,
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
  });

  let writtenRow: { id: string; local_id: string; opportunity_id: string } | null = null;
  let afterList = beforeList;
  let afterFinalReview = beforeFinalReview;

  if (writeMode) {
    const localId = `local-ledger-proof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: SyncRevisionLedgerEntryInput = {
      localId,
      opportunityId: targetOpportunity.id,
      opportunityTitle: targetOpportunity.title ?? targetOpportunity.issueStatement ?? targetOpportunity.id,
      decision: 'deferred',
      selectedText: 'Deferred for later decision',
      sourceExcerpt: targetOpportunity.quoteHighlight ?? targetOpportunity.quoteRest ?? '',
      sourceLocation: targetOpportunity.anchor ?? '',
      clientCreatedAt: new Date().toISOString(),
      metadata: {
        criterion: targetOpportunity.criterion,
        cardType: targetOpportunity.cardType,
        trustedPathStatus: targetOpportunity.trustedPathStatus,
      },
    };

    console.error('[proof] writing temporary deferred decision for', TEST_OPPORTUNITY_ID, 'localId', localId);
    const synced = await syncRevisionLedgerDecisions({
      user,
      manuscriptId: MANUSCRIPT_ID,
      evaluationJobId: EVALUATION_JOB_ID,
      entries: [entry],
    });

    if (synced.length !== 1) {
      console.error('[proof] sync did not return the expected row');
      process.exit(1);
    }

    writtenRow = {
      id: synced[0].id,
      local_id: synced[0].local_id,
      opportunity_id: synced[0].opportunity_id,
    };

    console.error('[proof] canonical read-back succeeded:', writtenRow);

    afterList = await listRevisionLedgerDecisions({
      user,
      manuscriptId: MANUSCRIPT_ID,
      evaluationJobId: EVALUATION_JOB_ID,
    });

    afterFinalReview = await getFinalReviewPayload({
      user,
      manuscriptId: MANUSCRIPT_ID,
      evaluationJobId: EVALUATION_JOB_ID,
    });

    console.error('[proof] cleaning up temporary row', writtenRow.id);
    const { error: deleteError } = await supabase
      .from('revision_ledger_decisions')
      .delete()
      .eq('id', writtenRow.id);

    if (deleteError) {
      console.error('[proof] failed to delete temporary row:', deleteError.message);
      console.error('[proof] manual cleanup required:', writtenRow);
      process.exit(1);
    }
  } else {
    console.error('[proof] write mode disabled (set LEDGER_PERSISTENCE_WRITE_PROOF=1 to write a temporary row)');
  }

  const report = {
    type: 'ledger-persistence-b099a623-proof',
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: EVALUATION_JOB_ID,
    ownerId,
    manuscriptTitle: manuscript.title ?? null,
    writeMode,
    targetOpportunityId: targetOpportunity.id,
    targetOpportunityBucket: queue.opportunities.some((o) => o.id === TEST_OPPORTUNITY_ID)
      ? 'opportunities'
      : queue.needsTargeting.some((o) => o.id === TEST_OPPORTUNITY_ID)
        ? 'needsTargeting'
        : queue.withheldUnsupported.some((o) => o.id === TEST_OPPORTUNITY_ID)
          ? 'withheldUnsupported'
          : 'unknown',
    beforeWrite: {
      listDecisionCount: beforeList.length,
      listDecisionIds: beforeList.map((d) => d.opportunity_id),
      finalReviewDeferredCount: beforeFinalReview.deferredCount,
      finalReviewDecisionIds: beforeFinalReview.decisions.map((d) => d.opportunityId),
    },
    afterWrite: writeMode
      ? {
          temporaryRow: writtenRow,
          listDecisionCount: afterList.length,
          listDecisionIds: afterList.map((d) => d.opportunity_id),
          finalReviewDeferredCount: afterFinalReview.deferredCount,
          finalReviewDecisionIds: afterFinalReview.decisions.map((d) => d.opportunityId),
        }
      : null,
    invariant: writeMode
      ? {
          synced: afterList.some((d) => d.opportunity_id === TEST_OPPORTUNITY_ID),
          finalReview: afterFinalReview.decisions.some((d) => d.opportunityId === TEST_OPPORTUNITY_ID),
        }
      : null,
    note: 'Write-mode proof inserts a temporary deferred row and removes it. Read-only mode still shows the pre-existing persisted state.',
  };

  console.log(JSON.stringify(report, null, 2));

  const outDir = resolve(process.cwd(), 'logs');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'ledger-persistence-b099a623.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.error('[proof] wrote report to', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
