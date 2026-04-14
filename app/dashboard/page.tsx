import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">My Jobs Dashboard</h1>
      <p className="text-slate-600 mb-6">
        Submit manuscripts and track evaluation results through the live writer flow.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/evaluate" className="block rounded-lg border border-slate-200 p-5 hover:shadow-md transition">
          <h2 className="font-medium text-slate-900 mb-1">My Jobs &amp; Evaluate</h2>
          <p className="text-sm text-slate-600">Submit a manuscript, monitor status, and open results at /evaluate/[jobId].</p>
        </Link>
        <Link href="/dashboard/activity" className="block rounded-lg border border-slate-200 p-5 hover:shadow-md transition">
          <h2 className="font-medium text-slate-900 mb-1">Activity History</h2>
          <p className="text-sm text-slate-600">Review recent account and evaluation actions, then jump back to them.</p>
        </Link>
        <Link href="/revise" className="block rounded-lg border border-slate-200 p-5 hover:shadow-md transition">
          <h2 className="font-medium text-slate-900 mb-1">Revise</h2>
          <p className="text-sm text-slate-600">Review revision recommendations and track progress.</p>
        </Link>
        <Link href="/convert" className="block rounded-lg border border-slate-200 p-5 hover:shadow-md transition">
          <h2 className="font-medium text-slate-900 mb-1">Convert</h2>
          <p className="text-sm text-slate-600">Transform manuscripts between formats.</p>
        </Link>
        <Link href="/output" className="block rounded-lg border border-slate-200 p-5 hover:shadow-md transition">
          <h2 className="font-medium text-slate-900 mb-1">Output</h2>
          <p className="text-sm text-slate-600">Generate publication-ready submission packages.</p>
        </Link>
      </div>
    </main>
  );
}
