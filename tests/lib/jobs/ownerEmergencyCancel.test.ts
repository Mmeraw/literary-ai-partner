import {
  cancelAllActiveEvaluationsAsOwner,
  OWNER_EMERGENCY_CANCEL_CONFIRMATION,
} from '@/lib/jobs/ownerEmergencyCancel';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelEvaluationAsUser } from '@/lib/jobs/userCancel';

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));
jest.mock('@/lib/jobs/userCancel', () => ({ cancelEvaluationAsUser: jest.fn() }));

function setupActiveSnapshot(rows: unknown[]) {
  const query = {
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  (createAdminClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(query) }),
  });
}

describe('cancelAllActiveEvaluationsAsOwner', () => {
  beforeEach(() => jest.clearAllMocks());

  test('requires the server-owned confirmation phrase before reading active jobs', async () => {
    await expect(cancelAllActiveEvaluationsAsOwner({ actorId: 'admin', confirmation: 'cancel' }))
      .rejects.toThrow('confirmation did not match');
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test('uses the canonical guarded cancellation path with owner-emergency attribution', async () => {
    setupActiveSnapshot([
      { id: 'job-1', manuscripts: { user_id: 'author-1' } },
      { id: 'job-2', manuscripts: [{ user_id: 'author-2' }] },
    ]);
    (cancelEvaluationAsUser as jest.Mock)
      .mockResolvedValueOnce({ ok: true, jobId: 'job-1', status: 'cancelled', cancelledAt: 'now' })
      .mockResolvedValueOnce({ ok: false, code: 'conflict', message: 'already terminal', status: 409 });

    const result = await cancelAllActiveEvaluationsAsOwner({
      actorId: 'owner-admin',
      confirmation: OWNER_EMERGENCY_CANCEL_CONFIRMATION,
    });

    expect(result).toMatchObject({ ok: true, requested: 2, cancelled: 1, conflicts: 1 });
    expect(cancelEvaluationAsUser).toHaveBeenNthCalledWith(1, expect.objectContaining({
      jobId: 'job-1',
      userId: 'author-1',
      actor: { id: 'owner-admin', kind: 'owner_emergency' },
    }));
    expect(cancelEvaluationAsUser).toHaveBeenNthCalledWith(2, expect.objectContaining({
      jobId: 'job-2',
      userId: 'author-2',
      actor: { id: 'owner-admin', kind: 'owner_emergency' },
    }));
  });

  test('fails closed for an active row with no durable manuscript owner', async () => {
    setupActiveSnapshot([{ id: 'job-missing-owner', manuscripts: null }]);

    const result = await cancelAllActiveEvaluationsAsOwner({
      actorId: 'owner-admin',
      confirmation: OWNER_EMERGENCY_CANCEL_CONFIRMATION,
    });

    expect(result).toMatchObject({ ok: false, requested: 1, cancelled: 0 });
    expect(result.failed).toEqual([expect.objectContaining({ code: 'missing_owner' })]);
    expect(cancelEvaluationAsUser).not.toHaveBeenCalled();
  });
});
