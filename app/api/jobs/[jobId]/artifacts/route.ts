import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Debug endpoint: Read Phase 2 artifacts
 * GET /api/jobs/:id/artifacts?type=one_page_summary
 * 
 * Returns 404 if missing, 200 with payload if present.
 * Service role protected.
 */

function checkServiceRole(req: Request): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  
  const authHeader = req.headers.get("authorization");
  const expectedKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  
  return authHeader === expectedKey;
}

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 }
    );
  }

  const jobId = params.jobId;
  const url = new URL(req.url);
  const artifactType = url.searchParams.get("type") || "one_page_summary";

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("evaluation_artifacts")
      .select("*")
      .eq("job_id", jobId)
      .eq("artifact_type", artifactType)
      .maybeSingle();

    if (error) {
      console.error("GET /api/jobs/[id]/artifacts error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Artifact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        artifact: {
          id: data.id,
          job_id: data.job_id,
          manuscript_id: data.manuscript_id,
          artifact_type: data.artifact_type,
          artifact_version: data.artifact_version,
          content: data.content,
          source_hash: data.source_hash,
          created_at: data.created_at
        }
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected error in GET /api/jobs/[id]/artifacts:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}
