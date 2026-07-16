'use client';

import { useEffect, useRef, useState } from 'react';

type Format = 'pdf' | 'txt' | 'docx';
type JobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'unknown';
type MenuPlacement = 'above' | 'below';

type DownloadReportButtonProps = {
  jobId: string;
  disabled?: boolean;
  unavailableLabel?: string;
};

const OPTIONS: { label: string; format: Format; description?: string }[] = [
  {
    label: 'PDF (.pdf)',
    format: 'pdf',
    description: 'Premium editorial PDF following the canonical evaluation template.',
  },
  {
    label: 'Word (.docx)',
    format: 'docx',
    description: 'Polished Word report with native headings, tables, and callouts.',
  },
  {
    label: 'Plain Text (.txt)',
    format: 'txt',
    description: 'Professional 78-column archival brief with the same report order.',
  },
];

const MIME_TYPES: Record<Format, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

const MENU_HEIGHT_ESTIMATE_PX = 340;
const VIEWPORT_MARGIN_PX = 16;

export default function DownloadReportButton({
  jobId,
  disabled,
  unavailableLabel = 'Available after evaluation completes',
}: DownloadReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement>('above');
  const [status, setStatus] = useState<JobStatus>('unknown');
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const nextStatus = data?.job?.status;
        if (
          nextStatus === 'queued' ||
          nextStatus === 'running' ||
          nextStatus === 'complete' ||
          nextStatus === 'failed'
        ) {
          if (!cancelled) setStatus(nextStatus);
        }
      } catch {
        // Keep unavailable until status can be confirmed.
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const resolvedDisabled = disabled ?? status !== 'complete';

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (resolvedDisabled) setOpen(false);
  }, [resolvedDisabled]);

  function resolveMenuPlacement(): MenuPlacement {
    const wrapper = wrapperRef.current;
    if (!wrapper) return 'above';

    const trigger = wrapper.querySelector<HTMLButtonElement>('button');
    if (!trigger) return 'above';

    const rect = trigger.getBoundingClientRect();
    const availableAbove = rect.top - VIEWPORT_MARGIN_PX;
    const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN_PX;

    // Prefer opening below for the report-header control when the menu fits.
    // Near the footer, retain the upward-opening menu so all formats remain visible.
    if (availableBelow >= MENU_HEIGHT_ESTIMATE_PX || availableBelow >= availableAbove) {
      return 'below';
    }

    return 'above';
  }

  async function handleSelect(format: Format) {
    if (resolvedDisabled || downloading) return;
    setOpen(false);
    setErrorMessage(null);
    setDownloading(true);

    try {
      const res = await fetch(`/api/reports/${jobId}/download?format=${format}`);

      if (!res.ok) {
        let userMessage = 'Download failed. Please try again.';
        try {
          const body = await res.json();
          if (body?.error && typeof body.error === 'string') {
            userMessage = body.error;
          }
        } catch {
          // Response was not JSON — use default message.
        }
        setErrorMessage(userMessage);
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `revision-grade-report.${format}`;

      const url = URL.createObjectURL(new Blob([blob], { type: MIME_TYPES[format] }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage('Download failed due to a network error. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          if (!resolvedDisabled && !downloading) {
            setErrorMessage(null);
            if (!open) setMenuPlacement(resolveMenuPlacement());
            setOpen((v) => !v);
          }
        }}
        aria-haspopup={resolvedDisabled ? undefined : 'menu'}
        aria-expanded={resolvedDisabled ? undefined : open}
        aria-disabled={resolvedDisabled || downloading}
        title={resolvedDisabled ? unavailableLabel : downloading ? 'Downloading…' : 'Download report'}
        className={`border rounded-md px-4 py-2 text-sm font-medium shadow-sm flex items-center gap-2 ${
          resolvedDisabled || downloading
            ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span>{downloading ? 'Downloading…' : 'Download Report'}</span>
        {resolvedDisabled ? (
          <span className="text-xs font-normal text-gray-500">{unavailableLabel}</span>
        ) : !downloading ? (
          <span aria-hidden="true">{open && menuPlacement === 'above' ? '▴' : '▾'}</span>
        ) : null}
      </button>
      {!resolvedDisabled && open && !downloading && (
        <div
          role="menu"
          data-testid="download-report-menu"
          data-placement={menuPlacement}
          className={`absolute right-0 w-64 max-h-[calc(100vh-2rem)] overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg z-[200] ${
            menuPlacement === 'below' ? 'top-full mt-1' : 'bottom-full mb-1'
          }`}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.format}
              type="button"
              role="menuitem"
              onClick={() => void handleSelect(opt.format)}
              className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
            >
              <span className="block font-medium">{opt.label}</span>
              {opt.description && (
                <span className="block text-xs text-gray-500 leading-snug mt-0.5">{opt.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {errorMessage && (
        <div className="mt-2 max-w-sm rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 shadow-sm">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="mt-1 text-xs text-amber-600 underline hover:text-amber-800"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
