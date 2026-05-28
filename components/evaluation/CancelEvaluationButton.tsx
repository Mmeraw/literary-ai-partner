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
  buttonClassName = 'inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors',
  onSuccess,
  onError,
}: CancelEvaluationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayLabel = label === 'STOP' ? 'Cancel Evaluation' : label;

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
      // Optionally reload page to reflect cancellation
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={buttonClassName}
        disabled={isLoading}
      >
        {isLoading ? 'Cancelling...' : displayLabel}
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => { if (!isLoading) setIsOpen(false); }}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Cancel this evaluation?</h2>
              <button
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700">
                This will stop the job and no final report will be generated unless the core evaluation has already completed. You will not be charged if analysis has not begun.
              </p>
              {error && (
                <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => { setIsOpen(false); setError(null); }}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {error ? 'Close' : 'Keep Running'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Cancelling...' : 'Cancel Evaluation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
