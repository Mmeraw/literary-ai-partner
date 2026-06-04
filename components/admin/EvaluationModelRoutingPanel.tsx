"use client";

import { useCallback, useEffect, useState } from "react";

interface ModelRouteRow {
  phase: string;
  purpose: string;
  model: string;
  source: string;
}

interface ModelRoutingPayload {
  defaultModel: string;
  rows: ModelRouteRow[];
  pricingNote: string;
}

function modelTone(model: string): string {
  const normalized = model.toLowerCase();
  if (normalized.includes("mini") || normalized.includes("nano") || normalized.includes("4o")) return "text-emerald-300";
  if (normalized.includes("4.1") || normalized.includes("5")) return "text-rg-gold";
  return "text-rg-cream";
}

export default function EvaluationModelRoutingPanel() {
  const [data, setData] = useState<ModelRoutingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/costs/model-routing", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not load model routing.");
      setData(json.data as ModelRoutingPayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load model routing.");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <section className="rounded-lg border border-rg-gold/25 bg-rg-ink2/70 p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="font-rg-serif text-xl text-rg-cream">Evaluation Model Routing</h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-rg-cream2/75">
            Configured model ladder by evaluation phase. Spend below still comes from actual recorded model telemetry per API call.
          </p>
        </div>
        <button onClick={fetchData} className="rounded border border-rg-cream2/20 px-4 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2 transition hover:border-rg-gold/60 hover:text-rg-cream">
          Refresh Routing
        </button>
      </div>

      {error && <p className="mt-4 rounded border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-300">{error}</p>}

      {!data && !error && <p className="mt-4 text-sm text-rg-cream2/60">Loading model routing...</p>}

      {data && (
        <>
          <div className="mt-4 rounded border border-rg-cream2/10 bg-rg-ink/55 p-3 font-rg-mono text-xs text-rg-cream2/80">
            Global fallback: <span className={modelTone(data.defaultModel)}>{data.defaultModel}</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rg-cream2/10">
                  {["Phase", "Purpose", "Configured Model", "Resolved From"].map((h) => (
                    <th key={h} className="px-3 py-2 font-rg-mono text-xs uppercase tracking-wider text-rg-cream2/60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rg-cream2/5">
                {data.rows.map((row) => (
                  <tr key={`${row.phase}-${row.purpose}`} className="transition hover:bg-rg-ink2/50">
                    <td className="whitespace-nowrap px-3 py-3 font-rg-mono text-xs text-rg-cream">{row.phase}</td>
                    <td className="px-3 py-3 text-sm text-rg-cream2/80">{row.purpose}</td>
                    <td className={`whitespace-nowrap px-3 py-3 font-rg-mono text-xs font-semibold ${modelTone(row.model)}`}>{row.model}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-rg-mono text-xs text-rg-cream2/65">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-7 text-rg-cream2/75">{data.pricingNote}</p>
        </>
      )}
    </section>
  );
}
