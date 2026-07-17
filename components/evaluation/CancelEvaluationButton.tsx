'use client';

import React, { useState } from 'react';

interface CancelEvaluationModalProps {
  jobId: string;
  label?: string;
  buttonClassName?: string;
  returnHref?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

type CancelState = 'idle' | 'cancelling' | 'cancelled' | 'error';

export function CancelEvaluationButton({
  jobId,
  label = 'Cancel Evaluation',
  buttonClassName = 'inline-flex items-center rounded-md bg-red-700 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60',
  returnHref = '/evaluate',
  onSuccess,
  onError,
}: CancelEvaluationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<CancelState>('idle');
  const [error, setError] = useState<string | null>(null);
  const displayLabel = label === 'STOP' ? 'Cancel Evaluation' : label;
  const isLoading = state === 'cancelling';
  const isCancelled = state === 'cancelled';

  const close = () => {
    if (isLoading) return;
    setIsOpen(false);
    setError(null);
    if (!isCancelled) setState('idle');
  };

  const leaveModal = (href = returnHref) => {
    setIsOpen(false);
    window.location.assign(href);
  };

  const handleCancel = async () => {
    setState('cancelling');
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'user_cancelled' }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || `Failed to cancel evaluation (${response.status})`);
      }

      setState('cancelled');
      onSuccess?.();
      // A client router refresh can retain the old /api/jobs result. Force a fresh
      // document request so cancelled work immediately leaves the active state.
      window.setTimeout(() => window.location.assign(returnHref), 250);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Cancellation could not be saved. Please refresh and try again.';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
          <div
            className="mx-4 w-full max-w-md rounded-xl border border-stone-300 bg-white text-stone-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-evaluation-title"
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <h2 id="cancel-evaluation-title" className="text-lg font-bold text-stone-950">
                {isCancelled ? 'Evaluation cancelled' : 'Cancel evaluation?'}
              </h2>
              <button type="button" onClick={close} disabled={isLoading} className="text-stone-600 hover:text-stone-950" aria-label="Close">
                ×
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {isCancelled ? (
                <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-950">
                  <p className="font-bold">Evaluation cancelled.</p>
                  <p className="mt-2 text-sm">The job has been stopped and will no longer appear as active.</p>
                </div>
              ) : (
                <p className="text-sm leading-6 text-stone-800">
                  This stops the current evaluation. Completed analysis may be preserved, but no final report will be generated unless you restart it.
                </p>
              )}

              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-950">
                  <p className="font-bold">Cancellation not confirmed.</p>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-stone-200 px-6 py-4">
              {isCancelled ? (
                <>
                  <button type="button" onClick={() => leaveModal(returnHref)} className="rounded-lg border border-stone-400 bg-white px-4 py-2 text-sm font-bold text-stone-950 hover:bg-stone-100">
                    Return to Evaluations
                  </button>
                  <button type="button" onClick={() => leaveModal('/evaluate')} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-bold text-white hover:bg-stone-800">
                    Start new evaluation
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={error ? () => leaveModal(returnHref) : close} disabled={isLoading} className="rounded-lg border border-stone-400 bg-white px-4 py-2 text-sm font-bold text-stone-950 hover:bg-stone-100 disabled:opacity-60">
                    {error ? 'Return to Evaluations' : 'Keep Evaluation'}
                  </button>
                  <button type="button" onClick={handleCancel} disabled={isLoading} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
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
