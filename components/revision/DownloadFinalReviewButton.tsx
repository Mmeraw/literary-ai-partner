"use client";

import { useEffect, useRef, useState } from "react";

type View = "clean" | "marked" | "changelog";
type Format = "pdf" | "txt";

type Option = {
  label: string;
  view: View;
  format: Format;
  description: string;
  requiresSource?: boolean;
};

type DownloadFinalReviewButtonProps = {
  manuscriptId: string | null;
  evaluationJobId: string | null;
  disabled?: boolean;
  sourceAvailable?: boolean;
  unavailableLabel?: string;
};

const OPTIONS: Option[] = [
  {
    label: "Clean Draft — PDF",
    view: "clean",
    format: "pdf",
    description: "Opens a clean print view. Use Save as PDF.",
    requiresSource: true,
  },
  {
    label: "Clean Draft — TXT",
    view: "clean",
    format: "txt",
    description: "Plain text clean revised draft.",
    requiresSource: true,
  },
  {
    label: "Marked Copy — PDF",
    view: "marked",
    format: "pdf",
    description: "Opens a marked review print view. Use Save as PDF.",
    requiresSource: true,
  },
  {
    label: "Marked Copy — TXT",
    view: "marked",
    format: "txt",
    description: "Plain text marked review copy with changelog.",
    requiresSource: true,
  },
  {
    label: "Changelog — PDF",
    view: "changelog",
    format: "pdf",
    description: "Opens a changelog print view. Use Save as PDF.",
  },
  {
    label: "Changelog — TXT",
    view: "changelog",
    format: "txt",
    description: "Plain text revision changelog.",
  },
];

function buildQuery(manuscriptId: string, evaluationJobId: string, view: View) {
  return new URLSearchParams({ manuscriptId, evaluationJobId, view }).toString();
}

export default function DownloadFinalReviewButton({
  manuscriptId,
  evaluationJobId,
  disabled,
  sourceAvailable = true,
  unavailableLabel = "Available after Final Review has decisions",
}: DownloadFinalReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const resolvedDisabled = disabled || !manuscriptId || !evaluationJobId;

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (resolvedDisabled) setOpen(false);
  }, [resolvedDisabled]);

  function handleSelect(option: Option) {
    if (resolvedDisabled || !manuscriptId || !evaluationJobId || (option.requiresSource && !sourceAvailable)) return;
    setOpen(false);
    const query = buildQuery(manuscriptId, evaluationJobId, option.view);

    if (option.format === "pdf") {
      window.open(`/workbench/final-review?${query}&print=1`, "_blank", "noopener,noreferrer");
      return;
    }

    window.open(`/api/final-review/export?${query}&format=${option.view}`, "_self");
  }

  return (
    <div ref={wrapperRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => {
          if (!resolvedDisabled) setOpen((value) => !value);
        }}
        aria-haspopup={resolvedDisabled ? undefined : "menu"}
        aria-expanded={resolvedDisabled ? undefined : open}
        aria-disabled={resolvedDisabled}
        title={resolvedDisabled ? unavailableLabel : "Download Final Review"}
        className={`rounded border px-3 py-2 text-xs font-semibold shadow-sm ${
          resolvedDisabled
            ? "cursor-not-allowed border-[#3A3022] bg-[#120E08] text-[#7F735F]"
            : "border-[#C8A96E] bg-[#C8A96E] text-[#1A140C] hover:bg-[#D8BB7B]"
        }`}
      >
        Download Final Review {resolvedDisabled ? <span className="font-normal">· {unavailableLabel}</span> : <span aria-hidden="true">▾</span>}
      </button>

      {!resolvedDisabled && open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-[#3A3022] bg-[#120E08] shadow-2xl">
          {OPTIONS.map((option) => {
            const optionDisabled = Boolean(option.requiresSource && !sourceAvailable);
            return (
              <button
                key={`${option.view}-${option.format}`}
                type="button"
                role="menuitem"
                disabled={optionDisabled}
                onClick={() => handleSelect(option)}
                className={`block w-full px-4 py-3 text-left text-sm ${
                  optionDisabled
                    ? "cursor-not-allowed bg-[#0E0A05] text-[#6F6250]"
                    : "text-[#F2E7D4] hover:bg-[#21180F]"
                }`}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-[#A9987D]">
                  {optionDisabled ? "Unavailable until the full manuscript source text is connected." : option.description}
                </span>
              </button>
            );
          })}
          {!sourceAvailable && (
            <div className="border-t border-[#2E261A] px-4 py-3 text-xs leading-snug text-amber-100">
              Clean Draft, Marked Copy, and Apply are locked because this evaluation does not currently expose full manuscript source text. Changelog exports remain available.
            </div>
          )}
          <div className="border-t border-[#2E261A] px-4 py-3 text-xs leading-snug text-[#A9987D]">
            Word export is temporarily hidden until it uses the same canonical Final Review projection as the webpage.
          </div>
        </div>
      )}
    </div>
  );
}
