"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type GrantedEval = {
  grantId: string;
  jobId: string;
  scope: string;
  expiresAt: string;
  createdAt: string;
  jobStatus: string;
  jobPhase: string | null;
  manuscriptTitle: string;
  ownerEmail: string | null;
};

export default function AdminSupportListPage() {
  const [grants, setGrants] = useState<GrantedEval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/support");
        const json = await res.json();
        if (!json.ok) {
          setError(json.error ?? "Failed to load");
        } else {
          setGrants(json.grants ?? []);
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-rg-mono text-xs text-rg-gold hover:underline">← Admin</Link>
          </div>
          <h1 className="font-rg-serif text-3xl font-semibold">User Support View</h1>
          <p className="text-sm text-rg-cream2/70">
            Evaluations where the author has granted support access. Click to view diagnostic findings and revision decisions.
          </p>
        </header>

        {loading && <p className="text-sm text-rg-cream2/50">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && grants.length === 0 && (
          <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/50 p-6 text-center">
            <p className="text-sm text-rg-cream2/60">No active support access grants.</p>
            <p className="mt-1 text-xs text-rg-cream2/40">Authors must enable the Support Access toggle on their evaluation or workbench page.</p>
          </div>
        )}

        {grants.length > 0 && (
          <div className="space-y-3">
            {grants.map((g) => (
              <Link
                key={g.grantId}
                href={`/admin/support/${g.jobId}`}
                className="group flex items-center justify-between rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4 transition hover:border-rg-gold/60 hover:bg-rg-ink2"
              >
                <div className="min-w-0">
                  <p className="font-rg-serif text-lg text-rg-cream group-hover:text-rg-gold">
                    {g.manuscriptTitle}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-rg-cream2/60">
                    {g.ownerEmail && <span>{g.ownerEmail}</span>}
                    <span>Status: <span className="text-rg-cream">{g.jobStatus}</span></span>
                    {g.jobPhase && <span>Phase: <span className="text-rg-cream">{g.jobPhase}</span></span>}
                    <span className="rounded border border-emerald-500/30 bg-emerald-950/20 px-2 py-0.5 text-emerald-400">
                      {g.scope}
                    </span>
                    <span>Expires {new Date(g.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="shrink-0 font-rg-mono text-xs text-rg-gold">View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
