"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { EvaluationJobRow } from "../db/schema";

/**
 * Track C: Check if all jobs have terminal status
 * Stops polling when no active jobs remain
 */
function allJobsTerminal(jobs: EvaluationJobRow[]): boolean {
  if (jobs.length === 0) return false;
  return jobs.every(
    (job) =>
      job.status === "complete" ||
      job.status === "failed" ||
      job.status === "canceled"
  );
}

function isTerminal(status: string) {
  return status === "complete" || status === "failed" || status === "canceled";
}

function computePollMs(elapsedMs: number) {
  if (elapsedMs < 30_000) return 2_000;
  if (elapsedMs < 120_000) return 5_000;
  return 10_000;
}

type JobsResponse = {
  jobs: EvaluationJobRow[];
};

async function fetchJobs(signal?: AbortSignal): Promise<JobsResponse> {
  const res = await fetch("/api/jobs", { signal });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

type RunPhase1Response = {
  ok: boolean;
  job?: any;
  error?: string;
};

async function runPhase1(jobId: string): Promise<RunPhase1Response> {
  const res = await fetch(`/api/jobs/${jobId}/run-phase1`, {
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Run Phase 1 failed: ${res.status} ${text}`);
  }

  return res.json();
}

export function useJobs() {
  const [jobs, setJobs] = useState<EvaluationJobRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [isRunningPhase1, setIsRunningPhase1] = useState(false);
  const [runPhase1Error, setRunPhase1Error] = useState<Error | null>(null);

  // Track when we first saw each job as non-terminal (UI-local clock).
  const firstSeenActiveAtRef = useRef<Map<string, number>>(new Map());

  // One timer at a time.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const fetchJobsCallback = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      setIsError(false);
      setError(null);

      const data = await fetchJobs(abortRef.current.signal);

      if (!mountedRef.current) return;

      const now = Date.now();
      const nextJobs: EvaluationJobRow[] = data.jobs ?? [];
      setJobs(nextJobs);

      // Update first-seen timestamps for active jobs; remove entries for terminal jobs.
      for (const j of nextJobs) {
        if (isTerminal(j.status)) {
          firstSeenActiveAtRef.current.delete(j.id);
        } else {
          if (!firstSeenActiveAtRef.current.has(j.id)) {
            firstSeenActiveAtRef.current.set(j.id, now);
          }
        }
      }

      // Also clean up any ids we no longer see at all (deleted / filtered / etc.).
      const visibleIds = new Set(nextJobs.map((j) => j.id));
      for (const id of firstSeenActiveAtRef.current.keys()) {
        if (!visibleIds.has(id)) firstSeenActiveAtRef.current.delete(id);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;

      if (mountedRef.current) {
        setIsError(true);
        setError(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    stoppedRef.current = false;

    const tick = async () => {
      if (stoppedRef.current) return;

      await fetchJobsCallback();

      if (stoppedRef.current) return;

      // If everything visible is terminal (or no jobs), stop polling.
      const activeSince = Array.from(firstSeenActiveAtRef.current.values());
      if (activeSince.length === 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        return;
      }

      // For a jobs list, pick the fastest required interval among active jobs
      // (i.e., the *minimum* poll delay) to stay responsive.
      const now = Date.now();
      let nextDelay = 10_000;

      for (const startedAt of activeSince) {
        const elapsed = now - startedAt;
        const ms = computePollMs(elapsed);
        if (ms < nextDelay) nextDelay = ms;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tick, nextDelay);
    };

    // Start immediately.
    tick();

    return () => {
      mountedRef.current = false;
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      abortRef.current?.abort();
    };
  }, [fetchJobsCallback]);

  const runPhase1ForJob = async (jobId: string) => {
    try {
      setIsRunningPhase1(true);
      setRunPhase1Error(null);
      await runPhase1(jobId);
      // polling will refresh job state automatically
    } catch (err) {
      setRunPhase1Error(err as Error);
    } finally {
      setIsRunningPhase1(false);
    }
  };

  return {
    jobs,
    isLoading,
    isError,
    error,
    runPhase1ForJob,
    isRunningPhase1,
    runPhase1Error,
  };
}
