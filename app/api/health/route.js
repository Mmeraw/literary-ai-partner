// app/api/health/route.js

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createAuditEvent, emitAuditEvent } from "@/lib/audit";
import { FUNCTION_IDS } from "@/lib/governance";

export async function GET() {
  const supabase = getSupabaseClient();

  // Simple connectivity check – adjust table name later if needed.
  let dbStatus = "unknown";

  try {
    const { error } = await supabase.from("health_checks").select("id").limit(1);
    dbStatus = error ? "error" : "ok";
  } catch {
    dbStatus = "error";
  }

  const auditEvent = createAuditEvent({
    functionId: FUNCTION_IDS.UTILITIES_HELPERS,
    workType: "health_check",
    status: dbStatus === "ok" ? "success" : "error",
    message: "Health check ping",
    meta: { dbStatus },
  });

  await emitAuditEvent(auditEvent);

  return NextResponse.json(
    {
      ok: true,
      dbStatus,
      governanceVersion: auditEvent.governanceVersion,
      timestamp: auditEvent.timestamp,
    },
    { status: 200 }
  );
}

