import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getJob } from "@/lib/jobs/store";
import { classifySmokeDiagnostic } from "@/lib/jobs/smokeDiagnostic";

type Params = Promise<{ jobId: string }>;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function constantTimeTokenEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return timingSafeEqual(bufA, bufB);
}

function getSmokeConfig(): { token: string; userId: string } | null {
  const token = process.env.SMOKE_DIAGNOSTICS_TOKEN?.trim();
  const userId = process.env.SMOKE_USER_ID?.trim();
  if (!token || !userId) return null;
  return { token, userId };
}

function isAuthenticatedSmokeDiagnostic(req: NextRequest, expectedToken: string): boolean {
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;
  return constantTimeTokenEqual(token, expectedToken);
}

/**
 * GET /api/internal/smoke/jobs/[jobId]/diagnostic
 *
 * Narrow, fail-closed diagnostic endpoint for the canonical real-manuscript
 * smoke. Requires both SMOKE_DIAGNOSTICS_TOKEN (constant-time compared) and
 * SMOKE_USER_ID to be configured. The x-user-id header and job ownership must
 * match the configured smoke identity.
 *
 * Returns only the explicitly allowlisted safe, redacted diagnostic fields;
 * raw last_error and arbitrary job metadata (including progress) are never
 * exposed. The response includes Cache-Control: no-store to prevent caching of
 * operational state.
 */
export async function GET(req: NextRequest, ctx: { params: Params }) {
  try {
    const { jobId } = await ctx.params;
    const config = getSmokeConfig();

    if (!config) {
      console.error("[smoke-diagnostic] configuration incomplete");
      return jsonNoStore(
        { ok: false, error: "Smoke diagnostic configuration incomplete" },
        503,
      );
    }

    if (!isAuthenticatedSmokeDiagnostic(req, config.token)) {
      console.warn("[smoke-diagnostic] rejected unauthenticated request", { jobId });
      return jsonNoStore({ ok: false, error: "Unauthorized" }, 401);
    }

    const requestUserId = req.headers.get("x-user-id")?.trim();
    if (requestUserId !== config.userId) {
      console.warn("[smoke-diagnostic] rejected request with mismatched x-user-id", { jobId });
      return jsonNoStore({ ok: false, error: "Forbidden" }, 403);
    }

    const job = await getJob(jobId);
    if (!job) {
      return jsonNoStore({ ok: false, error: "Job not found" }, 404);
    }

    if (job.user_id !== config.userId) {
      console.warn("[smoke-diagnostic] rejected access to non-smoke job", { jobId });
      return jsonNoStore({ ok: false, error: "Forbidden" }, 403);
    }

    const phase =
      typeof job.progress === "object" && job.progress !== null && "phase" in job.progress
        ? String((job.progress as Record<string, unknown>).phase)
        : null;

    const phaseStatus =
      typeof job.progress === "object" && job.progress !== null && "phase_status" in job.progress
        ? (job.progress as Record<string, unknown>).phase_status
        : null;

    const failureCode = job.failure_code ?? null;
    const diagnostic = classifySmokeDiagnostic(failureCode, phase);

    console.info("[smoke-diagnostic] served redacted diagnostic", {
      jobId,
      phase,
      failure_code: failureCode,
      category: diagnostic.category,
      retryable: diagnostic.retryable,
    });

    return jsonNoStore({
      ok: true,
      job_id: job.id,
      status: job.status,
      phase,
      phase_status: phaseStatus,
      failure_code: failureCode,
      category: diagnostic.category,
      retryable: diagnostic.retryable,
      diagnostic_summary: diagnostic.summary,
    });
  } catch (error) {
    console.error("[smoke-diagnostic] unexpected error", { error });
    return jsonNoStore({ ok: false, error: "Internal server error" }, 500);
  }
}
