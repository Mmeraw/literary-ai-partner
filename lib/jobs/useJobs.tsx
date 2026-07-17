"use client";

import { useEffect, useRef, useState } from "react";
import type { EvaluationJobRow } from "../db/schema";
import { getPollingInterval } from "./polling";

const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled", "canceled", "stale"]);

function allJobsTerminal(jobs: EvaluationJobRow[]): boolean {
  if (jobs.length === 0) return false;
  return jobs.every((job) => TERMINAL_STATUSES.has(String(job.status)));
}

type JobsResponse = {
  jobs: EvaluationJobRow[];
};

async function fetchJobs(signal?: AbortSignal): Promise<JobsResponse> {
  const res = await fetch("/api/jobs", {
    signal,
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function createdAt(job: EvaluationJobRow): number {
  const value = new Date(job.created_at ?? 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function statusRank(job: EvaluationJobRow): number {
  const status = String(job.status);
  if (status === "running" || status === "queued") return 3;
  if (status === "complete") return 2;
  return 1;
}

/**
 * Evaluation history is a manuscript history, not a raw retry log. Keep one
 * representative row per manuscript: active attempt first, otherwise latest
 * successful report, otherwise latest failed/cancelled attempt. This prevents
 * repeated retries for one title from crowding other completed evaluations out
 * of the visible history.
 */
export function groupJobsForEvaluationHistory(jobs: EvaluationJobRow[]): EvaluationJobRow[] {
  const grouped = new Map<string, EvaluationJobRow>();

  for (const job of jobs) {
    const manuscriptKey = String(job.manuscript_id ?? job.manuscript_title ?? job.id);
    const current = grouped.get(manuscriptKey);
    if (!current) {
      grouped.set(manuscriptKey, job);
      continue;
    }

    const nextRank = statusRank(job);
    const currentRank = statusRank(current);
    if (nextRank > currentRank || (nextRank === currentRank && createdAt(job) > createdAt(current))) {
      grouped.set(manuscriptKey, job);
    }
  }

  return [...grouped.values()].sort((a, b) => createdAt(b) - createdAt(a));
}

export function useJobs() {
  const [jobs, setJobs] = useState<EvaluationJobRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const currentIntervalRef = useRef<number>(2000);

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
          const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];
          setJobs(groupJobsForEvaluationHistory(rawJobs));

          if (allJobsTerminal(rawJobs)) {
            if (timerRef.current !== null) {
              window.clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return;
          }

          const newInterval = getPollingInterval(rawJobs);
          if (newInterval !== currentIntervalRef.current) {
            currentIntervalRef.current = newInterval;
            if (timerRef.current !== null) window.clearInterval(timerRef.current);
            timerRef.current = window.setInterval(tick, newInterval);
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (mountedRef.current) {
          setIsError(true);
          setError(err as Error);
        }
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    tick();
    timerRef.current = window.setInterval(tick, currentIntervalRef.current);

    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { jobs, isLoading, isError, error };
}
