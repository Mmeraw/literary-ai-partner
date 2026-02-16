// app/admin/invariants/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type InvariantRow = {
  id: string;
  name: string;
  status: "pass" | "fail" | "warn";
  severity: "high" | "medium" | "low";
  observed_count: number;
  sample_job_ids: string[];
};

type OkResponse = {
  ok: true;
  generated_at: string;
  invariants: InvariantRow[];
};

type ErrResponse = { ok: false; error: string; details?: string };

export default function InvariantsPage() {
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [rows, setRows] = useState<InvariantRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/invariants", { method: "GET" });

      if (res.status === 401) {
        setRows([]);
        setGeneratedAt(null);
        setMessage("Unauthorized");
        return;
      }

      if (res.status === 403) {
        setRows([]);
        setGeneratedAt(null);
        setMessage("Forbidden");
        return;
      }

      if (!res.ok) {
        setRows([]);
        setGeneratedAt(null);
        setMessage("Error loading invariants");
        return;
      }

      const data = (await res.json()) as OkResponse | ErrResponse;

      if (data.ok) {
        setGeneratedAt(data.generated_at);
        setRows(data.invariants);
        return;
      }

      setRows([]);
      setGeneratedAt(null);
      setMessage("Error loading invariants");
    } catch {
      setRows([]);
      setGeneratedAt(null);
      setMessage("Error loading invariants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Invariants</h1>

      <div style={{ marginBottom: 12 }}>
        Generated at: {generatedAt ?? "\u2014"}
      </div>

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
          {loading ? "Refreshing\u2026" : "Refresh"}
        </button>
      </div>

      {message ? (
        <div>{message}</div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #ddd",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>ID</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Severity</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Observed Count</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Sample Job IDs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.id}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.name}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.status}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.severity}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.observed_count}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  {r.sample_job_ids?.length ? r.sample_job_ids.join(", ") : "\u2014"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td style={{ padding: 8 }} colSpan={6}>
                  No invariants to display.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </div>
  );
}
