// Jest test environment setup
// Pass through environment variables if set (GitHub Actions, local CI)
// Otherwise use sensible test defaults

import { resolveEvaluationTimeoutConfig } from "./lib/evaluation/config";

process.env.SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://localhost:54321";

process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? "test_anon_key";

process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test_service_role_key";

// Ensure NEXT_PUBLIC variants are set for client-side code
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

// Test-only compatibility for lightweight Supabase query-builder mocks.
// Several focused unit tests use partial fluent-chain stubs. Keep these
// methods non-enumerable so they do not alter object snapshots/iteration.
for (const method of ['neq', 'in', 'order'] as const) {
  if (!(method in Object.prototype)) {
    Object.defineProperty(Object.prototype, method, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: function supabaseMockQueryBuilderPassthrough() {
        return this;
      },
    });
  }
}

// Map database URLs for TTL/concurrency tests (psql CLI integration tests)
// Tries multiple common env var names in priority order
if (!process.env.PG_URL) {
  const dbUrl = 
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPROTECTED;
  
  if (dbUrl) {
    (process.env as any).PG_URL = dbUrl;
  }
}

// Evaluation timeout invariants (mistake-proof baseline for Jest):
// EVAL_OPENAI_TIMEOUT_MS must be >= EVAL_PASS_TIMEOUT_MS.
const resolvedTimeouts = resolveEvaluationTimeoutConfig(process.env);
const evalPassTimeoutMs = resolvedTimeouts.passTimeout.valueMs;
const evalOpenAiTimeoutMs = Math.max(resolvedTimeouts.openAiTimeout.valueMs, evalPassTimeoutMs);

process.env.EVAL_PASS_TIMEOUT_MS = String(evalPassTimeoutMs);
process.env.EVAL_OPENAI_TIMEOUT_MS = String(evalOpenAiTimeoutMs);