'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getProgressDisplay } from '@/components/evaluation-poller-display';
import { useRouter } from 'next/navigation';
import { CancelEvaluationButton } from './evaluation/CancelEvaluationButton';
import {
  FailedJobRecovery,
  useFailedJobRecovery,
} from './evaluation/FailedJobRecovery';

const ANIMATION_TICK_MS = 400;
const RUNNING_SOFT_CEILING = 79;
const RUNNING_SOFT_FORWARD_TICK_MS = 1200;
const COMPLETE_ANIMATION_TICK_MS = 200;
const RUNNING_MAX_DISPLAY_PROGRESS = 79;

function getInitialDisplayProgress(job: JobState | null): number {
  if (!job) return 0;
  if (job.status === 'complete') return 100;
  if (job.status === 'running') {
    return Math.max(0, Math.min(RUNNING_MAX_DISPLAY_PROGRESS, Math.round(job.progress)));
  }
  return 0;
}

export interface JobState {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;
  created_at: string;
  updated_at: string;
  last_error?: string;
  phase?: 'phase_0' | 'phase_1a' | 'phase_2' | 'phase_3' | null;
  phase_status?: 'queued' | 'running' | 'complete' | 'failed' | null;
  cross_check_status?:
    | 'queued'
    | 'running'
    | 'complete'
    | 'failed'
    | 'failed_soft'
    | 'failed_blocking'
    | 'cross_check_completed'
    | 'skipped'
    | null;
  phase1_started_at?: string | null;
  phase1_completed_at?: string | null;
  phase2_started_at?: string | null;
  phase2_completed_at?: string | null;
  pass3_started_at?: string | null;
  pass3_completed_at?: string | null;
}

interface PollerProps {
  jobId: string;
  initialJob?: JobState | null;
  userId?: string;
  onComplete?: (job: JobState, isSuccess: boolean) => void;
  refreshInterval?: number;
  redirectOnComplete?: boolean;
  redirectDelayMs?: number;
  refreshOnComplete?: boolean;
}

export function EvaluationPoller({
  jobId,
  initialJob = null,
  userId,
  onComplete,
  refreshInterval = 500,
  redirectOnComplete = false,
  redirectDelayMs,
  refreshOnComplete = false,
}: PollerProps) {
  const router = useRouter();
  const [job, setJob] = useState<JobState | null>(initialJob);
  const [error, setError] = useState<string | null>(null);

  const jobProgressAsRecord =
    job?.status === 'failed' && job != null
      ? (job as unknown as { progress?: Record<string, unknown> }).progress ?? null
      : null;
  const { checkpoint, resumeLoading, resumeError, resumed, handleResume } =
    useFailedJobRecovery(
      jobId,
      job?.status ?? null,
      jobProgressAsRecord,
      () => {
        setJob((prev) =>
          prev ? { ...prev, status: 'queued' } : prev
        );
      },
    );
  const [transientError, setTransientError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [nextPollDelay, setNextPollDelay] = useState(refreshInterval);
  const [pendingRedirectDelayMs, setPendingRedirectDelayMs] = useState<number | null>(null);
  const [displayProgress, setDisplayProgress] = useState<number>(getInitialDisplayProgress(initialJob));

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectDeadlineRef = useRef<number | null>(null);
  const refreshedRef = useRef(false);
  const completionRefreshArmedRef = useRef(false);
  const fetchJobRef = useRef<(() => Promise<void>) | null>(null);
  const unchangedCountRef = useRef(0);
  const networkErrorCountRef = useRef(0);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!job || job.status === 'failed') return;

    const target =
      job.status === 'complete'
        ? 100
        : Math.min(
            RUNNING_MAX_DISPLAY_PROGRESS,
            Math.max(job.progress, RUNNING_SOFT_CEILING),
          );
    const tickMs =
      job.status === 'complete'
        ? COMPLETE_ANIMATION_TICK_MS
        : displayProgress >= job.progress
          ? RUNNING_SOFT_FORWARD_TICK_MS
          : ANIMATION_TICK_MS;

    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= target) {
          clearInterval(interval);
          return prev;
        }
        return Math.min(prev + 1, target);
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [displayProgress, job]);

  useEffect(() => {
    if (
      completionRefreshArmedRef.current &&
      job?.status === 'complete' &&
      displayProgress >= 100 &&
      refreshOnComplete &&
      !refreshedRef.current
    ) {
      completionRefreshArmedRef.current = false;
      refreshedRef.current = true;
      router.refresh();
    }
  }, [displayProgress, job?.status, refreshOnComplete, router]);

  const getAdaptiveDelay = useCallback(
    (unchangedCount: number, networkErrorCount: number) => {
      const base = refreshInterval;
      const unchangedDelayMultiplier =
        unchangedCount >= 10 ? 3 : unchangedCount >= 5 ? 2 : unchangedCount >= 2 ? 1.5 : 1;
      const networkDelayMultiplier = networkErrorCount >= 2 ? 2 : 1;
      return Math.min(base * unchangedDelayMultiplier * networkDelayMultiplier, 1500);
    },
    [refreshInterval]
  );

  const resolvedRedirectDelayMs = (() => {
    if (typeof redirectDelayMs === 'number' && Number.isFinite(redirectDelayMs)) {
      return Math.max(0, Math.min(redirectDelayMs, 15000));
    }
    const fromEnv = Number(process.env.NEXT_PUBLIC_EVAL_COMPLETE_REDIRECT_DELAY_MS ?? '800');
    if (Number.isFinite(fromEnv)) {
      return Math.max(0, Math.min(fromEnv, 15000));
    }
    return 800;
  })();

  const navigateToReport = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    if (redirectCountdownIntervalRef.current) {
      clearInterval(redirectCountdownIntervalRef.current);
      redirectCountdownIntervalRef.current = null;
    }
    redirectDeadlineRef.current = null;
    setPendingRedirectDelayMs(null);
    router.push(`/evaluate/${jobId}/report`);
  }, [jobId, router]);

  const scheduleNextPoll = useCallback(
    (delay: number) => {
      if (!isPolling) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (fetchJobRef.current) {
          void fetchJobRef.current();
        }
      }, delay);
      setNextPollDelay(delay);
    },
    [isPolling]
  );

  const fetchJob = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (userId) {
        headers['x-user-id'] = userId;
      }

      const res = await fetch(`/api/jobs/${jobId}`, {
        headers,
        cache: 'no-store',
      });
      setPollCount((c) => c + 1);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const serverError =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : `Failed to fetch job (HTTP ${res.status})`;

        if (res.status === 401 || res.status === 404) {
          setError(serverError);
          setIsPolling(false);
          return;
        }

        networkErrorCountRef.current += 1;
        setTransientError(serverError);
        scheduleNextPoll(getAdaptiveDelay(unchangedCountRef.current, networkErrorCountRef.current));
        return;
      }

      networkErrorCountRef.current = 0;
      setTransientError(null);

      const data = await res.json();
      if (data.ok && data.job) {
        const nextJob = data.job as JobState;
        const previousJob = job;

        setJob((prev) => {
          const unchanged =
            prev &&
            prev.status === nextJob.status &&
            prev.progress === nextJob.progress &&
            prev.updated_at === nextJob.updated_at &&
            prev.last_error === nextJob.last_error &&
            prev.phase === nextJob.phase &&
            prev.phase_status === nextJob.phase_status &&
            prev.cross_check_status === nextJob.cross_check_status &&
            prev.phase1_started_at === nextJob.phase1_started_at &&
            prev.phase1_completed_at === nextJob.phase1_completed_at &&
            prev.phase2_started_at === nextJob.phase2_started_at &&
            prev.phase2_completed_at === nextJob.phase2_completed_at &&
            prev.pass3_started_at === nextJob.pass3_started_at &&
            prev.pass3_completed_at === nextJob.pass3_completed_at;

          unchangedCountRef.current = unchanged ? unchangedCountRef.current + 1 : 0;
          return nextJob;
        });

        setError(null);

        if (data.job.status === 'complete' || data.job.status === 'failed') {
          setIsPolling(false);

          if (data.job.status === 'complete' && redirectOnComplete && !redirectedRef.current) {
            if (resolvedRedirectDelayMs === 0) {
              navigateToReport();
            } else {
              redirectDeadlineRef.current = Date.now() + resolvedRedirectDelayMs;
              setPendingRedirectDelayMs(resolvedRedirectDelayMs);
              if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
              redirectTimeoutRef.current = setTimeout(() => {
                navigateToReport();
              }, resolvedRedirectDelayMs);
            }
          } else if (
            data.job.status === 'complete' &&
            refreshOnComplete &&
            !refreshedRef.current
          ) {
            completionRefreshArmedRef.current = true;
          }

          onComplete?.(data.job, data.job.status === 'complete');
          return;
        }

        const progressChanged =
          previousJob != null &&
          previousJob.status === 'running' &&
          nextJob.status === 'running' &&
          previousJob.progress !== nextJob.progress;

        scheduleNextPoll(
          progressChanged
            ? refreshInterval
            : getAdaptiveDelay(unchangedCountRef.current, networkErrorCountRef.current)
        );
      }
    } catch (err) {
      networkErrorCountRef.current += 1;
      setTransientError(err instanceof Error ? err.message : 'Network error');
      scheduleNextPoll(getAdaptiveDelay(unchangedCountRef.current, networkErrorCountRef.current));
    }
  }, [
    getAdaptiveDelay,
    navigateToReport,
    onComplete,
    redirectOnComplete,
    resolvedRedirectDelayMs,
    scheduleNextPoll,
    userId,
  ]);

  useEffect(() => {
    if (pendingRedirectDelayMs == null) {
      if (redirectCountdownIntervalRef.current) {
        clearInterval(redirectCountdownIntervalRef.current);
        redirectCountdownIntervalRef.current = null;
      }
      return;
    }

    if (redirectCountdownIntervalRef.current) {
      clearInterval(redirectCountdownIntervalRef.current);
      redirectCountdownIntervalRef.current = null;
    }

    redirectCountdownIntervalRef.current = setInterval(() => {
      const deadline = redirectDeadlineRef.current;
      if (deadline == null) return;

      const remaining = Math.max(0, deadline - Date.now());
      setPendingRedirectDelayMs(remaining);

      if (remaining <= 0 && redirectCountdownIntervalRef.current) {
        clearInterval(redirectCountdownIntervalRef.current);
        redirectCountdownIntervalRef.current = null;
      }
    }, 100);

    return () => {
      if (redirectCountdownIntervalRef.current) {
        clearInterval(redirectCountdownIntervalRef.current);
        redirectCountdownIntervalRef.current = null;
      }
    };
  }, [pendingRedirectDelayMs]);

  useEffect(() => {
    fetchJobRef.current = fetchJob;
  }, [fetchJob]);

  useEffect(() => {
    if (!isPolling) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    void fetchJob();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      if (redirectCountdownIntervalRef.current) {
        clearInterval(redirectCountdownIntervalRef.current);
        redirectCountdownIntervalRef.current = null;
      }
    };
  }, [fetchJob, isPolling]);

  useEffect(() => {
    setJob(initialJob);
    setError(null);
    setTransientError(null);
    setIsPolling(true);
    setPollCount(0);
    setNextPollDelay(refreshInterval);
    setPendingRedirectDelayMs(null);
    setDisplayProgress(getInitialDisplayProgress(initialJob));
    completionRefreshArmedRef.current = false;
    unchangedCountRef.current = 0;
    networkErrorCountRef.current = 0;
    redirectedRef.current = false;
    refreshedRef.current = false;
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    if (redirectCountdownIntervalRef.current) {
      clearInterval(redirectCountdownIntervalRef.current);
      redirectCountdownIntervalRef.current = null;
    }
    redirectDeadlineRef.current = null;
  }, [initialJob, jobId, userId, refreshInterval]);

  const formatUserSafeError = (value: string) =>
    value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 600);

  // ── Design tokens (inline, matches revise workbench) ──
  const ink       = '#0D0A05';
  const surface   = '#12100B';
  const surfaceRaised = '#1C160E';
  const cream     = '#F5EFE0';
  const cream2    = '#C8BEA8';
  const gold      = '#C8A96E';
  const dim       = '#6B6560';
  const border    = 'rgba(216,209,192,0.14)';
  const borderStrong = 'rgba(216,209,192,0.28)';
  const successColor = '#7FA36B';
  const dangerColor  = '#A7472A';

  // ── Render ──

  if (error && !job) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(122,43,26,0.18)', border: `1px solid rgba(167,71,42,0.45)` }}
      >
        <p className="text-sm font-semibold" style={{ color: cream }}>Error</p>
        <p className="text-sm mt-1" style={{ color: cream2 }}>{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: surfaceRaised, border: `1px solid ${border}` }}
      >
        <p className="text-sm" style={{ color: dim }}>Loading job status…</p>
      </div>
    );
  }

  const isCompletingAnimation = job.status === 'complete' && displayProgress < 100;

  const statusLabel = {
    queued:   'Waiting in queue',
    running:  'In progress',
    complete: isCompletingAnimation ? 'In progress' : '✓ Report ready',
    failed:   '⚠ Needs attention',
  }[job.status];

  const statusColor = {
    queued:   gold,
    running:  gold,
    complete: isCompletingAnimation ? gold : successColor,
    failed:   '#e07a5f',
  }[job.status];

  // Progress bar fill color
  const barColor = job.status === 'failed' ? dangerColor : job.status === 'complete' && !isCompletingAnimation ? successColor : gold;

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: surfaceRaised,
        border: `1px solid ${border}`,
        fontFamily: "'Switzer', system-ui, sans-serif",
      }}
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            className="text-lg font-semibold"
            style={{ color: cream, fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            Evaluation Status
          </h3>
          <p className="text-sm font-semibold" style={{ color: statusColor }}>{statusLabel}</p>
        </div>

        {/* Progress Bar */}
        {(() => {
          const displayStatus = isCompletingAnimation ? 'running' : job.status;
          const pd = getProgressDisplay({
            status: displayStatus,
            phase: job.phase ?? null,
            phase_status: job.phase_status ?? null,
            cross_check_status: job.cross_check_status ?? null,
            created_at: job.created_at ?? null,
            phase1_started_at: job.phase1_started_at ?? null,
            phase1_completed_at: job.phase1_completed_at ?? null,
            phase2_started_at: job.phase2_started_at ?? null,
            phase2_completed_at: job.phase2_completed_at ?? null,
            pass3_started_at: job.pass3_started_at ?? null,
            pass3_completed_at: job.pass3_completed_at ?? null,
          });
          if (!pd) return null;
          return (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium" style={{ color: cream2 }}>{pd.label}</p>
                <p className="text-sm" style={{ color: dim }}>{pd.valueLabel}</p>
              </div>
              {/* Track */}
              <div
                className="w-full rounded-full h-1.5"
                style={{ background: 'rgba(216,209,192,0.12)' }}
              >
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${pd.indeterminate ? 'animate-pulse' : ''}`}
                  style={{
                    width: pd.indeterminate ? '100%' : `${pd.percentage}%`,
                    background: pd.indeterminate ? 'rgba(200,169,110,0.4)' : barColor,
                  }}
                />
              </div>
              <p className="text-xs" style={{ color: dim }}>{pd.helperText}</p>
            </div>
          );
        })()}

        {/* Timestamps + Cancel */}
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: dim }}>Created</p>
            <p className="font-mono text-xs" style={{ color: cream2 }}>
              {new Date(job.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: dim }}>Updated</p>
            <p className="font-mono text-xs" style={{ color: cream2 }}>
              {new Date(job.updated_at).toLocaleString()}
            </p>
          </div>
          {(job.status === 'queued' || job.status === 'running') && (
            <div className="flex items-end justify-start sm:justify-end lg:justify-start">
              <CancelEvaluationButton
                jobId={jobId}
                label="Cancel evaluation"
              />
            </div>
          )}
        </div>

        {/* Failed-job recovery */}
        {job.status === 'failed' && (
          <div className="space-y-3">
            {job.last_error && (
              <div
                className="p-3 rounded-lg"
                style={{
                  background: 'rgba(122,43,26,0.18)',
                  border: '1px solid rgba(167,71,42,0.4)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#e07a5f' }}>Error</p>
                <p className="text-sm" style={{ color: cream2 }}>{formatUserSafeError(job.last_error)}</p>
              </div>
            )}
            <FailedJobRecovery
              jobId={jobId}
              checkpoint={checkpoint}
              resumeLoading={resumeLoading}
              resumeError={resumeError}
              resumed={resumed}
              onResume={handleResume}
            />
          </div>
        )}

        {/* Transient fetch errors */}
        {transientError && isPolling && (
          <div
            className="p-3 rounded-lg"
            style={{
              background: 'rgba(200,169,110,0.08)',
              border: '1px solid rgba(200,169,110,0.25)',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: gold }}>
              Temporary connection issue
            </p>
            <p className="text-sm" style={{ color: cream2 }}>
              {formatUserSafeError(transientError)}
            </p>
            <p className="text-xs mt-1" style={{ color: dim }}>
              Retrying automatically in {Math.ceil(nextPollDelay / 1000)}s.
            </p>
          </div>
        )}

        {/* Completion CTA before auto-redirect */}
        {job.status === 'complete' && !isCompletingAnimation && redirectOnComplete && !redirectedRef.current && (
          <div
            className="p-3 rounded-lg"
            style={{
              background: 'rgba(127,163,107,0.1)',
              border: '1px solid rgba(127,163,107,0.35)',
            }}
          >
            <p className="text-sm" style={{ color: cream2 }}>
              Report ready.
              {pendingRedirectDelayMs != null
                ? ` Redirecting automatically in ${Math.ceil(pendingRedirectDelayMs / 1000)}s.`
                : ' Redirecting automatically…'}
            </p>
            <button
              type="button"
              onClick={navigateToReport}
              className="mt-2 inline-flex rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: 'rgba(127,163,107,0.18)',
                border: '1px solid rgba(127,163,107,0.45)',
                color: cream,
              }}
            >
              View report now
            </button>
          </div>
        )}

        {/* Dev metadata */}
        {process.env.NODE_ENV === 'development' && (
          <div
            className="text-xs pt-2"
            style={{ borderTop: `1px solid ${border}`, color: dim }}
          >
            <p>Polling: {isPolling ? 'active' : 'stopped'}</p>
            <p>Polls: {pollCount}</p>
            <p>Next delay: {nextPollDelay}ms</p>
          </div>
        )}
      </div>
    </div>
  );
}
