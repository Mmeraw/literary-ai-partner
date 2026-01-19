"use client";

import { useEffect, useRef, useState } from "react";
import type { EvaluationJobRow } from "../db/schema";

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

export function useJobs() {
  const [jobs, setJobs] = useState<EvaluationJobRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;

    const tick = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        if (mountedRef.current) {
          setIsError(false);
          setError(null);
        }

        const data = await fetchJobs(abortRef.current.signal);

        if (mountedRef.current) {
          setJobs(data.jobs);
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

  return {
    jobs,
    isLoading,
    isError,
    error,
  };
}
