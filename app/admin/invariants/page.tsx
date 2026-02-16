"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A4.3 — Invariants Dashboard Page
 *
 * Fetches /api/admin/invariants and renders invariants table.
 * Handles 200/401/403/500 with appropriate messages.
 * No service role client in browser.
 */

type InvariantRow = {
  id: string;
  name: string;
  status: "pass" | "fail" | "warn";
  severity: "high" | "medium" | "low";
  observed_count: number;
  sample_job_ids: string[];
  threshold_seconds?: number;
};

type OkResponse = {
  ok: true;
  generated_at: string;
  invariants: InvariantRow[];
};

export default function InvariantsPage() {
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [rows, setRows] = useState<InvariantRow[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorText(null);

    try {
      const res = await fetch("/api/admin/invariants", { method: "GET" });

      if (res.status === 401) {
        setRows([]);
        setGeneratedAt(null);
        setErrorText("Unauthorized");
        return;
      }

      if (res.status === 403) {
        setRows([]);
        setGeneratedAt(null);
        setErrorText("Forbidden");
        return;
      }

      if (!res.ok) {
        setRows([]);
        setGeneratedAt(null);
        setErrorText("Error loading invariants");
        return;
      }

      const data = await res.json();

      if (data.ok === true) {
        setGeneratedAt((data as OkResponse).generated_at);
        setRows((data as OkResponse).invariants);
        return;
      }

      setRows([]);
      setGeneratedAt(null);
      setErrorText("Error loading invariants");
    } catch {
      setRows([]);
      setGeneratedAt(null);
      setErrorText("Error loading invariants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusColor = (s: string) => {
    if (s === "pass") return "#16a34a";
    if (s === "fail") return "#dc2626";
    if (s === "warn") return "#ca8a04";
    return "#6b7280";
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Invariants</h1>

      <div style={{ marginBottom: 12, color: "#6b7280" }}>
        Generated at: {generatedAt ?? "\u2014"}
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: loading ? "#e5e7eb" : "#4f46e5",
            color: loading ? "#6b7280" : "#ffffff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          {loading ? "Refreshing\u2026" : "Refresh"}
        </button>
      </div>

      {errorText ? (
        <div style={{ color: "#dc2626", fontWeight: 500 }}>{errorText}</div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #e5e7eb",
          }}
        >
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>ID</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Name</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Severity</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Observed Count</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Sample Job IDs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8, fontFamily: "monospace", fontSize: 13 }}>{r.id}</td>
                <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8 }}>{r.name}</td>
                <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8, color: statusColor(r.status), fontWeight: 600 }}>{r.status}</td>
                <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8 }}>{r.severity}</td>
                <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8 }}>{r.observed_count}</td>
                <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8, fontFamily: "monospace", fontSize: 12 }}>
                  {r.sample_job_ids?.length ? r.sample_job_ids.join(", ") : "\u2014"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !errorText ? (
              <tr>
                <td style={{ padding: 8, color: "#9ca3af" }} colSpan={6}>
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
