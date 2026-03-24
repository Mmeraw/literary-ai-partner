/**
 * log-governance-event.ts
 * Persistence wrapper: writes governance decisions to Supabase governance_logs.
 * Every gate check (pass or fail) is recorded for audit trail.
 */

import { createClient } from '@supabase/supabase-js';
import { GovernanceResult } from '../governance/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface GovernanceLogEntry {
  run_id: string;
  gate_name: string;
  passed: boolean;
  reason: string | null;
  context: Record<string, unknown>;
  timestamp: string;
}

export async function logGovernanceEvent(
  runId: string,
  gateName: string,
  result: GovernanceResult,
  context: Record<string, unknown> = {}
): Promise<void> {
  const entry: GovernanceLogEntry = {
    run_id: runId,
    gate_name: gateName,
    passed: result.pass,
    reason: result.reason ?? null,
    context,
    timestamp: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('governance_logs')
    .insert(entry);

  if (error) {
    // Log but do not throw — governance logging failure
    // must not block the pipeline (fail-open for logging only)
    console.error(`[governance-log] Failed to persist ${gateName}:`, error.message);
  }
}

export async function logGovernanceBatch(
  runId: string,
  results: Array<{ gate: string; result: GovernanceResult; context?: Record<string, unknown> }>
): Promise<void> {
  const entries = results.map(({ gate, result, context }) => ({
    run_id: runId,
    gate_name: gate,
    passed: result.pass,
    reason: result.reason ?? null,
    context: context ?? {},
    timestamp: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('governance_logs')
    .insert(entries);

  if (error) {
    console.error(`[governance-log] Batch insert failed for run ${runId}:`, error.message);
  }
}
