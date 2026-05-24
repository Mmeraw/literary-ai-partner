import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTraceId, logger } from "@/lib/observability/logger";

/**
 * DELETE /api/jobs/purge
 *
 * Permanently deletes all terminal (failed + complete) jobs for the
 * authenticated user. Active jobs (queued / running) are never touched.
 * Append-only AccessLog entries are preserved — only evaluation_jobs rows
 * are removed.
 */
export async function DELETE() {
  const trace_id = generateTraceId();

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .delete()
    .eq("user_id", user.id)
    .in("status", ["failed", "complete"])
    .select("id");

  if (error) {
    logger.error("Purge terminal jobs failed", {
      trace_id,
      event: "api.jobs.purge.error",
      user_id: user.id,
      error: error.message,
    });
    return NextResponse.json(
      { ok: false, error: "Purge failed", detail: error.message, trace_id },
      { status: 500 }
    );
  }

  const purged = (data ?? []).length;

  logger.info("Terminal jobs purged", {
    trace_id,
    event: "api.jobs.purge.success",
    user_id: user.id,
    purged_count: purged,
  });

  return NextResponse.json({ ok: true, purged, trace_id }, { status: 200 });
}
