'use client';

import React, { useState } from 'react';

interface CancelEvaluationModalProps {
  jobId: string;
  label?: string;
  buttonClassName?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export function CancelEvaluationButton({
  jobId,
  label = 'Cancel Evaluation',
  buttonClassName,
  onSuccess,
  onError,
}: CancelEvaluationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/user-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'user_cancelled' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to cancel evaluation (${response.status})`);
      }

      setIsOpen(false);
      onSuccess?.();
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerClass = buttonClassName ?? 'inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={triggerClass}
        style={{
          background: 'transparent',
          border: '1px solid rgba(167,71,42,0.55)',
          color: '#C8A96E',
          fontFamily: "'Switzer', system-ui, sans-serif",
        }}
        disabled={isLoading}
      >
        {isLoading ? 'Cancelling…' : label}
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(13,10,5,0.82)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="max-w-md w-full mx-4 rounded-xl shadow-2xl"
            style={{
              background: '#1C160E',
              border: '1px solid rgba(216,209,192,0.18)',
              fontFamily: "'Switzer', system-ui, sans-serif",
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid rgba(216,209,192,0.12)' }}
            >
              <h2
                className="text-lg font-semibold"
                style={{
                  color: '#F5EFE0',
                  fontFamily: "'Instrument Serif', Georgia, serif",
                }}
              >
                Cancel Evaluation?
              </h2>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <p className="text-sm leading-relaxed" style={{ color: '#C8BEA8' }}>
                Cancel this evaluation? Work in progress will be discarded, and no final report will be generated unless the core evaluation has already completed.
              </p>
              {error && (
                <div
                  className="mt-4 rounded-lg p-3"
                  style={{
                    background: 'rgba(122,43,26,0.18)',
                    border: '1px solid rgba(167,71,42,0.45)',
                  }}
                >
                  <p className="text-sm" style={{ color: '#e07a5f' }}>{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex gap-3 justify-end"
              style={{ borderTop: '1px solid rgba(216,209,192,0.12)' }}
            >
              <button
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(216,209,192,0.22)',
                  color: '#C8BEA8',
                }}
              >
                Keep Evaluating
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                style={{
                  background: 'rgba(122,43,26,0.35)',
                  border: '1px solid rgba(167,71,42,0.6)',
                  color: '#F5EFE0',
                }}
              >
                {isLoading ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
