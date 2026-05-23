'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SynchronizedPhaseStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'complete'
  | 'completed'
  | 'failed'
  | 'degraded'
  | 'cancelled'
  | string;

export interface SynchronizedJobState {
  jobId: string;
  phase: string;
  phaseStatus: SynchronizedPhaseStatus;
  cancellationRequested: boolean;
  leaseUntil: string | null;
}

type EvaluationJobRealtimeRow = {
  id?: unknown;
  phase?: unknown;
  phase_status?: unknown;
  cancellation_requested?: unknown;
  lease_until?: unknown;
};

type RealtimePayload = {
  new: EvaluationJobRealtimeRow;
};

type MinimalRealtimeChannel = {
  on: (
    event: 'postgres_changes',
    filter: Record<string, unknown>,
    callback: (payload: RealtimePayload) => void,
  ) => MinimalRealtimeChannel;
  subscribe: (callback?: (status: string) => void) => MinimalRealtimeChannel;
};

export type EvaluationSubscriptionClient = Pick<SupabaseClient, 'channel' | 'removeChannel'> & {
  channel: (topic: string) => MinimalRealtimeChannel;
  removeChannel: (channel: MinimalRealtimeChannel) => void | Promise<'ok' | 'timed out' | 'error'>;
};

function createBrowserSupabaseClient(): EvaluationSubscriptionClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase browser env is required for evaluation realtime subscription.');
  }

  return createClient(url, anonKey) as unknown as EvaluationSubscriptionClient;
}

function toStringOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function mapEvaluationRealtimeRow(
  row: EvaluationJobRealtimeRow,
  fallback: SynchronizedJobState,
): SynchronizedJobState {
  return {
    jobId: toStringOrFallback(row.id, fallback.jobId),
    phase: toStringOrFallback(row.phase, fallback.phase),
    phaseStatus: toStringOrFallback(row.phase_status, fallback.phaseStatus),
    cancellationRequested: row.cancellation_requested === true,
    leaseUntil: toNullableString(row.lease_until),
  };
}

export function useEvaluationSubscription(
  jobId: string,
  initialState: SynchronizedJobState,
  client?: EvaluationSubscriptionClient,
) {
  const supabase = useMemo(() => client ?? createBrowserSupabaseClient(), [client]);
  const [state, setState] = useState<SynchronizedJobState>(initialState);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);

  useEffect(() => {
    setIsSyncing(true);
    setState(initialState);

    const channel = supabase
      .channel(`live_job_sync:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'evaluation_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setState((current) => mapEvaluationRealtimeRow(payload.new, current));
          setIsSyncing(false);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsSyncing(false);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [jobId, initialState, supabase]);

  return { state, isSyncing };
}
