'use client';

export default function LedgerDownloadButton({ jobId }: { jobId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = `/api/reports/${jobId}/download?format=txt`;
      }}
      style={{
        fontFamily: 'monospace',
        fontSize: '0.6875rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#7B7B7B',
        background: 'transparent',
        border: '1px solid #7B7B7B',
        padding: '0.375rem 0.875rem',
        cursor: 'pointer',
      }}
    >
      Save / Download
    </button>
  );
}
