"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ManuscriptSubmissionForm — dark design system rewrite
 * All logic identical to original. Only styling changed.
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

  const removeManuscriptLocally = (manuscriptId) => {
    setDashboardManuscripts((prev) => prev.filter((doc) => doc.id !== manuscriptId));
    setHiddenManuscriptIds((prev) => prev.filter((id) => id !== manuscriptId));
    setSelectedManuscriptId((current) => (current === manuscriptId ? null : current));
  };

  const hideManuscriptHere = (manuscriptId) => {
    setHiddenManuscriptIds((prev) => (prev.includes(manuscriptId) ? prev : [...prev, manuscriptId]));
    setSelectedManuscriptId((current) => (current === manuscriptId ? null : current));
  };

  const deleteManuscriptById = async (manuscriptId, confirmationLabel) => {
    const target = dashboardManuscripts.find((doc) => doc.id === manuscriptId);
    const label = target?.title || "this manuscript";
    const confirmed = window.confirm(
      confirmationLabel || `Delete ${label}? This permanently removes it from your dashboard.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      const response = await fetch(`/api/manuscripts?id=${encodeURIComponent(String(manuscriptId))}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed");
      removeManuscriptLocally(manuscriptId);
    } catch (err) {
      setError(err.message || "Delete failed");
    }
  };

  const deleteManuscriptFromDashboard = async (manuscriptId) => {
    await deleteManuscriptById(manuscriptId);
  };

  const clearThisWindow = () => {
    setHiddenManuscriptIds(dashboardManuscripts.map((doc) => doc.id));
    setSelectedManuscriptId(null);
  };

  const deleteAllTitlesFromThisWindow = async () => {
    if (visibleDashboardManuscripts.length === 0) return;
    const confirmed = window.confirm(
      `Delete all visible titles? This permanently removes them from your dashboard.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      for (const doc of visibleDashboardManuscripts) {
        const response = await fetch(`/api/manuscripts?id=${encodeURIComponent(String(doc.id))}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Delete failed for ${doc.title || "this manuscript"}`);
        removeManuscriptLocally(doc.id);
      }
    } catch (err) {
      setError(err.message || "Delete failed");
    }
  };

  const restoreAllInThisWindow = () => setHiddenManuscriptIds([]);

  useEffect(() => {
    let isMounted = true;
    const loadManuscripts = async () => {
      setIsLoadingDashboard(true);
      try {
        const response = await fetch("/api/manuscripts", { method: "GET" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load manuscripts");
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
    return () => { isMounted = false; };
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
      const response = await fetch("/api/manuscripts", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
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

  const toggleManuscriptSelection = (manuscriptId) => {
    setSelectedManuscriptId((current) => (current === manuscriptId ? null : manuscriptId));
    setManuscriptText("");
  };

  const triggerDashboardUpload = () => uploadInputRef.current?.click();
  const triggerInlineUpload = () => fileInputRef.current?.click();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasSelectedManuscript = Number.isInteger(selectedManuscriptId);
    const hasPastedText = manuscriptText.trim().length > 0;
    if (!hasSelectedManuscript && !hasPastedText) {
      setError("Select a manuscript, upload a file, or paste text to continue.");
      return;
    }
    if (hasSelectedManuscript && hasPastedText) {
      setError("Choose one source: a saved manuscript or pasted text — not both.");
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
          : { manuscript_text: manuscriptText, manuscript_size: manuscriptSize }),
      };
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create evaluation job");
      setManuscriptText("");
      if (onSubmitSuccess) onSubmitSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    // Surfaces
    card: "rounded-xl border border-[#2A2218] bg-[#14110C] p-5",
    cardGold: "rounded-xl border border-[#C8A96E33] bg-[#14110C] p-5",
    // Labels
    label: "block text-xs font-semibold uppercase tracking-widest text-[#B8AE9C] mb-2",
    // Text inputs
    input: "w-full rounded-lg border border-[#2A2218] bg-[#1E180F] px-4 py-3 text-sm text-[#F5EFE0] placeholder-[#6B6560] focus:border-[#C8A96E] focus:outline-none focus:ring-1 focus:ring-[#C8A96E] transition-colors disabled:opacity-50",
    textarea: "w-full rounded-lg border border-[#2A2218] bg-[#1E180F] px-4 py-3 text-sm text-[#F5EFE0] placeholder-[#6B6560] focus:border-[#C8A96E] focus:outline-none focus:ring-1 focus:ring-[#C8A96E] transition-colors disabled:opacity-50 resize-none",
    select: "w-full rounded-lg border border-[#2A2218] bg-[#1E180F] px-4 py-3 text-sm text-[#F5EFE0] focus:border-[#C8A96E] focus:outline-none focus:ring-1 focus:ring-[#C8A96E] transition-colors",
    // Buttons
    btnGhost: "rounded-lg border border-[#2A2218] bg-transparent px-3 py-1.5 text-xs font-medium text-[#B8AE9C] hover:border-[#C8A96E] hover:text-[#C8A96E] transition-colors disabled:opacity-40",
    btnDanger: "rounded-lg border border-[#7A2B1A44] bg-transparent px-3 py-1.5 text-xs font-medium text-[#A7472A] hover:border-[#A7472A] hover:bg-[#7A2B1A22] transition-colors disabled:opacity-40",
    btnUpload: "w-full rounded-lg border border-dashed border-[#2A2218] bg-[#1E180F] px-4 py-3 text-sm font-medium text-[#B8AE9C] hover:border-[#C8A96E] hover:text-[#C8A96E] transition-colors disabled:opacity-40",
  };

  const hasSource = Number.isInteger(selectedManuscriptId) || manuscriptText.trim().length > 0;

  return (
    <div style={{ fontFamily: "'Switzer', 'Inter', system-ui, sans-serif" }}>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Main input surface ──────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Saved manuscripts */}
            <div className={S.card}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-[#B8AE9C]">
                  Saved Manuscripts
                </h3>
                <div className="flex gap-2">
                  <button type="button" onClick={restoreAllInThisWindow}
                    disabled={isUploading || isSubmitting || hiddenManuscriptIds.length === 0}
                    className={S.btnGhost}>
                    Restore all
                  </button>
                  <button type="button" onClick={clearThisWindow}
                    disabled={isUploading || isSubmitting || visibleDashboardManuscripts.length === 0}
                    className={S.btnGhost}>
                    Clear view
                  </button>
                </div>
              </div>

              <div className="space-y-2 min-h-[12rem] max-h-[28rem] overflow-y-auto pr-1 mb-4">
                {isLoadingDashboard ? (
                  <div className="flex items-center gap-3 py-8 justify-center">
                    <div className="h-4 w-4 rounded-full border-2 border-[#C8A96E] border-t-transparent animate-spin" />
                    <span className="text-sm text-[#6B6560]">Loading manuscripts…</span>
                  </div>
                ) : visibleDashboardManuscripts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <svg className="h-8 w-8 text-[#2A2218]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-[#6B6560]">No saved manuscripts yet.</p>
                    <p className="text-xs text-[#4A4440]">Upload a file below to get started.</p>
                  </div>
                ) : (
                  visibleDashboardManuscripts.map((doc) => {
                    const isSelected = selectedManuscriptId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          if (e.target.closest("button") || e.target.closest("input")) return;
                          toggleManuscriptSelection(doc.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleManuscriptSelection(doc.id);
                          }
                        }}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#C8A96E] bg-[#C8A96E0F]"
                            : "border-[#2A2218] bg-[#1E180F] hover:border-[#3A3020]"
                        }`}
                      >
                        {/* Custom radio */}
                        <div className={`shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? "border-[#C8A96E]" : "border-[#3A3020]"
                        }`}>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-[#C8A96E]" />}
                        </div>
                        <input
                          type="radio"
                          name="dashboard-manuscript"
                          checked={isSelected}
                          className="sr-only"
                          onChange={() => { if (!isSelected) toggleManuscriptSelection(doc.id); }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) { e.preventDefault(); toggleManuscriptSelection(doc.id); }
                          }}
                        />

                        <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#F5EFE0] truncate">
                              {doc.title || "Untitled Manuscript"}
                            </p>
                            <p className="text-xs text-[#6B6560] mt-0.5">
                              {(doc.word_count ?? 0).toLocaleString()} words
                              {doc.source ? ` · ${doc.source}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); hideManuscriptHere(doc.id); }}
                              className={S.btnGhost}>
                              Hide
                            </button>
                            <button type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void deleteManuscriptFromDashboard(doc.id); }}
                              className={S.btnDanger}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-[#2A2218]">
                <button type="button" onClick={triggerDashboardUpload}
                  disabled={isUploading || isSubmitting}
                  className={S.btnUpload}>
                  {isUploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-3 w-3 rounded-full border-2 border-[#C8A96E] border-t-transparent animate-spin" />
                      Uploading…
                    </span>
                  ) : "↑ Upload new manuscript (.txt or .docx)"}
                </button>
                <input ref={uploadInputRef} type="file"
                  accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadFile(file);
                    e.target.value = "";
                  }}
                />
                {visibleDashboardManuscripts.length > 0 && (
                  <button type="button"
                    onClick={() => void deleteAllTitlesFromThisWindow()}
                    disabled={isUploading || isSubmitting}
                    className={S.btnDanger}>
                    Delete all visible
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#2A2218]" />
              <span className="text-xs uppercase tracking-widest text-[#4A4440]">or paste new text</span>
              <div className="flex-1 h-px bg-[#2A2218]" />
            </div>

            {/* Project title */}
            <div>
              <label htmlFor="project-title" className={S.label}>
                Project Title <span className="normal-case tracking-normal font-normal text-[#4A4440]">(optional)</span>
              </label>
              <input
                id="project-title"
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Helps you organize submissions"
                className={S.input}
                disabled={isSubmitting}
              />
            </div>

            {/* Paste area */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="manuscript-text" className={S.label}>
                  Paste manuscript text
                </label>
                <button type="button" onClick={triggerInlineUpload}
                  disabled={isUploading || isSubmitting}
                  className={S.btnGhost}>
                  Upload file (250k max)
                </button>
              </div>
              <textarea
                id="manuscript-text"
                value={manuscriptText}
                onChange={(e) => {
                  setManuscriptText(e.target.value);
                  if (e.target.value.trim().length > 0) setSelectedManuscriptId(null);
                }}
                placeholder="Paste a scene, chapter, or full manuscript here. Formatting is preserved."
                rows={12}
                className={S.textarea}
                disabled={isSubmitting}
              />
              <input ref={fileInputRef} type="file"
                accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadFile(file);
                  e.target.value = "";
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-[#6B6560]">
                  {wordCount > 0 ? (
                    <span className="text-[#C8A96E]">{wordCount.toLocaleString()} words</span>
                  ) : "Up to 150k words pasted · 250k uploaded"}
                </p>
                <p className="text-xs text-[#4A4440]">Formatting preserved</p>
              </div>
            </div>

            {/* English variant */}
            <div>
              <label className={S.label}>English Variant</label>
              <select value={englishVariant} onChange={(e) => setEnglishVariant(e.target.value)} className={S.select}>
                <option value="us">US English</option>
                <option value="uk">UK English</option>
              </select>
            </div>

            {/* Mode note */}
            <div className={S.cardGold}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#C8A96E] mb-1">Mode confirmation</p>
              <p className="text-sm text-[#B8AE9C]">
                Evaluation mode (Standard / Transgressive / Testimony) is detected after analysis and confirmed with you before Revise begins.
              </p>
            </div>

          </div>

          {/* ── Right: Guidance sidebar ────────────────────────────── */}
          <aside className="space-y-4">
            <div className={S.card}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#C8A96E] mb-3">How it works</p>
              <div className="space-y-4">
                {[
                  { n: "01", title: "Submit", body: "Upload, paste, or select a saved manuscript." },
                  { n: "02", title: "Analyze", body: "The engine scores 13 story criteria. Chapters are processed in parallel." },
                  { n: "03", title: "Report", body: "A governed evaluation report is generated with scores, rationale, and recommendations." },
                  { n: "04", title: "Revise", body: "Confirm mode, then move to targeted revision guided by the report." },
                ].map(({ n, title, body }) => (
                  <div key={n} className="flex gap-3">
                    <span className="shrink-0 text-xs font-mono text-[#C8A96E] mt-0.5">{n}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#F5EFE0]">{title}</p>
                      <p className="text-xs text-[#6B6560] mt-0.5">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={S.card}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#C8A96E] mb-3">Best results</p>
              <ul className="space-y-2">
                {[
                  "Complete scenes or chapters evaluate better than fragments.",
                  "Opening chapters benefit from full hook and voice context.",
                  "Larger submissions (5k+ words) unlock the most reliable scores.",
                ].map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[#B8AE9C]">
                    <span className="shrink-0 text-[#C8A96E] mt-0.5">—</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[#2A2218] bg-[#0D0A05] p-4">
              <p className="text-xs text-[#4A4440] leading-relaxed">
                Framework-driven analysis does not replace human editorial judgment.
              </p>
            </div>
          </aside>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-5 rounded-lg border border-[#7A2B1A66] bg-[#7A2B1A11] px-4 py-3">
            <p className="text-sm text-[#C06050]">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || isUploading || !hasSource}
          className="mt-6 w-full rounded-xl border border-[#C8A96E] bg-[#C8A96E] px-6 py-4 text-base font-semibold text-[#0D0A05] shadow-sm hover:bg-[#D9BB82] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ letterSpacing: "0.01em" }}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-[#0D0A05] border-t-transparent animate-spin" />
              Starting evaluation…
            </span>
          ) : "Begin Evaluation"}
        </button>
      </form>
    </div>
  );
}
