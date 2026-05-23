'use client';

import React from 'react';
import {
  useEvaluationSubscription,
  type EvaluationSubscriptionClient,
  type SynchronizedJobState,
} from '@/hooks/useEvaluationSubscription';

interface WorkspaceSyncProviderProps {
  jobId: string;
  initialState: SynchronizedJobState;
  children: React.ReactNode;
  client?: EvaluationSubscriptionClient;
}

export function WorkspaceSyncProvider({
  jobId,
  initialState,
  children,
  client,
}: WorkspaceSyncProviderProps) {
  const { state, isSyncing } = useEvaluationSubscription(jobId, initialState, client);

  if (isSyncing) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">
        Synchronizing live project states...
      </div>
    );
  }

  if (state.phaseStatus === 'running') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/50 border border-zinc-800 rounded-lg max-w-xl mx-auto my-12 text-center">
        <div className="h-5 w-5 border-2 border-t-transparent border-emerald-500 rounded-full animate-spin mb-4" />
        <h3 className="text-sm font-semibold tracking-tight text-zinc-200">Analysis Engine Processing</h3>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm">
          RevisionGrade is evaluating phase <span className="font-mono text-emerald-400">{state.phase}</span> of this manuscript.
          Workspace interactions are locked while background caches refresh.
        </p>
      </div>
    );
  }

  if (state.cancellationRequested) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-lg text-center max-w-md mx-auto my-12">
        <h3 className="text-sm font-semibold text-red-400">Abort Execution Triggered</h3>
        <p className="text-xs text-zinc-400 mt-1">This job is winding down safely. Structural writes are locked.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {state.phaseStatus === 'degraded' && (
        <div className="bg-amber-950/30 border-b border-amber-900/50 px-4 py-2 text-xs text-amber-300 flex items-center justify-between">
          <span>⚠️ Some structural values are loading from a degraded processing pass.</span>
          <span className="font-mono text-[10px] uppercase bg-amber-900/40 px-1.5 py-0.5 rounded">Degraded Mode</span>
        </div>
      )}
      {children}
    </div>
  );
}
