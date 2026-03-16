import { getSupabaseAdminClient } from "@/lib/supabase";
import type { LogRevisionEventInput } from "./telemetry";

let _supabase: ReturnType<typeof getSupabaseAdminClient> | undefined;

function getSupabase() {
  if (_supabase === undefined) {
    _supabase = getSupabaseAdminClient();
  }
  return _supabase;
}

const supabase = new Proxy({} as NonNullable<ReturnType<typeof getSupabaseAdminClient>>, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error(
        `[REVISION-TELEMETRY] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof typeof client];
  },
});

export async function logRevisionEvent(input: LogRevisionEventInput): Promise<void> {
  try {
    const { error } = await supabase.from("revision_events").insert({
      revision_session_id: input.revision_session_id ?? null,
      proposal_id: input.proposal_id ?? null,
      manuscript_id: input.manuscript_id ?? null,
      manuscript_version_id: input.manuscript_version_id ?? null,
      evaluation_run_id: input.evaluation_run_id ?? null,
      event_type: input.event_type,
      severity: input.severity ?? "info",
      event_code: input.event_code,
      message: input.message ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.error("Failed to log revision event", {
        event_code: input.event_code,
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Failed to log revision event", {
      event_code: input.event_code,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
