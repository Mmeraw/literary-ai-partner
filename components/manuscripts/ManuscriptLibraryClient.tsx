"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState, useTransition } from "react";

type ManuscriptRow = {
  id: number;
  title: string | null;
  word_count: number | null;
  source: string | null;
  file_size: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatWords(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString();
}

function pluralizeManuscript(count: number): string {
  return count === 1 ? "manuscript" : "manuscripts";
}

type DeleteMode = "single" | "bulk";

interface DeleteConfirmation {
  mode: DeleteMode;
  ids: number[];
  titles: string[];
}

export default function ManuscriptLibraryClient({
  manuscripts,
}: {
  manuscripts: ManuscriptRow[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirm, setConfirm] = useState<DeleteConfirmation | null>(null);
  const [typedConfirm, setTypedConfirm] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [, startTransition] = useTransition();

  const allSelected = useMemo(
    () => manuscripts.length > 0 && selectedIds.size === manuscripts.length,
    [manuscripts.length, selectedIds.size],
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(manuscripts.map((m) => m.id)));
    }
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openSingleDelete = (manuscript: ManuscriptRow) => {
    setTypedConfirm("");
    setNotice(null);
    setConfirm({
      mode: "single",
      ids: [manuscript.id],
      titles: [manuscript.title || "Untitled Manuscript"],
    });
  };

  const openBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setTypedConfirm("");
    setNotice(null);
    const rows = manuscripts.filter((m) => selectedIds.has(m.id));
    setConfirm({
      mode: "bulk",
      ids: rows.map((m) => m.id),
      titles: rows.map((m) => m.title || "Untitled Manuscript"),
    });
  };

  const closeConfirm = () => {
    setConfirm(null);
    setTypedConfirm("");
  };

  const performDelete = async () => {
    if (!confirm || isDeleting) return;

    if (confirm.mode === "bulk" && typedConfirm !== "DELETE") {
      setNotice({ type: "error", message: "Type DELETE exactly to confirm bulk deletion." });
      return;
    }

    setIsDeleting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/manuscripts?ids=${encodeURIComponent(confirm.ids.join(","))}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of confirm.ids) next.delete(id);
        return next;
      });

      setNotice({
        type: "success",
        message:
          confirm.mode === "single"
            ? `"${confirm.titles[0]}" was permanently deleted.`
            : `Permanently deleted ${confirm.ids.length} ${pluralizeManuscript(confirm.ids.length)}.`,
      });

      // Refresh the server-rendered table once the deletion transaction is complete.
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setNotice({ type: "error", message });
    } finally {
      setIsDeleting(false);
      setConfirm(null);
      setTypedConfirm("");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openBulkDelete}
            disabled={selectedIds.size === 0 || isDeleting}
            className="rounded border border-red-900/60 bg-red-950 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete selected{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-xs text-[#A9987D]">
              {selectedIds.size} {pluralizeManuscript(selectedIds.size)} selected
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/evaluate"
            className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 font-semibold text-[#1A140C] hover:bg-[#D8BB7B]"
          >
            Upload / evaluate
          </Link>
          <Link
            href="/dashboard"
            className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className={`mt-6 rounded-xl border p-4 text-sm ${
            notice.type === "success"
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
              : "border-red-400/40 bg-red-500/10 text-red-100"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#2D2519]">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-[#120E08] text-xs uppercase tracking-[0.16em] text-[#C8A96E]">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all manuscripts"
                  className="h-4 w-4 accent-[#C8A96E]"
                />
              </th>
              <th className="px-4 py-3">Manuscript</th>
              <th className="px-4 py-3">Words</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2D2519]">
            {manuscripts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#A9987D]">
                  No saved manuscripts yet. Upload a DOCX/TXT or paste text from the Evaluate page.
                </td>
              </tr>
            ) : (
              manuscripts.map((manuscript) => (
                <tr key={manuscript.id} className="bg-[#171109] text-[#F3E3C3]">
                  <td className="px-4 py-4 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(manuscript.id)}
                      onChange={() => toggleRow(manuscript.id)}
                      aria-label={`Select ${manuscript.title || "Untitled Manuscript"}`}
                      className="h-4 w-4 accent-[#C8A96E]"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/manuscripts/${manuscript.id}`}
                      className="font-semibold text-[#F8F1E6] hover:text-[#C8A96E]"
                    >
                      {manuscript.title || "Untitled Manuscript"}
                    </Link>
                    <div className="mt-1 text-xs text-[#8F806A]">ID {manuscript.id}</div>
                  </td>
                  <td className="px-4 py-4 text-[#E8D8BA]">{formatWords(manuscript.word_count)}</td>
                  <td className="px-4 py-4 text-[#CBBDA4]">{manuscript.source || "saved"}</td>
                  <td className="px-4 py-4 text-[#CBBDA4]">
                    {formatDate(manuscript.updated_at || manuscript.created_at)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2 text-xs">
                      <Link
                        href={`/manuscripts/${manuscript.id}`}
                        className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]"
                      >
                        Open source
                      </Link>
                      <Link
                        href={`/evaluate?manuscriptId=${manuscript.id}`}
                        className="rounded border border-[#C8A96E] px-3 py-2 text-[#F3E3C3] hover:bg-[#2A2115]"
                      >
                        Evaluate
                      </Link>
                      <button
                        type="button"
                        onClick={() => openSingleDelete(manuscript)}
                        disabled={isDeleting}
                        className="rounded border border-red-900/60 bg-red-950/50 px-3 py-2 text-red-100 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#3A3022] bg-[#1C160E] p-6 text-[#F5EFE4]">
            <h3 className="font-rg-serif text-2xl text-[#F8F1E6]">Permanently delete {confirm.mode === "bulk" ? `${confirm.ids.length} ${pluralizeManuscript(confirm.ids.length)}` : "manuscript"}?</h3>

            <p className="mt-3 text-sm leading-6 text-[#CBBDA4]">
              {confirm.mode === "single" ? (
                <>
                  Permanently delete <strong className="text-[#F8F1E6]">{confirm.titles[0]}</strong> and all associated evaluations, reports, revision data, and generated files? This action cannot be undone.
                </>
              ) : (
                <>
                  Permanently delete {confirm.ids.length} {pluralizeManuscript(confirm.ids.length)} and all associated content? This action cannot be undone.
                </>
              )}
            </p>

            {confirm.titles.length > 1 && (
              <ul className="mt-3 max-h-32 list-disc overflow-auto rounded border border-[#2D2519] bg-[#120E08] px-5 py-3 text-sm text-[#CBBDA4]">
                {confirm.titles.map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
              </ul>
            )}

            {confirm.mode === "bulk" && (
              <div className="mt-4">
                <label htmlFor="confirm-delete" className="block text-xs font-semibold uppercase tracking-wide text-[#C8A96E]">
                  Type DELETE to continue
                </label>
                <input
                  id="confirm-delete"
                  type="text"
                  value={typedConfirm}
                  onChange={(e) => setTypedConfirm(e.target.value)}
                  disabled={isDeleting}
                  className="mt-2 w-full rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm text-[#F5EFE4] outline-none focus:border-[#C8A96E]"
                />
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={isDeleting}
                className="rounded border border-[#5D4C31] px-4 py-2 text-sm text-[#E8D8BA] hover:border-[#C8A96E] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={performDelete}
                disabled={isDeleting || (confirm.mode === "bulk" && typedConfirm !== "DELETE")}
                className="rounded border border-red-900/60 bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
