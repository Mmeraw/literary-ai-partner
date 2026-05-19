/**
 * Admin Pipeline Logs API
 *
 * GET /api/admin/pipeline-logs?jobId=<uuid>
 *
 * Returns audit-log entries for a given evaluation job, ordered by
 * created_at ASC. Logs are written from the pipeline via
 * lib/evaluation/pipeline/pipelineLogger.ts.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export interface PipelineLog {
  id: string;
  job_id: string | null;
  level: "info" | "warn" | "error";
  stage: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const bearer = extractBearer(req.headers.get("authorization"));
  return !!bearer && bearer === expected;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId query parameter is required" }, { status: 400 });
  }

  const supabase = createAdminClient({ nullable: true });
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client unavailable" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("pipeline_logs")
    .select("id, job_id, level, stage, message, metadata, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch logs: ${error.message}` },
      { status: 500 },
    );
  }

  const logs: PipelineLog[] = (data ?? []) as PipelineLog[];
  return NextResponse.json({ logs }, { status: 200 });
}
