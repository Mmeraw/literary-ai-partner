"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type JobStatus = "queued" | "running" | "complete" | "failed";

type JobProbeResponse = {
  ok?: boolean;
  job?: {
    status?: JobStatus;
  };
  error?: string;
};

type ResumeResponse = {
  success?: boolean;
  error?: string;
  message?: string;
};

type EvaluationUnavailableReloadButtonProps = {
  jobId: string;
};

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Active reload control for the report/status unavailable state.
 *
 * A same-route <Link> can be a no-op in the Next.js client router. This button
 * performs real work: it checks the canonical no-store job API, nudges queued or
 * recoverable failed jobs through the resume/kickoff endpoint, and then refreshes
 * the current server component tree.
 */
export default function EvaluationUnavailableReloadButton({
  jobId,
}: EvaluationUnavailableReloadButtonProps) {
  const router = useRouter();
  const [isReloading, setIsReloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReload = useCallback(async () => {
    if (isReloading) return;

    setIsReloading(true);
    setMessage("Checking evaluation status…");

    try {
      const encodedJobId = encodeURIComponent(jobId);
      const statusResponse = await fetch(`/api/jobs/${encodedJobId}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });
      const statusPayload = await readJson<JobProbeResponse>(statusResponse);

      if (!statusResponse.ok || statusPayload?.ok !== true || !statusPayload.job) {
        const detail =
          statusPayload?.error ??
          (statusResponse.status === 401
            ? "Please sign in again to view this evaluation."
            : statusResponse.status === 404
              ? "The evaluation is still not accessible for this signed-in account."
              : "The evaluation status could not be checked yet.");
        setMessage(`${detail} Refreshing the page now…`);
        router.refresh();
        return;
      }

      const status = statusPayload.job.status;
      if (status === "queued" || status === "failed") {
        setMessage(status === "queued" ? "Evaluation found. Restarting worker pickup…" : "Evaluation found. Attempting recovery…");
        const resumeResponse = await fetch(`/api/jobs/${encodedJobId}/resume`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
        const resumePayload = await readJson<ResumeResponse>(resumeResponse);

        if (!resumeResponse.ok || resumePayload?.success !== true) {
          setMessage(
            resumePayload?.error ??
              "The evaluation was found, but automatic recovery could not be started. Refreshing the page now…",
          );
          router.refresh();
          return;
        }

        setMessage(resumePayload.message ?? "Evaluation recovery restarted. Refreshing…");
      } else {
        setMessage("Evaluation found. Refreshing…");
      }

      router.refresh();
    } catch (err) {
      console.error("[EvaluationUnavailableReloadButton] reload failed", err);
      setMessage("Reload could not reach the server. Refreshing the page now…");
      router.refresh();
    } finally {
      setIsReloading(false);
    }
  }, [isReloading, jobId, router]);

  return (
    <div className="inline-flex flex-col gap-2">
      <button
        type="button"
        onClick={handleReload}
        disabled={isReloading}
        className="inline-block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:cursor-wait disabled:opacity-70"
      >
        {isReloading ? "Reloading…" : "Reload"}
      </button>
      {message && (
        <p className="max-w-md text-xs text-gray-600" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
