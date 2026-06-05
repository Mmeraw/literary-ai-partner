import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCostCents } from "@/lib/jobs/cost";

export type LlmCostEventSource = "evaluation" | "revise_queue" | "agent_readiness";

export interface LlmCostEventInput {
  source: LlmCostEventSource;
  activity: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents?: number | null;
  provider?: string;
  userId?: string | null;
  evaluationJobId?: string | null;
  manuscriptId?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

const FORBIDDEN_METADATA_KEY_PATTERN = /(text|content|prompt|response|query|synopsis|bio|manuscript|passage)/i;

function toSafeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function sanitizeMetadata(input?: Record<string, unknown>): Record<string, string | number | boolean | null> {
  if (!input) return {};
  const safe: Record<string, string | number | boolean | null> = {};

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (FORBIDDEN_METADATA_KEY_PATTERN.test(key)) continue;

    if (rawValue === null) {
      safe[key] = null;
      continue;
    }

    if (typeof rawValue === "boolean") {
      safe[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      safe[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "string") {
      safe[key] = rawValue.slice(0, 140);
      continue;
    }
  }

  return safe;
}

export async function recordLlmCostEvent(input: LlmCostEventInput): Promise<void> {
  const model = (input.model ?? "").trim();
  const activity = (input.activity ?? "").trim();
  if (!model || !activity) return;

  const inputTokens = Math.floor(toSafeNumber(input.inputTokens));
  const outputTokens = Math.floor(toSafeNumber(input.outputTokens));

  const resolvedCostCents =
    typeof input.costCents === "number" && Number.isFinite(input.costCents)
      ? Math.max(0, input.costCents)
      : calculateCostCents(model, inputTokens, outputTokens);

  const supabase = createAdminClient();
  const { error } = await supabase.from("llm_cost_events").insert({
    source: input.source,
    activity,
    provider: (input.provider ?? "openai").trim() || "openai",
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_cents: resolvedCostCents,
    user_id: input.userId ?? null,
    evaluation_job_id: input.evaluationJobId ?? null,
    manuscript_id: input.manuscriptId ?? null,
    metadata: sanitizeMetadata(input.metadata),
    created_at: input.createdAt ?? new Date().toISOString(),
  });

  if (error) {
    console.error("[cost-events] Failed to record llm_cost_event", {
      source: input.source,
      activity,
      model,
      message: error.message,
    });
  }
}
