import { createAdminClient } from '@/lib/supabase/admin';
import { cancelEvaluationAsUser, type UserCancelResult } from '@/lib/jobs/userCancel';

/**
 * The phrase is deliberately server-owned: the client must prove intent but
 * cannot choose a broader cancellation scope or cancellation actor.
 */
export const OWNER_EMERGENCY_CANCEL_CONFIRMATION = 'CANCEL ALL ACTIVE EVALUATIONS';
const MAX_SNAPSHOT_JOBS = 500;

type ActiveJob = {
  id: string;
  manuscripts: { user_id: string | null } | Array<{ user_id: string | null }> | null;
};

function ownerIdOf(job: ActiveJob): string | null {
  const manuscripts = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  return typeof manuscripts?.user_id === 'string' && manuscripts.user_id.trim()
    ? manuscripts.user_id.trim()
    : null;
}

export type OwnerEmergencyCancelResult = {
  ok: boolean;
  requested: number;
  cancelled: number;
  alreadyTerminal: number;
  conflicts: number;
  failed: Array<{ jobId: string; code: string; message: string }>;
  snapshotLimitReached: boolean;
};

/**
 * Cancels the active-job snapshot through the same guarded state machine used
 * for ordinary user cancellation. It never deletes jobs or modifies completed
 * results. New jobs created after the snapshot are intentionally excluded.
 */
export async function cancelAllActiveEvaluationsAsOwner(args: {
  actorId: string;
  confirmation: string;
}): Promise<OwnerEmergencyCancelResult> {
  if (args.confirmation.trim() !== OWNER_EMERGENCY_CANCEL_CONFIRMATION) {
    throw new Error('Emergency cancellation confirmation did not match.');
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('evaluation_jobs')
    .select('id, manuscripts!inner(user_id)')
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: true })
    .limit(MAX_SNAPSHOT_JOBS);

  if (error) {
    throw new Error('Unable to load active evaluation jobs for emergency cancellation.');
  }

  const snapshot = (Array.isArray(data) ? data : []) as ActiveJob[];
  const result: OwnerEmergencyCancelResult = {
    ok: true,
    requested: snapshot.length,
    cancelled: 0,
    alreadyTerminal: 0,
    conflicts: 0,
    failed: [],
    snapshotLimitReached: snapshot.length === MAX_SNAPSHOT_JOBS,
  };

  for (const job of snapshot) {
    const ownerId = ownerIdOf(job);
    if (!ownerId) {
      result.ok = false;
      result.failed.push({
        jobId: job.id,
        code: 'missing_owner',
        message: 'Active job has no manuscript owner; it was not cancelled.',
      });
      continue;
    }

    const cancelled: UserCancelResult = await cancelEvaluationAsUser({
      jobId: job.id,
      userId: ownerId,
      reason: 'other',
      actor: { id: args.actorId, kind: 'owner_emergency' },
    });

    if (cancelled.ok === true) {
      result.cancelled += cancelled.alreadyCancelled ? 0 : 1;
      result.alreadyTerminal += cancelled.alreadyCancelled ? 1 : 0;
      continue;
    }

    const failure = cancelled;
    if (failure.code === 'conflict' || failure.code === 'not_found') {
      result.conflicts += 1;
      continue;
    }

    result.ok = false;
    result.failed.push({ jobId: job.id, code: failure.code, message: failure.message });
  }

  return result;
}
