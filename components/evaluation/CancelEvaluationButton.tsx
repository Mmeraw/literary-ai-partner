'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CancelEvaluationModalProps {
  jobId: string;
  label?: string;
  buttonClassName?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

type CancelState = 'idle' | 'cancelling' | 'cancelled' | 'error';

export function CancelEvaluationButton({
  jobId,
  label = 'Cancel Evaluation',
  buttonClassName = 'inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors',
  onSuccess,
  onError,
}: CancelEvaluationModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<CancelState>('idle');
  const [error, setError] = useState<string | null>(null);
  const displayLabel = label === 'STOP' ? 'Cancel Evaluation' : label;
  const isLoading = state === 'cancelling';
  const isCancelled = state === 'cancelled';

  const closeAndRefresh = () => {
    setIsOpen(false);
    setError(null);
    router.refresh();
  };

  const goToDashboard = () => {
    setIsOpen(false);
    router.push('/dashboard');
    router.refresh();
  };

  const handleCancel = async () => {
    setState('cancelling');
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/user-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'user_cancelled' }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || `Failed to cancel evaluation (${response.status})`);
      }

      setState('cancelled');
      setError(null);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancellation could not be saved. Please refresh and try again.';
      setState('error');
      setError(message);
      onError?.(message);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          if (state !== 'cancelled') {
            setState('idle');
            setError(null);
          }
        }}
        className={buttonClassName}
        disabled={isLoading || isCancelled}
      >
        {isCancelled ? 'Cancelled' : isLoading ? 'Cancelling…' : displayLabel}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => {
            if (!isLoading) closeAndRefresh();
          }}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-evaluation-title"
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 id="cancel-evaluation-title" className="text-lg font-semibold text-gray-900">
                {isCancelled ? 'Evaluation cancelled' : 'Cancel evaluation?'}
              </h2>
              <button
                type="button"
                onClick={closeAndRefresh}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {isCancelled ? (
                <div className="rounded-md bg-green-50 border border-green-200 p-4">
                  <p className="text-sm font-semibold text-green-900">Evaluation cancelled</p>
                  <p className="text-sm text-green-800 mt-2">
                    Your manuscript was not evaluated to completion. No score or report was generated.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-700">
                  This will stop the current evaluation. Completed analysis may be preserved, but no final report will be generated unless you start again.
                </p>
              )}

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-semibold text-red-900">Cancellation not confirmed.</p>
                  <p className="text-sm text-red-800 mt-1">{error}</p>
                  <p className="text-xs text-red-700 mt-2">
                    The job may still be active. Refresh the page before trying again.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              {isCancelled ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); router.push('/evaluate'); router.refresh(); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Return to job list
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); router.push('/evaluate'); router.refresh(); }}
                    className="px-4 py-2 text-sm font-medium text-white bg-stone-800 hover:bg-stone-900 rounded-md transition-colors"
                  >
                    Start new evaluation
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setError(null);
                      setState('idle');
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {error ? 'Close' : 'Keep Evaluation'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Cancelling…' : 'Cancel Evaluation'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
