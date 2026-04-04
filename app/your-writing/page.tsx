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