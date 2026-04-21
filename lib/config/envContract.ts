/**
 * envContract.ts — Canonical environment variable contract
 *
 * Single source of truth for all env vars consumed by the evaluation pipeline.
 * Validates presence and type at startup; throws with a clear message on violation.
 */

export interface EnvContract {
  OPENAI_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  /** Milliseconds — global per-model request timeout. Default: 180_000 */
  EVALUATION_TIMEOUT_MS: number;
  /** Comma-separated model list override. Optional. */
  EVALUATION_MODELS?: string;
  NODE_ENV: 'development' | 'test' | 'production';
}

const DEFAULTS: Partial<EnvContract> = {
  EVALUATION_TIMEOUT_MS: 180_000,
  NODE_ENV: 'development',
};

function requireString(key: string, env: NodeJS.ProcessEnv): string {
  const val = env[key];
  if (!val || val.trim() === '') {
    throw new Error(
      `[envContract] Missing required environment variable: ${key}\n` +
        `  Set it in .env.local (local), Vercel dashboard (preview/prod), or GitHub Actions secrets (CI).`
    );
  }
  return val.trim();
}

function parsePositiveInt(key: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) {
    throw new Error(
      `[envContract] ${key} must be a positive integer, got: ${JSON.stringify(raw)}`
    );
  }
  return n;
}

/**
 * Validate and return the env contract.
 * Call once at process startup — or in the Next.js API route handler before any IO.
 */
export function resolveEnvContract(env: NodeJS.ProcessEnv = process.env): EnvContract {
  const timeoutMs = parsePositiveInt(
    'EVALUATION_TIMEOUT_MS',
    env.EVALUATION_TIMEOUT_MS,
    DEFAULTS.EVALUATION_TIMEOUT_MS!
  );

  const nodeEnv = (env.NODE_ENV ?? DEFAULTS.NODE_ENV) as EnvContract['NODE_ENV'];

  return {
    OPENAI_API_KEY: requireString('OPENAI_API_KEY', env),
    PERPLEXITY_API_KEY: requireString('PERPLEXITY_API_KEY', env),
    SUPABASE_URL: requireString('SUPABASE_URL', env),
    SUPABASE_SERVICE_ROLE_KEY: requireString('SUPABASE_SERVICE_ROLE_KEY', env),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requireString('NEXT_PUBLIC_SUPABASE_ANON_KEY', env),
    EVALUATION_TIMEOUT_MS: timeoutMs,
    EVALUATION_MODELS: env.EVALUATION_MODELS?.trim() || undefined,
    NODE_ENV: nodeEnv,
  };
}

/**
 * Singleton — resolved once per process.
 * Import this in API routes and pipeline modules instead of reading process.env directly.
 */
let _contract: EnvContract | undefined;

export function getEnvContract(): EnvContract {
  if (!_contract) {
    _contract = resolveEnvContract();
  }
  return _contract;
}

/** Test helper — reset the singleton between tests. */
export function __resetEnvContract(): void {
  _contract = undefined;
}
