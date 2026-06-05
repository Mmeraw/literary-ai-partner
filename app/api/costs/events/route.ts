import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { recordLlmCostEvent } from "@/lib/cost/llmCostEvents";

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const source = body?.source as "agent_readiness" | "revise_queue" | "evaluation" | undefined;
    const activity = typeof body?.activity === "string" ? body.activity : "";
    const model = typeof body?.model === "string" ? body.model : "";

    if (!source || !activity || !model) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: source, activity, model" },
        { status: 400 },
      );
    }

    await recordLlmCostEvent({
      source,
      activity,
      model,
      inputTokens: Number(body?.inputTokens ?? 0),
      outputTokens: Number(body?.outputTokens ?? 0),
      costCents: typeof body?.costCents === "number" ? body.costCents : null,
      userId: user.id,
      evaluationJobId: typeof body?.evaluationJobId === "string" ? body.evaluationJobId : null,
      manuscriptId: typeof body?.manuscriptId === "number" ? body.manuscriptId : null,
      metadata: typeof body?.metadata === "object" && body.metadata !== null ? body.metadata : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to record cost event",
      },
      { status: 500 },
    );
  }
}
