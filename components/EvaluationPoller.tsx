'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getProgressDisplay } from '@/components/evaluation-poller-display';
import { formatRelativeTime, formatDuration } from '@/lib/ui/time-helpers';
import { useRouter } from 'next/navigation';
import { CancelEvaluationButton } from './evaluation/CancelEvaluationButton';
import {
  FailedJobRecovery,
  useFailedJobRecovery,
} from './evaluation/FailedJobRecovery';

// No client-side progress drift. Progress is driven 100% from backend phase state
// via getProgressDisplay. Constants below retained only for redirect animation.
const COMPLETE_ANIMATION_TICK_MS = 200;

function getInitialDisplayProgress(job: JobState | null): number {
  if (!job) return 0;
  if (job.status === 'complete') return 100;
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
  // Canonical pipeline-stage fields (additive; may be absent on older API responses).
  // When present these are authoritative for stage label resolution and are decoupled
  // from the smoothly-animated visual progress bar.
  phase?: 'phase_0' | 'phase_1a' | 'review_gate' | 'phase_2' | 'phase_3' | 'wave_revision' | null;
  phase_status?: 'queued' | 'running' | 'complete' | 'failed' | 'awaiting_approval' | null;
  // Raw unit counters — used to compute the within-phase fraction for
  // early vs late phase_1a label selection. Additive; absent on older jobs.
  total_units?: number | null;
  completed_units?: number | null;
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
  // Per-stage timestamps (additive; absent on older API responses).
  // Consumed by the truthful, stage-weighted progress display. Optional so
  // the type compiles against pre-#509 server responses; the display module
  // falls back to an indeterminate shimmer when a stage's timestamp is
  // unavailable, rather than inventing fake forward motion.
  phase1_started_at?: string | null;
  phase1_completed_at?: string | null;
  phase2_started_at?: string | null;
  phase2_completed_at?: string | null;
  pass3_started_at?: string | null;
  pass3_completed_at?: string | null;
  /** Authoritative Phase 0 telemetry — from progress JSONB, not column delta */
  phase0_total_duration_ms?: number | null;
  phase0_calibration_word_count?: number | null;
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

  // PR-E / PR-595: Failed-job recovery — checkpoint detection + resume button.
  // The hook reads job.progress to derive checkpoint info without an extra
  // network round-trip. The actual resume is POSTed to /api/jobs/[jobId]/resume.
  const jobProgressAsRecord =
    job?.status === 'failed' && job != null
      ? (job as unknown as { progress?: Record<string, unknown> }).progress ?? null
      : null;
  const { checkpoint, resumeLoading, resumeError, resumed, handleResume } =
    useFailedJobRecovery(
      jobId,
      job?.status ?? null,
      jobProgressAsRecord,
      // After a successful resume the poller needs to restart. Reset isPolling
      // by triggering a re-fetch — the hook calls onResumed which we use to
      // kick off a fresh poll cycle by resetting the job state to null briefly.
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

  // displayProgress: used only for the completion-animation sweep to 100.
  // For all running states the bar width comes directly from getProgressDisplay.
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

  // Completion sweep: animate displayProgress to 100 only when backend status=complete.
  // For all running/queued states the bar width is driven directly by getProgressDisplay.
  useEffect(() => {
    if (!job || job.status !== 'complete') return;
    if (displayProgress >= 100) return;

    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, COMPLETE_ANIMATION_TICK_MS);

    return () => clearInterval(interval);
  }, [displayProgress, job?.status]);

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
            prev.last_error === nextJob.last_error &&
            prev.phase === nextJob.phase &&
            prev.phase_status === nextJob.phase_status &&
            prev.total_units === nextJob.total_units &&
            prev.completed_units === nextJob.completed_units &&
            prev.cross_check_status === nextJob.cross_check_status &&
            prev.phase1_started_at === nextJob.phase1_started_at &&
            prev.phase1_completed_at === nextJob.phase1_completed_at &&
            prev.phase2_started_at === nextJob.phase2_started_at &&
            prev.phase2_completed_at === nextJob.phase2_completed_at &&
            prev.pass3_started_at === nextJob.pass3_started_at &&
            prev.pass3_completed_at === nextJob.pass3_completed_at &&
            prev.phase0_total_duration_ms === nextJob.phase0_total_duration_ms;

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
            <p className="text-sm text-gray-500 mt-1">ID: {job.id.slice(0, 8)}&hellip;</p>
          </div>
          <p className={`text-lg font-semibold ${statusColor}`}>{statusLabel}</p>
        </div>

                {/* Progress Bar — driven 100% from backend phase, no client-side drift */}
        {(() => {
          // For completion animation: use displayProgress (sweeps 0→100 client-side).
          // For all other states: use pd.percentage directly (deterministic, phase-driven).
          const pd = getProgressDisplay({
            status: isCompletingAnimation ? 'running' : job.status,
            phase: job.phase ?? null,
            phase_status: job.phase_status ?? null,
            cross_check_status: job.cross_check_status ?? null,
            // Early vs late phase_1a: use the top-level total_units/completed_units
            // fields returned by the API (not the rolled-up numeric progress percentage).
            phase_unit_fraction: (() => {
              const total = typeof job.total_units === 'number' ? job.total_units : null;
              const done = typeof job.completed_units === 'number' ? job.completed_units : null;
              if (total && total > 0 && done !== null) return done / total;
              return null;
            })(),
          });
          if (!pd) return null;

          // Bar color classes derived from pd.color
          const barColorClass = {
            blue: 'bg-blue-600',
            amber: 'bg-amber-500',
            red: 'bg-red-600',
            green: 'bg-green-600',
          }[pd.color];

          const labelColorClass = {
            blue: 'text-gray-700',
            amber: 'text-amber-800 font-semibold',
            red: 'text-red-800 font-semibold',
            green: 'text-green-700',
          }[pd.color];

          // Completion animation uses displayProgress; all other states use pd.percentage.
          const barWidth = isCompletingAnimation ? displayProgress : pd.percentage;

          return (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <p className={`text-sm ${labelColorClass}`}>{pd.label}</p>
                <p className="text-sm text-gray-600 shrink-0">{pd.valueLabel}</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${barColorClass}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{pd.helperText}</p>
              {job.status === 'running' && pollCount > 10 && !pd.hardStop && (
                <p className="text-xs text-gray-500">
                  Experiencing delays?{' '}
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="underline text-gray-600 cursor-pointer"
                  >
                    Refresh
                  </button>
                </p>
              )}
            </div>
          );
        })()}

        {/* Pipeline stage mini-timeline — sequential, backend-driven only.
             Phase 0 ✓ is proven by phase0_total_duration_ms ≥ 12000 from JSONB telemetry.
             NOT from phase0_completed_at column (that has legacy cosmetic stamp paths).
             Pass 3A preflight is NOT concurrent — it runs after all Phase 1A chunks are cached. */}
        {(job.phase === 'phase_0' || job.phase === 'phase_1a' || job.phase === 'phase_2' || job.phase === 'phase_3') && job.status !== 'failed' && (() => {
          const phase0Proven = typeof job.phase0_total_duration_ms === 'number' && job.phase0_total_duration_ms >= 12000;
          const phase0Running = job.phase === 'phase_0' && job.status === 'running';
          const phase1aActive = job.phase === 'phase_1a';
          const phase2Active = job.phase === 'phase_2';
          const phase3Active = job.phase === 'phase_3';
          return (
            <div className="text-xs text-gray-500 space-y-1.5 border-t pt-3">
              {/* Stage 1: Calibration */}
              <div className="flex items-center gap-2">
                {phase0Proven
                  ? <span className="text-green-700 font-medium">✓</span>
                  : phase0Running
                    ? <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse inline-block" />
                    : <span className="h-2 w-2 rounded-full bg-gray-300 inline-block" />}
                <span className={phase0Proven ? 'text-green-800' : phase0Running ? 'text-gray-700' : 'text-gray-400'}>
                  {phase0Proven
                    ? `Calibrating evaluation standards — complete (${Math.round((job.phase0_total_duration_ms ?? 0) / 1000)}s · ${job.phase0_calibration_word_count ?? '?'} words)`
                    : phase0Running
                      ? 'Calibrating evaluation standards…'
                      : 'Calibration — pending'}
                </span>
              </div>
              {/* Stage 2: Manuscript read + preflight (sequential, after Phase 0) */}
              {(phase1aActive || phase2Active || phase3Active) && (
                <div className="flex items-center gap-2">
                  {(phase2Active || phase3Active)
                    ? <span className="text-green-700 font-medium">✓</span>
                    : <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse inline-block" />}
                  <span className={(phase2Active || phase3Active) ? 'text-green-800' : 'text-gray-700'}>
                    {(phase2Active || phase3Active)
                      ? 'Manuscript analysis + structural preflight — complete'
                      : 'Manuscript analysis + structural preflight — in progress…'}
                  </span>
                </div>
              )}
              {/* Stage 3: Craft diagnostics */}
              {(phase2Active || phase3Active) && (
                <div className="flex items-center gap-2">
                  {phase3Active
                    ? <span className="text-green-700 font-medium">✓</span>
                    : <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse inline-block" />}
                  <span className={phase3Active ? 'text-green-800' : 'text-gray-700'}>
                    {phase3Active
                      ? 'Craft diagnostics — complete'
                      : 'Craft diagnostics — in progress…'}
                  </span>
                </div>
              )}
              {/* Stage 4: Synthesis */}
              {phase3Active && (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse inline-block" />
                  <span className="text-gray-700">Assembling evaluation matrix…</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Timestamps — show relative/elapsed time, not raw timestamps */}
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-gray-600">Started</p>
            <p className="text-gray-900">
              {formatRelativeTime(job.created_at)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">
              {job.status === 'complete' ? 'Completed' : 'Updated'}
            </p>
            <p className="text-gray-900">
              {job.status === 'running' || job.status === 'queued'
                ? `Running for ${formatDuration(job.created_at)}`
                : formatRelativeTime(job.updated_at)}
            </p>
          </div>
          {(job.status === 'queued' || job.status === 'running') && (
            <div className="flex items-end justify-start sm:justify-end lg:justify-start">
              <CancelEvaluationButton
                jobId={jobId}
                label="Cancel Evaluation"
                buttonClassName="inline-flex items-center rounded-md border border-red-600 bg-red-600 px-3 py-2 text-xs font-bold tracking-wide text-white shadow-sm hover:bg-red-700"
              />
            </div>
          )}
        </div>

        {/* Failed-job recovery: checkpoint-aware resume button */}
        {job.status === 'failed' && (
          <div className="space-y-3">
            {/* Surface the raw error detail above the recovery panel for transparency */}
            {job.last_error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-xs font-semibold text-red-800 uppercase">Error</p>
                <p className="text-sm text-red-700 mt-2">{formatUserSafeError(job.last_error)}</p>
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
