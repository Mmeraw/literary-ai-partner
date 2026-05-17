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

  const handleRetry = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/synthesis/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to retry synthesis (${response.status})`);
      }

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

  const handleSkip = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/synthesis/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to skip synthesis (${response.status})`);
      }

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

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleRetry}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
          title="Re-run the Narrative Synthesis worker"
        >
          {isLoading ? 'Processing...' : 'Retry Synthesis'}
        </button>
        <button
          onClick={handleSkip}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
          title="Skip Narrative Synthesis and complete evaluation"
        >
          {isLoading ? 'Processing...' : 'Skip Synthesis'}
        </button>
      </div>
    </div>
  );
}
