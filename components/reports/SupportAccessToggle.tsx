'use client';

import { useCallback, useEffect, useState } from 'react';

type Grant = {
  id: string;
  scope: string;
  expires_at: string;
  created_at: string;
};

type SupportAccessToggleProps = {
  jobId: string;
  scope?: 'evaluation_telemetry' | 'revision_data' | 'full';
};

const SCOPE_COPY = {
  evaluation_telemetry: {
    off: 'Allow the RevisionGrade support team to view evaluation diagnostics for troubleshooting. Your manuscript text is never shared.',
    on: 'Support team can view evaluation diagnostics for this submission. Your manuscript text is never shared.',
    label: 'Evaluation Support Access',
  },
  revision_data: {
    off: 'Allow the RevisionGrade support team to view your revision queue and diagnostic findings for this evaluation. Your manuscript text is never shared.',
    on: 'Support team can view your revision queue and diagnostic findings. Your manuscript text is never shared.',
    label: 'Revision Support Access',
  },
  full: {
    off: 'Allow the RevisionGrade support team to view evaluation diagnostics and revision data for troubleshooting. Your manuscript text is never shared.',
    on: 'Support team can view evaluation diagnostics and revision data for this submission. Your manuscript text is never shared.',
    label: 'Full Support Access',
  },
} as const;

export default function SupportAccessToggle({ jobId, scope = 'evaluation_telemetry' }: SupportAccessToggleProps) {
  const [granted, setGranted] = useState(false);
  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = SCOPE_COPY[scope];

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/support-access`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) {
        setGranted(data.granted);
        setGrant(data.grant ?? null);
      }
    } catch {
      // Silent fail on load
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  async function handleToggle() {
    setToggling(true);
    setError(null);

    try {
      if (granted) {
        const res = await fetch(`/api/jobs/${jobId}/support-access`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) {
          setGranted(false);
          setGrant(null);
        } else {
          setError('Failed to revoke access');
        }
      } else {
        const res = await fetch(`/api/jobs/${jobId}/support-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Author-initiated support access', scope }),
        });
        const data = await res.json();
        if (data.ok) {
          setGranted(true);
          setGrant(data.grant ?? null);
        } else {
          setError('Failed to grant access');
        }
      }
    } catch {
      setError('Network error');
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return null;
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{copy.label}</p>
          <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">
            {granted ? copy.on : copy.off}
          </p>
          {granted && grant?.expires_at && (
            <p className="mt-1 text-xs text-gray-500">
              Expires {new Date(grant.expires_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          aria-pressed={granted}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            granted
              ? 'bg-emerald-600 focus:ring-emerald-500'
              : 'bg-gray-200 focus:ring-gray-400'
          } ${toggling ? 'opacity-50 cursor-wait' : ''}`}
        >
          <span className="sr-only">
            {granted ? 'Revoke support access' : 'Grant support access'}
          </span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              granted ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
