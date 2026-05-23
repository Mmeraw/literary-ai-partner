import {
  assertEvaluationPhaseStatusTransition,
  validateEvaluationPhaseStatusTransition,
} from '../../lib/evaluation/orchestration/stateGuard';
import {
  EvaluationRunnerFatalError,
  RunnerHeartbeatMonitor,
  assertCurrentLeaseOwnership,
} from '../../lib/evaluation/orchestration/runnerHeartbeat';

type MockJob = {
  id: string;
  worker_id: string;
  lease_token: string;
  phase_status: string;
  cancellation_requested: boolean;
  heartbeat_at?: string;
  lease_until?: string;
};

class MockSupabaseQuery {
  private filters: Record<string, unknown> = {};
  private shouldSelectAfterUpdate = false;
  private maybeSingleMode = false;

  constructor(
    private readonly table: MockSupabaseTable,
    private readonly mode: 'select' | 'update',
    private readonly patch?: Partial<MockJob>,
  ) {}

  select(): MockSupabaseQuery {
    this.shouldSelectAfterUpdate = true;
    return this;
  }

  eq(column: string, value: unknown): MockSupabaseQuery {
    this.filters[column] = value;
    return this;
  }

  single(): Promise<{ data: MockJob | null; error: { message: string } | null }> {
    const data = this.table.find(this.filters);
    return Promise.resolve({ data, error: data ? null : { message: 'row not found' } });
  }

  maybeSingle(): Promise<{ data: { id: string } | MockJob | null; error: null }> {
    this.maybeSingleMode = true;
    if (this.mode === 'update') {
      const updated = this.table.update(this.filters, this.patch ?? {});
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

  find(filters: Record<string, unknown>): MockJob | null {
    for (const [key, value] of Object.entries(filters)) {
      if ((this.job as unknown as Record<string, unknown>)[key] !== value) {
        return null;
      }
    }
    return { ...this.job };
  }

  updateRow(filters: Record<string, unknown>, patch: Partial<MockJob>): MockJob | null {
    const found = this.find(filters);
    if (!found) return null;
    this.job = { ...this.job, ...patch };
    return { ...this.job };
  }

  update(filters: Record<string, unknown>, patch: Partial<MockJob>): MockJob | null {
    return this.updateRow(filters, patch);
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

describe('evaluation runner lifecycle guards', () => {
  it('allows only explicit phase_status transitions in the app layer', () => {
    expect(() => validateEvaluationPhaseStatusTransition('queued', 'running')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('running', 'awaiting_approval')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('running', 'queued')).not.toThrow();
    expect(() => validateEvaluationPhaseStatusTransition('awaiting_approval', 'queued')).not.toThrow();
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
    });

    await expect(assertCurrentLeaseOwnership({
      supabase: client as never,
      jobId: 'job-1',
      workerId: 'worker-a',
      leaseToken: 'token-a',
    })).rejects.toThrow(/write attempt blocked/);
  });
});
