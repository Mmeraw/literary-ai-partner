/**
 * Durable completion authority for the targeted Held Recovery production proof.
 *
 * Reconstruction/Readmission completion is not rewritten as a fictitious
 * executor attempt. Instead, this boundary verifies the canonical Readmission
 * result, advances the existing queue authority, reloads the canonical
 * Workbench projection, and advances to reclassified only when exactly one
 * terminal projection exists.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ReadmissionResult } from './heldRecoveryReconstructionReadmission'
import {
  applyHeldQueueTransition,
  createSupabaseHeldQueueTransitionPersistenceAdapter,
  type HeldQueueTransitionPersistenceAdapter,
  type HeldQueueTransitionWriteResult,
} from './heldRecoveryQueueTransitionWriter'
import {
  decideHeldQueueTransitionFromAuthority,
  type HeldQueueState,
  type HeldQueueTransitionDecision,
} from './heldRecoveryQueueTransitionPolicy'
import {
  getWorkbenchQueueForHeldRecoveryReadmission,
  type WorkbenchQueuePayload,
} from './workbenchQueue'
import type { ClassifiedWorkbenchOpportunity } from './workbenchQueueProjection'

type QueueAuthority = {
  readonly state: HeldQueueState
  readonly authorityVersion: string
}

export type CompleteHeldRecoveryProductionAuthorityResult =
  | { readonly status: 'readmission_not_authoritative'; readonly readmissionStatus: ReadmissionResult['status'] }
  | { readonly status: 'already_reclassified'; readonly finalCardType?: string }
  | {
      readonly status: 'reclassified'
      readonly finalCardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld'
      readonly recoveredTransition: HeldQueueTransitionWriteResult | null
      readonly reclassifiedTransition: HeldQueueTransitionWriteResult
    }

export type HeldRecoveryProductionCompletionDependencies = {
  readonly supabase?: SupabaseClient
  readonly loadQueueAuthority?: (input: {
    readonly jobId: string
    readonly heldItemId: string
    readonly opportunityId: string
  }) => Promise<QueueAuthority | null>
  readonly applyTransition?: HeldQueueTransitionPersistenceAdapter['applyAllowedTransition']
  readonly loadWorkbench?: () => Promise<WorkbenchQueuePayload>
}

function acceptedReadmission(result: ReadmissionResult): boolean {
  return result.status === 'admitted' || result.status === 'not_admitted' || result.status === 'unchanged'
}

function allowedDecision(
  from: HeldQueueState,
  to: HeldQueueState,
  authorityVersion: string,
): HeldQueueTransitionDecision & { readonly allowed: true } {
  const decision = decideHeldQueueTransitionFromAuthority({
    from,
    requestedTo: to,
    authorityVersion,
  })
  if (!decision.allowed) {
    throw new Error(
      `Held Recovery completion transition denied: ${from} -> ${to} (${decision.reason})`,
    )
  }
  return decision
}

function successfulTransition(
  result: HeldQueueTransitionWriteResult,
  expected: string,
): Extract<HeldQueueTransitionWriteResult, { status: 'applied' | 'already_applied' }> {
  if (result.status !== 'applied' && result.status !== 'already_applied') {
    throw new Error(`Held Recovery ${expected} transition failed closed: ${result.status}`)
  }
  return result
}

function terminalProjection(
  queue: WorkbenchQueuePayload,
  opportunityId: string,
): ClassifiedWorkbenchOpportunity {
  if (!queue.ok) throw new Error(queue.error ?? 'Held Recovery Workbench projection failed')
  const matches = [
    ...queue.opportunities,
    ...queue.needsTargeting,
    ...queue.withheldUnsupported,
  ].filter((opportunity) => opportunity.id === opportunityId) as ClassifiedWorkbenchOpportunity[]
  if (matches.length !== 1) {
    throw new Error(`Held Recovery Workbench authority count is ${matches.length}, expected 1`)
  }
  const projected = matches[0]
  const cardType = projected.finalDecision?.cardType
  if (
    cardType !== 'copy_paste_rewrite' &&
    cardType !== 'revision_strategy' &&
    cardType !== 'withheld'
  ) {
    throw new Error('Held Recovery Workbench finalDecision authority is missing')
  }
  return projected
}

async function loadQueueAuthority(
  supabase: Pick<SupabaseClient, 'from'>,
  input: { readonly jobId: string; readonly heldItemId: string; readonly opportunityId: string },
): Promise<QueueAuthority | null> {
  const { data, error } = await supabase
    .from('held_recovery_queue_items')
    .select('queue_state,authority_version,evaluation_job_id,opportunity_id')
    .eq('held_item_id', input.heldItemId)
    .maybeSingle()
  if (error) throw new Error(`Held Recovery queue authority read failed: ${error.message}`)
  if (!data) return null
  if (data.evaluation_job_id !== input.jobId || data.opportunity_id !== input.opportunityId) {
    throw new Error('Held Recovery queue authority identity mismatch')
  }
  if (typeof data.authority_version !== 'string' || !data.authority_version) {
    throw new Error('Held Recovery queue authority version is missing')
  }
  return {
    state: data.queue_state as HeldQueueState,
    authorityVersion: data.authority_version,
  }
}

export async function completeHeldRecoveryProductionAuthority(
  input: {
    readonly jobId: string
    readonly heldItemId: string
    readonly opportunityId: string
    readonly manuscriptId: string
    readonly userId: string
    readonly readmission: ReadmissionResult
  },
  dependencies: HeldRecoveryProductionCompletionDependencies = {},
): Promise<CompleteHeldRecoveryProductionAuthorityResult> {
  if (!acceptedReadmission(input.readmission)) {
    return {
      status: 'readmission_not_authoritative',
      readmissionStatus: input.readmission.status,
    }
  }

  const supabase = dependencies.supabase ?? createAdminClient()
  let authority = await (dependencies.loadQueueAuthority ?? ((identity) =>
    loadQueueAuthority(supabase, identity)))(input)
  if (!authority) throw new Error('Held Recovery queue authority is missing')

  const workbench = dependencies.loadWorkbench ?? (() =>
    getWorkbenchQueueForHeldRecoveryReadmission({
      manuscriptId: input.manuscriptId,
      evaluationJobId: input.jobId,
      user: { id: input.userId },
    }))

  if (authority.state === 'reclassified') {
    const projected = terminalProjection(await workbench(), input.opportunityId)
    return { status: 'already_reclassified', finalCardType: projected.finalDecision.cardType }
  }
  if (
    authority.state !== 'recovery_attempt_running' &&
    authority.state !== 'recovered_pending_reclassification'
  ) {
    throw new Error(`Held Recovery completion found unexpected queue state: ${authority.state}`)
  }

  const persistence: HeldQueueTransitionPersistenceAdapter = {
    applyAllowedTransition: dependencies.applyTransition ??
      createSupabaseHeldQueueTransitionPersistenceAdapter(supabase).applyAllowedTransition,
  }

  let recoveredTransition: HeldQueueTransitionWriteResult | null
  if (authority.state === 'recovery_attempt_running') {
    recoveredTransition = await applyHeldQueueTransition(persistence, {
      heldItemId: input.heldItemId,
      decision: allowedDecision(
        'recovery_attempt_running',
        'recovered_pending_reclassification',
        authority.authorityVersion,
      ),
    })
    const successful = successfulTransition(recoveredTransition, 'reconstruction-complete')
    authority = {
      state: 'recovered_pending_reclassification',
      authorityVersion: successful.record.nextAuthorityVersion,
    }
  } else {
    // Replay resumes from the persisted authority. Do not manufacture a
    // transition record merely to make the return shape look symmetrical.
    recoveredTransition = null
  }

  const projected = terminalProjection(await workbench(), input.opportunityId)
  const reclassifiedTransition = await applyHeldQueueTransition(persistence, {
    heldItemId: input.heldItemId,
    decision: allowedDecision(
      'recovered_pending_reclassification',
      'reclassified',
      authority.authorityVersion,
    ),
  })
  successfulTransition(reclassifiedTransition, 'reclassification')

  return {
    status: 'reclassified',
    finalCardType: projected.finalDecision.cardType,
    recoveredTransition,
    reclassifiedTransition,
  }
}
