import { createClient } from "@supabase/supabase-js";
import {
  logLlr003Probe,
  probeLlr003PairsFromInput,
  type RuleEvaluationInputForProbe,
} from "../lib/governance/lessonsLearned/ACTIVE_RULES";

type EvaluationJobRow = {
  id: string;
  convergenceResult?: {
    overall?: {
      top_3_strengths?: string[];
      top_3_risks?: string[];
      top3strengths?: string[];
      top3risks?: string[];
    };
  } | null;
  convergence_result?: {
    overall?: {
      top_3_strengths?: string[];
      top_3_risks?: string[];
      top3strengths?: string[];
      top3risks?: string[];
    };
  } | null;
};

function toProbeInput(job: EvaluationJobRow): RuleEvaluationInputForProbe {
  const convergence = job.convergenceResult ?? job.convergence_result ?? {};

  const strengths =
    convergence?.overall?.top_3_strengths ?? convergence?.overall?.top3strengths ?? [];
  const risks = convergence?.overall?.top_3_risks ?? convergence?.overall?.top3risks ?? [];

  return {
    convergence_result: {
      overall: {
        top_3_strengths: strengths,
        top_3_risks: risks,
      },
    },
  };
}

async function main() {
  const jobId = process.argv[2];

  if (!jobId) {
    throw new Error("Usage: tsx scripts/probe-llr003-job.ts <job-id>");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, convergenceResult, convergence_result")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to load evaluation_jobs row for ${jobId}: ${error?.message ?? "unknown error"}`);
  }

  const input = toProbeInput(data as EvaluationJobRow);
  const pairs = probeLlr003PairsFromInput(input);
  const blocking = pairs.filter((pair) => pair.decision === "error_polarity");

  logLlr003Probe(`job ${jobId}`, input);

  console.log("\nSummary");
  console.log({
    jobId,
    strengths: input.convergence_result?.overall?.top_3_strengths?.length ?? 0,
    risks: input.convergence_result?.overall?.top_3_risks?.length ?? 0,
    totalPairs: pairs.length,
    blockingPairs: blocking.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
