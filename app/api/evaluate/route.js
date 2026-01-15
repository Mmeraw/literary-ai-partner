// app/api/evaluate/route.js

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import {
  createGovernedRequest,
  FUNCTION_IDS,
} from "@/lib/governance";
import { createAuditEvent, emitAuditEvent } from "@/lib/audit";

export async function POST(request) {
  const supabase = getSupabaseClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { manuscriptId, workType = "novel", inputs = {} } = body;

  // Wrap in governance envelope
  const governed = createGovernedRequest({
    functionId: FUNCTION_IDS.EVALUATE,
    workType,
    inputs: {
      manuscriptId,
      ...inputs,
    },
    routing: {
      pipeline: "quick", // or "full" later
    },
    validation: {
      minWords: 5000,
    },
    meta: {},
  });

  // TODO: replace with real Supabase write once schema is final
  let dbError = null;
  try {
    const { error } = await supabase
      .from("evaluations")
      .insert({
        manuscript_id: manuscriptId,
        payload: governed,
      });
    dbError = error ?? null;
  } catch (err) {
    dbError = err;
  }

  const success = !dbError;

  const auditEvent = createAuditEvent({
    functionId: FUNCTION_IDS.EVALUATE,
    workType,
    status: success ? "success" : "error",
    message: success
      ? "Evaluation request accepted"
      : "Failed to persist evaluation request",
    meta: {
      manuscriptId,
      dbError: dbError ? String(dbError.message ?? dbError) : null,
    },
  });

  await emitAuditEvent(auditEvent);

  if (!success) {
    return NextResponse.json(
      { ok: false, error: "Failed to create evaluation" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      governanceVersion: governed.governanceVersion,
      envelope: governed.envelope,
    },
    { status: 200 }
  );
}
