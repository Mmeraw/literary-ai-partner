"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviseForensicsLandingPage() {
  const router = useRouter();
  const [jobId, setJobId] = useState("");

  const openForensics = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = jobId.trim();
    if (!trimmed) return;
    router.push(`/admin/revise-forensics/${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <Link href="/admin" className="text-sm font-semibold text-rg-gold hover:text-rg-cream">
            ← Back to Admin
          </Link>
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">
            Admin · Revise Forensics
          </p>
          <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">
            Revise Workbench Forensics
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-rg-cream2/70">
            Internal-only audit view for the Evaluate → Revise bridge. This module exposes raw
            source manifests, field ownership proof, withheld reasons, needs-targeting reasons,
            candidate ownership, and grounding status. Do not surface these details to authors.
          </p>
        </header>

        <form
          onSubmit={openForensics}
          className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-5 shadow-sm"
        >
          <label className="block font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold/80">
            Evaluation Job ID
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              placeholder="Paste evaluation job UUID"
              className="min-h-11 flex-1 rounded border border-rg-cream2/20 bg-rg-ink px-3 py-2 font-mono text-sm text-rg-cream placeholder:text-rg-cream2/35 focus:border-rg-gold focus:outline-none"
            />
            <button
              type="submit"
              className="rounded bg-rg-gold px-5 py-2 font-rg-mono text-xs font-bold uppercase tracking-[0.16em] text-rg-ink hover:bg-amber-400 disabled:opacity-50"
              disabled={!jobId.trim()}
            >
              Open Audit
            </button>
          </div>
        </form>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Source manifest", "Raw ledger source participation, required-source status, degraded sources, artifact IDs, and source hash."],
            ["Field ownership", "Machine-readable proof that every Ready card has one declared field owner and valid field-source status."],
            ["Admission reasons", "Ready, Needs Targeting, and Withheld breakdowns with grounding, preflight, and blocking reasons."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/50 p-5">
              <h2 className="font-rg-serif text-xl text-rg-cream">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-rg-cream2/65">{description}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
