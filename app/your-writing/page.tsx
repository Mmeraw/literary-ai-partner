"use client";

import { useRouter } from "next/navigation";
import ManuscriptSubmissionForm from "@/components/evaluation/ManuscriptSubmissionForm";

export default function YourWritingPage() {
  const router = useRouter();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Your Writing</h1>
        <p className="mt-2 text-sm text-slate-600">
          Submit your manuscript to evaluate it with RevisionGrade.
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-amber-800">Before you submit</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">RevisionGrade evaluates manuscripts and serious narrative excerpts.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-800">
          Eligible submissions include full manuscripts, partial manuscripts, individual chapters, novel excerpts, novellas, book-length memoirs, and narrative nonfiction manuscripts.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-800">
          RevisionGrade does not evaluate general documents, letters, resumes, academic papers, contracts, marketing copy, query letters, synopses, or author biographies. Agent Readiness™ may help create or prepare query letters, synopses, author biographies, and submission materials, but those materials are not evaluated through the manuscript-evaluation engine.
        </p>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ManuscriptSubmissionForm
          onSubmitSuccess={(data) => {
            const jobId = data?.job_id;
            if (jobId) {
              router.push("/evaluate/" + jobId);
            }
          }}
        />
      </div>
    </main>
  );
}
