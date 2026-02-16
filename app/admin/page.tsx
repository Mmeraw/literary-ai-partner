"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/diagnostics")
      .then((res) => {
        if (res.status === 403 || res.status === 401) {
          router.replace("/evaluate");
          return;
        }
        setAuthorized(true);
      })
      .catch(() => router.replace("/evaluate"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-gray-500">Checking admin access...</p>
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/diagnostics"
          className="block rounded-lg border border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all"
        >
          <h2 className="text-lg font-medium mb-2">Diagnostics</h2>
          <p className="text-sm text-gray-600">
            Real-time observability metrics, job status, and phase timing.
          </p>
        </Link>
        <Link
          href="/admin/jobs"
          className="block rounded-lg border border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all"
        >
          <h2 className="text-lg font-medium mb-2">Jobs</h2>
          <p className="text-sm text-gray-600">
            View and manage evaluation jobs with filtering and pagination.
          </p>
        </Link>
        <Link
          href="/admin/jobs/dead-letter"
          className="block rounded-lg border border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all"
        >
          <h2 className="text-lg font-medium mb-2">Dead Letter Queue</h2>
          <p className="text-sm text-gray-600">
            Review failed jobs and retry or discard them.
          </p>
        </Link>
      </div>
    </main>
  );
}
