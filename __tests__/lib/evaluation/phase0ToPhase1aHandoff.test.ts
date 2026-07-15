import { completePhase0ToPhase1aHandoff } from '../../../lib/evaluation/phase0ToPhase1aHandoff';

describe('completePhase0ToPhase1aHandoff', () => {
  test('calls the atomic seed-verified handoff RPC and reports updated rows', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 1, error: null });

    const result = await completePhase0ToPhase1aHandoff({
      supabase: { rpc } as any,
      jobId: '11111111-1111-4111-8111-111111111111',
      expectedClaimedBy: 'worker-1',
      expectedLeaseToken: '22222222-2222-4222-8222-222222222222',
      progressPatch: { phase0_fast_track: true },
    });

    expect(result).toEqual({ ok: true, updated: true });
    expect(rpc).toHaveBeenCalledWith('complete_phase0_to_phase1a_handoff', {
      p_job_id: '11111111-1111-4111-8111-111111111111',
      p_expected_claimed_by: 'worker-1',
      p_expected_lease_token: '22222222-2222-4222-8222-222222222222',
      p_progress_patch: { phase0_fast_track: true },
    });
  });

  test('returns optimistic_lock_lost when the atomic RPC updates zero rows', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 0, error: null });

    const result = await completePhase0ToPhase1aHandoff({
      supabase: { rpc } as any,
      jobId: '11111111-1111-4111-8111-111111111111',
      progressPatch: {},
    });

    expect(result).toEqual({ ok: true, updated: false, reason: 'optimistic_lock_lost' });
  });

  test('surfaces RPC errors without pretending the handoff happened', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'missing seed' } });

    const result = await completePhase0ToPhase1aHandoff({
      supabase: { rpc } as any,
      jobId: '11111111-1111-4111-8111-111111111111',
      progressPatch: {},
    });

    expect(result).toEqual({ ok: false, error: 'missing seed' });
  });
});