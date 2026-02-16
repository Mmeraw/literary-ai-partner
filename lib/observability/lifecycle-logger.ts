/**
 * A4.1 — Lifecycle Logger Module
 *
 * Inserts exactly one row into worker_lifecycle_events.
 *
 * Behavior rules:
 * - Must never throw
 * - If insert fails: console.error only
 * - No retries, no extra deps
 * - Must use passed-in Supabase client (do not create a client)
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type LifecycleEvent = {
  jobId: string;
  phase?: string;
  event: string;
  status?: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
};

/**
 * Insert one structured lifecycle event row.
 * Never throws. On failure: console.error only.
 */
export async function logLifecycleEvent(
  supabase: SupabaseClient,
  evt: LifecycleEvent
): Promise<void> {
  try {
    const { error } = await supabase.from("worker_lifecycle_events").insert({
      job_id: evt.jobId,
      phase: evt.phase ?? null,
      event: evt.event,
      status: evt.status ?? null,
      worker_id: evt.workerId ?? null,
      metadata: evt.metadata ?? null,
      error: evt.error ?? null,
    });

    if (error) {
      console.error("logLifecycleEvent: insert failed", {
        message: error.message,
        code: (error as Record<string, unknown>).code,
      });
    }
  } catch (err) {
    console.error("logLifecycleEvent: unexpected failure", err);
  }
}
