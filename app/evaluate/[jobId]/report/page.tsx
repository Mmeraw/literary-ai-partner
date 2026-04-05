// app/evaluate/[jobId]/report/page.tsx
"use client";

import { useEffect, useState } from "react";

/**
 * Canonical artifact type for Flow 1 one-page summary.
 * Governance: This must match ARTIFACT_TYPES.ONE_PAGE_SUMMARY in writeArtifact.ts.
 */
const REPORT_ARTIFACT_TYPE = "one_page_summary";

type Ok = {
  ok: true;
  job_id: string;
  status: string;
  evaluation_result: any;
  source?: "artifact" | "inline_job_result";
};

type Err = {
  ok: false;
  error: string;
  details?: string;
};

export default function ReportPage({ params }: { params: { jobId: string } }) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<Ok | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    setData(null);

    try {
      const res = await fetch(`/api/evaluations/${params.jobId}`, { method: "GET" });

      if (res.status === 401) return setMessage("Please log in.");
      if (res.status === 403) return setMessage("You do not own this evaluation.");
      if (res.status === 409) return setMessage("Evaluation still processing.");
      if (!res.ok) return setMessage("Error loading report.");

      const json = (await res.json()) as Ok | Err;

      if ((json as Ok).ok) {
        // Governance: report page requires canonical artifact source
        if ((json as any).source === "inline_job_result") {
          setMessage("Phase 2 artifact not yet available. Showing job detail page instead may provide interim results.");
          return;
        }
        setData(json as Ok);
        return;
      }

      setMessage("Error loading report.");
    } catch {
      setMessage("Error loading report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.jobId]);


  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Evaluation Report
      </h1>

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {message ? <div>{message}</div> : null}

      {data ? (
        <div>
          <div style={{ marginBottom: 8 }}>
            <strong>Job:</strong> {data.job_id}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Status:</strong> {data.status}
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Generated at:</strong>{" "}
            {data.evaluation_result?.generated_at ?? "—"}
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Summary:</strong>{" "}
            {data.evaluation_result?.summary ?? "—"}
          </div>

          <div>
            <strong>Metrics</strong>
            <ul>
              <li>completeness: {data.evaluation_result?.metrics?.completeness ?? "—"}</li>
              <li>coherence: {data.evaluation_result?.metrics?.coherence ?? "—"}</li>
              <li>readiness: {data.evaluation_result?.metrics?.readiness ?? "—"}</li>
            </ul>
          </div>

          <div style={{ marginTop: 16 }}>
            <strong>Artifact type:</strong> {REPORT_ARTIFACT_TYPE}
          </div>

          {process.env.NODE_ENV !== "production" && (
            <div style={{ marginTop: 16 }}>
              <strong>Raw Result (debug)</strong>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(data.evaluation_result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
