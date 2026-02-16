"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EvaluationJob {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  phase: string | null;
  retry_count: number;
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
        if (data?.success) {
          setJobs(data.data?.jobs ?? data.data ?? []);
        } else if (data) {
          setError(data.error?.message ?? "Failed to load jobs");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, router]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-gray-500">Loading jobs...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6">
        <p className="text-red-600">Error: {error}</p>
        <Link href="/admin" className="text-blue-600 underline mt-2 inline-block">
          Back to Admin
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href="/admin" className="text-blue-600 underline text-sm">
          &larr; Back to Admin
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-4">Evaluation Jobs</h1>

      <div className="mb-4 flex gap-2">
        {["all", "queued", "running", "complete", "failed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => { setLoading(true); setStatusFilter(s); }}
            className={`px-3 py-1 rounded text-sm border ${
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {jobs.length === 0 ? (
        <p className="text-gray-500">No jobs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Phase</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Retries</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Created</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Last Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{job.id.slice(0, 8)}...</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        job.status === "complete"
                          ? "bg-green-100 text-green-800"
                          : job.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : job.status === "running"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{job.phase ?? "-"}</td>
                  <td className="px-3 py-2">{job.retry_count}</td>
                  <td className="px-3 py-2 text-xs">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-red-600 max-w-xs truncate">
                    {job.last_error ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
