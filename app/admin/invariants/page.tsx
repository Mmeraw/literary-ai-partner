// app/admin/invariants/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link href="/admin" className="text-sm text-rg-gold underline">← Back to Admin</Link>
          <p className="mt-4 font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Admin · Invariants</p>
          <h1 className="mt-2 font-rg-serif text-3xl font-semibold">Invariants</h1>
        </header>

        <p className="text-sm text-rg-cream2/70">
          Generated at: {generatedAt ?? "\u2014"}
        </p>

        <div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded bg-rg-gold px-4 py-2 text-sm font-bold text-rg-ink hover:bg-amber-400 disabled:bg-rg-cream2/20 disabled:text-rg-cream2/40 disabled:cursor-not-allowed"
          >
            {loading ? "Refreshing\u2026" : "Refresh"}
          </button>
        </div>

        {message ? (
          <div className="text-rg-cream2/70">{message}</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-rg-cream2/15 bg-rg-ink2/70">
            <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
              <thead className="bg-rg-ink2">
                <tr>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">ID</th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">Name</th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">Status</th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">Severity</th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">Observed Count</th>
                  <th className="px-4 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">Sample Job IDs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rg-cream2/10">
                {rows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-rg-ink2/50">
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream">{r.id}</td>
                    <td className="px-4 py-3 text-rg-cream">{r.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">{r.status}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">{r.severity}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-rg-cream2/70">{r.observed_count}</td>
                    <td className="px-4 py-3 text-rg-cream2/70">
                      {r.sample_job_ids?.length ? r.sample_job_ids.join(", ") : "\u2014"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-rg-cream2/40" colSpan={6}>
                      No invariants to display.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
