import {
  assertEvaluationPhaseStatusTransition,
  validateEvaluationPhaseStatusTransition,
} from '../../lib/evaluation/orchestration/stateGuard';
import {
  EvaluationRunnerFatalError,
  RunnerHeartbeatMonitor,
  assertCurrentLeaseOwnership,
  guardedEvaluationJobUpdate,
} from '../../lib/evaluation/orchestration/runnerHeartbeat';

type MockJob = {
  id: string;
  worker_id: string;
  lease_token: string;
  phase_status: string;
  cancellation_requested: boolean;
  heartbeat_at?: string;
  last_heartbeat_at?: string;
  lease_until?: string;
  updated_at?: string;
  status?: string;
  progress?: Record<string, unknown>;
};

type Filter =
  | { op: 'eq'; column: string; value: unknown }
  | { op: 'gt'; column: string; value: unknown };

class MockSupabaseQuery {
  private filters: Filter[] = [];

  constructor(
    private readonly table: MockSupabaseTable,
    private readonly mode: 'select' | 'update',
    private readonly patch?: Partial<MockJob>,
  ) {}

  select(): MockSupabaseQuery {
    return this;
  }

  eq(column: string, value: unknown): MockSupabaseQuery {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  gt(column: string, value: unknown): MockSupabaseQuery {
    this.filters.push({ op: 'gt', column, value });
    return this;
  }

  single(): Promise<{ data: MockJob | null; error: { message: string } | null }> {
    const data = this.table.find(this.filters);
    return Promise.resolve({ data, error: data ? null : { message: 'row not found' } });
  }

  maybeSingle(): Promise<{ data: { id: string } | null; error: null }> {
    if (this.mode === 'update') {
      const updated = this.table.updateRow(this.filters, this.patch ?? {});
      return Promise.resolve({ data: updated ? { id: updated.id } : null, error: null });
    }
    const data = this.table.find(this.filters);
    return Promise.resolve({ data: data ? { id: data.id } : null, error: null });
  }
}

class MockSupabaseTable {
  constructor(private job: MockJob) {}

  select(): MockSupabaseQuery {
    return new MockSupabaseQuery(this, 'select');
  }

  update(patch: Partial<MockJob>): MockSupabaseQuery {
    return new MockSupabaseQuery(this, 'update', patch);
  }

  find(filters: Filter[]): MockJob | null {
    for (const filter of filters) {
      const actual = (this.job as unknown as Record<string, unknown>)[filter.column];
      if (filter.op === 'eq' && actual !== filter.value) {
        return null;
      }
      if (filter.op === 'gt') {
        const actualMs = Date.parse(String(actual ?? ''));
        const expectedMs = Date.parse(String(filter.value ?? ''));
        if (!Number.isFinite(actualMs) || !Number.isFinite(expectedMs) || actualMs <= expectedMs) {
          return null;
        }
      }
    }
    return { ...this.job };
  }

  updateRow(filters: Filter[], patch: Partial<MockJob>): MockJob | null {
    const found = this.find(filters);
    if (!found) return null;
    this.job = { ...this.job, ...patch };
    return { ...this.job };
  }

  setJob(job: MockJob): void {
    this.job = job;
  }

  getJob(): MockJob {
    return { ...this.job };
  }
}

function mockSupabase(job: MockJob) {
  const table = new MockSupabaseTable(job);
  return {
    table,
    client: {
      from: (name: string) => {
        if (name !== 'evaluation_jobs') throw new Error(`Unexpected table ${name}`);
        return table;
      },
    },
  };
}

function futureIso(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

function pastIso(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

describe('evaluation runner lifecycle guards', () => {
  it('allows only explicit phase_status transitions in the app layer', () => {
    expect(() => validateEvaluationPhaseStatusTransition('queued', 'running')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('running', 'awaiting_approval')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('running', 'queued')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('awaiting_approval', 'queued')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('failed', 'queued')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('degraded', 'queued')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('cancelled', 'queued')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('complete', 'running')).toThrow(/Illegal evaluation phase_status transition/);
    expect(() => assertEvaluationPhaseStatusTransition('running', 'banana')).toThrow(/Unknown next phase_status/);
  });

  it('renews heartbeat only when worker and lease token still match', async () => {
    const { client, table } = mockSupabase({
      id: 'job-1',
      worker_id: 'worker-a',
      lease_token: 'token-a',
      phase_status: 'running',
      cancellation_requested: false,
      lease_until: futureIso(),
    });

    const monitor = new RunnerHeartbeatMonitor({
      jobId: 'job-1',
      workerId: 'worker-a',
      leaseToken: 'token-a',
      supabase: client as never,
      leaseDurationSeconds: 300,
    });

    await expect(monitor.renewOnce()).resolves.toBeUndefined();
    expect(table.getJob().heartbeat_at).toBeDefined();
    expect(table.getJob().lease_until).toBeDefined();
  });

  it('throws typed fatal error when cancellation is requested', async () => {
    const { client } = mockSupabase({
      id: 'job-1',
      worker_id: 'worker-a',
      lease_token: 'token-a',
      phase_status: 'running',
      cancellation_requested: true,
      lease_until: futureIso(),
    });

    const monitor = new RunnerHeartbeatMonitor({
      jobId: 'job-1',
      workerId: 'worker-a',
      leaseToken: 'token-a',
      supabase: client as never,
    });

    await expect(monitor.renewOnce()).rejects.toBeInstanceOf(EvaluationRunnerFatalError);
  });

  it('blocks ghost writes after lease ownership changes', async () => {
    const { client, table } = mockSupabase({
      id: 'job-1',
      worker_id: 'worker-a',
      lease_token: 'token-a',
      phase_status: 'running',
      cancellation_requested: false,
      lease_until: futureIso(),
    });

    await expect(assertCurrentLeaseOwnership({
      supabase: client as never,
      jobId: 'job-1',
      workerId: 'worker-a',
      leaseToken: 'token-a',
    })).resolves.toBeUndefined();

    table.setJob({
      id: 'job-1',
      worker_id: 'worker-b',
      lease_token: 'token-b',
      phase_status: 'running',
      cancellation_requested: false,
      lease_until: futureIso(),
    });

    await expect(assertCurrentLeaseOwnership({
      supabase: client as never,
      jobId: 'job-1',
      workerId: 'worker-a',
      leaseToken: 'token-a',
    })).rejects.toThrow(/write attempt blocked/);
  });

  it('blocks guarded writes after lease expiry', async () => {
    const { client, table } = mockSupabase({
      id: 'job-1',
      worker_id: 'worker-a',
      lease_token: 'token-a',
      phase_status: 'running',
      cancellation_requested: false,
      lease_until: pastIso(),
      status: 'running',
    });

    await expect(guardedEvaluationJobUpdate({
      supabase: client as never,
      jobId: 'job-1',
      workerId: 'worker-a',
      leaseToken: 'token-a',
      patch: { status: 'complete', phase_status: 'complete' },
    })).rejects.toThrow(/lease ownership was not current/);

    expect(table.getJob().status).toBe('running');
  });
});
