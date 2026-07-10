'use client';

import React, { useState } from 'react';

interface SynthesisControlsProps {
  jobId: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export function SynthesisArtifactControls({
  jobId,
  onSuccess,
  onError,
}: SynthesisControlsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);

  const handleRetry = async () => {
    setIsLoading(true);
    setError(null);
    setQueuedMessage(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/synthesis/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Failed to retry synthesis (${response.status})`);
      }

      setQueuedMessage(
        data.message ||
          'Narrative Synthesis recovery queued from the completed Evidence Review anchor.',
      );
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {queuedMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3" role="status">
          <p className="text-sm text-green-800">{queuedMessage}</p>
        </div>
      )}
      <button
        onClick={handleRetry}
        disabled={isLoading || queuedMessage !== null}
        className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
        style={{ backgroundColor: '#7A2B1A', color: '#FFFFFF' }}
        title="Resume Narrative Synthesis from the completed Evidence Review anchor"
      >
        {isLoading ? 'Queuing recovery…' : queuedMessage ? 'Recovery queued' : 'Retry Narrative Synthesis'}
      </button>
      <p className="text-xs text-gray-600">
        Recovery resumes from the completed Evidence Review and preserved evaluation artifacts; it does not restart the evaluation.
      </p>
    </div>
  );
}
