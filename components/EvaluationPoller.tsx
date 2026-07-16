'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { getProgressDisplay } from '@/components/evaluation-poller-display';
import { formatRelativeTime, formatDuration } from '@/lib/ui/time-helpers';
import { useRouter } from 'next/navigation';
import { CancelEvaluationButton } from './evaluation/CancelEvaluationButton';
import {
  FailedJobRecovery,
  useFailedJobRecovery,
} from './evaluation/FailedJobRecovery';
import { canShowCancelEvaluation, isUserCancelled } from '@/lib/evaluation/cancelEvaluationPolicy';

// No client-side progress drift. Progress is driven 100% from backend phase state
// via getProgressDisplay. The completion sweep is visual only and ends by
// opening the canonical report page automatically.
const COMPLETE_ANIMATION_TICK_MS = 200;
const LONGFORM_WORD_COUNT_THRESHOLD = 25000;

function getInitialDisplayProgress(job: Parameters<typeof getProgressDisplay>[0] & Pick<JobState, 'pass3_completed_at' | 'manuscript_word_count'> | null): number {
  if (!job) return 0;
  if (job.status === 'failed') return 0;
  // Seed from getProgressDisplay which now handles interim-complete (synthesis pending)
  // long-form jobs at 92% instead of 100%. This prevents the bar from snapping to
  // 100% when Narrative Synthesis is still running.
  return getProgressDisplay(job)?.percentage ?? 0;
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
  last_heartbeat?: string | null;
  last_error?: string;
  failure_code?: string;
  phase_message?: string | null;
  heartbeat_age_seconds?: number | null;
  retry_count?: number | null;
  is_stalled?: boolean;
  stalled_reason?: string | null;
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
  /** Pipeline block code — when set, the eval is gated/blocked */
  block_code?: string | null;
  /** Review-gate quality signal surfaced from jobs API */
  hard_fail_present?: boolean | null;
  /** Manuscript word count from chunk_routing — available before completion */
  manuscript_word_count?: number | null;
  /** True when the caller is an operator/admin and operational details are included in this response */
  can_view_operational_details?: boolean;
  /** Public-safe failure message shown to non-operator users when the job has failed */
  public_status_message?: string | null;
  /** Monotonic ratchet — highest progress percentage ever reported. Bar never renders below this. */
  progress_high_water?: number | null;
  dashboard_status?: string | null;
  /** Issue #1011 — true when DREAM artifact exists (or short-form). */
  dream_ready?: boolean;
}

function isLongFormJob(job: Pick<JobState, 'manuscript_word_count'> | null): boolean {
  return typeof job?.manuscript_word_count === 'number' && job.manuscript_word_count >= LONGFORM_WORD_COUNT_THRESHOLD;
}

interface PollerProps {
  jobId: string;
  initialJob?: JobState | null;
  userId?: string;
  onComplete?: (job: JobState, isSuccess: boolean) => void;
  refreshInterval?: number; // ms, default 500
  redirectOnComplete?: boolean;
  refreshOnComplete?: boolean;
  /** Auto-redirect to Story Ledger when the pipeline reaches review_gate. */
  redirectOnReviewGate?: boolean;
  /** Test seam only: production uses a full-page navigation to the report. */
  reportNavigator?: (href: string) => void;
}

function defaultReportNavigator(href: string) {
  window.location.assign(href);
}

export function EvaluationPoller({
  jobId,
  initialJob = null,
  userId,
  onComplete,
  refreshInterval = 500,
  redirectOnComplete = false,
  refreshOnComplete = false,
  redirectOnReviewGate = false,
  reportNavigator = defaultReportNavigator,
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
  const [refreshBump, setRefreshBump] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // displayProgress: used only for the completion-animation sweep to 100.
  // For all running states the bar width comes directly from getProgressDisplay.
  const [displayProgress, setDisplayProgress] = useState<number>(getInitialDisplayProgress(initialJob));

  // Monotonic ratchet: track the highest percentage ever shown to the user.
  // The progress bar NEVER goes backward from the user's perspective — all internal
  // kicks, retries, and phase re-runs are invisible plumbing.
  const highWaterMarkRef = useRef<number>(getInitialDisplayProgress(initialJob));

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshedRef = useRef(false);
  const popIntoViewTriggeredRef = useRef(false);
  const completionRefreshArmedRef = useRef(false);
  const fetchJobRef = useRef<(() => Promise<void>) | null>(null);
  const unchangedCountRef = useRef(0);
  const networkErrorCountRef = useRef(0);
  const redirectedRef = useRef(false);
  const reviewGateRedirectedRef = useRef(
    // If the initial job is already at review_gate, don't redirect — the SSR
    // page already renders the review section with a direct link.
    initialJob?.phase === 'review_gate',
  );

  const navigateToReport = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    // Navigate directly to the report page — avoids the intermediate
    // /evaluate/[jobId]/report server-redirect stub which can silently
    // fail in Next.js App Router client-side navigation.
    reportNavigator(`/reports/${jobId}`);
  }, [jobId, reportNavigator]);

  // Completion sweep: animate displayProgress to 100 when the customer-facing
  // report is complete. Issue #1011: long-form waits for dream_ready; short-form
  // finishes at normal evaluation completion.
  useEffect(() => {
    if (!job || job.status !== 'complete') return;
    if (job.dream_ready === false) return;
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
  }, [displayProgress, job?.status, job?.pass3_completed_at, job?.manuscript_word_count]);

  // UX polish: when progress reaches 100%, bring the evaluation shell into view
  // and give it a brief "pop" animation so completion feels intentional.
  useEffect(() => {
    if (!job) return;
    if (popIntoViewTriggeredRef.current) return;
    if (job.status === 'failed') return;

    const isCompletingAnimation =
      job.status === 'complete' &&
      job.dream_ready !== false &&
      displayProgress < 100;

    const pd = getProgressDisplay({
      status: isCompletingAnimation ? 'running' : job.status,
      phase: job.phase ?? null,
      phase_status: job.phase_status ?? null,
      cross_check_status: job.cross_check_status ?? null,
      phase_unit_fraction: (() => {
        const total = typeof job.total_units === 'number' ? job.total_units : null;
        const done = typeof job.completed_units === 'number' ? job.completed_units : null;
        if (total && total > 0 && done !== null) return done / total;
        return null;
      })(),
      hard_fail_present: job.hard_fail_present ?? undefined,
      phase1_started_at: job.phase1_started_at ?? null,
      phase2_started_at: job.phase2_started_at ?? null,
      phase3_started_at: job.pass3_started_at ?? null,
      pass3_completed_at: job.pass3_completed_at ?? null,
      manuscript_word_count: job.manuscript_word_count ?? null,
      phase_message: job.phase_message ?? null,
      heartbeat_age_seconds: job.heartbeat_age_seconds ?? null,
      retry_count: job.retry_count ?? null,
      is_stalled: job.is_stalled ?? false,
      stalled_reason: job.stalled_reason ?? null,
      failure_code: job.failure_code ?? null,
      block_code: job.block_code ?? null,
      progress_high_water: job.progress_high_water ?? null,
    });

    if (!pd) return;

    const safeAnimated = Math.max(0, Math.min(100, displayProgress));
    const rawBarWidth = pd.indeterminate
      ? 100
      : isCompletingAnimation
      ? safeAnimated
      : Math.max(safeAnimated, pd.percentage ?? 0) + refreshBump;
    const displayedPercent = Math.max(
      0,
      Math.min(100, Math.round(Math.max(rawBarWidth, highWaterMarkRef.current))),
    );

    if (displayedPercent < 100) return;

    popIntoViewTriggeredRef.current = true;

    const target =
      document.getElementById('evaluation-overview-card') ??
      document.getElementById('evaluation-report-shell');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const offscreen = rect.top < 0 || rect.top > window.innerHeight * 0.4;
    if (offscreen) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    target.animate(
      [
        { transform: 'scale(0.988)', filter: 'brightness(1)' },
        { transform: 'scale(1.012)', filter: 'brightness(1.04)' },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      {
        duration: 560,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    );
  }, [displayProgress, job, refreshBump]);

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

  // Customer-facing completion handoff: once the bar has visibly reached 100%,
  // open the canonical report automatically. The button/link is only a fallback,
  // not a required second action.
  // Issue #1011: for long-form, hold redirect until DREAM artifact is ready.
  useEffect(() => {
    if (
      job?.status === 'complete' &&
      displayProgress >= 100 &&
      redirectOnComplete &&
      !redirectedRef.current &&
      (job.dream_ready !== false)
    ) {
      navigateToReport();
    }
  }, [displayProgress, job?.status, job?.dream_ready, navigateToReport, redirectOnComplete]);

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

      // Guard: detect non-JSON responses (Vercel timeout HTML pages, 502/504 gateways)
      const contentType = res.headers.get('content-type') ?? '';
      const isJsonResponse = contentType.includes('application/json');

      if (!res.ok) {
        const data = isJsonResponse
          ? await res.json().catch(() => ({}))
          : {};
        const serverError =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : !isJsonResponse
              ? `Server returned non-JSON response (HTTP ${res.status}). This usually means a temporary infrastructure timeout — your evaluation is likely still running.`
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

      // Guard: 200 OK but non-JSON body (rare Vercel edge case during cold starts)
      if (!isJsonResponse) {
        networkErrorCountRef.current += 1;
        setTransientError(
          'Server returned a non-JSON response despite 200 status. This is a temporary infrastructure issue — your evaluation is still running. Retrying shortly.'
        );
        scheduleNextPoll(getAdaptiveDelay(unchangedCountRef.current, networkErrorCountRef.current));
        return;
      }

      networkErrorCountRef.current = 0;
      setTransientError(null);

      const data = await res.json();
      if (data.ok && data.job) {
        const nextJob = data.job as JobState;
        const previousJob = job;

        // Compute unchanged comparison synchronously before any state updates.
        // This keeps the side-effect (ref mutation) out of the setJob updater
        // function, which is critical for React concurrent mode correctness
        // and prevents the updater from blocking user interactions.
        const unchanged =
          previousJob != null &&
          previousJob.status === nextJob.status &&
          previousJob.progress === nextJob.progress &&
          previousJob.updated_at === nextJob.updated_at &&
          previousJob.last_error === nextJob.last_error &&
          previousJob.phase === nextJob.phase &&
          previousJob.phase_status === nextJob.phase_status &&
          previousJob.total_units === nextJob.total_units &&
          previousJob.completed_units === nextJob.completed_units &&
          previousJob.cross_check_status === nextJob.cross_check_status &&
          previousJob.phase1_started_at === nextJob.phase1_started_at &&
          previousJob.phase1_completed_at === nextJob.phase1_completed_at &&
          previousJob.phase2_started_at === nextJob.phase2_started_at &&
          previousJob.phase2_completed_at === nextJob.phase2_completed_at &&
          previousJob.pass3_started_at === nextJob.pass3_started_at &&
          previousJob.pass3_completed_at === nextJob.pass3_completed_at &&
          previousJob.manuscript_word_count === nextJob.manuscript_word_count &&
          previousJob.phase0_total_duration_ms === nextJob.phase0_total_duration_ms &&
          previousJob.phase_message === nextJob.phase_message &&
          previousJob.heartbeat_age_seconds === nextJob.heartbeat_age_seconds &&
          previousJob.retry_count === nextJob.retry_count &&
          previousJob.is_stalled === nextJob.is_stalled &&
          previousJob.stalled_reason === nextJob.stalled_reason &&
          previousJob.failure_code === nextJob.failure_code;
        unchangedCountRef.current = unchanged ? unchangedCountRef.current + 1 : 0;

        // Wrap non-urgent poll state updates in startTransition so that any
        // user interaction (click, keypress) is not blocked by the re-render
        // triggered by the polling response. Also skip unchanged snapshots to
        // prevent unnecessary reconciliation during steady-state polling.
        if (!unchanged) {
          startTransition(() => {
            setJob(nextJob);
            setError(null);
          });
        }

        // Auto-redirect to Story Ledger when pipeline reaches review_gate
        if (
          redirectOnReviewGate &&
          nextJob.phase === 'review_gate' &&
          !reviewGateRedirectedRef.current
        ) {
          reviewGateRedirectedRef.current = true;
          setIsPolling(false);
          router.push(`/evaluate/${jobId}/ledger`);
          return;
        }

        // Stop polling on terminal state. Long-form complete can be interim until
        // DREAM synthesis lands (issue #1011); short-form complete is already final.
        const isTerminalComplete =
          nextJob.status === 'complete' && (nextJob.dream_ready !== false);

        if (isTerminalComplete || nextJob.status === 'failed') {
          setIsPolling(false);

          if (
            isTerminalComplete &&
            refreshOnComplete &&
            !refreshedRef.current
          ) {
            completionRefreshArmedRef.current = true;
          }

          onComplete?.(nextJob, isTerminalComplete);
          return;
        }

        const progressChanged =
          previousJob != null &&
          previousJob.status === 'running' &&
          nextJob.status === 'running' &&
          previousJob.progress !== nextJob.progress;

        if (progressChanged || (previousJob && previousJob.phase !== nextJob.phase)) {
          setRefreshBump(0);
        }

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
    jobId,
    navigateToReport,
    onComplete,
    redirectOnReviewGate,
    router,
    scheduleNextPoll,
    userId,
  ]);

  const handleManualRefresh = useCallback(() => {
    startTransition(() => {
      setRefreshBump((prev) => Math.min(prev + 1, 5));
      setIsRefreshing(true);
    });

    // Keep the click handler itself tiny for INP: let the browser paint the
    // pressed/loading state before running the no-store poll and downstream
    // React reconciliation for the report page.
    window.setTimeout(() => {
      void (async () => {
        try {
          if (fetchJobRef.current) await fetchJobRef.current();
        } finally {
          window.setTimeout(() => {
            startTransition(() => setIsRefreshing(false));
          }, 600);
        }
      })();
    }, 0);
  }, []);

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
    };
  }, [fetchJob, isPolling]);

  useEffect(() => {
    setJob(initialJob);
    setError(null);
    setTransientError(null);
    setIsPolling(true);
    setPollCount(0);
    setNextPollDelay(refreshInterval);
    setDisplayProgress(getInitialDisplayProgress(initialJob));
    completionRefreshArmedRef.current = false;
    unchangedCountRef.current = 0;
    networkErrorCountRef.current = 0;
    redirectedRef.current = false;
    refreshedRef.current = false;
    popIntoViewTriggeredRef.current = false;
  }, [initialJob, jobId, userId, refreshInterval]);

  const formatUserSafeError = (value: string) =>
    value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 600);

  // ========================================
  // Render
  // ========================================

  if (error && !job) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-800">Error</p>
        <p className="text-sm text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-sm text-stone-500">Loading job status…</p>
      </div>
    );
  }

  const isLongForm = isLongFormJob(job);
  const dreamIsReady = job.dream_ready !== false;
  const isCompletingAnimation = job.status === 'complete' && dreamIsReady && displayProgress < 100;
  const isInterimComplete = job.status === 'complete' && !dreamIsReady && !isCompletingAnimation;
  const isFinalComplete = job.status === 'complete' && dreamIsReady && !isCompletingAnimation;
  const showCancelAction =
    (job.status === 'queued' || job.status === 'running') &&
    canShowCancelEvaluation({
    status: job.status,
    dashboardStatus: job.dashboard_status,
    phaseStatus: job.phase_status,
    progress: (job as unknown as { progress?: Record<string, unknown> }).progress ?? null,
  });
  const cancelledByUser =
    job.status === 'failed'
    && isUserCancelled((job as unknown as { progress?: Record<string, unknown> }).progress ?? null);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div>
            <h3 className="font-rg-serif text-lg font-semibold text-stone-900">Job Status</h3>
          </div>
        </div>

                {/* FIX: recovery_in_progress state — show a clear message instead of a frozen bar */}
        {(job.status === 'queued' || job.status === 'running') &&
          job.dashboard_status === 'recovery_in_progress' && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-amber-700 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-900">
                Evaluation delayed — recovery is in progress
              </p>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed">
              Your writing and all completed analysis have been preserved.
              RevisionGrade is automatically resuming from the last checkpoint.
              This page will update when the evaluation restarts.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isRefreshing}
                onClick={handleManualRefresh}
                className={`inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 shadow-sm transition-colors ${
                  isRefreshing ? 'cursor-wait opacity-60' : 'hover:bg-amber-50'
                }`}
              >
                <span className={isRefreshing ? 'animate-spin inline-block' : ''}>↻</span>
                {isRefreshing ? 'Checking...' : 'Check now'}
              </button>
              <button
                type="button"
                disabled={resumeLoading || resumed}
                onClick={() => {
                  void handleResume();
                }}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                  resumeLoading || resumed
                    ? 'cursor-not-allowed border-amber-300 bg-amber-100 text-amber-500'
                    : 'border-amber-500 bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {resumeLoading ? 'Re-kicking…' : resumed ? 'Kick sent' : 'Continue Evaluation'}
              </button>
              {showCancelAction && (
                <CancelEvaluationButton
                  jobId={jobId}
                  label="Cancel"
                  returnHref="/evaluate"
                  buttonClassName="inline-flex items-center rounded-md bg-red-800 border border-red-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-900"
                />
              )}
            </div>
          </div>
        )}

        {/* Progress Bar — driven 100% from backend phase, no client-side drift */}
        {job.dashboard_status !== 'recovery_in_progress' && (() => {
          // For completion animation: use displayProgress (sweeps 0→100 client-side).
          // For all other states: use pd.percentage directly (deterministic, phase-driven).
          const pd = getProgressDisplay({
            status: isCompletingAnimation ? 'running' : job.status,
            phase: job.phase ?? null,
            phase_status: job.phase_status ?? null,
            cross_check_status: job.cross_check_status ?? null,
            phase_unit_fraction: (() => {
              const total = typeof job.total_units === 'number' ? job.total_units : null;
              const done = typeof job.completed_units === 'number' ? job.completed_units : null;
              if (total && total > 0 && done !== null) return done / total;
              return null;
            })(),
            hard_fail_present: job.hard_fail_present ?? undefined,
            phase1_started_at: job.phase1_started_at ?? null,
            phase2_started_at: job.phase2_started_at ?? null,
            phase3_started_at: job.pass3_started_at ?? null,
            pass3_completed_at: job.pass3_completed_at ?? null,
            manuscript_word_count: job.manuscript_word_count ?? null,
            phase_message: job.phase_message ?? null,
            heartbeat_age_seconds: job.heartbeat_age_seconds ?? null,
            retry_count: job.retry_count ?? null,
            is_stalled: job.is_stalled ?? false,
            stalled_reason: job.stalled_reason ?? null,
            failure_code: job.failure_code ?? null,
            block_code: job.block_code ?? null,
            progress_high_water: job.progress_high_water ?? null,
          });
          if (!pd) return null;

          // getProgressDisplay now handles interim-complete (synthesis pending)
          // and final-complete states natively — no client-side overrides needed.
          const effectivePd = pd;

          // Bar color classes derived from effectivePd.color — warm brand palette
          const barColorClass = {
            blue: 'bg-gradient-to-r from-stone-600 to-stone-500',
            amber: 'bg-gradient-to-r from-amber-600 to-amber-500',
            red: 'bg-gradient-to-r from-red-700 to-red-600',
            green: 'bg-gradient-to-r from-stone-700 to-stone-600',
          }[effectivePd.color];

          const labelColorClass = {
            blue: 'text-stone-700',
            amber: 'text-amber-800 font-semibold',
            red: 'text-red-800 font-semibold',
            green: 'text-stone-700',
          }[effectivePd.color];

          // Bar fill: use displayProgress (animated, seeded from backend) for all non-terminal states.
          // Monotonic ratchet: bar NEVER goes backward from user's perspective.
          const safeAnimated = Math.max(0, Math.min(100, displayProgress));
          const rawBarWidth = effectivePd.indeterminate
            ? 100
            : isCompletingAnimation
            ? safeAnimated
            : Math.max(safeAnimated, effectivePd.percentage ?? 0) + refreshBump;
          // Apply monotonic ratchet — only ever advance forward
          if (rawBarWidth > highWaterMarkRef.current) {
            highWaterMarkRef.current = rawBarWidth;
          }
          const barWidth = Math.max(rawBarWidth, highWaterMarkRef.current);
          const nonTerminalCap = job.status === 'complete' ? 100 : 99;
          const displayedPercent = Math.max(0, Math.min(nonTerminalCap, Math.round(barWidth)));
          return (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className={`text-xl font-semibold leading-8 sm:text-2xl ${labelColorClass}`}>{effectivePd.label}</p>
                <p className="text-sm font-semibold text-stone-600" aria-label={`Completion ${displayedPercent}%`}>
                  {displayedPercent}%
                </p>
              </div>
              <div className="w-full rounded-full h-2.5" style={{ backgroundColor: '#E8E4DD' }}>
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ease-out ${barColorClass}`}
                  style={{ width: `${Math.min(barWidth, nonTerminalCap)}%` }}
                />
              </div>
              <p className="text-xs text-stone-500">{effectivePd.helperText}</p>
              {isInterimComplete && (
                <p className="text-xs text-gray-400 mt-1">
                  Your full diagnostic report is ready below — scores, evidence, confidence, and revision recommendations are all final.
                  The Narrative Synthesis section will appear automatically once it finishes generating.
                </p>
              )}
              {(job.status === 'queued' || job.status === 'running') && (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    disabled={isRefreshing}
                    onClick={handleManualRefresh}
                    className={`inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${isRefreshing ? 'text-stone-400 cursor-wait' : 'text-stone-700 hover:bg-stone-50'}`}
                  >
                    <span className={isRefreshing ? 'animate-spin inline-block' : ''}>↻</span>
                    {isRefreshing ? 'Checking...' : 'Refresh'}
                  </button>
                  {job.status === 'queued' && pollCount > 10 && (
                    <span className="text-xs text-stone-400">Still preparing?</span>
                  )}
                  {job.status === 'running' && pollCount > 30 && (
                    <span className="text-xs text-stone-400">Taking longer than expected?</span>
                  )}
                </div>
              )}
              {(job.status === 'queued' || job.status === 'running') && (
                <p className="text-xs text-stone-400 mt-2">
                  {isLongFormJob(job)
                    ? 'Full-length works may take over an hour to evaluate.'
                    : 'Short passages typically take 15 minutes or more to evaluate.'}
                </p>
              )}
            </div>
          );
        })()}

        {/* Progress bar label + helper text is sufficient — no internal pipeline stages exposed */}

        {/* Timestamps — show relative/elapsed time, not raw timestamps */}
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4" style={{ borderTop: '1px solid #E8E4DD', paddingTop: '1rem' }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">Started</p>
            <p className="mt-1 text-sm text-stone-800">
              {formatRelativeTime(job.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
              {job.status === 'complete' ? 'Completed' : 'Updated'}
            </p>
            <p className="mt-1 text-sm text-stone-800">
              {job.status === 'running' || job.status === 'queued'
                ? `Running for ${formatDuration(
                    job.pass3_started_at
                    ?? job.phase2_started_at
                    ?? job.phase1_started_at
                    ?? job.created_at
                  )}`
                : formatRelativeTime(job.updated_at)}
            </p>
          </div>
          {(job.status === 'running' || job.status === 'queued') && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-stone-400">Total Elapsed</p>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {formatDuration(job.created_at)}
              </p>
            </div>
          )}
          {showCancelAction && (
            <div className="flex items-end justify-start sm:justify-end">
              <CancelEvaluationButton
                jobId={jobId}
                label="Cancel Evaluation"
                returnHref="/evaluate"
                buttonClassName="inline-flex items-center rounded-md bg-red-800 border border-red-900 px-3 py-2 text-xs font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-red-900"
              />
            </div>
          )}
        </div>

        {/* Failed-job recovery: checkpoint-aware resume button */}
        {job.status === 'failed' && (
          <div className="space-y-3">
            {/* Operational error detail — operators only */}
            {job.can_view_operational_details && job.last_error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-800 uppercase">Error</p>
                <p className="text-sm text-red-700 mt-2">{formatUserSafeError(job.last_error)}</p>
              </div>
            ) : null}
            <FailedJobRecovery
              jobId={jobId}
              checkpoint={checkpoint}
              resumeLoading={resumeLoading}
              resumeError={resumeError}
              resumed={resumed}
              onResume={handleResume}
              showOperationalDetails={job.can_view_operational_details ?? false}
              cancelledByUser={cancelledByUser}
            />
          </div>
        )}

        {/* Transient fetch errors should not be confused with terminal job failure */}
        {transientError && isPolling && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800 uppercase">Temporary connection issue</p>
            <p className="text-sm text-amber-700 mt-2">
              {formatUserSafeError(transientError)}
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Retrying automatically in {Math.ceil(nextPollDelay / 1000)}s.
            </p>
          </div>
        )}

        {(job.status === 'queued' || job.status === 'running') && job.is_stalled && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-800 uppercase">Evaluation stalled</p>
            <p className="text-sm text-red-700 mt-2">
              {formatUserSafeError(
                job.stalled_reason ||
                (typeof job.heartbeat_age_seconds === 'number'
                  ? `No progress update for ${job.heartbeat_age_seconds}s. The worker may be stuck.`
                  : 'No progress updates detected. The worker may be stuck.'),
              )}
            </p>
            {typeof job.retry_count === 'number' && (
              <p className="text-xs text-red-700 mt-1">Retry attempts observed: {job.retry_count}</p>
            )}
          </div>
        )}

        {/* Completion handoff — Final state auto-opens report; fallback link only. */}
        {isFinalComplete && redirectOnComplete && !redirectedRef.current && (
          <div className="rounded-lg border p-3" style={{ backgroundColor: '#F2EFEA', borderColor: '#A98E4A' }}>
            <p className="text-sm text-stone-800">
              {isLongForm ? 'Final report ready.' : 'Evaluation report ready.'}
              {' Opening automatically…'}
            </p>
            <a
              href={`/reports/${jobId}`}
              className="mt-2 inline-flex rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
            >
              {isLongForm ? 'View Final Report' : 'View Evaluation Report'}
            </a>
          </div>
        )}
        {isInterimComplete && redirectOnComplete && !redirectedRef.current && (
          <div className="rounded-lg border p-3" style={{ backgroundColor: '#F2EFEA', borderColor: '#D6D0C4' }}>
            <p className="text-sm text-stone-700">
              Diagnostic report ready. Finalizing your report is still generating — the full report will appear automatically when complete.
            </p>
            <button
              type="button"
              onClick={navigateToReport}
              className="mt-2 inline-flex rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
            >
              View Diagnostic Report
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
