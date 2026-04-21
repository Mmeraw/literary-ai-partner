# Environment Contract

`lib/config/envContract.ts` is the **single source of truth** for every environment variable consumed by the evaluation pipeline.

## Why this exists

Scattered `process.env` reads across API routes and pipeline modules create silent failures: a missing key produces `undefined`, which surfaces as a cryptic downstream error. The contract validator catches violations at process startup with a precise error message and a remediation hint.

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for evaluation models |
| `PERPLEXITY_API_KEY` | Yes | — | Perplexity API key |
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service role key (server-only) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | — | Supabase anon key (client-safe) |
| `EVALUATION_TIMEOUT_MS` | No | `180000` | Per-model request timeout in milliseconds |
| `EVALUATION_MODELS` | No | — | Comma-separated model override list |
| `NODE_ENV` | No | `development` | Runtime environment |

## Usage

```ts
import { getEnvContract } from '@/lib/config/envContract';

const env = getEnvContract(); // throws if any required var is missing
const key = env.OPENAI_API_KEY;
const timeout = env.EVALUATION_TIMEOUT_MS; // always a number
```

## Where to set variables

| Runtime | Location |
|---|---|
| Local development | `.env.local` (git-ignored) |
| Vercel preview/prod | Vercel dashboard → Settings → Environment Variables |
| GitHub Actions CI | Repository Settings → Secrets and variables → Actions |

## Adding a new variable

1. Add the field to the `EnvContract` interface in `envContract.ts`
2. Add validation logic in `resolveEnvContract()` (use `requireString` or `parsePositiveInt`)
3. Add a test case in `lib/config/__tests__/envContract.test.ts`
4. Update this table
