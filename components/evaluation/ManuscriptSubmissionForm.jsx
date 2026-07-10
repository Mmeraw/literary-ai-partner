"use client"; // cache-bust 2026-07-08T21:07-design-system-v1

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

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

// ─── Brand tokens ────────────────────────────────────────────────────────────
const C = {
  oxblood:      "#7A2B1A",
  gold:         "#8A5A00",
  goldBorder:   "rgba(138,90,0,0.55)",
  cream:        "#FFF8E8",
  ink:          "#1C1410",
  body:         "#3D2E1A",
  meta:         "#5C4A32",
  muted:        "#7A6A52",
  inputBorder:  "#C4B8A8",
  inputFocusRing: "rgba(122,43,26,0.18)",
  surface:      "#FBFAF7",
  white:        "#FFFFFF",
};

// Focus style shared for all inputs/selects/textareas — oxblood ring
const INPUT_CLS =
  "min-h-[48px] w-full rounded-lg border bg-white px-4 py-3 text-base leading-6 focus:outline-none focus:ring-2";

function inputStyle(overrideStyle = {}) {
  return {
    borderColor: C.inputBorder,
    color: C.ink,
    ...overrideStyle,
  };
}

// Stable module-scope field components. Defining these inside the form causes
// React to treat them as new component types on every state update, remounting the
// active input and dropping focus after each keystroke.
const focusRingStyle = {
  outline: "none",
  boxShadow: `0 0 0 3px ${C.inputFocusRing}`,
  borderColor: C.oxblood,
};
const blurStyle = { outline: "none", boxShadow: "none" };

function FocusableInput({ className, style, onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      className={className}
      style={{ ...style, ...(focused ? focusRingStyle : blurStyle) }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
}

function FocusableSelect({ className, style, children, onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      className={className}
      style={{ ...style, ...(focused ? focusRingStyle : blurStyle) }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
    >
      {children}
    </select>
  );
}

function FocusableTextarea({ className, style, onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...props}
      className={className}
      style={{ ...style, ...(focused ? focusRingStyle : blurStyle) }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
}

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
      detail:
        "Long-form continuity, recurrence, payoff, pacing over distance, and structural readiness will be assessed.",
    };
  }

  if (wordCount >= 20000 && manuscriptStructure === "standalone") {
    return {
      label: "Novella evaluation",
      summary: "Standalone narrative — manuscript-scale analysis eligible.",
      detail:
        "Continuity, pacing, narrative closure, and structural readiness can be assessed for this complete work.",
    };
  }

  if (wordCount >= 7500 && manuscriptStructure === "standalone") {
    return {
      label: "Novelette evaluation",
      summary: "Standalone short work — full criteria with narrative closure.",
      detail:
        "All 13 story criteria scored. Narrative closure and arc resolution are assessed since this is a complete work.",
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
    detail:
      "Golden Spine/WAVE long-form analysis is reserved for manuscripts of 20,000 words or more.",
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
      startTransition(() => {
        setSelectedManuscriptId((prev) => (prev !== null ? null : prev));
        setActiveInputMethod((prev) => (prev !== "paste" ? "paste" : prev));
      });
    }

    clearPendingPastedTextSummary();
    pastedTextSummaryTimerRef.current = window.setTimeout(() => {
      pastedTextSummaryTimerRef.current = null;
      startTransition(() => {
        updatePastedTextSummaryNow(getCurrentPastedText());
      });
    }, 350);
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
    <div className="mx-auto max-w-7xl" style={{ color: C.ink, fontSize: "17px" }}>
      <div className="rounded-3xl border bg-white p-5 shadow-sm md:p-6 lg:p-7" style={{ borderColor: "#D6D0C8" }}>
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="mb-6 text-center">
          <p
            className="font-rg-mono text-[0.78rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: C.gold }}
          >
            Submission workbench
          </p>
          <h2
            className="mt-2 font-rg-serif text-4xl font-semibold tracking-tight md:text-5xl"
            style={{ color: C.ink }}
          >
            Choose your writing
          </h2>
          <p
            className="mx-auto mt-2 max-w-3xl text-base leading-7"
            style={{ color: C.body }}
          >
            Select one clear source: use a saved manuscript, upload a new file, or paste text. RevisionGrade will estimate the evaluation depth before submission.
          </p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* ── Option A / B / C cards ──────────────────────────────────── */}
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            {INPUT_METHODS.map((method, idx) => {
              const isActive = activeInputMethod === method.id;
              const optionLabels = ["Option A", "Option B", "Option C"];
              const optionLabel = optionLabels[idx] || "Option";
              const cardStyle = isActive
                ? { outline: "2px solid #8A5A00", outlineOffset: "-2px", backgroundColor: C.cream }
                : { outline: "1px solid #D6D0C8", outlineOffset: "-1px", backgroundColor: C.white };
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleInputMethodChange(method.id)}
                  className="relative min-h-[6.5rem] rounded-xl p-4 text-left transition focus:outline-none"
                  style={cardStyle}
                  aria-pressed={isActive}
                >
                  {isActive && (
                    <span
                      className="absolute right-3 top-3 rounded-full px-2 py-0.5 font-rg-mono text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                      style={{ backgroundColor: C.oxblood, color: "#FFFFFF" }}
                    >
                      Selected
                    </span>
                  )}
                  <span
                    className="font-rg-mono text-[0.72rem] font-bold uppercase tracking-[0.14em]"
                    style={{ color: isActive ? C.oxblood : C.gold }}
                  >
                    {optionLabel}
                  </span>
                  <span
                    className="mt-1.5 block font-rg-serif text-xl leading-tight"
                    style={{ color: C.ink }}
                  >
                    {method.label}
                  </span>
                  <span
                    className="mt-1 block text-sm leading-5"
                    style={{ color: C.meta }}
                  >
                    {method.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Main two-column layout ──────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
            {/* ── Left: form fields ─────────────────────────────────────── */}
            <section className="space-y-4">

              {/* Author Name */}
              <div>
                <label
                  htmlFor="author-name"
                  className="mb-2 block text-[0.95rem] font-semibold"
                  style={{ color: C.ink }}
                >
                  Author Name{" "}
                  <span className="font-normal" style={{ color: C.meta }}>
                    (optional)
                  </span>
                </label>
                <FocusableInput
                  id="author-name"
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g., Michael J. Meraw or pen name"
                  className="min-h-[48px] w-full rounded-lg border bg-white px-4 py-3 text-base"
                  style={inputStyle({ color: C.ink })}
                  disabled={isSubmitting}
                />
              </div>

              {/* Project Title */}
              <div>
                <label
                  htmlFor="project-title"
                  className="mb-2 block text-[0.95rem] font-semibold"
                  style={{ color: C.ink }}
                >
                  Project Title{" "}
                  <span className="font-normal" style={{ color: C.meta }}>
                    (optional)
                  </span>
                </label>
                <FocusableInput
                  id="project-title"
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Helps organize submissions and reports"
                  className="min-h-[48px] w-full rounded-lg border bg-white px-4 py-3 text-base"
                  style={inputStyle({ color: C.ink })}
                  disabled={isSubmitting}
                />
              </div>

              {/* ── Saved documents panel ─────────────────────────────── */}
              {activeInputMethod === "saved" && (
                <div
                  className="rounded-2xl border p-4 md:p-5"
                  style={{ borderColor: "#D6D0C8", backgroundColor: C.surface }}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3
                        className="font-rg-serif text-xl leading-tight"
                        style={{ color: C.ink }}
                      >
                        Saved documents
                      </h3>
                      <p className="mt-0.5 text-sm" style={{ color: C.meta }}>
                        Click a manuscript to select it.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {hiddenManuscriptIds.length > 0 && (
                        <button
                          type="button"
                          onClick={restoreAllInThisWindow}
                          disabled={isUploading || isSubmitting}
                          className="rounded border bg-white px-2.5 py-1 text-xs font-semibold hover:bg-stone-50 disabled:opacity-60"
                          style={{ borderColor: "#C4B8A8", color: C.body }}
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
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm" style={{ color: "#7A4F00" }}>
                      {unnamedDashboardManuscripts.length} unnamed{" "}
                      {pluralizeManuscript(unnamedDashboardManuscripts.length)} hidden from this list. Use Delete unnamed to permanently remove{" "}
                      {unnamedDashboardManuscripts.length === 1 ? "it" : "them"}.
                    </div>
                  )}

                  {pendingBulkDeleteMode && bulkDeleteTargets.length > 0 && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-900">
                        Delete {bulkDeleteTargets.length}{" "}
                        {pluralizeManuscript(bulkDeleteTargets.length)} from your dashboard?
                      </p>
                      <p className="mt-1 text-sm text-red-800">
                        This permanently removes{" "}
                        {bulkDeleteTargets.length === 1 ? "this manuscript" : "these manuscripts"}{" "}
                        from your dashboard and this window.
                      </p>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPendingBulkDeleteMode(null)}
                          className="min-h-[34px] rounded-md border bg-white px-3 py-1.5 text-sm font-semibold hover:bg-stone-50"
                          style={{ borderColor: "#C4B8A8", color: C.body }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteManuscriptsByIds(bulkDeleteTargets.map((doc) => doc.id))}
                          className="min-h-[34px] rounded-md border border-red-700 px-3 py-1.5 text-sm font-bold hover:opacity-90"
                          style={{ backgroundColor: "#B91C1C", color: "#FFFFFF" }}
                        >
                          Confirm Delete {bulkDeleteTargets.length}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Document list */}
                  <div className="mb-2 max-h-[16rem] min-h-[6rem] space-y-1 overflow-y-auto pr-1">
                    {isLoadingDashboard ? (
                      <div className="text-base" style={{ color: C.body }}>
                        Loading saved manuscripts…
                      </div>
                    ) : visibleDashboardManuscripts.length === 0 ? (
                      <div
                        className="rounded-xl border bg-white p-5 text-base"
                        style={{ borderColor: "#D6D0C8", color: C.body }}
                      >
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
                            className="cursor-pointer rounded-lg border p-2.5 transition focus:outline-none"
                            style={
                              isSelected
                                ? { borderColor: C.gold, backgroundColor: C.cream }
                                : { borderColor: "#E2DDD5", backgroundColor: C.white }
                            }
                          >
                            <div className="flex items-center gap-2.5 py-0.5">
                              {/* No dot indicator — border highlight alone signals selection */}
                              <div className="min-w-0 flex-1">
                                <div
                                  className="truncate text-sm font-semibold leading-5"
                                  style={{ color: C.ink }}
                                >
                                  {getDisplayTitle(doc)}
                                </div>
                                <div
                                  className="text-xs leading-4"
                                  style={{ color: C.muted }}
                                >
                                  {formatWordCount(doc.word_count)} words · {doc.source ?? "saved"}
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  title="Hide from this list"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    hideManuscriptHere(doc.id);
                                  }}
                                  className="rounded border bg-white px-2 py-1 text-xs hover:bg-stone-50"
                                  style={{ borderColor: "#C4B8A8", color: C.body }}
                                >
                                  Hide
                                </button>
                                <button
                                  type="button"
                                  title="Delete from workspace"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setError(null);
                                    setDeleteNotice(null);
                                    setPendingBulkDeleteMode(null);
                                    setPendingDeleteManuscriptId(doc.id);
                                  }}
                                  className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                >
                                  ✕
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
                                    className="min-h-[34px] rounded-md border bg-white px-3 py-1.5 text-sm font-semibold hover:bg-stone-50"
                                    style={{ borderColor: "#C4B8A8", color: C.body }}
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
                                    className="min-h-[34px] rounded-md border border-red-700 px-3 py-1.5 text-sm font-bold hover:opacity-90"
                                    style={{ backgroundColor: "#B91C1C", color: "#FFFFFF" }}
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

                  {/* Bulk-action footer */}
                  <div className="flex flex-wrap gap-1.5">
                    {visibleDashboardManuscripts.length > 0 && (
                      <button
                        type="button"
                        onClick={clearThisWindow}
                        disabled={isUploading || isSubmitting}
                        className="rounded border bg-white px-2.5 py-1 text-xs font-semibold hover:bg-stone-50 disabled:opacity-60"
                        style={{ borderColor: "#C4B8A8", color: C.body }}
                      >
                        Hide all
                      </button>
                    )}
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
                        className="rounded border border-red-200 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Delete unnamed ({unnamedDashboardManuscripts.length})
                      </button>
                    )}
                    {visibleDashboardManuscripts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setDeleteNotice(null);
                          setPendingDeleteManuscriptId(null);
                          setPendingBulkDeleteMode("shown");
                        }}
                        disabled={isUploading || isSubmitting}
                        className="rounded border border-red-200 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Delete all shown
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Upload panel ─────────────────────────────────────── */}
              {activeInputMethod === "upload" && (
                <div
                  className="rounded-2xl border p-5 md:p-6"
                  style={{ borderColor: "#D6D0C8", backgroundColor: C.surface }}
                >
                  <p
                    className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.16em]"
                    style={{ color: C.gold }}
                  >
                    Upload file
                  </p>
                  <h3
                    className="mt-2 font-rg-serif text-3xl"
                    style={{ color: C.ink }}
                  >
                    Upload a manuscript file
                  </h3>
                  <p className="mt-2 max-w-2xl text-base leading-7" style={{ color: C.body }}>
                    Upload a DOCX or TXT file. RevisionGrade saves it to your workspace, selects it for this evaluation, and preserves the original file text as the evaluation source.
                  </p>

                  {uploadedManuscriptSelected ? (
                    <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-left shadow-sm">
                      <p className="font-rg-mono text-[0.76rem] font-bold uppercase tracking-[0.14em] text-emerald-800">
                        File uploaded and selected ✓
                      </p>
                      <h4 className="mt-2 font-rg-serif text-2xl leading-tight" style={{ color: C.ink }}>
                        {getDisplayTitle(selectedDashboardManuscript)}
                      </h4>
                      <p className="mt-2 text-base font-bold" style={{ color: C.ink }}>
                        {formatWordCount(selectedDashboardManuscript.word_count)} words · uploaded file
                      </p>
                      <p className="mt-2 text-base leading-6" style={{ color: C.body }}>
                        This file is loaded, selected, and ready for evaluation. Use Replace File only if you want to evaluate a different upload.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={triggerDashboardUpload}
                          disabled={isUploading || isSubmitting}
                          className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-60"
                          style={{ backgroundColor: C.oxblood, color: "#FFFFFF" }}
                        >
                          {isUploading ? "Uploading…" : "Replace File"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInputMethodChange("saved")}
                          className="min-h-[44px] rounded-lg border bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-50"
                          style={{ borderColor: "#C4B8A8", color: C.body }}
                        >
                          View in saved documents
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="mt-5 rounded-2xl border border-dashed p-8 text-center"
                      style={{ borderColor: "#C4B8A8", backgroundColor: C.white }}
                    >
                      <button
                        type="button"
                        onClick={triggerDashboardUpload}
                        disabled={isUploading || isSubmitting}
                        className="min-h-[50px] rounded-xl px-6 py-3 font-rg-mono text-sm font-bold uppercase tracking-[0.14em] shadow-sm disabled:opacity-60"
                        style={{ backgroundColor: C.oxblood, color: "#FFFFFF" }}
                      >
                        {isUploading ? "Uploading…" : "Choose File"}
                      </button>
                      <p className="mt-3 text-base" style={{ color: C.body }}>
                        Supported uploads: DOCX and TXT. Files may be up to 250k words.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Paste panel ──────────────────────────────────────── */}
              {activeInputMethod === "paste" && (
                <div
                  className="rounded-2xl border p-5"
                  style={{ borderColor: "#D6D0C8", backgroundColor: C.surface }}
                >
                  <label
                    htmlFor="manuscript-text"
                    className="font-rg-serif text-3xl"
                    style={{ color: C.ink }}
                  >
                    Paste text
                  </label>
                  <p className="mb-3 mt-2 text-base leading-7" style={{ color: C.body }}>
                    Paste a paragraph, scene, chapter, excerpt, or full manuscript. This path creates an evaluation from pasted text without changing saved dashboard manuscripts.
                  </p>
                  <FocusableTextarea
                    id="manuscript-text"
                    ref={manuscriptTextareaRef}
                    defaultValue={manuscriptTextRef.current}
                    onChange={handlePastedTextChange}
                    placeholder="Formatting is preserved where supported…"
                    rows={12}
                    className="w-full rounded-lg border bg-white px-4 py-3 text-base leading-7"
                    style={inputStyle({
                      color: C.ink,
                      borderColor: isOverPasteLimit ? "#DC2626" : C.inputBorder,
                    })}
                    disabled={isSubmitting}
                  />
                  <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                    <p
                      className="text-base font-semibold"
                      style={{ color: isOverPasteLimit ? "#B91C1C" : C.body }}
                    >
                      Current pasted word count: {formatWordCount(wordCount)}
                    </p>
                    <p className="text-base" style={{ color: C.muted }}>
                      Maximum: {formatWordCount(PASTE_WORD_LIMIT)} words
                    </p>
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
                        className="mt-3 inline-flex min-h-[42px] items-center rounded-lg px-5 py-2 text-sm font-bold shadow-sm"
                        style={{ backgroundColor: C.oxblood, color: "#FFFFFF" }}
                      >
                        Switch to Upload File
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden file input */}
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

              {/* ── English Variant + Manuscript Structure ─────────── */}
              <div className="grid gap-4 md:grid-cols-2">
                <div
                  className="rounded-xl border p-4 md:p-5"
                  style={{ borderColor: "#D6D0C8" }}
                >
                  <label
                    className="mb-2.5 block text-[0.98rem] font-semibold leading-6"
                    style={{ color: C.ink }}
                  >
                    English Variant
                  </label>
                  <FocusableSelect
                    value={englishVariant}
                    onChange={(e) => setEnglishVariant(e.target.value)}
                    className="min-h-[48px] w-full rounded-lg border bg-white px-4 py-3 text-base leading-6"
                    style={inputStyle({ color: C.ink })}
                  >
                    <option value="us">American English (Default)</option>
                    <option value="uk">British English</option>
                    <option value="ca">Canadian English</option>
                    <option value="au">Australian English</option>
                    <option value="za">South African English</option>
                    <option value="nz">New Zealand English</option>
                  </FocusableSelect>
                  <p className="mt-3 text-[0.95rem] leading-7" style={{ color: C.body }}>
                    Controls RevisionGrade-generated analysis, recommendations, revision guidance, and report text. Manuscript text, quotations, and evidence excerpts are preserved exactly as submitted.
                  </p>
                </div>

                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: "#D6D0C8" }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <label
                      className="block text-[0.95rem] font-semibold"
                      style={{ color: C.ink }}
                    >
                      Manuscript Structure
                    </label>
                    <span className="group relative cursor-help">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold"
                        style={{ borderColor: C.inputBorder, color: C.body }}
                      >
                        i
                      </span>
                      <span
                        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-80 -translate-x-1/2 rounded-lg border bg-white p-3 text-sm leading-relaxed opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                        style={{ borderColor: "#D6D0C8", color: C.body }}
                      >
                        <strong className="block" style={{ color: C.ink }}>
                          Standalone story
                        </strong>
                        A self-contained narrative with its own beginning, middle, and ending — such as a short story, novelette, novella, or complete novel.
                        <strong className="mt-2 block" style={{ color: C.ink }}>
                          Chapter(s) from a larger work
                        </strong>
                        An excerpt or section from a longer manuscript. The system won&apos;t penalize unresolved plot threads or open endings.
                      </span>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { value: "chapters", label: "Chapter(s) from a larger work" },
                      { value: "standalone", label: "Standalone story" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex min-h-[38px] cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-base hover:bg-stone-50"
                        style={{ color: C.ink }}
                      >
                        <input
                          type="radio"
                          name="manuscriptStructure"
                          value={opt.value}
                          checked={manuscriptStructure === opt.value}
                          onChange={() => setManuscriptStructure(opt.value)}
                          className="h-5 w-5"
                          style={{ accentColor: C.oxblood }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Evaluation Mode + Voice Preservation ─────────────── */}
              <div className="grid gap-5 lg:grid-cols-2">
                <div
                  className="rounded-xl border p-4 md:p-5"
                  style={{ borderColor: "#D6D0C8" }}
                >
                  <label
                    className="mb-2.5 block text-[0.98rem] font-semibold leading-6"
                    style={{ color: C.ink }}
                  >
                    Evaluation Mode
                  </label>
                  <FocusableSelect
                    value={sensitivityMode}
                    onChange={(e) => setSensitivityMode(e.target.value)}
                    disabled={isSubmitting || isUploading}
                    className="min-h-[48px] w-full rounded-lg border bg-white px-4 py-3 text-base leading-6"
                    style={inputStyle({ color: C.ink })}
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="TRANSGRESSIVE">Transgressive</option>
                    <option value="TESTIMONY">Testimony</option>
                  </FocusableSelect>
                  <p className="mt-3 text-[0.95rem] leading-7" style={{ color: C.body }}>
                    {sensitivityMode === "STANDARD" && "Default mode for most manuscripts."}
                    {sensitivityMode === "TRANSGRESSIVE" &&
                      "For work with intentional register breaks, non-standard structure, or boundary-pushing craft."}
                    {sensitivityMode === "TESTIMONY" &&
                      "For testimony-like, memoir, or sensitive lived-experience material."}
                  </p>
                </div>
                <div
                  className="rounded-xl border p-4 md:p-5"
                  style={{ borderColor: "#D6D0C8" }}
                >
                  <label
                    className="mb-2.5 block text-[0.98rem] font-semibold leading-6"
                    style={{ color: C.ink }}
                  >
                    Voice Preservation
                  </label>
                  <FocusableSelect
                    value={voicePreservation}
                    onChange={(e) => setVoicePreservation(e.target.value)}
                    disabled={isSubmitting || isUploading}
                    className="min-h-[48px] w-full rounded-lg border bg-white px-4 py-3 text-base leading-6"
                    style={inputStyle({ color: C.ink })}
                  >
                    <option value="MAXIMUM">Maximum — preserve my voice</option>
                    <option value="BALANCED">Balanced</option>
                    <option value="POLISHED">Polished — prioritize readability</option>
                  </FocusableSelect>
                  <p className="mt-3 text-[0.95rem] leading-7" style={{ color: C.body }}>
                    Controls how aggressively revision recommendations rewrite your prose.
                  </p>
                </div>
              </div>

              {/* ── Processing terms ─────────────────────────────────── */}
              <label
                className="flex gap-3 rounded-2xl border p-4 text-left cursor-pointer"
                style={{
                  borderColor: processingTermsAccepted ? C.gold : "#C4B8A8",
                  backgroundColor: processingTermsAccepted ? C.cream : C.white,
                }}
              >
                <input
                  type="checkbox"
                  checked={processingTermsAccepted}
                  onChange={(event) => {
                    setProcessingTermsAccepted(event.target.checked);
                    if (event.target.checked) setError(null);
                  }}
                  disabled={isSubmitting || isUploading}
                  className="mt-1 h-5 w-5 shrink-0"
                  style={{ accentColor: C.oxblood }}
                />
                <span className="text-base leading-7" style={{ color: C.body }}>
                  I understand that RevisionGrade evaluations are custom digital services, that processing starts after submission, and that I agree to the processing and refund terms.{" "}
                  <a
                    href="/terms"
                    className="ml-1 font-bold underline underline-offset-2"
                    style={{ color: C.oxblood }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read terms.
                  </a>
                </span>
              </label>

              {/* ── Error block ──────────────────────────────────────── */}
              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4">
                  <p className="text-base font-semibold text-red-900">{error}</p>
                </div>
              )}

              {/* ── CTA button ───────────────────────────────────────── */}
              <button
                type="submit"
                disabled={isSubmitting || isUploading || !processingTermsAccepted || isOverPasteLimit}
                className="min-h-[60px] w-full rounded-xl px-6 py-4 font-rg-mono text-base font-bold uppercase tracking-[0.18em] shadow-md transition disabled:cursor-not-allowed disabled:shadow-none"
                style={
                  isSubmitting || isUploading || !processingTermsAccepted || isOverPasteLimit
                    ? { backgroundColor: "#C4B8A8", color: "#7A6A52" }
                    : { backgroundColor: C.oxblood, color: "#FFFFFF" }
                }
              >
                {isSubmitting ? "Starting Evaluation…" : "Begin Editorial Evaluation"}
              </button>
            </section>

            {/* ── Right: sticky sidebar ──────────────────────────────── */}
            <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
              {/* Selected writing */}
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: C.goldBorder, backgroundColor: C.cream }}
              >
                <p
                  className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.14em]"
                  style={{ color: C.gold }}
                >
                  Selected writing
                </p>
                <h4
                  className="mt-1.5 font-rg-serif text-xl leading-tight"
                  style={{ color: C.ink }}
                >
                  {submissionSourceSummary.title}
                </h4>
                <p
                  className="mt-2 text-sm font-bold uppercase tracking-[0.08em]"
                  style={{ color: C.body }}
                >
                  {submissionSourceSummary.label}
                </p>
                <p className="mt-2 text-base font-bold" style={{ color: C.ink }}>
                  {submissionSourceSummary.meta}
                </p>
                <p className="mt-2 text-base leading-6" style={{ color: C.body }}>
                  {submissionSourceSummary.body}
                </p>
              </div>

              {/* Estimated mode */}
              <div
                className="rounded-2xl border p-4"
                style={
                  activeWordCount
                    ? { borderColor: C.goldBorder, backgroundColor: C.cream }
                    : { borderColor: "#D6D0C8", backgroundColor: C.surface }
                }
              >
                <p
                  className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.14em]"
                  style={{ color: activeWordCount ? C.gold : C.muted }}
                >
                  Estimated mode
                </p>
                <h4
                  className="mt-1.5 font-rg-serif text-xl leading-tight"
                  style={{ color: C.ink }}
                >
                  {evaluationMode.label}
                </h4>
                <p className="mt-2 text-base font-bold" style={{ color: C.ink }}>
                  {evaluationMode.summary}
                </p>
                <p className="mt-2 text-base leading-6" style={{ color: C.body }}>
                  {evaluationMode.detail}
                </p>
                <p className="mt-4 text-base font-bold" style={{ color: C.ink }}>
                  Detected/selected words: {formatWordCount(activeWordCount)}
                </p>
              </div>

              {/* Guidance */}
              <div
                className="rounded-2xl border bg-white p-4"
                style={{ borderColor: "#D6D0C8" }}
              >
                <h4 className="font-rg-serif text-xl" style={{ color: C.ink }}>
                  Guidance
                </h4>
                <p className="mt-2 text-base leading-7" style={{ color: C.body }}>
                  RevisionGrade diagnoses readiness before revision. It does not assume every submission needs the same depth of analysis.
                </p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-6" style={{ color: C.body }}>
                  <li>Use complete scenes or chapters when possible.</li>
                  <li>Full manuscripts enable long-form continuity analysis.</li>
                  <li>Short excerpts receive criteria-based story diagnosis only.</li>
                </ul>
              </div>

              {/* Document eligibility */}
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: C.goldBorder, backgroundColor: C.cream }}
              >
                <p
                  className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.14em]"
                  style={{ color: C.gold }}
                >
                  Document eligibility
                </p>
                <h4
                  className="mt-1.5 font-rg-serif text-xl leading-tight"
                  style={{ color: C.ink }}
                >
                  What can be evaluated
                </h4>
                <p className="mt-2 text-base leading-7" style={{ color: C.body }}>
                  RevisionGrade evaluates manuscripts and serious narrative excerpts: novels, novellas, book-length memoirs, narrative nonfiction manuscripts, and substantial fiction/nonfiction excerpts.
                </p>
                <p className="mt-3 text-base leading-7" style={{ color: C.body }}>
                  It does{" "}
                  <span className="font-semibold" style={{ color: C.ink }}>
                    not
                  </span>{" "}
                  evaluate general documents such as personal/business letters, professional correspondence, query letters, synopses, author bios, resumes/CVs, academic papers, research papers, legal documents, contracts, or marketing/sales copy.
                </p>
                <p className="mt-3 text-base leading-7" style={{ color: C.body }}>
                  If unsupported content is detected, evaluation will not proceed. You&apos;ll receive a clear explanation and can resubmit with an eligible manuscript.
                </p>
                <a
                  href="/faq"
                  className="mt-3 inline-flex text-sm font-bold underline underline-offset-2"
                  style={{ color: C.oxblood }}
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
