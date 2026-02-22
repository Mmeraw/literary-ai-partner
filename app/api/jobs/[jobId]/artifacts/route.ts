// app/api/jobs/[jobId]/artifacts/route.ts
// User-facing artifact endpoint with authentication
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "Missing jobId" }, { status: 400 });
  }

  const cookieStore = await cookies();
  
  // Get session token from cookies
  const accessToken = cookieStore.get('sb-access-token')?.value || 
                      cookieStore.get('supabase-auth-token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  // Auth
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Ownership check
  const { data: job } = await supabase
    .from("evaluation_jobs")
    .select("id, created_by")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  if (job.created_by !== auth.user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Fetch latest artifact
  const { data: artifact, error } = await supabase
    .from("evaluation_artifacts")
    .select("id, job_id, artifact_type, content, created_at")
    .eq("job_id", jobId)
    // .eq("artifact_type", "evaluation_result_v1") // enable if needed
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    artifact: artifact ?? null,
  });
}
