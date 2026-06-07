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

const UNTITLED_MANUSCRIPT_PATTERN = /^untitled(?:\s+manuscript)?$/i;

const PASTE_WORD_LIMIT = 250000;

function getDocumentTitle(doc) {
  return String(doc?.title || "").trim();
}

function isUnnamedManuscript(doc) {
  const title = getDocumentTitle(doc);
  return !title || UNTITLED_MANUSCRIPT_PATTERN.test(title);
}

function getDisplayTitle(doc) {
  const title = getDocumentTitle(doc);
  return title || "Untitled Manuscript";
}

function getEvaluationMode(wordCount, manuscriptStructure) {
  if (!wordCount) {
    return {
      label: "Awaiting text",
      summary: "Select, upload, or paste writing to estimate the evaluation mode.",
      detail: "RevisionGrade confirms the final mode during analysis.",
    };
  }

  if (wordCount >= 50000) {
    return {
      label: "Novel evaluation",
      summary: "Full manuscript-scale readiness analysis.",
      detail: "Long-form continuity, recurrence, payoff, pacing over distance, and structural readiness will be assessed.",
    };
  }

  if (wordCount >= 20000 && manuscriptStructure === "standalone") {
    return {
      label: "Novella evaluation",
      summary: "Standalone narrative — manuscript-scale analysis eligible.",
      detail: "Continuity, pacing, narrative closure, and structural readiness can be assessed for this complete work.",
    };
  }

  if (wordCount >= 7500 && manuscriptStructure === "standalone") {
    return {
      label: "Novelette evaluation",
      summary: "Standalone short work — full criteria with narrative closure.",
      detail: "All 13 story criteria scored. Narrative closure and arc resolution are assessed since this is a complete work.",
    };
  }

  if (wordCount >= 6000) {
    return {
      label: "Multi-chapter evaluation",
      summary: "13 story criteria with high confidence.",
      detail: "Sufficient material for high-confidence craft diagnosis across all criteria.",
    };
  }

  return {
    label: "Short-form evaluation",
    summary: "13 story criteria only.",
    detail: "Golden Spine/WAVE long-form analysis is reserved for manuscripts of 20,000 words or more.",
  };
}

function formatWordCount(value) {
  return Number(value || 0).toLocaleString();
}

function isWhitespaceCode(code) {
  return (
    code <= 32 ||
    code === 160 ||
    code === 5760 ||
    (code >= 8192 && code <= 8202) ||
    code === 8232 ||
    code === 8233 ||
    code === 8239 ||
    code === 8287 ||
    code === 12288
  );
}

function hasNonWhitespaceText(text) {
  for (let index = 0; index < text.length; index += 1) {
    if (!isWhitespaceCode(text.charCodeAt(index))) return true;
  }
  return false;
}

function countWordsInText(text) {
  let count = 0;
  let inWord = false;

  for (let index = 0; index < text.length; index += 1) {
    if (isWhitespaceCode(text.charCodeAt(index))) {
      inWord = false;
    } else if (!inWord) {
      count += 1;
      inWord = true;
    }
  }

  return count;
}

function pluralizeManuscript(count) {
  return count === 1 ? "manuscript" : "manuscripts";
}

async function parseJsonResponseSafe(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return null;
  }
  return await response.json().catch(() => null);
}

function normalizeClientError(message, fallback) {
  if (!message || typeof message !== "string") return fallback;
  const lowered = message.toLowerCase();
  const looksLikeJsonParseIssue =
    lowered.includes("unexpected token") ||
    lowered.includes("json") ||
    lowered.includes("doctype") ||
    lowered.includes("not valid json");
  return looksLikeJsonParseIssue ? fallback : message;
}

function getSubmissionSourceSummary({ selectedDashboardManuscript, hasPastedText, wordCount }) {
  if (selectedDashboardManuscript) {
    const isUploaded = selectedDashboardManuscript.source === "upload";
    return {
      label: isUploaded ? "Uploaded file selected" : "Saved document selected",
      title: getDisplayTitle(selectedDashboardManuscript),
      meta: `${formatWordCount(selectedDashboardManuscript.word_count)} words · ${selectedDashboardManuscript.source ?? "saved manuscript"}`,
      body: "This manuscript will be evaluated. Pasted text is ignored while a saved or uploaded manuscript is selected.",
    };
  }

  if (hasPastedText) {
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
export default function ManuscriptSubmissionForm({ onSubmitSuccess, freeDiagnosticTrial = false }) {
  const uploadInputRef = useRef(null);
  const manuscriptTextareaRef = useRef(null);
  const manuscriptTextRef = useRef("");
  const pastedTextSummaryTimerRef = useRef(null);

  const [activeInputMethod, setActiveInputMethod] = useState("saved");
  const [pastedTextSummary, setPastedTextSummary] = useState({ hasText: false, wordCount: 0 });
  const [authorName, setAuthorName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [selectedManuscriptId, setSelectedManuscriptId] = useState(null);
  const [dashboardManuscripts, setDashboardManuscripts] = useState([]);
  const [hiddenManuscriptIds, setHiddenManuscriptIds] = useState([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteManuscriptId, setPendingDeleteManuscriptId] = useState(null);
  const [pendingBulkDeleteMode, setPendingBulkDeleteMode] = useState(null);
  const [deleteNotice, setDeleteNotice] = useState(null);
  const [error, setError] = useState(null);
  const [processingTermsAccepted, setProcessingTermsAccepted] = useState(false);

  const [englishVariant, setEnglishVariant] = useState("us");
  const [manuscriptStructure, setManuscriptStructure] = useState("chapters");
  const [sensitivityMode, setSensitivityMode] = useState("STANDARD");
  const [voicePreservation, setVoicePreservation] = useState("BALANCED");

  const wordCount = pastedTextSummary.wordCount;
  const isOverPasteLimit = wordCount > PASTE_WORD_LIMIT;

  const selectedDashboardManuscript = useMemo(
    () => dashboardManuscripts.find((doc) => doc.id === selectedManuscriptId) || null,
    [dashboardManuscripts, selectedManuscriptId],
  );

  const uploadedManuscriptSelected = activeInputMethod === "upload" && selectedDashboardManuscript?.source === "upload";
  const activeWordCount = selectedDashboardManuscript?.word_count ?? wordCount;
  const evaluationMode = getEvaluationMode(activeWordCount, manuscriptStructure);
  const submissionSourceSummary = getSubmissionSourceSummary({
    selectedDashboardManuscript,
    hasPastedText: pastedTextSummary.hasText,
    wordCount,
  });

  const unnamedDashboardManuscripts = useMemo(
    () => dashboardManuscripts.filter(isUnnamedManuscript),
    [dashboardManuscripts],
  );

  const visibleDashboardManuscripts = useMemo(
    () => dashboardManuscripts.filter((doc) => !hiddenManuscriptIds.includes(doc.id) && !isUnnamedManuscript(doc)),
    [dashboardManuscripts, hiddenManuscriptIds],
  );

  const bulkDeleteTargets = useMemo(() => {
    if (pendingBulkDeleteMode === "shown") return visibleDashboardManuscripts;
    if (pendingBulkDeleteMode === "unnamed") return unnamedDashboardManuscripts;
    return [];
  }, [pendingBulkDeleteMode, unnamedDashboardManuscripts, visibleDashboardManuscripts]);

  const clearPendingPastedTextSummary = () => {
    if (pastedTextSummaryTimerRef.current !== null) {
      window.clearTimeout(pastedTextSummaryTimerRef.current);
      pastedTextSummaryTimerRef.current = null;
    }
  };

  const getCurrentPastedText = () => {
    const currentText = manuscriptTextareaRef.current?.value ?? manuscriptTextRef.current;
    manuscriptTextRef.current = currentText;
    return currentText;
  };

  const updatePastedTextSummaryNow = (text) => {
    setPastedTextSummary({ hasText: hasNonWhitespaceText(text), wordCount: countWordsInText(text) });
  };

  const setPastedTextValue = (nextText) => {
    manuscriptTextRef.current = nextText;
    if (manuscriptTextareaRef.current && manuscriptTextareaRef.current.value !== nextText) {
      manuscriptTextareaRef.current.value = nextText;
    }
    clearPendingPastedTextSummary();
    updatePastedTextSummaryNow(nextText);
  };

  const handlePastedTextChange = (event) => {
    manuscriptTextRef.current = event.currentTarget.value;

    if (manuscriptTextRef.current.length > 0) {
      if (selectedManuscriptId !== null) setSelectedManuscriptId(null);
      if (activeInputMethod !== "paste") setActiveInputMethod("paste");
    }

    clearPendingPastedTextSummary();
    pastedTextSummaryTimerRef.current = window.setTimeout(() => {
      pastedTextSummaryTimerRef.current = null;
      updatePastedTextSummaryNow(getCurrentPastedText());
    }, 180);
  };

  const removeManuscriptsLocally = (manuscriptIds) => {
    const ids = new Set(manuscriptIds);
    setDashboardManuscripts((prev) => prev.filter((doc) => !ids.has(doc.id)));
    setHiddenManuscriptIds((prev) => prev.filter((id) => !ids.has(id)));
    setSelectedManuscriptId((current) => (ids.has(current) ? null : current));
    setPendingDeleteManuscriptId((current) => (ids.has(current) ? null : current));
  };

  const removeManuscriptLocally = (manuscriptId) => {
    removeManuscriptsLocally([manuscriptId]);
  };

  const hideManuscriptHere = (manuscriptId) => {
    setHiddenManuscriptIds((prev) => (prev.includes(manuscriptId) ? prev : [...prev, manuscriptId]));
    setSelectedManuscriptId((current) => (current === manuscriptId ? null : current));
    setPendingDeleteManuscriptId((current) => (current === manuscriptId ? null : current));
    setPendingBulkDeleteMode(null);
    setDeleteNotice(null);
  };

  const deleteManuscriptsByIds = async (manuscriptIds) => {
    const ids = [...new Set(manuscriptIds)].filter((id) => id != null);
    if (ids.length === 0) return;

    setError(null);
    setDeleteNotice(null);

    const results = await Promise.allSettled(
      ids.map(async (manuscriptId) => {
        const response = await fetch(`/api/manuscripts?id=${encodeURIComponent(String(manuscriptId))}`, {
          method: "DELETE",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || `Delete failed for manuscript ${manuscriptId}`);
        }

        return manuscriptId;
      }),
    );

    const deletedIds = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failedCount = results.length - deletedIds.length;

    if (deletedIds.length > 0) {
      removeManuscriptsLocally(deletedIds);
    }

    setPendingBulkDeleteMode(null);

    if (ids.length > 1) {
      setDeleteNotice(`Deleted ${deletedIds.length} ${pluralizeManuscript(deletedIds.length)}.`);
    }

    if (failedCount > 0) {
      setError(`${failedCount} ${pluralizeManuscript(failedCount)} could not be deleted. Please try again.`);
    }
  };

  const deleteManuscriptById = async (manuscriptId) => {
    await deleteManuscriptsByIds([manuscriptId]);
  };

  const clearThisWindow = () => {
    setHiddenManuscriptIds(dashboardManuscripts.map((doc) => doc.id));
    setSelectedManuscriptId(null);
    setPendingDeleteManuscriptId(null);
    setPendingBulkDeleteMode(null);
    setDeleteNotice(null);
  };

  const restoreAllInThisWindow = () => {
    setHiddenManuscriptIds([]);
    setDeleteNotice(null);
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

  useEffect(() => {
    return () => {
      clearPendingPastedTextSummary();
    };
  }, []);

  const handleInputMethodChange = (methodId) => {
    setActiveInputMethod(methodId);
    setError(null);
    setPendingDeleteManuscriptId(null);
    setPendingBulkDeleteMode(null);
    setDeleteNotice(null);

    if (methodId === "paste") {
      setSelectedManuscriptId(null);
      return;
    }

    if (methodId === "saved" || methodId === "upload") {
      setPastedTextValue("");
    }
  };

  const handleUploadFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setPendingDeleteManuscriptId(null);
    setPendingBulkDeleteMode(null);
    setDeleteNotice(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", projectTitle || file.name.replace(/\.[^.]+$/, ""));
      form.append("english_variant", englishVariant);

      const response = await fetch("/api/manuscripts", {
        method: "POST",
        body: form,
      });
      const data = await parseJsonResponseSafe(response);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired. Please sign in again, then retry upload.");
        }

        const apiError =
          data?.details && data?.error ? `${data.error}: ${data.details}` : data?.error || "Upload failed";

        throw new Error(
          normalizeClientError(
            apiError,
            "We couldn't read that DOCX file. Please try again or upload a .txt/.docx file.",
          ),
        );
      }

      if (data?.manuscript) {
        setDashboardManuscripts((prev) => [data.manuscript, ...prev.filter((m) => m.id !== data.manuscript.id)]);
        setSelectedManuscriptId(data.manuscript.id);
        setHiddenManuscriptIds((prev) => prev.filter((id) => id !== data.manuscript.id));
        setPastedTextValue("");
        setActiveInputMethod("upload");
      }
    } catch (err) {
      setError(
        normalizeClientError(
          err?.message,
          "We couldn't read that DOCX file. Please try again or upload a .txt/.docx file.",
        ),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const toggleManuscriptSelection = (manuscriptId) => {
    setSelectedManuscriptId((current) => (current === manuscriptId ? null : manuscriptId));
    setPastedTextValue("");
    setActiveInputMethod("saved");
    setPendingDeleteManuscriptId(null);
    setPendingBulkDeleteMode(null);
    setDeleteNotice(null);
  };

  const triggerDashboardUpload = () => uploadInputRef.current?.click();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const manuscriptText = getCurrentPastedText();
    const hasSelectedManuscript = Number.isInteger(selectedManuscriptId);
    const hasPastedText = hasNonWhitespaceText(manuscriptText);

    if (!hasSelectedManuscript && hasPastedText && countWordsInText(manuscriptText) > PASTE_WORD_LIMIT) {
      setError(
        `Your pasted text exceeds the 250,000-word limit for direct paste. Please use the Upload File tab to submit manuscripts of this length.`,
      );
      return;
    }

    if (!processingTermsAccepted) {
      setError("Please confirm the processing terms before continuing.");
      return;
    }

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
    setPendingDeleteManuscriptId(null);
    setPendingBulkDeleteMode(null);
    setDeleteNotice(null);

    try {
      const manuscriptSize = hasPastedText ? new Blob([manuscriptText]).size : undefined;

      const payload = {
        job_type: "evaluate_full",
        ...(freeDiagnosticTrial ? { user_tier: "free" } : {}),
        author_name: authorName.trim() || null,
        manuscript_title: projectTitle,
        english_variant: englishVariant,
        manuscript_structure: manuscriptStructure,
        sensitivity_mode: sensitivityMode,
        voice_preservation_level: voicePreservation.toLowerCase(),
        processing_terms_accepted: true,
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

      const data = await parseJsonResponseSafe(response);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired. Please sign in again, then retry.");
        }
        throw new Error(
          normalizeClientError(data?.error || "Failed to create evaluation job", "Failed to create evaluation job"),
        );
      }

      setPastedTextValue("");
      setProcessingTermsAccepted(false);
      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }
    } catch (err) {
      setError(normalizeClientError(err?.message, "Failed to create evaluation job"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl text-[17px] text-stone-950">
      <div className="rounded-3xl border border-stone-300 bg-white p-5 shadow-sm md:p-6 lg:p-7">
        <div className="mb-6 text-center">
          <p className="font-rg-mono text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#8A5A00]">Submission workbench</p>
          <h2 className="mt-2 font-rg-serif text-4xl font-semibold tracking-tight text-stone-950 md:text-5xl">Choose your writing</h2>
          <p className="mx-auto mt-2 max-w-3xl text-base leading-7 text-stone-800">
            Select one clear source: use a saved manuscript, upload a new file, or paste text. RevisionGrade will estimate the evaluation depth before submission.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            {INPUT_METHODS.map((method) => {
              const isActive = activeInputMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleInputMethodChange(method.id)}
                  className={`relative min-h-[7.25rem] rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                    isActive
                      ? "border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600/20"
                      : "border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50"
                  }`}
                  aria-pressed={isActive}
                >
                  {isActive && (
                    <span className="absolute right-4 top-4 rounded-full bg-blue-700 px-2.5 py-1 font-rg-mono text-[0.72rem] font-bold uppercase tracking-[0.08em] text-white">
                      Selected
                    </span>
                  )}
                  <span className="font-rg-mono text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[#8A5A00]">Step 1</span>
                  <span className="mt-2 block font-rg-serif text-2xl leading-tight text-stone-950">{method.label}</span>
                  <span className="mt-1.5 block text-base leading-6 text-stone-800">{method.description}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <section className="space-y-4">
              <div>
                <label htmlFor="author-name" className="mb-2 block text-[0.95rem] font-semibold text-stone-900">
                  Author Name <span className="font-normal text-stone-700">(optional)</span>
                </label>
                <input
                  id="author-name"
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g., Michael J. Meraw or pen name"
                  className="min-h-[48px] w-full rounded-lg border border-stone-400 bg-white px-4 py-3 text-base text-stone-950 placeholder:text-stone-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="project-title" className="mb-2 block text-[0.95rem] font-semibold text-stone-900">
                  Project Title <span className="font-normal text-stone-700">(optional)</span>
                </label>
                <input
                  id="project-title"
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Helps organize submissions and reports"
                  className="min-h-[48px] w-full rounded-lg border border-stone-400 bg-white px-4 py-3 text-base text-stone-950 placeholder:text-stone-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  disabled={isSubmitting}
                />
              </div>

              {activeInputMethod === "saved" && (
                <div className="rounded-2xl border border-stone-300 bg-[#FBFAF7] p-4 md:p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="font-rg-serif text-3xl leading-tight text-stone-950">Saved documents</h3>
                      <p className="mt-1 text-base leading-6 text-stone-800">Choose one manuscript from your workspace.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {unnamedDashboardManuscripts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setDeleteNotice(null);
                            setPendingDeleteManuscriptId(null);
                            setPendingBulkDeleteMode("unnamed");
                          }}
                          disabled={isUploading || isSubmitting}
                          className="min-h-[42px] rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Delete unnamed ({unnamedDashboardManuscripts.length})
                        </button>
                      )}
                      {visibleDashboardManuscripts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setDeleteNotice(null);
                            setPendingDeleteManuscriptId(null);
                            setPendingBulkDeleteMode("shown");
                          }}
                          disabled={isUploading || isSubmitting}
                          className="min-h-[42px] rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Delete all shown
                        </button>
                      )}
                      {hiddenManuscriptIds.length > 0 && (
                        <button
                          type="button"
                          onClick={restoreAllInThisWindow}
                          disabled={isUploading || isSubmitting}
                          className="min-h-[42px] rounded-lg border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-50 disabled:opacity-60"
                        >
                          Restore hidden
                        </button>
                      )}
                    </div>
                  </div>

                  {deleteNotice && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                      {deleteNotice}
                    </div>
                  )}

                  {unnamedDashboardManuscripts.length > 0 && (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      {unnamedDashboardManuscripts.length} unnamed {pluralizeManuscript(unnamedDashboardManuscripts.length)} hidden from this list. Use Delete unnamed to permanently remove {unnamedDashboardManuscripts.length === 1 ? "it" : "them"}.
                    </div>
                  )}

                  {pendingBulkDeleteMode && bulkDeleteTargets.length > 0 && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-900">
                        Delete {bulkDeleteTargets.length} {pluralizeManuscript(bulkDeleteTargets.length)} from your dashboard?
                      </p>
                      <p className="mt-1 text-sm text-red-800">
                        This permanently removes {bulkDeleteTargets.length === 1 ? "this manuscript" : "these manuscripts"} from your dashboard and this window.
                      </p>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPendingBulkDeleteMode(null)}
                          className="min-h-[34px] rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteManuscriptsByIds(bulkDeleteTargets.map((doc) => doc.id))}
                          className="min-h-[34px] rounded-md border border-red-700 bg-red-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-800"
                        >
                          Confirm Delete {bulkDeleteTargets.length}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mb-3 max-h-[24rem] min-h-[12rem] space-y-2 overflow-y-auto pr-1">
                    {isLoadingDashboard ? (
                      <div className="text-base text-stone-700">Loading saved manuscripts...</div>
                    ) : visibleDashboardManuscripts.length === 0 ? (
                      <div className="rounded-xl border border-stone-300 bg-white p-5 text-base text-stone-700">
                        No named saved manuscripts found yet. Use the Upload File tab to add one, or paste text directly.
                      </div>
                    ) : (
                      visibleDashboardManuscripts.map((doc) => {
                        const isSelected = selectedManuscriptId === doc.id;
                        const isConfirmingDelete = pendingDeleteManuscriptId === doc.id;
                        return (
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
                            className={`cursor-pointer rounded-xl border p-3.5 transition focus:outline-none focus:ring-2 focus:ring-blue-600/25 ${
                              isSelected ? "border-blue-600 bg-blue-50 shadow-sm" : "border-stone-300 bg-white hover:border-stone-400"
                            }`}
                          >
                            <div className="flex min-h-[3.65rem] items-center gap-3">
                              <input
                                type="radio"
                                name="dashboard-manuscript"
                                checked={isSelected}
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
                                className="h-5 w-5 shrink-0 accent-blue-700"
                                aria-label={`Select ${getDisplayTitle(doc)}`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-base font-bold leading-6 text-stone-950">{getDisplayTitle(doc)}</div>
                                <div className="text-[0.95rem] leading-5 text-stone-700">{formatWordCount(doc.word_count)} words · {doc.source ?? "saved manuscript"}</div>
                              </div>
                              <div className="flex shrink-0 gap-1.5">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    hideManuscriptHere(doc.id);
                                  }}
                                  className="min-h-[38px] rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100"
                                >
                                  Hide
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setError(null);
                                    setDeleteNotice(null);
                                    setPendingBulkDeleteMode(null);
                                    setPendingDeleteManuscriptId(doc.id);
                                  }}
                                  className="min-h-[38px] rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {isConfirmingDelete && (
                              <div
                                className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <p className="text-sm font-semibold text-red-900">
                                  Delete {getDisplayTitle(doc)} from your dashboard?
                                </p>
                                <p className="mt-1 text-sm text-red-800">
                                  This permanently removes it from your dashboard and this window.
                                </p>
                                <div className="mt-3 flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setPendingDeleteManuscriptId(null);
                                    }}
                                    className="min-h-[34px] rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void deleteManuscriptById(doc.id);
                                    }}
                                    className="min-h-[34px] rounded-md border border-red-700 bg-red-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-800"
                                  >
                                    Confirm Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {visibleDashboardManuscripts.length > 0 && (
                      <button
                        type="button"
                        onClick={clearThisWindow}
                        disabled={isUploading || isSubmitting}
                        className="min-h-[40px] rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-60"
                      >
                        Hide all from this window
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeInputMethod === "upload" && (
                <div className="rounded-2xl border border-stone-300 bg-[#FBFAF7] p-5 md:p-6">
                  <p className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.16em] text-[#8A5A00]">Upload file</p>
                  <h3 className="mt-2 font-rg-serif text-3xl text-stone-950">Upload a manuscript file</h3>
                  <p className="mt-2 max-w-2xl text-base leading-7 text-stone-800">
                    Upload a DOCX or TXT file. RevisionGrade saves it to your workspace, selects it for this evaluation, and preserves the original file text as the evaluation source.
                  </p>

                  {uploadedManuscriptSelected ? (
                    <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-left shadow-sm">
                      <p className="font-rg-mono text-[0.76rem] font-bold uppercase tracking-[0.14em] text-emerald-800">
                        File uploaded and selected ✓
                      </p>
                      <h4 className="mt-2 font-rg-serif text-2xl leading-tight text-stone-950">
                        {getDisplayTitle(selectedDashboardManuscript)}
                      </h4>
                      <p className="mt-2 text-base font-bold text-stone-950">
                        {formatWordCount(selectedDashboardManuscript.word_count)} words · uploaded file
                      </p>
                      <p className="mt-2 text-base leading-6 text-stone-800">
                        This file is loaded, selected, and ready for evaluation. Use Replace File only if you want to evaluate a different upload.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={triggerDashboardUpload}
                          disabled={isUploading || isSubmitting}
                          className="min-h-[44px] rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                        >
                          {isUploading ? "Uploading..." : "Replace File"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInputMethodChange("saved")}
                          className="min-h-[44px] rounded-lg border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-50"
                        >
                          View in saved documents
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-stone-400 bg-white p-8 text-center">
                      <button
                        type="button"
                        onClick={triggerDashboardUpload}
                        disabled={isUploading || isSubmitting}
                        className="min-h-[50px] rounded-xl bg-blue-700 px-6 py-3 font-rg-mono text-sm font-bold uppercase tracking-[0.14em] text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                      >
                        {isUploading ? "Uploading..." : "Choose File"}
                      </button>
                      <p className="mt-3 text-base text-stone-700">Supported uploads: DOCX and TXT. Files may be up to 250k words.</p>
                    </div>
                  )}
                </div>
              )}

              {activeInputMethod === "paste" && (
                <div className="rounded-2xl border border-stone-300 bg-[#FBFAF7] p-5">
                  <label htmlFor="manuscript-text" className="font-rg-serif text-3xl text-stone-950">
                    Paste text
                  </label>
                  <p className="mb-3 mt-2 text-base leading-7 text-stone-800">
                    Paste a paragraph, scene, chapter, excerpt, or full manuscript. This path creates an evaluation from pasted text without changing saved dashboard manuscripts.
                  </p>
                  <textarea
                    id="manuscript-text"
                    ref={manuscriptTextareaRef}
                    defaultValue={manuscriptTextRef.current}
                    onChange={handlePastedTextChange}
                    placeholder="Formatting is preserved where supported..."
                    rows={12}
                    className={`w-full rounded-lg border bg-white px-4 py-3 text-base leading-7 text-stone-950 placeholder:text-stone-500 focus:outline-none focus:ring-2 ${isOverPasteLimit ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-stone-400 focus:border-blue-600 focus:ring-blue-600/20"}`}
                    disabled={isSubmitting}
                  />
                  <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                    <p className={`text-base font-semibold ${isOverPasteLimit ? "text-red-700" : "text-stone-700"}`}>
                      Current pasted word count: {formatWordCount(wordCount)}
                    </p>
                    <p className="text-base text-stone-500">Maximum: {formatWordCount(PASTE_WORD_LIMIT)} words</p>
                  </div>
                  {isOverPasteLimit && (
                    <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-4">
                      <p className="text-base font-bold text-red-900">
                        Paste limit exceeded — {formatWordCount(wordCount)} of {formatWordCount(PASTE_WORD_LIMIT)} words maximum.
                      </p>
                      <p className="mt-1 text-base text-red-800">
                        Manuscripts over 250,000 words must be submitted via file upload. Use the Upload File tab to continue.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleInputMethodChange("upload")}
                        className="mt-3 inline-flex min-h-[42px] items-center rounded-lg bg-blue-700 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800"
                      >
                        Switch to Upload File
                      </button>
                    </div>
                  )}
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-stone-300 p-4">
                  <label className="mb-2 block text-[0.95rem] font-semibold text-stone-900">English Variant</label>
                  <select
                    value={englishVariant}
                    onChange={(e) => setEnglishVariant(e.target.value)}
                    className="min-h-[48px] w-full rounded-lg border border-stone-400 bg-white px-4 py-2 text-base text-stone-950 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="us">US English</option>
                    <option value="uk">UK English</option>
                    <option value="ca">Canadian English</option>
                    <option value="au">Australian English</option>
                    <option value="za">South African English</option>
                    <option value="nz">New Zealand English</option>
                  </select>
                </div>

                <div className="rounded-xl border border-stone-300 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <label className="block text-[0.95rem] font-semibold text-stone-900">Manuscript Structure</label>
                    <span className="group relative cursor-help">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stone-400 text-xs font-bold text-stone-700">i</span>
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-80 -translate-x-1/2 rounded-lg border border-stone-300 bg-white p-3 text-sm leading-relaxed text-stone-800 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        <strong className="block text-stone-950">Standalone story</strong>
                        A self-contained narrative with its own beginning, middle, and ending — such as a short story, novelette, novella, or complete novel.
                        <strong className="mt-2 block text-stone-950">Chapter(s) from a larger work</strong>
                        An excerpt or section from a longer manuscript. The system won&apos;t penalize unresolved plot threads or open endings.
                      </span>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex min-h-[38px] items-center gap-3 rounded-md px-2 py-1.5 text-base text-stone-900 hover:bg-stone-50">
                      <input
                        type="radio"
                        name="manuscriptStructure"
                        value="chapters"
                        checked={manuscriptStructure === "chapters"}
                        onChange={() => setManuscriptStructure("chapters")}
                        className="h-5 w-5 accent-blue-700"
                      />
                      <span>Chapter(s) from a larger work</span>
                    </label>
                    <label className="flex min-h-[38px] items-center gap-3 rounded-md px-2 py-1.5 text-base text-stone-900 hover:bg-stone-50">
                      <input
                        type="radio"
                        name="manuscriptStructure"
                        value="standalone"
                        checked={manuscriptStructure === "standalone"}
                        onChange={() => setManuscriptStructure("standalone")}
                        className="h-5 w-5 accent-blue-700"
                      />
                      <span>Standalone story</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-stone-700">Evaluation Mode</label>
                  <select
                    value={sensitivityMode}
                    onChange={(e) => setSensitivityMode(e.target.value)}
                    disabled={isSubmitting || isUploading}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="TRANSGRESSIVE">Transgressive</option>
                    <option value="TESTIMONY">Testimony</option>
                  </select>
                  <p className="mt-1 text-xs text-stone-500">
                    {sensitivityMode === "STANDARD" && "Default mode for most manuscripts."}
                    {sensitivityMode === "TRANSGRESSIVE" && "For work with intentional register breaks, non-standard structure, or boundary-pushing craft."}
                    {sensitivityMode === "TESTIMONY" && "For testimony-like, memoir, or sensitive lived-experience material."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-stone-700">Voice Preservation</label>
                  <select
                    value={voicePreservation}
                    onChange={(e) => setVoicePreservation(e.target.value)}
                    disabled={isSubmitting || isUploading}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900"
                  >
                    <option value="MAXIMUM">Maximum — preserve my voice</option>
                    <option value="BALANCED">Balanced</option>
                    <option value="POLISHED">Polished — prioritize readability</option>
                  </select>
                  <p className="mt-1 text-xs text-stone-500">
                    Controls how aggressively revision recommendations rewrite your prose.
                  </p>
                </div>
              </div>

              <label className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left">
                <input
                  type="checkbox"
                  checked={processingTermsAccepted}
                  onChange={(event) => {
                    setProcessingTermsAccepted(event.target.checked);
                    if (event.target.checked) setError(null);
                  }}
                  disabled={isSubmitting || isUploading}
                  className="mt-1 h-5 w-5 shrink-0 accent-blue-700"
                />
                <span className="text-base leading-7 text-stone-900">
                  I understand that RevisionGrade evaluations are custom digital services, that processing starts after submission, and that I agree to the processing and refund terms.
                  <a href="/terms" className="ml-1 font-bold text-blue-800 underline underline-offset-2 hover:text-stone-950" target="_blank" rel="noreferrer">
                    Read terms.
                  </a>
                </span>
              </label>

              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4">
                  <p className="text-base font-semibold text-red-900">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isUploading || !processingTermsAccepted || isOverPasteLimit}
                className="min-h-[56px] w-full rounded-xl bg-blue-700 px-6 py-4 font-rg-mono text-base font-bold uppercase tracking-[0.16em] text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-700 disabled:opacity-100"
              >
                {isSubmitting ? "Starting Evaluation..." : "Begin Editorial Evaluation"}
              </button>
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#A36A00]/45 bg-[#FFF8E8] p-5">
                <p className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.14em] text-[#8A5A00]">Selected writing</p>
                <h4 className="mt-2 font-rg-serif text-2xl leading-tight text-stone-950">{submissionSourceSummary.title}</h4>
                <p className="mt-2 text-sm font-bold uppercase tracking-[0.08em] text-stone-800">{submissionSourceSummary.label}</p>
                <p className="mt-2 text-base font-bold text-stone-950">{submissionSourceSummary.meta}</p>
                <p className="mt-2 text-base leading-6 text-stone-800">{submissionSourceSummary.body}</p>
              </div>

              <div className="rounded-2xl border border-[#A36A00]/45 bg-[#FFF8E8] p-5">
                <p className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.14em] text-[#8A5A00]">Estimated mode</p>
                <h4 className="mt-2 font-rg-serif text-2xl leading-tight text-stone-950">{evaluationMode.label}</h4>
                <p className="mt-2 text-base font-bold text-stone-950">{evaluationMode.summary}</p>
                <p className="mt-2 text-base leading-6 text-stone-800">{evaluationMode.detail}</p>
                <p className="mt-4 text-base font-bold text-stone-950">Detected/selected words: {formatWordCount(activeWordCount)}</p>
              </div>

              <div className="rounded-2xl border border-stone-300 bg-white p-5">
                <h4 className="font-rg-serif text-2xl text-stone-950">Guidance</h4>
                <p className="mt-2 text-base leading-7 text-stone-800">
                  RevisionGrade diagnoses readiness before revision. It does not assume every submission needs the same depth of analysis.
                </p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-6 text-stone-800">
                  <li>Use complete scenes or chapters when possible.</li>
                  <li>Full manuscripts enable long-form continuity analysis.</li>
                  <li>Short excerpts receive criteria-based story diagnosis only.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#A36A00]/45 bg-[#FFF8E8] p-5">
                <p className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.14em] text-[#8A5A00]">Document eligibility</p>
                <h4 className="mt-2 font-rg-serif text-2xl leading-tight text-stone-950">What can be evaluated</h4>
                <p className="mt-2 text-base leading-7 text-stone-800">
                  RevisionGrade evaluates manuscripts and serious narrative excerpts: novels, novellas, book-length memoirs, narrative nonfiction manuscripts, and substantial fiction/nonfiction excerpts.
                </p>
                <p className="mt-3 text-base leading-7 text-stone-800">
                  It does <span className="font-semibold">not</span> evaluate general documents such as personal/business letters, professional correspondence, query letters, synopses, author bios, resumes/CVs, academic papers, research papers, legal documents, contracts, or marketing/sales copy.
                </p>
                <p className="mt-3 text-base leading-7 text-stone-800">
                  If unsupported content is detected, evaluation will not proceed. You&apos;ll receive a clear explanation and can resubmit with an eligible manuscript.
                </p>
                <a
                  href="/faq"
                  className="mt-3 inline-flex text-sm font-bold text-blue-800 underline underline-offset-2 hover:text-stone-950"
                >
                  Read full eligibility policy
                </a>
              </div>
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}
