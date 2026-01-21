"use client";

import { useEffect, useRef, useState } from "react";
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

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const tick = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        setIsError(false);
        setError(null);

        const data = await fetchJobs(abortRef.current.signal);
        if (mountedRef.current) {
          setJobs(data.jobs);
          
          // Track C: Stop polling when all jobs are terminal
          if (allJobsTerminal(data.jobs)) {
            if (timerRef.current !== null) {
              window.clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
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
    };

    tick();
    timerRef.current = window.setInterval(tick, 2000);

    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

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
