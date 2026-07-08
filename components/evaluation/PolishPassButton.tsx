'use client';

import React, { useState } from 'react';

interface PolishPassButtonProps {
  jobId: string;
}

type PolishState = 'idle' | 'running' | 'done' | 'error';

const productiveActionButtonClassName =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-[#7A2B1A] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function PolishPassButton({ jobId }: PolishPassButtonProps) {
  const [state, setState] = useState<PolishState>('idle');
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setState('running');
    setError(null);

    try {
      const res = await fetch(`/api/evaluations/${jobId}/polish`, {
        method: 'POST',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setCount(data.opportunities_count ?? 0);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run Polish Pass');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
        <span aria-hidden>✨</span>
        <span>
          Polish Pass complete — <strong>{count}</strong> surface {count === 1 ? 'opportunity' : 'opportunities'} found.
          {count && count > 0 ? ' Visit the Revise workbench to review them.' : ''}
        </span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleRun}
          className={productiveActionButtonClassName}
        >
          Retry Polish Pass
        </button>
        <span className="text-xs text-red-600">{error}</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleRun}
      disabled={state === 'running'}
      className={productiveActionButtonClassName}
    >
      {state === 'running' ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Running Polish Pass…
        </>
      ) : (
        <>
          <span aria-hidden>✨</span>
          Run Polish Pass
        </>
      )}
    </button>
  );
}

export default PolishPassButton;
