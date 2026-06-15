"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAllowlist";

export default function AdminDiagnosticsModule() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [jobId, setJobId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/user", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        const email = data?.user?.email ?? null;
        setIsAdmin(isPipelineHealthAdminEmail(email));
        setChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
        setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function openForensics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = jobId.trim();
    if (!normalized) return;
    router.push(`/admin/forensics/${encodeURIComponent(normalized)}`);
  }

  if (!checked || !isAdmin) {
    return null;
  }

  return (
    <section className="border-y border-rg-gold/25 bg-rg-ink2/60">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Admin module · private</p>
        <h2 className="mt-4 font-rg-serif text-3xl text-rg-cream">Diagnostics Console</h2>
        <p className="mt-4 max-w-3xl text-rg-cream2/75">
          Visible only to your admin account. Open pipeline diagnostics, forensics, and reliability telemetry directly from Resources.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link href="/admin/diagnostics" className="border border-rg-cream2/20 bg-rg-ink/60 p-5 hover:border-rg-gold/70">
            <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.18em] text-rg-gold">Operations</p>
            <h3 className="mt-2 font-rg-serif text-xl text-rg-cream">Diagnostics</h3>
            <p className="mt-2 text-sm text-rg-cream2/70">Phase timing, failures, and system observability panels.</p>
          </Link>

          <Link href="/admin/pipeline-health" className="border border-rg-cream2/20 bg-rg-ink/60 p-5 hover:border-rg-gold/70">
            <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.18em] text-rg-gold">SIPOC</p>
            <h3 className="mt-2 font-rg-serif text-xl text-rg-cream">Pipeline Health</h3>
            <p className="mt-2 text-sm text-rg-cream2/70">Job health, failure heatmap, and diagnostics completeness.</p>
          </Link>

          <Link href="/admin" className="border border-rg-cream2/20 bg-rg-ink/60 p-5 hover:border-rg-gold/70">
            <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.18em] text-rg-gold">Control center</p>
            <h3 className="mt-2 font-rg-serif text-xl text-rg-cream">Admin Dashboard</h3>
            <p className="mt-2 text-sm text-rg-cream2/70">All admin modules including Revise, costs, and support views.</p>
          </Link>
        </div>

        <form onSubmit={openForensics} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:min-w-[420px]">
            <label htmlFor="forensics-job-id" className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-cream2/70">
              Open forensic packet by job ID
            </label>
            <input
              id="forensics-job-id"
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              placeholder="c73899ab-20b7-440a-978a-ec78c390a09b"
              className="mt-2 w-full border border-rg-cream2/25 bg-rg-ink px-3 py-2 text-sm text-rg-cream outline-none focus:border-rg-gold"
            />
          </div>
          <button type="submit" className="border border-rg-gold/60 bg-rg-gold px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-ink hover:bg-transparent hover:text-rg-gold">
            Open Forensics
          </button>
        </form>
      </div>
    </section>
  );
}
