'use client';

import { useEffect, useRef, useState } from 'react';

type Format = 'pdf' | 'docx' | 'txt';
type JobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'unknown';

type DownloadReportButtonProps = {
  jobId: string;
  disabled?: boolean;
  unavailableLabel?: string;
};

const OPTIONS: { label: string; format: Format }[] = [
  { label: 'PDF', format: 'pdf' },
  { label: 'Word (.docx)', format: 'docx' },
  { label: 'Plain Text (.txt)', format: 'txt' },
];

export default function DownloadReportButton({
  jobId,
  disabled,
  unavailableLabel = 'Available after evaluation completes',
}: DownloadReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<JobStatus>('unknown');
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

  function handleSelect(format: Format) {
    if (resolvedDisabled) return;
    setOpen(false);
    const url = `/api/reports/${jobId}/download?format=${format}`;
    if (format === 'pdf') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          if (!resolvedDisabled) setOpen((v) => !v);
        }}
        aria-haspopup={resolvedDisabled ? undefined : 'menu'}
        aria-expanded={resolvedDisabled ? undefined : open}
        aria-disabled={resolvedDisabled}
        title={resolvedDisabled ? unavailableLabel : 'Download report'}
        className={`border rounded-md px-4 py-2 text-sm font-medium shadow-sm flex items-center gap-2 ${
          resolvedDisabled
            ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span>Download Report</span>
        {resolvedDisabled ? (
          <span className="text-xs font-normal text-gray-500">{unavailableLabel}</span>
        ) : (
          <span aria-hidden="true">{'▾'}</span>
        )}
      </button>
      {!resolvedDisabled && open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-10"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.format}
              type="button"
              role="menuitem"
              onClick={() => handleSelect(opt.format)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
