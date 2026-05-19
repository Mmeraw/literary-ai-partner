'use client';

import { useEffect, useRef, useState } from 'react';

type Format = 'pdf' | 'docx' | 'txt';

const OPTIONS: { label: string; format: Format }[] = [
  { label: 'PDF', format: 'pdf' },
  { label: 'Word (.docx)', format: 'docx' },
  { label: 'Plain Text (.txt)', format: 'txt' },
];

export default function DownloadReportButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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

  function handleSelect(format: Format) {
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
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm flex items-center gap-2"
      >
        <span>Download Report</span>
        <span aria-hidden="true">{'▾'}</span>
      </button>
      {open && (
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
