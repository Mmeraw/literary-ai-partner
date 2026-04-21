export type LatencyStage =
  | 'job_create'
  | 'worker_kickoff'
  | 'claim'
  | 'fetch_manuscript'
  | 'pipeline_run'
  | 'pass1'
  | 'pass2'
  | 'pass3'
  | 'pass4_cross_check'
  | 'quality_gate'
  | 'persist_artifacts'
  | 'finalize';

export interface LatencyTraceEvent {
  job_id: string;
  stage: LatencyStage;
  state: string;
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

function toIsoDate(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function toMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function shouldLogLatencyTrace(): boolean {
  return process.env.ENABLE_LATENCY_TRACE_LOGS === '1';
}

export function emitLatencyTrace(event: LatencyTraceEvent): void {
  if (shouldLogLatencyTrace()) {
    console.log('[LatencyTrace]', event);
  }
}

export function startLatencyStage(args: {
  jobId: string;
  stage: LatencyStage;
  state?: string;
  startedAt?: string | Date;
  metadata?: Record<string, unknown>;
}): string {
  const startedAtIso = toIsoDate(args.startedAt ?? new Date());
  emitLatencyTrace({
    job_id: args.jobId,
    stage: args.stage,
    state: args.state ?? 'started',
    started_at: startedAtIso,
    metadata: args.metadata,
  });
  return startedAtIso;
}

export function finishLatencyStage(args: {
  jobId: string;
  stage: LatencyStage;
  startedAt: string;
  state?: string;
  endedAt?: string | Date;
  metadata?: Record<string, unknown>;
}): void {
  const endedAtIso = toIsoDate(args.endedAt ?? new Date());
  const durationMs = Math.max(0, toMs(endedAtIso) - toMs(args.startedAt));
  emitLatencyTrace({
    job_id: args.jobId,
    stage: args.stage,
    state: args.state ?? 'completed',
    started_at: args.startedAt,
    ended_at: endedAtIso,
    duration_ms: durationMs,
    metadata: args.metadata,
  });
}