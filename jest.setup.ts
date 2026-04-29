// Jest test environment setup

import { resolveEvaluationTimeoutConfig } from "./lib/evaluation/config";

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "test_anon_key";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test_service_role_key";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

const resolvedTimeouts = resolveEvaluationTimeoutConfig(process.env);
const evalPassTimeoutMs = resolvedTimeouts.passTimeout.valueMs;
const evalOpenAiTimeoutMs = Math.max(resolvedTimeouts.openAiTimeout.valueMs, evalPassTimeoutMs);

process.env.EVAL_PASS_TIMEOUT_MS = String(evalPassTimeoutMs);
process.env.EVAL_OPENAI_TIMEOUT_MS = String(evalOpenAiTimeoutMs);
