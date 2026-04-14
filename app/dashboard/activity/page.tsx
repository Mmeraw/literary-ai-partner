"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  clearUserActivity,
  clearUserActivityRemote,
  fetchUserActivityRemote,
  readUserActivity,
  type UserActivityEntry,
} from "@/lib/activity/userActivity";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ActivityHistoryPage() {
  const [version, setVersion] = useState(0);
  const [remoteItems, setRemoteItems] = useState<UserActivityEntry[] | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");

  useEffect(() => {
    let cancelled = false;

    const loadRemote = async () => {
      setSyncState("loading");
      const remote = await fetchUserActivityRemote(300);
      if (cancelled) return;

      if (remote.length > 0) {
        setRemoteItems(remote);
        setSyncState("ready");
        return;
      }

      setRemoteItems(null);
      setSyncState("fallback");
    };

    void loadRemote();

    return () => {
      cancelled = true;
    };
  }, [version]);

  const localItems = useMemo(() => readUserActivity(300), [version]);
  const items = remoteItems && remoteItems.length > 0 ? remoteItems : localItems;

  const handleRefresh = () => {
    setVersion((v) => v + 1);
  };

  const handleClear = async () => {
    await clearUserActivityRemote();
    clearUserActivity();
    setVersion((v) => v + 1);
  };

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/dashboard" className="text-blue-600 underline text-sm">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Activity History</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
            onClick={handleRefresh}
          >
            {syncState === "loading" ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded border text-sm text-red-700 border-red-300 hover:bg-red-50"
            onClick={handleClear}
          >
            Clear history
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        {syncState === "ready"
          ? "Showing synced account activity history."
          : "Showing browser-local activity history (sync unavailable or empty)."}{" "}
        Use links to revisit previous pages.
      </p>

      {items.length === 0 ? (
        <div className="rounded border p-6 text-gray-600 text-sm">No activity has been recorded yet.</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">When</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Event</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Details</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatTimestamp(item.timestamp)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.event}</td>
                  <td className="px-4 py-3 text-gray-600 break-all">{item.detail ?? item.route ?? "—"}</td>
                  <td className="px-4 py-3">
                    {item.href ? (
                      <Link href={item.href} className="text-blue-600 underline">
                        {item.linkLabel ?? "Open"}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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
