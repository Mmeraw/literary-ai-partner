"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EvaluationJob {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  manuscript_id: number;
  phase: string | null;
  phase_status: string | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<EvaluationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("limit", "50");

    fetch(`/api/admin/jobs?${params}`)
      .then((res) => {
        if (res.status === 403 || res.status === 401) {
          router.replace("/evaluate");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.ok && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        } else if (data.success && data.data) {
          setJobs(Array.isArray(data.data) ? data.data : data.data.jobs ?? []);
        } else if (data.error) {
          setError(data.error?.message ?? JSON.stringify(data.error));
        } else {
          setJobs([]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, router]);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
        <p className="font-medium text-slate-700">Loading jobs...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Error: {error}</p>
        </div>
        <Link
          href="/admin"
          className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          ← Back to Admin
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 text-slate-950">
      <Link
        href="/admin"
        className="text-sm font-semibold text-blue-700 hover:text-blue-900"
      >
        ← Back to Admin
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-slate-950">
        Evaluation Jobs
      </h1>

      <div className="mt-4 flex gap-2 flex-wrap">
        {["all", "queued", "running", "complete", "failed"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setLoading(true);
              setStatusFilter(s);
            }}
            className={`rounded px-3 py-1.5 text-sm font-semibold border ${
              statusFilter === s
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm font-medium text-slate-700">
        {jobs.length} job(s) found
      </p>

      {jobs.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-800">
            No jobs found for this filter.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-300 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  ID
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Phase
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Attempts
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Created
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-900">
                  Last Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold text-blue-700">
                    <Link
                      href={`/evaluate/${job.id}`}
                      className="hover:text-blue-900 hover:underline"
                    >
                      {job.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                        job.status === "complete"
                          ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                          : job.status === "failed"
                            ? "bg-red-50 text-red-800 ring-1 ring-red-200"
                            : job.status === "running"
                              ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200"
                              : "bg-slate-50 text-slate-800 ring-1 ring-slate-200"
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                    {job.phase ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                    {job.attempt_count}/{job.max_attempts}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-700">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {job.last_error ? (
                      <span className="block max-w-md truncate rounded bg-red-50 px-2 py-1 font-semibold text-red-800 ring-1 ring-red-200">
                        {job.last_error}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
