"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const INPUT_METHODS = [
  {
    id: "saved",
    label: "Saved Document",
    description: "Choose from manuscripts already in your workspace.",
  },
  {
    id: "upload",
    label: "Upload File",
    description: "Import a new DOCX or TXT file and select it for evaluation.",
  },
  {
    id: "paste",
    label: "Paste Text",
    description: "Paste a scene, chapter, excerpt, or manuscript directly.",
  },
];

function getEvaluationMode(wordCount) {
  if (!wordCount) {
    return {
      label: "Awaiting text",
      summary: "Select, upload, or paste writing to estimate the evaluation mode.",
      detail: "RevisionGrade confirms the final mode during analysis.",
    };
  }

  if (wordCount < 25000) {
    return {
      label: "Short-form evaluation",
      summary: "13 story criteria only.",
      detail: "Golden Spine/WAVE long-form analysis is reserved for manuscripts of 25,000 words or more.",
    };
  }

  return {
    label: "Long-form evaluation",
    summary: "Manuscript-scale readiness analysis eligible.",
    detail: "Long-form continuity, recurrence, payoff, pacing over distance, and structural readiness can be assessed.",
  };
}

function formatWordCount(value) {
  return Number(value || 0).toLocaleString();
}

function getSubmissionSourceSummary({ activeInputMethod, selectedDashboardManuscript, manuscriptText, wordCount }) {
  if (selectedDashboardManuscript) {
    return {
      label: activeInputMethod === "upload" ? "Uploaded file selected" : "Saved document selected",
      title: selectedDashboardManuscript.title || "Untitled Manuscript",
      meta: `${formatWordCount(selectedDashboardManuscript.word_count)} words · ${selectedDashboardManuscript.source ?? "saved manuscript"}`,
      body: "This saved manuscript will be evaluated. Pasted text is ignored while a saved/uploaded manuscript is selected.",
    };
  }

  if (manuscriptText.trim()) {
    return {
      label: "Pasted text selected",
      title: "Manual text submission",
      meta: `${formatWordCount(wordCount)} words · pasted text`,
      body: "This pasted text will be evaluated directly. It will not replace saved manuscripts in your dashboard.",
    };
  }

  return {
    label: "No writing selected",
    title: "Choose saved, upload, or paste",
    meta: "0 words detected",
    body: "Select one source before beginning evaluation.",
  };
}

/**
 * Track A: Evaluation Entry
 * Single UI entry point to create evaluate_full jobs via POST /api/jobs
 */
export default function ManuscriptSubmissionForm({ onSubmitSuccess }) {
  const fileInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [activeInputMethod, setActiveInputMethod] = useState("saved");
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

  const selectedDashboardManuscript = useMemo(
    () => dashboardManuscripts.find((doc) => doc.id === selectedManuscriptId) || null,
    [dashboardManuscripts, selectedManuscriptId],
  );

  const activeWordCount = selectedDashboardManuscript?.word_count ?? wordCount;
  const evaluationMode = getEvaluationMode(activeWordCount);
  const submissionSourceSummary = getSubmissionSourceSummary({
    activeInputMethod,
    selectedDashboardManuscript,
    manuscriptText,
    wordCount,
  });

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

  const deleteManuscriptFromDashboard = async (manuscriptId) => {
    await deleteManuscriptById(manuscriptId);
  };

  const deleteManuscriptById = async (manuscriptId, confirmationLabel) => {
    const target = dashboardManuscripts.find((doc) => doc.id === manuscriptId);
    const label = target?.title || "this manuscript";
    const confirmed = window.confirm(
      confirmationLabel || `Delete ${label}? This permanently removes it from your dashboard and this window.`,
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

      removeManuscriptLocally(manuscriptId);
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

  const handleInputMethodChange = (methodId) => {
    setActiveInputMethod(methodId);
    setError(null);

    if (methodId === "paste") {
      setSelectedManuscriptId(null);
      return;
    }

    if (methodId === "saved" || methodId === "upload") {
      setManuscriptText("");
    }
  };

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
        setActiveInputMethod("upload");
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
    setActiveInputMethod("saved");
  };

  const triggerDashboardUpload = () => uploadInputRef.current?.click();
  const triggerInlineUpload = () => fileInputRef.current?.click();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hasSelectedManuscript = Number.isInteger(selectedManuscriptId);
    const hasPastedText = manuscriptText.trim().length > 0;

    if (!hasSelectedManuscript && !hasPastedText) {
      setError("Select a saved manuscript, upload a file, or paste text to continue.");
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
    <div className="mx-auto max-w-7xl">
      <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm lg:p-8">
        <div className="mb-8 text-center">
          <p className="font-rg-mono text-xs uppercase tracking-[0.22em] text-rg-gold">Submission workbench</p>
          <h2 className="mt-3 font-rg-serif text-4xl font-semibold tracking-tight text-stone-950 md:text-5xl">Choose your writing</h2>
          <p className="mx-auto mt-3 max-w-3xl text-stone-600">
            Select one clear source: use a saved manuscript, upload a new file, or paste text. RevisionGrade will estimate the evaluation depth before submission.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            {INPUT_METHODS.map((method) => {
              const isActive = activeInputMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleInputMethodChange(method.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isActive ? "border-rg-gold bg-[#FBFAF7] shadow-sm" : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">Step 1</span>
                  <span className="mt-2 block font-rg-serif text-xl text-stone-950">{method.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-stone-600">{method.description}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="space-y-5 lg:col-span-2">
              <div>
                <label htmlFor="project-title" className="mb-2 block text-sm font-medium text-stone-700">
                  Project Title (optional)
                </label>
                <input
                  id="project-title"
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Helps organize submissions and reports"
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950"
                  disabled={isSubmitting}
                />
              </div>

              {activeInputMethod === "saved" && (
                <div className="rounded-2xl border border-stone-200 bg-[#FBFAF7] p-4">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="font-rg-serif text-2xl text-stone-950">Saved documents</h3>
                      <p className="mt-1 text-sm text-stone-600">Choose one manuscript from your workspace.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleInputMethodChange("upload")}
                        disabled={isUploading || isSubmitting}
                        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                      >
                        Upload instead
                      </button>
                      {hiddenManuscriptIds.length > 0 && (
                        <button
                          type="button"
                          onClick={restoreAllInThisWindow}
                          disabled={isUploading || isSubmitting}
                          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                        >
                          Restore hidden
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mb-3 max-h-[26rem] min-h-[12rem] space-y-2 overflow-y-auto pr-1">
                    {isLoadingDashboard ? (
                      <div className="text-sm text-stone-500">Loading saved manuscripts...</div>
                    ) : visibleDashboardManuscripts.length === 0 ? (
                      <div className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
                        No saved manuscripts found yet. Use the Upload File tab to add one, or paste text directly.
                      </div>
                    ) : (
                      visibleDashboardManuscripts.map((doc) => (
                        <div
                          key={doc.id}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            if (event.target.closest("button") || event.target.closest("input")) return;
                            toggleManuscriptSelection(doc.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleManuscriptSelection(doc.id);
                            }
                          }}
                          className={`cursor-pointer rounded-xl border p-3 ${
                            selectedManuscriptId === doc.id ? "border-rg-gold bg-white shadow-sm" : "border-stone-200 bg-white/80"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="dashboard-manuscript"
                              checked={selectedManuscriptId === doc.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (selectedManuscriptId === doc.id) {
                                  event.preventDefault();
                                  toggleManuscriptSelection(doc.id);
                                }
                              }}
                              onChange={() => {
                                if (selectedManuscriptId !== doc.id) toggleManuscriptSelection(doc.id);
                              }}
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm text-stone-950">{doc.title || "Untitled Manuscript"}</div>
                              <div className="text-xs text-stone-500">{formatWordCount(doc.word_count)} words · {doc.source ?? "saved manuscript"}</div>
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                hideManuscriptHere(doc.id);
                              }}
                              className="rounded-md border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                            >
                              Hide
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {visibleDashboardManuscripts.length > 0 && (
                    <button
                      type="button"
                      onClick={clearThisWindow}
                      disabled={isUploading || isSubmitting}
                      className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60"
                    >
                      Hide all from this window
                    </button>
                  )}
                </div>
              )}

              {activeInputMethod === "upload" && (
                <div className="rounded-2xl border border-stone-200 bg-[#FBFAF7] p-6">
                  <p className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">Upload file</p>
                  <h3 className="mt-2 font-rg-serif text-3xl text-stone-950">Upload a manuscript file</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                    Upload a DOCX or TXT file. RevisionGrade saves it to your workspace, selects it for this evaluation, and preserves the original file text as the evaluation source.
                  </p>
                  <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
                    <button
                      type="button"
                      onClick={triggerDashboardUpload}
                      disabled={isUploading || isSubmitting}
                      className="rounded-xl bg-rg-gold px-5 py-3 font-rg-mono text-xs font-semibold uppercase tracking-[0.16em] text-stone-950 shadow-sm hover:opacity-90 disabled:opacity-60"
                    >
                      {isUploading ? "Uploading..." : "Choose File"}
                    </button>
                    <p className="mt-3 text-xs text-stone-500">Supported uploads: DOCX and TXT. Files may be up to 250k words.</p>
                  </div>
                  {selectedDashboardManuscript && (
                    <button
                      type="button"
                      onClick={() => handleInputMethodChange("saved")}
                      className="mt-4 rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                    >
                      View in saved documents
                    </button>
                  )}
                </div>
              )}

              {activeInputMethod === "paste" && (
                <div className="rounded-2xl border border-stone-200 bg-[#FBFAF7] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="manuscript-text" className="font-rg-serif text-2xl text-stone-950">
                      Paste text
                    </label>
                  </div>
                  <p className="mb-3 text-sm leading-6 text-stone-600">
                    Paste a paragraph, scene, chapter, excerpt, or full manuscript. This path creates an evaluation from pasted text without changing saved dashboard manuscripts.
                  </p>
                  <textarea
                    id="manuscript-text"
                    value={manuscriptText}
                    onChange={(e) => {
                      setManuscriptText(e.target.value);
                      if (e.target.value.trim().length > 0) {
                        setSelectedManuscriptId(null);
                        setActiveInputMethod("paste");
                      }
                    }}
                    placeholder="Formatting is preserved where supported..."
                    rows={14}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950"
                    disabled={isSubmitting}
                  />
                  <p className="mt-2 text-xs text-stone-500">Current pasted word count: {formatWordCount(wordCount)}</p>
                  <p className="text-xs text-stone-500">Paste up to 150k words.</p>
                </div>
              )}

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

              <div className="rounded-xl border border-stone-200 p-4">
                <label className="mb-2 block text-sm font-medium text-stone-700">English Variant</label>
                <select
                  value={englishVariant}
                  onChange={(e) => setEnglishVariant(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950"
                >
                  <option value="us">US English</option>
                  <option value="uk">UK English</option>
                </select>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-rg-gold/30 bg-[#FBFAF7] p-5">
                <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">Selected writing</p>
                <h4 className="mt-2 font-rg-serif text-2xl text-stone-950">{submissionSourceSummary.title}</h4>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{submissionSourceSummary.label}</p>
                <p className="mt-2 text-sm font-medium text-stone-700">{submissionSourceSummary.meta}</p>
                <p className="mt-2 text-xs leading-5 text-stone-600">{submissionSourceSummary.body}</p>
              </div>

              <div className="rounded-2xl border border-rg-gold/30 bg-[#FBFAF7] p-5">
                <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">Estimated Mode</p>
                <h4 className="mt-2 font-rg-serif text-2xl text-stone-950">{evaluationMode.label}</h4>
                <p className="mt-2 text-sm font-medium text-stone-700">{evaluationMode.summary}</p>
                <p className="mt-2 text-xs leading-5 text-stone-600">{evaluationMode.detail}</p>
                <p className="mt-4 text-xs text-stone-500">Detected/selected words: {formatWordCount(activeWordCount)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-5">
                <h4 className="font-rg-serif text-2xl text-stone-950">How evaluation works</h4>
                <p className="mt-2 text-sm leading-6 text-stone-600">RevisionGrade diagnoses readiness before revision. It does not assume every submission needs the same depth of analysis.</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-5">
                <h4 className="font-rg-serif text-2xl text-stone-950">Best results</h4>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600">
                  <li>Use complete scenes or chapters when possible.</li>
                  <li>Full manuscripts enable long-form continuity analysis.</li>
                  <li>Short excerpts receive criteria-based story diagnosis only.</li>
                </ul>
              </div>
            </aside>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="mt-6 w-full rounded-xl bg-rg-gold px-6 py-4 font-rg-mono text-xs font-semibold uppercase tracking-[0.18em] text-stone-950 shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Starting Evaluation..." : "Begin Editorial Evaluation"}
          </button>
        </form>
      </div>
    </div>
  );
}
