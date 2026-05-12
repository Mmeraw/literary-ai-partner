'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getProgressDisplay } from '@/components/evaluation-poller-display';
import { useRouter } from 'next/navigation';

// How many ms between each animated +1% tick on the display progress.
// At 400ms/tick the bar takes ~40 s to traverse 0→100 at full speed.
const ANIMATION_TICK_MS = 400;

// When the backend holds at a coarse checkpoint such as 33%, continue the
// browser-only display slowly through safe non-terminal stages so the UI does
// not appear frozen. Completion remains backend-gated and never renders 100%
// until the job status is actually complete.
const RUNNING_SOFT_CEILING = 79;
const RUNNING_SOFT_FORWARD_TICK_MS = 1200;

// Once the backend marks the job complete, keep animating the client-only
// progress display to 100 instead of snapping. This lets users see the final
// stage labels even when the backend jumps directly from ~33% to complete.
const COMPLETE_ANIMATION_TICK_MS = 200;

// Keep running jobs below near-complete UI bands until final gates pass and
// the backend marks the job as complete.
const RUNNING_MAX_DISPLAY_PROGRESS = 79;

function getInitialDisplayProgress(job: JobState | null): number {
  if (!job) return 0;
  if (job.status === 'complete') return 100;
  if (job.status === 'running') {
    // Preserve server-reported progress on first paint so refreshes do not
    // visually jump backwards to 0% and re-animate from scratch.
    // While status is still running, keep display progress below near-complete
    // bands so we do not imply publishable readiness before final QA passes.
    return Math.max(0, Math.min(RUNNING_MAX_DISPLAY_PROGRESS, Math.round(job.progress)));
  }
  return 0;
}

/**
 * EvaluationPoller
 *
 * Polling component for GET /api/jobs/[jobId].
 * Fetches job state every 1-2 seconds and renders progress.
 *
 * Props:
 *   - jobId: job UUID to poll
 *   - userId: x-user-id header (for dev/test)
 *   - onComplete: callback on terminal state (complete, failed)
 */

export interface JobState {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number; // 0-100
  created_at: string;
  updated_at: string;
  last_error?: string;
}

interface PollerProps {
  jobId: string;
  initialJob?: JobState | null;
  userId?: string;
  onComplete?: (job: JobState, isSuccess: boolean) => void;
  refreshInterval?: number; // ms, default 500
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
  const [transientError, setTransientError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [nextPollDelay, setNextPollDelay] = useState(refreshInterval);
  const [pendingRedirectDelayMs, setPendingRedirectDelayMs] = useState<number | null>(null);

  // Animated display progress: ticks through user-safe display stages while
  // backend state remains authoritative for terminal completion/failure.
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

  // Animate displayProgress toward the current display target, one tick at a time.
  // Running jobs can soft-forward past coarse backend checkpoints up to a safe
  // non-terminal ceiling so the UI does not appear frozen at ~35%. Complete jobs
  // continue to 100 client-side so users do not see a 35% → 100% snap.
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

  // For report pages that need a server refresh after completion, wait until the
  // client-side animation has reached 100. Otherwise the page refresh can replace
  // the in-progress card immediately and visually recreate the snap-to-complete bug.
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
      // Keep completion visibility snappy: avoid long drift on unchanged snapshots.
      // This controls UI freshness, not backend pipeline runtime.
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

  // Fetch job status
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

        // Treat auth/not-found as terminal fetch failures for this page load.
        if (res.status === 401 || res.status === 404) {
          setError(serverError);
          setIsPolling(false);
          return;
        }

        // Non-terminal API errors: continue polling with temporary backoff.
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
            prev.last_error === nextJob.last_error;

          unchangedCountRef.current = unchanged ? unchangedCountRef.current + 1 : 0;
          return nextJob;
        });

        setError(null);

        // Stop polling on terminal state
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

  // Poll loop with adaptive backoff and safe retry behavior.
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

  // ========================================
  // Render
  // ========================================

  if (error && !job) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-sm font-semibold text-red-800">Error</p>
        <p className="text-sm text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded">
        <p className="text-sm text-gray-600">Loading job status...</p>
      </div>
    );
  }

  const isCompletingAnimation = job.status === 'complete' && displayProgress < 100;

  const statusLabel = {
    queued: 'Waiting in queue',
    running: 'In progress',
    complete: isCompletingAnimation ? 'In progress' : '✅ Report ready',
    failed: '⚠ Needs attention',
  }[job.status];

  const statusColor = {
    queued: 'text-gray-600',
    running: 'text-blue-600',
    complete: isCompletingAnimation ? 'text-blue-600' : 'text-green-600',
    failed: 'text-red-600',
  }[job.status];

  return (
    <div className="p-4 border border-gray-200 rounded bg-white">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Job Status</h3>
            <p className="text-sm text-gray-500 mt-1">{job.id}</p>
          </div>
          <p className={`text-lg font-semibold ${statusColor}`}>{statusLabel}</p>
        </div>

                {/* Progress Bar */}
        {(() => {
          // Use the smoothly animated displayProgress so the bar traverses
          // every stage label at a legible pace regardless of how coarse the
          // backend progress checkpoints are. While completion animation is still
          // in flight, render through the running-stage label map instead of the
          // terminal complete display, which is intentionally fixed at 100%.
          const displayStatus = isCompletingAnimation ? 'running' : job.status;
          const pd = getProgressDisplay({ status: displayStatus, progress: displayProgress });
          if (!pd) return null;
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{pd.label}</p>
                <p className="text-sm text-gray-600">{pd.valueLabel}</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${pd.indeterminate ? 'bg-gray-400 animate-pulse' : 'bg-blue-600'}`}
                  style={{ width: pd.indeterminate ? '100%' : `${pd.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{pd.helperText}</p>
            </div>
          );
        })()}

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Created</p>
            <p className="text-gray-900 font-mono">
              {new Date(job.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Updated</p>
            <p className="text-gray-900 font-mono">
              {new Date(job.updated_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Last Error */}
        {job.status === 'failed' && job.last_error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-xs font-semibold text-red-800 uppercase">Error</p>
            <p className="text-sm text-red-700 mt-2">{formatUserSafeError(job.last_error)}</p>
          </div>
        )}

        {/* Transient fetch errors should not be confused with terminal job failure */}
        {transientError && isPolling && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded">
            <p className="text-xs font-semibold text-amber-800 uppercase">Temporary connection issue</p>
            <p className="text-sm text-amber-700 mt-2">
              {formatUserSafeError(transientError)}
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Retrying automatically in {Math.ceil(nextPollDelay / 1000)}s.
            </p>
          </div>
        )}

        {/* Completion CTA before auto-redirect */}
        {job.status === 'complete' && !isCompletingAnimation && redirectOnComplete && !redirectedRef.current && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              Report ready.
              {pendingRedirectDelayMs != null
                ? ` Redirecting automatically in ${Math.ceil(pendingRedirectDelayMs / 1000)}s.`
                : ' Redirecting automatically…'}
            </p>
            <button
              type="button"
              onClick={navigateToReport}
              className="mt-2 inline-flex rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100"
            >
              View report now
            </button>
          </div>
        )}

        {/* Poll Metadata (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
            <p>Polling: {isPolling ? 'active' : 'stopped'}</p>
            <p>Polls: {pollCount}</p>
            <p>Next delay: {nextPollDelay}ms</p>
          </div>
        )}
      </div>
    </div>
  );
}
