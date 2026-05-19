/**
 * Fire-and-forget pipeline logger — writes structured log entries to the
 * pipeline_logs Supabase table. Never throws, never blocks the pipeline.
 * On insert failure, falls back to console.warn only.
 *
 * Callers should fire-and-forget with `void pipelineLog({ ... })` — awaiting
 * is permitted (returns Promise<void>) but is discouraged on the hot path.
 *
 * Schema: see supabase/migrations/20260519000000_pipeline_logs.sql
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type PipelineLogLevel = "info" | "warn" | "error";

export interface PipelineLogArgs {
  jobId: string;
  level: PipelineLogLevel;
  stage: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function pipelineLog(args: PipelineLogArgs): Promise<void> {
  try {
    const supabase = createAdminClient({ nullable: true });
    if (!supabase) {
      console.warn("[pipelineLogger] supabase admin client unavailable — skipping log insert", {
        stage: args.stage,
        message: args.message,
      });
      return;
    }

    const { error } = await supabase.from("pipeline_logs").insert({
      job_id: args.jobId,
      level: args.level,
      stage: args.stage,
      message: args.message,
      metadata: args.metadata ?? null,
    });

    if (error) {
      console.warn("[pipelineLogger] insert failed", {
        stage: args.stage,
        message: args.message,
        error: error.message,
      });
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[pipelineLogger] threw unexpectedly — swallowing", {
      stage: args.stage,
      message: args.message,
      reason,
    });
  }
}
