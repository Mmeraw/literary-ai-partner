import type { SupabaseClient } from '@supabase/supabase-js';

export type Phase0ToPhase1aHandoffResult =
  | { ok: true; updated: true }
  | { ok: true; updated: false; reason: 'optimistic_lock_lost' }
  | { ok: false; error: string };

function normalizeUpdatedCount(data: unknown): number {
  if (typeof data === 'number' && Number.isFinite(data)) return data;
  if (typeof data === 'string' && data.trim().length > 0) {
    const parsed = Number(data);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(data)) return data.length;
  return 0;
}

export async function completePhase0ToPhase1aHandoff(args: {
  supabase: SupabaseClient<any, any, any>;
  jobId: string;
  expectedClaimedBy?: string | null;
  expectedLeaseToken?: string | null;
  progressPatch: Record<string, unknown>;
}): Promise<Phase0ToPhase1aHandoffResult> {
  const { data, error } = await args.supabase.rpc('complete_phase0_to_phase1a_handoff', {
    p_job_id: args.jobId,
    p_expected_claimed_by: args.expectedClaimedBy ?? null,
    p_expected_lease_token: args.expectedLeaseToken ?? null,
    p_progress_patch: args.progressPatch,
  });

  if (error) {
    return { ok: false, error: error.message ?? String(error) };
  }

  const updated = normalizeUpdatedCount(data);
  if (updated < 1) {
    return { ok: true, updated: false, reason: 'optimistic_lock_lost' };
  }

  return { ok: true, updated: true };
}