import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";
import { getCanonicalLongContextLedgerModel } from "@/lib/evaluation/policy";

export const dynamic = "force-dynamic";

function envOrNull(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function phaseModelRows() {
  const config = getEvaluationRuntimeConfig();
  const routing = config.routing;
  const pass1aModel = envOrNull("EVAL_PASS1A_MODEL") ?? routing.pass1Model;

  return [
    {
      phase: "Phase 0",
      purpose: "Seed / intake warmup",
      model: routing.seedModel,
      source: envOrNull("EVAL_SEED_MODEL") ? "EVAL_SEED_MODEL" : envOrNull("EVAL_CHEAP_MODEL") ? "EVAL_CHEAP_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Phase 0.5a",
      purpose: "Story ledger / grounding",
      model: routing.ledgerModel,
      source: envOrNull("EVAL_LEDGER_MODEL") ? "EVAL_LEDGER_MODEL" : envOrNull("EVAL_CHEAP_MODEL") ? "EVAL_CHEAP_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Phase 0.5a long context",
      purpose: "Ledger overflow above long-context threshold",
      model: getCanonicalLongContextLedgerModel(),
      source: envOrNull("EVAL_LONG_CONTEXT_MODEL") ? "EVAL_LONG_CONTEXT_MODEL" : "built-in gpt-4.1-mini fallback",
    },
    {
      phase: "Phase 0.5b",
      purpose: "Revise opportunity seed / polish prep",
      model: routing.polishModel,
      source: envOrNull("EVAL_POLISH_MODEL") ? "EVAL_POLISH_MODEL" : envOrNull("EVAL_CHEAP_MODEL") ? "EVAL_CHEAP_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Phase 1a",
      purpose: "Character / continuity chunk sweep",
      model: pass1aModel,
      source: envOrNull("EVAL_PASS1A_MODEL") ? "EVAL_PASS1A_MODEL" : envOrNull("EVAL_PASS1_MODEL") ? "EVAL_PASS1_MODEL" : envOrNull("EVAL_CHUNK_MODEL") ? "EVAL_CHUNK_MODEL" : envOrNull("EVAL_CHEAP_MODEL") ? "EVAL_CHEAP_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Pass 1",
      purpose: "Craft chunk evaluation",
      model: routing.pass1Model,
      source: envOrNull("EVAL_PASS1_MODEL") ? "EVAL_PASS1_MODEL" : envOrNull("EVAL_CHUNK_MODEL") ? "EVAL_CHUNK_MODEL" : envOrNull("EVAL_CHEAP_MODEL") ? "EVAL_CHEAP_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Phase 2 / Pass 2",
      purpose: "Editorial chunk evaluation",
      model: routing.pass2Model,
      source: envOrNull("EVAL_PASS2_MODEL") ? "EVAL_PASS2_MODEL" : envOrNull("EVAL_CHUNK_MODEL") ? "EVAL_CHUNK_MODEL" : envOrNull("EVAL_CHEAP_MODEL") ? "EVAL_CHEAP_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Phase 3a",
      purpose: "Preflight reader / reducer",
      model: routing.pass3Model,
      source: envOrNull("EVAL_PASS3_MODEL") ? "EVAL_PASS3_MODEL" : envOrNull("EVAL_SYNTHESIS_MODEL") ? "EVAL_SYNTHESIS_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Phase 3b",
      purpose: "Long-form DREAM synthesis",
      model: routing.pass3Model,
      source: envOrNull("EVAL_PASS3_MODEL") ? "EVAL_PASS3_MODEL" : envOrNull("EVAL_SYNTHESIS_MODEL") ? "EVAL_SYNTHESIS_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Pass 3",
      purpose: "Final synthesis / reconciliation",
      model: routing.pass3Model,
      source: envOrNull("EVAL_PASS3_MODEL") ? "EVAL_PASS3_MODEL" : envOrNull("EVAL_SYNTHESIS_MODEL") ? "EVAL_SYNTHESIS_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "Read-ahead",
      purpose: "Full-manuscript analytical read",
      model: routing.pass3Model,
      source: envOrNull("EVAL_PASS3_MODEL") ? "EVAL_PASS3_MODEL" : envOrNull("EVAL_SYNTHESIS_MODEL") ? "EVAL_SYNTHESIS_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
    {
      phase: "WAVE / repair guidance",
      purpose: "Polish / repair-oriented guidance",
      model: routing.polishModel,
      source: envOrNull("EVAL_POLISH_MODEL") ? "EVAL_POLISH_MODEL" : envOrNull("EVAL_CHEAP_MODEL") ? "EVAL_CHEAP_MODEL" : "EVAL_OPENAI_MODEL fallback",
    },
  ];
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const config = getEvaluationRuntimeConfig();
    return NextResponse.json({
      success: true,
      data: {
        defaultModel: config.model,
        rows: phaseModelRows(),
        pricingNote: "CostOps spend is calculated from actual job_costs rows by recorded model, so mixed-model evaluations are priced per call, not as one flat model.",
      },
      meta: { fetchedAt: new Date().toISOString() },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resolve evaluation model routing",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
