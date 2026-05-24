import type { SupabaseClient } from '@supabase/supabase-js';

export class EvaluationRunnerFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationRunnerFatalError';
  }
}

export type RunnerHeartbeatMonitorOptions = {
  jobId: string;
  workerId: string;
  leaseToken: string;
  supabase: Pick<SupabaseClient, 'from'>;
  leaseDurationSeconds?: number;
  heartbeatIntervalMs?: number;
  onFatal?: (error: EvaluationRunnerFatalError) => void;
};

export class RunnerHeartbeatMonitor {
  private isRunning = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly leaseDurationSeconds: number;
  private readonly heartbeatIntervalMs: number;
  private fatalError: EvaluationRunnerFatalError | null = null;

  constructor(private readonly options: RunnerHeartbeatMonitorOptions) {
    this.leaseDurationSeconds = options.leaseDurationSeconds ?? 300;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 60_000;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.executeLoop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public assertLive(): void {
    if (this.fatalError) {
      throw this.fatalError;
    }
  }

  public getFatalError(): EvaluationRunnerFatalError | null {
    return this.fatalError;
  }

  private async executeLoop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.renewOnce();
    } catch (error) {
      const fatal = error instanceof EvaluationRunnerFatalError
        ? error
        : new EvaluationRunnerFatalError(`[HEARTBEAT_CRITICAL_FAILURE] ${String(error)}`);
      this.fatalError = fatal;
      this.stop();
      this.options.onFatal?.(fatal);
      return;
    }

    if (!this.isRunning) return;
    this.timeoutId = setTimeout(() => {
      void this.executeLoop();
    }, this.heartbeatIntervalMs);
  }

  public async renewOnce(): Promise<void> {
    const { data: job, error: fetchError } = await this.options.supabase
      .from('evaluation_jobs')
      .select('cancellation_requested, phase_status, lease_token')
      .eq('id', this.options.jobId)
      .single();

    if (fetchError || !job) {
      throw new EvaluationRunnerFatalError(
        `Heartbeat ownership check failed for job ${this.options.jobId}: ${fetchError?.message ?? 'job not found'}`,
      );
    }

    const record = job as {
      cancellation_requested?: boolean | null;
      phase_status?: string | null;
      lease_token?: string | null;
    };

    if (record.cancellation_requested === true) {
      throw new EvaluationRunnerFatalError(`Job ${this.options.jobId} was cancelled externally.`);
    }

    if (record.phase_status !== 'running') {
      throw new EvaluationRunnerFatalError(
        `Job ${this.options.jobId} lost running state; phase_status=${record.phase_status ?? 'null'}`,
      );
    }

    if (String(record.lease_token ?? '') !== this.options.leaseToken) {
      throw new EvaluationRunnerFatalError(`Job ${this.options.jobId} lease ownership changed.`);
    }

    const now = new Date();
    const leaseUntil = new Date(now.getTime() + this.leaseDurationSeconds * 1000).toISOString();
    const heartbeatAt = now.toISOString();

    const { data: updated, error: updateError } = await this.options.supabase
      .from('evaluation_jobs')
      .update({
        lease_until: leaseUntil,
        heartbeat_at: heartbeatAt,
        last_heartbeat_at: heartbeatAt,
        updated_at: heartbeatAt,
      })
      .eq('id', this.options.jobId)
      .eq('worker_id', this.options.workerId)
      .eq('lease_token', this.options.leaseToken)
      .eq('phase_status', 'running')
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new EvaluationRunnerFatalError(
        `Database lease extension rejected for job ${this.options.jobId}: ${updateError.message}`,
      );
    }

    if (!updated) {
      throw new EvaluationRunnerFatalError(
        `Database lease extension affected no rows for job ${this.options.jobId}; lease ownership likely changed.`,
      );
    }
  }
}

type LeaseGuardedUpdateParams = {
  supabase: Pick<SupabaseClient, 'from'>;
  jobId: string;
  workerId: string;
  leaseToken: string;
  patch: Record<string, unknown>;
};

export async function assertCurrentLeaseOwnership(params: {
  supabase: Pick<SupabaseClient, 'from'>;
  jobId: string;
  workerId: string;
  leaseToken: string;
}): Promise<void> {
  const { data, error } = await params.supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('id', params.jobId)
    .eq('worker_id', params.workerId)
    .eq('lease_token', params.leaseToken)
    .eq('phase_status', 'running')
    .gt('lease_until', new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new EvaluationRunnerFatalError(`Lease ownership validation failed: ${error.message}`);
  }

  if (!data) {
    throw new EvaluationRunnerFatalError(
      `Lease ownership validation failed for job ${params.jobId}; write attempt blocked.`,
    );
  }
}

export async function guardedEvaluationJobUpdate(params: LeaseGuardedUpdateParams): Promise<void> {
  const { data, error } = await params.supabase
    .from('evaluation_jobs')
    .update(params.patch)
    .eq('id', params.jobId)
    .eq('worker_id', params.workerId)
    .eq('lease_token', params.leaseToken)
    .gt('lease_until', new Date().toISOString())
    .select('id')
    .maybeSingle();

  if (error) {
    throw new EvaluationRunnerFatalError(`Guarded evaluation job update failed: ${error.message}`);
  }

  if (!data) {
    throw new EvaluationRunnerFatalError(
      `Guarded evaluation job update blocked for job ${params.jobId}; lease ownership was not current.`,
    );
  }
}
