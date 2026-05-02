# Environment Contract

`lib/config/envContract.ts` is the **single source of truth** for evaluation-altering environment inputs consumed by the evaluation pipeline.

> **Scope of this document:** evaluation-behavior inputs only. Auth/database/runtime secrets are catalogued in the registry section of `envContract.ts` for reference, but are not yet validated by this contract. That migration lands in the follow-on hot-path adoption PR.

## Server-only boundary

This module imports `'server-only'`. It must never be imported from client components or bundles. Vercel/Next.js will throw a build error if it leaks to the client.

## Variables owned by this contract

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `EVAL_PIPELINE_INPUT_CHAR_BUDGET` | No | `40000` | Max characters of manuscript fed to Pass 1. Must be 12 000–100 000. |
| `EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET` | No | `8000` | Max characters of synthesis reference material. Must be 1 000–50 000. |
| `EVAL_OPENAI_MODEL` | No | `gpt-4o` | OpenAI model identifier for evaluation runs. o-series reasoning models (o3, o1, etc.) are rejected in production unless `EVAL_ALLOW_REASONING_MODELS=true`. |
| `EVAL_ALLOW_REASONING_MODELS` | No | `false` | Operator override that permits o-series models (`/^o[0-9]/`) in `NODE_ENV=production`. When unset/`false`, the contract throws during resolution before any API call if the resolved model is o-series. Set to `true` only for explicit, time-boxed evaluations (not steady-state production). |
| `EVAL_EXTERNAL_ADJUDICATION_MODE` | No | `optional` | One of `optional` \| `required` \| `veto`. |
| `ENABLE_LATENCY_TRACE_LOGS` | No | _(absent)_ | Set to `1` to enable per-step latency trace output. |
| `NODE_ENV` | No | `development` | Must be `development`, `test`, or `production`. |
| `VERCEL_ENV` | No | _(absent)_ | Platform signal: `production`, `preview`, or `development`. |
| `CI` | No | _(absent)_ | Platform signal: `true` in CI runners. |
| `FLOW1_EVIDENCE` | No | _(absent)_ | Set to `1` during evidence collection runs (activates evidence mode). |
| `FLOW_A7_EVIDENCE` | No | _(absent)_ | Set to `1` during A7 evidence runs. |
| `USE_REAL_LLM` | Forbidden | — | Always throws. Never permitted in any environment. |

## Conditional requirement: PERPLEXITY_API_KEY

`PERPLEXITY_API_KEY` is **not required** when `EVAL_EXTERNAL_ADJUDICATION_MODE=optional` (the default).

It **is required** at runtime when `EVAL_EXTERNAL_ADJUDICATION_MODE` is `required` or `veto`. The contract exposes `requiresPerplexityApiKey: boolean` so callers can assert its presence before making Perplexity API calls.

## SUPABASE_URL alias

Some client-side paths use `NEXT_PUBLIC_SUPABASE_URL` as an alias for `SUPABASE_URL`. The canonical server-side value is `SUPABASE_URL`. The hot-path adoption PR will normalise this; until then both may be set.

## Validation rules

- Integer budget fields: must be plain integers (no decimals, no units like `ms`). Floats and partially-numeric strings (e.g. `60000ms`) are rejected.
- `EVAL_EXTERNAL_ADJUDICATION_MODE`: must be exactly one of `optional | required | veto`.
- `NODE_ENV`: must be exactly one of `development | test | production`.
- **Forbidden combinations in Vercel production:** `CI=true`, `NODE_ENV=test`, `FLOW1_EVIDENCE=1`, `FLOW_A7_EVIDENCE=1` all throw.

## Usage

```ts
import { getEvalEnvContract } from '@/lib/config/envContract';

const env = getEvalEnvContract(); // throws on first call if any var is invalid
const budget = env.inputCharBudget;
const needsPerplexity = env.requiresPerplexityApiKey;
```

## Where to set variables

| Runtime | Location |
| :--- | :--- |
| Local development | `.env.local` (git-ignored) |
| Vercel preview/prod | Vercel dashboard → Settings → Environment Variables |
| GitHub Actions CI | Repository Settings → Secrets and variables → Actions |

## Adding a new evaluation-behavior variable

1. Add the field to `EvalEnvContract` interface in `envContract.ts`
2. Add validation logic in `resolveEvalEnvContract()` (use `parseStrictPositiveInt` or `requireNonEmpty`)
3. Add test cases in `lib/config/__tests__/envContract.test.ts` covering: valid value, empty/absent fallback, and at least one invalid/poisoned value
4. Update the Variables table above
5. For auth/secrets, add to the ENV VAR REGISTRY comment block at the bottom of `envContract.ts` (do not add validation there until the hot-path adoption PR)
