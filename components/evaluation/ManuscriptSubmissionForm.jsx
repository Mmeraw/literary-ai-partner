"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Track A: Evaluation Entry
 * Single UI entry point to create evaluate_full jobs via POST /api/jobs
 */
export default function ManuscriptSubmissionForm({ onSubmitSuccess }) {
  const fileInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [manuscriptText, setManuscriptText] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [selectedManuscriptId, setSelectedManuscriptId] = useState(null);
  const [dashboardManuscripts, setDashboardManuscripts] = useState([]);
  const [hiddenManuscriptIds, setHiddenManuscriptIds] = useState([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [englishVariant, setEnglishVariant] = useState("us");

  const wordCount = useMemo(() => {
    return manuscriptText.trim().split(/\s+/).filter(Boolean).length;
  }, [manuscriptText]);

  const visibleDashboardManuscripts = useMemo(
    () => dashboardManuscripts.filter((doc) => !hiddenManuscriptIds.includes(doc.id)),
    [dashboardManuscripts, hiddenManuscriptIds],
  );

  const hideManuscriptHere = (manuscriptId) => {
    setHiddenManuscriptIds((prev) => (prev.includes(manuscriptId) ? prev : [...prev, manuscriptId]));
    setSelectedManuscriptId((current) => (current === manuscriptId ? null : current));
  };

  const deleteManuscriptFromDashboard = async (manuscriptId) => {
    const target = dashboardManuscripts.find((doc) => doc.id === manuscriptId);
    const label = target?.title || "this manuscript";
    const confirmed = window.confirm(
      `Delete ${label}? This permanently removes it from your dashboard and this window.`,
    );

    if (!confirmed) return;

    setError(null);

    try {
      const response = await fetch(`/api/manuscripts?id=${encodeURIComponent(String(manuscriptId))}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }

      setDashboardManuscripts((prev) => prev.filter((doc) => doc.id !== manuscriptId));
      setHiddenManuscriptIds((prev) => prev.filter((id) => id !== manuscriptId));
      setSelectedManuscriptId((current) => (current === manuscriptId ? null : current));
    } catch (err) {
      setError(err.message || "Delete failed");
    }
  };

  const clearThisWindow = () => {
    setHiddenManuscriptIds(dashboardManuscripts.map((doc) => doc.id));
    setSelectedManuscriptId(null);
  };

  const restoreAllInThisWindow = () => {
    setHiddenManuscriptIds([]);
  };

  useEffect(() => {
    let isMounted = true;
    const loadManuscripts = async () => {
      setIsLoadingDashboard(true);
      try {
        const response = await fetch("/api/manuscripts", { method: "GET" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load dashboard documents");
        }
        if (!isMounted) return;
        setDashboardManuscripts(Array.isArray(data.manuscripts) ? data.manuscripts : []);
      } catch {
        if (!isMounted) return;
        setDashboardManuscripts([]);
      } finally {
        if (isMounted) setIsLoadingDashboard(false);
      }
    };

    void loadManuscripts();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUploadFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", projectTitle || file.name.replace(/\.[^.]+$/, ""));
      form.append("english_variant", englishVariant);

      const response = await fetch("/api/manuscripts", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      if (data.manuscript) {
        setDashboardManuscripts((prev) => [data.manuscript, ...prev.filter((m) => m.id !== data.manuscript.id)]);
        setSelectedManuscriptId(data.manuscript.id);
        setHiddenManuscriptIds((prev) => prev.filter((id) => id !== data.manuscript.id));
        setManuscriptText("");
      }
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerDashboardUpload = () => uploadInputRef.current?.click();
  const triggerInlineUpload = () => fileInputRef.current?.click();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hasSelectedManuscript = Number.isInteger(selectedManuscriptId);
    const hasPastedText = manuscriptText.trim().length > 0;

    if (!hasSelectedManuscript && !hasPastedText) {
      setError("Select a dashboard manuscript, upload a file, or paste text to continue.");
      return;
    }

    if (hasSelectedManuscript && hasPastedText) {
      setError("Choose one source only: selected/uploaded manuscript OR pasted text.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const manuscriptSize = hasPastedText ? new Blob([manuscriptText]).size : undefined;

      const payload = {
        job_type: "evaluate_full",
        manuscript_title: projectTitle,
        english_variant: englishVariant,
        ...(hasSelectedManuscript
          ? { manuscript_id: selectedManuscriptId }
          : {
              manuscript_text: manuscriptText,
              manuscript_size: manuscriptSize,
            }),
      };

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create evaluation job");
      }

      setManuscriptText("");
      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-8 shadow-sm">
        <div className="text-center mb-8">
          <h2 className="text-5xl font-semibold text-gray-900 tracking-tight mb-3">Your Writing</h2>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Upload or paste your writing below. Formatting is preserved. We&apos;ll automatically determine
            what you&apos;ve submitted and evaluate it accordingly.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 space-y-5">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Writing Details</h3>
                <p className="text-sm text-gray-600 mb-3">Choose a document from dashboard or upload a new one.</p>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={clearThisWindow}
                    disabled={isUploading || isSubmitting || visibleDashboardManuscripts.length === 0}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Clear this window
                  </button>
                  <button
                    type="button"
                    onClick={restoreAllInThisWindow}
                    disabled={isUploading || isSubmitting || hiddenManuscriptIds.length === 0}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Restore all items
                  </button>
                </div>

                <div className="space-y-2 mb-3 max-h-44 overflow-auto">
                  {isLoadingDashboard ? (
                    <div className="text-sm text-gray-500">Loading dashboard documents...</div>
                  ) : visibleDashboardManuscripts.length === 0 ? (
                    <div className="text-sm text-gray-500">No documents found in dashboard yet.</div>
                  ) : (
                    visibleDashboardManuscripts.map((doc) => (
                      <label
                        key={doc.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                          selectedManuscriptId === doc.id ? "border-indigo-500 bg-white" : "border-gray-200 bg-white/70"
                        }`}
                      >
                        <input
                          type="radio"
                          name="dashboard-manuscript"
                          checked={selectedManuscriptId === doc.id}
                          onChange={() => {
                            setSelectedManuscriptId(doc.id);
                            setManuscriptText("");
                          }}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-sm text-gray-900">{doc.title || "Untitled Manuscript"}</div>
                          <div className="text-xs text-gray-500">
                            {doc.word_count ?? 0} words • {doc.source ?? "unknown"}
                          </div>
                          <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 text-xs font-medium">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                hideManuscriptHere(doc.id);
                              }}
                              className="w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-indigo-700 hover:bg-indigo-100"
                            >
                              Hide from this window
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void deleteManuscriptFromDashboard(doc.id);
                              }}
                              className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-red-700 hover:bg-red-100"
                            >
                              Delete permanently
                            </button>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={triggerDashboardUpload}
                  disabled={isUploading || isSubmitting}
                  className="w-full rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {isUploading ? "Uploading..." : "Upload New Document to Dashboard"}
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadFile(file);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className="text-center text-xs uppercase tracking-wide text-gray-400">OR UPLOAD/PASTE NEW TEXT</div>

              <div>
                <label htmlFor="project-title" className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title (optional)
                </label>
                <input
                  id="project-title"
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Helps you organize your submissions"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="manuscript-text" className="text-sm font-medium text-gray-700">
                    Paste a paragraph, scene, chapter, screenplay, or full manuscript here
                  </label>
                  <button
                    type="button"
                    onClick={triggerInlineUpload}
                    disabled={isUploading || isSubmitting}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Upload File (250k max)
                  </button>
                </div>
                <textarea
                  id="manuscript-text"
                  value={manuscriptText}
                  onChange={(e) => {
                    setManuscriptText(e.target.value);
                    if (e.target.value.trim().length > 0) {
                      setSelectedManuscriptId(null);
                    }
                  }}
                  placeholder="Formatting (italics, bold, spacing) is preserved..."
                  rows={12}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={isSubmitting}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadFile(file);
                    e.target.value = "";
                  }}
                />
                <p className="mt-2 text-xs text-gray-500">Word count: {wordCount}</p>
                <p className="text-xs text-gray-500">Paste up to 150k words or upload files up to 250k words</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">English Variant</label>
                <select
                  value={englishVariant}
                  onChange={(e) => setEnglishVariant(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="us">US English</option>
                  <option value="uk">UK English</option>
                </select>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h4 className="text-sm font-semibold text-amber-900 mb-1">Mode confirmation happens after analysis</h4>
                <p className="text-sm text-amber-800">
                  Mode will be detected after analysis and confirmed with you before Revise.
                </p>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                <h4 className="font-semibold text-gray-900 mb-2">How Evaluation Works</h4>
                <p className="text-sm text-gray-600">Shorter submissions are evaluated directly. Full manuscripts are processed in chapters with progress tracking.</p>
              </div>
              <div className="rounded-xl bg-cyan-50 border border-cyan-100 p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Tips for Best Results</h4>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                  <li>Evaluate larger sections when possible.</li>
                  <li>Complete scenes or chapters improve reliability.</li>
                  <li>Opening chapters benefit from focused hook/voice setup.</li>
                </ul>
              </div>
            </aside>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="mt-6 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-white font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Starting Evaluation..." : "Evaluate with RevisionGrade"}
          </button>
        </form>
      </div>
    </div>
  );
}
