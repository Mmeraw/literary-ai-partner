'use client';

import { useState } from 'react';

const CONFIRMATION = 'CANCEL ALL ACTIVE EVALUATIONS';

type Result = {
  ok: boolean;
  requested?: number;
  cancelled?: number;
  conflicts?: number;
  failed?: Array<{ jobId: string; message: string }>;
  snapshotLimitReached?: boolean;
  error?: string;
};

/** Owner-only server route enforces identity; this component never decides authority. */
export function OwnerEmergencyCancelAllJobs() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function execute() {
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/jobs/emergency-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      });
      const payload = await response.json().catch(() => ({}));
      setResult({ ok: response.ok && payload.ok === true, ...payload });
      if (response.ok && payload.ok === true) setConfirmation('');
    } catch {
      setResult({ ok: false, error: 'The emergency request could not reach the server.' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-red-500/50 bg-red-950/20 p-5">
      <p className="font-rg-mono text-[10px] uppercase tracking-[0.18em] text-red-300">Owner break-glass control</p>
      <h2 className="mt-2 font-rg-serif text-xl text-rg-cream">Emergency cancel all active evaluations</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-rg-cream2/75">
        Stops the current snapshot of queued and running evaluation jobs. Completed and already failed evaluations are preserved; no records are deleted.
      </p>
      <button
        type="button"
        onClick={() => { setOpen(true); setResult(null); }}
        className="mt-4 rounded border border-red-300/70 bg-red-700 px-4 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-white hover:bg-red-600"
      >
        Emergency cancel all jobs
      </button>

      {open && (
        <div className="mt-4 rounded border border-red-300/40 bg-rg-ink p-4">
          <label className="block text-sm font-semibold text-rg-cream" htmlFor="emergency-cancel-confirmation">
            Type <code className="rounded bg-black/30 px-1 text-red-200">{CONFIRMATION}</code> to authorize this one-time action.
          </label>
          <input
            id="emergency-cancel-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={running}
            className="mt-3 w-full rounded border border-rg-cream2/30 bg-rg-ink2 px-3 py-2 font-mono text-sm text-rg-cream"
            autoComplete="off"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" disabled={running} onClick={() => { setOpen(false); setConfirmation(''); }} className="rounded border border-rg-cream2/30 px-3 py-2 text-sm text-rg-cream2 hover:text-rg-cream">
              Keep jobs running
            </button>
            <button
              type="button"
              disabled={running || confirmation !== CONFIRMATION}
              onClick={execute}
              className="rounded bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? 'Cancelling…' : 'Confirm emergency cancellation'}
            </button>
          </div>
          {result && (
            <p className={`mt-4 rounded border p-3 text-sm ${result.ok ? 'border-green-400/40 bg-green-900/20 text-green-100' : 'border-red-400/40 bg-red-900/20 text-red-100'}`}>
              {result.ok
                ? `Snapshot: ${result.requested ?? 0}; cancelled: ${result.cancelled ?? 0}; state conflicts: ${result.conflicts ?? 0}.`
                : result.error ?? 'Some jobs could not be cancelled; inspect Admin Jobs before retrying.'}
              {result.snapshotLimitReached ? ' Snapshot safety limit reached; inspect remaining active jobs immediately.' : ''}
              {(result.failed?.length ?? 0) > 0 ? ` ${result.failed?.length} job cancellation(s) require follow-up.` : ''}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
