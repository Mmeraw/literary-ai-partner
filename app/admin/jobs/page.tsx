// app/evaluate/[jobId]/page.tsx

import Link from "next/link";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function EvaluationReportPage({ params }: PageProps) {
  const { jobId } = await params;

  // --- KEEP YOUR EXISTING LOGIC BELOW THIS LINE ---
  // Example skeleton (replace with your existing fetch/render code):

  // const job = await fetchJob(jobId);

  return (
    <main className="p-6">
      <div className="mb-4">
        <Link href="/evaluate" className="underline">
          ← Back to Evaluate
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">Evaluation Report</h1>
      <p className="mt-2 text-sm text-gray-600">Job ID: {jobId}</p>

      {/* Your existing “not ready” / “complete” UI goes here */}
    </main>
  );
}
