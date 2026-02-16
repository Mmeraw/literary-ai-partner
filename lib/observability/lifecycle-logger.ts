// lib/observability/lifecycle-logger.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type LifecycleEvent = {
  job_id: string;
  event_type: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Inserts exactly one row into worker_lifecycle_events.
 *
 * Rules:
 * - Must never throw
 * - If insert fails: console.error only
 * - No retries, no extra dependencies
 * - Must use passed-in Supabase client (do not create a client)
 */
export async function logLifecycleEvent(
  supabase: SupabaseClient,
  event: LifecycleEvent
): Promise<void> {
  try {
    const { error } = await supabase.from("worker_lifecycle_events").insert({
      job_id: event.job_id,
      event_type: event.event_type,
      message: event.message ?? null,
      metadata: event.metadata ?? null,
    });

    if (error) {
      console.error("logLifecycleEvent: insert failed", {
        message: error.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        code: (error as any)?.code,
      });
    }
  } catch (err) {
    console.error("logLifecycleEvent: unexpected failure", err);
  }
}
