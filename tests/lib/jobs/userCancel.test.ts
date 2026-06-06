import { createAdminClient } from '@/lib/supabase/admin';
import { cancelEvaluationAsUser } from '@/lib/jobs/userCancel';

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

type SupabaseResponse = { data: unknown; error: unknown };

type RecordedOperation = {
  table: string;
  action: 'select' | 'update';
  payload?: Record<string, unknown>;
  filters: Array<{ op: 'eq' | 'in'; column: string; value: unknown }>;
  selectClause?: string;
};

class MockQuery {
  private operation: RecordedOperation;

  constructor(
    table: string,
    action: 'select' | 'update',
    private readonly responses: SupabaseResponse[],
    private readonly operations: RecordedOperation[],
    payload?: Record<string, unknown>,
  ) {
    this.operation = {
      table,
      action,
      payload,
      filters: [],
    };
    this.operations.push(this.operation);
  }

  select(selectClause: string) {
    this.operation.selectClause = selectClause;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.operation.action = 'update';
    this.operation.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.operation.filters.push({ op: 'eq', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.operation.filters.push({ op: 'in', column, value });
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.nextResponse());
  }

  then<TResult1 = SupabaseResponse, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.nextResponse()).then(onfulfilled, onrejected);
  }

  private nextResponse(): SupabaseResponse {
    const next = this.responses.shift();
    if (!next) {
      throw new Error('No mock Supabase response queued');
    }
    return next;
  }
}

function setupAdmin(responses: SupabaseResponse[]) {
  const operations: RecordedOperation[] = [];
  const admin = {
    from(table: string) {
      return {
        select(selectClause: string) {
          const query = new MockQuery(table, 'select', responses, operations);
          return query.select(selectClause);
        },
        update(payload: Record<string, unknown>) {
          return new MockQuery(table, 'update', responses, operations, payload);
        },
      };
    },
  };

  (createAdminClient as jest.Mock).mockReturnValue(admin);
  return { operations };
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    status: 'queued',
    phase: 'phase_0',
    phase_status: 'queued',
    progress: { phase: 'phase_0', phase_status: 'queued' },
    manuscript_id: 42,
    ...overrides,
  };
}

function updateOperations(operations: RecordedOperation[]) {
  return operations.filter((operation) => operation.action === 'update');
}

describe('cancelEvaluationAsUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cancels queued jobs through a legal queued -> running -> failed sequence', async () => {
    const { operations } = setupAdmin([
      { data: job(), error: null },
      { data: { id: 'job-1' }, error: null },
      { data: { id: 'job-1', status: 'failed', progress: {} }, error: null },
    ]);

    const result = await cancelEvaluationAsUser({
      jobId: 'job-1',
      userId: 'user-1',
      reason: 'user_cancelled',
    });

    expect(result).toMatchObject({ ok: true, status: 'cancelled', jobId: 'job-1' });

    const updates = updateOperations(operations);
    expect(updates).toHaveLength(2);
    expect(updates[0].payload).toMatchObject({
      status: 'running',
      phase_status: 'running',
      claimed_by: 'user-cancel:user-1',
    });
    expect(updates[1].payload).toMatchObject({
      status: 'failed',
      phase_status: 'failed',
      failure_code: 'USER_CANCELLED',
      claimed_by: null,
      lease_token: null,
    });
    expect(updates[1].filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'status', value: 'running' },
        { op: 'eq', column: 'lease_token', value: expect.any(String) },
      ]),
    );
  });

  test('normalizes awaiting approval before queued cancellation claim', async () => {
    const { operations } = setupAdmin([
      { data: job({ phase: 'review_gate', phase_status: 'awaiting_approval' }), error: null },
      { data: null, error: null },
      { data: { id: 'job-1' }, error: null },
      { data: { id: 'job-1', status: 'failed', progress: {} }, error: null },
    ]);

    const result = await cancelEvaluationAsUser({ jobId: 'job-1', userId: 'user-1' });

    expect(result).toMatchObject({ ok: true, status: 'cancelled' });
    const updates = updateOperations(operations);
    expect(updates[0].payload).toMatchObject({ phase_status: 'queued' });
    expect(updates[0].payload).not.toHaveProperty('status', 'failed');
    expect(updates[1].payload).toMatchObject({ status: 'running', phase_status: 'running' });
    expect(updates[2].payload).toMatchObject({ status: 'failed', phase_status: 'failed' });
  });

  test('cancels running jobs with a guarded running -> failed terminal update', async () => {
    const { operations } = setupAdmin([
      { data: job({ status: 'running', phase_status: 'running' }), error: null },
      { data: { id: 'job-1', status: 'failed', progress: {} }, error: null },
    ]);

    const result = await cancelEvaluationAsUser({ jobId: 'job-1', userId: 'user-1' });

    expect(result).toMatchObject({ ok: true, status: 'cancelled' });
    const updates = updateOperations(operations);
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({
      status: 'failed',
      phase_status: 'failed',
      failure_code: 'USER_CANCELLED',
    });
    expect(updates[0].filters).toEqual(
      expect.arrayContaining([{ op: 'eq', column: 'status', value: 'running' }]),
    );
  });

  test('does not overwrite a non-cancelled failed job as user-cancelled', async () => {
    const { operations } = setupAdmin([
      { data: job({ status: 'failed', phase_status: 'failed', progress: { phase_status: 'failed' } }), error: null },
    ]);

    const result = await cancelEvaluationAsUser({ jobId: 'job-1', userId: 'user-1' });

    expect(result).toMatchObject({ ok: false, code: 'conflict', status: 409, jobStatus: 'failed' });
    expect(updateOperations(operations)).toHaveLength(0);
  });

  test('is idempotent for jobs already cancelled by the user', async () => {
    const { operations } = setupAdmin([
      {
        data: job({
          status: 'failed',
          phase_status: 'failed',
          progress: { cancelled_by_user: true, cancelled_at: '2026-06-06T00:00:00.000Z' },
        }),
        error: null,
      },
    ]);

    const result = await cancelEvaluationAsUser({ jobId: 'job-1', userId: 'user-1' });

    expect(result).toMatchObject({
      ok: true,
      status: 'cancelled',
      alreadyCancelled: true,
      cancelledAt: '2026-06-06T00:00:00.000Z',
    });
    expect(updateOperations(operations)).toHaveLength(0);
  });

  test('returns server error without masking database write failures as client errors', async () => {
    setupAdmin([
      { data: job({ status: 'running', phase_status: 'running' }), error: null },
      { data: null, error: { message: 'database unavailable' } },
    ]);

    const result = await cancelEvaluationAsUser({ jobId: 'job-1', userId: 'user-1' });

    expect(result).toMatchObject({ ok: false, code: 'internal', status: 500 });
  });
});
