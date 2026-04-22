# Environment Contract Hardening Audit (2026-04-21)

Branch: `fix/env-contract-hardening`
Base: `main@9269192`

## Scope

This audit covers environment variables that can alter **evaluation behavior** across local, CI, preview, and production for canonical runtime paths:

- `app/api/workers/process-evaluations/route.ts`
- `lib/evaluation/processor.ts`
- `lib/evaluation/pipeline/*`
- `lib/evaluation/config.ts` + `lib/config/evaluationTimeouts.ts`
- `lib/evaluation/policy.ts`

Legacy/quarantined paths were reviewed for drift risk but are not canonical authorities:

- `workers/phase2Worker.ts`
- `workers/phase2Evaluation.ts`

## Mechanical inventory snapshot

Direct `process.env.*` reads across repository (all files, including tests/tools):

- Total direct reads: `608`
- Unique variables: `120`

This audit below classifies only runtime-impacting evaluation variables.

---

## Classification matrix (evaluation runtime)

| Variable | Classification | Current behavior | Contract risk |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required at runtime | Hard required by processor client init | Medium (public+server naming confusion) |
| `SUPABASE_SERVICE_ROLE_KEY` | required at runtime | Hard required by processor client init | Low |
| `OPENAI_API_KEY` | required at runtime (canonical path) | Canonical pass runners throw if absent | Medium (legacy path still has simulated fallback behavior) |
| `PERPLEXITY_API_KEY` | optional with conditional requirement | Required only when `EVAL_EXTERNAL_ADJUDICATION_MODE` is `required`/`veto` | Low |
| `EVAL_OPENAI_MODEL` | optional with default | Defaults to `o3` | Medium (direct reads in multiple modules) |
| `EVAL_OPENAI_TIMEOUT_MS` | optional with validated default | Central resolver + clamp + baseline conflict handling | Low |
| `EVAL_PASS_TIMEOUT_MS` | optional with validated default | Central resolver + clamp + baseline conflict handling | Low |
| `EVAL_PASS1_MAX_TOKENS` | optional with default | Parse+range in pass runner | Medium (ad hoc parser) |
| `EVAL_PASS2_MAX_TOKENS` | optional with default | Parse+range in pass runner | Medium (ad hoc parser) |
| `EVAL_PASS3_MAX_TOKENS` | optional with default | Parse+range in pass runner | Medium (ad hoc parser; default fallback mismatch risk) |
| `EVAL_PASS3_PROMPT_MAX_CHARS` | optional with default | Parse+range in pass3 | Medium (ad hoc parser) |
| `EVAL_PIPELINE_INPUT_CHAR_BUDGET` | optional with default | Parse+range in prompt window module | Medium (ad hoc parser) |
| `EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET` | optional with default | Parse+range in prompt window module | Medium (ad hoc parser) |
| `EVAL_EXTERNAL_ADJUDICATION_MODE` | optional with default | Normalized enum (`optional|required|veto`) | Low |
| `EVAL_CONTEXT_CONTAMINATION_GUARD` | optional with default | `auto` semantics (`prod=true` fallback) | Medium (behavior differs by env) |
| `EVAL_MIN_MANUSCRIPT_WORDS` | optional with default | Numeric parse with fallback | Medium (ad hoc parse) |
| `EVAL_MIN_MANUSCRIPT_CHARS` | deprecated compatibility | Converted to words when set | Medium (deprecated-but-active path) |
| `EVAL_STALE_RUNNING_MINUTES` | optional with default | Parse+range in processor | Medium (ad hoc parse) |
| `EVAL_WORKER_BATCH_SIZE` | optional with default | Parse+clamp in route and processor | Medium (duplicated logic) |
| `EVAL_WORKER_LEASE_MS` | optional with default | Parse+clamp in route and claim path | Medium (duplicated logic) |
| `EVAL_WORKER_MAX_EXECUTION_MS` | optional with default | Parse+clamp in route | Medium (ad hoc parser) |
| `CRON_SECRET` | required for non-vercel manual auth | Timing-safe compare | Low |
| `WORKER_ALLOW_SERVICE_ROLE_DEV` | local-only convenience | Dev-only auth bypass for service-role bearer | Medium (must stay impossible in prod) |
| `NODE_ENV` | runtime environment discriminator | Governs defaults and guards | Medium |
| `VERCEL` / `VERCEL_ENV` | runtime platform discriminator | Vercel cron trust + env labeling | Medium |
| `CI` | ci-only convenience | Used in security guard logic and test behavior | Medium |
| `ENABLE_LEGACY_PHASE2_WORKER` | local/migration-only toggle | Kill-switch for legacy path | Medium (must remain quarantined) |
| `ENABLE_LEGACY_PHASE2_RUNTIME` | local/migration-only toggle | Legacy path kill-switch | Medium (must remain quarantined) |

### Classification notes

- **Required at runtime** means canonical evaluation should fail early if absent.
- **Optional with default** means resolver provides deterministic default and validation.
- **Local-only convenience** means value exists to support local tooling or migration, not canonical prod behavior.
- **Forbidden to silently override file-backed config** currently implemented for timeout family (`EVAL_OPENAI_TIMEOUT_MS`, `EVAL_PASS_TIMEOUT_MS`) via conflict reason `conflicting_env_override`.

---

## Current centralization map

### Centralized today

1. `lib/config/evaluationTimeouts.ts`
   - `EVAL_OPENAI_TIMEOUT_MS`
   - `EVAL_PASS_TIMEOUT_MS`
   - supports file baseline + conflict detection + clamp + invariant

2. `lib/evaluation/policy.ts`
   - `EVAL_OPENAI_MODEL`
   - `EVAL_EXTERNAL_ADJUDICATION_MODE`

3. `lib/jobs/config.ts`
   - `ALLOW_HEADER_USER_ID`
   - lease timeout family for jobs

### Still ad hoc (centralization gap)

- Token caps and prompt budgets are parsed directly in pass modules:
  - `EVAL_PASS1_MAX_TOKENS`
  - `EVAL_PASS2_MAX_TOKENS`
  - `EVAL_PASS3_MAX_TOKENS`
  - `EVAL_PASS3_PROMPT_MAX_CHARS`
  - `EVAL_PIPELINE_INPUT_CHAR_BUDGET`
  - `EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET`
- Processor-specific toggles parsed in place:
  - `EVAL_MIN_MANUSCRIPT_WORDS`
  - `EVAL_MIN_MANUSCRIPT_CHARS` (deprecated)
  - `EVAL_STALE_RUNNING_MINUTES`
  - `EVAL_CONTEXT_CONTAMINATION_GUARD`
- Worker route duplicates bounded parsing for worker controls:
  - `EVAL_WORKER_BATCH_SIZE`
  - `EVAL_WORKER_LEASE_MS`
  - `EVAL_WORKER_MAX_EXECUTION_MS`

---

## Invariants to add (contract hardening target)

1. **Numeric strictness invariant**
   - Reject malformed numeric env values (`"abc"`, `"1.2"`, empty) for all bounded integers.
2. **Pass timeout ordering invariant** (already present)
   - `EVAL_OPENAI_TIMEOUT_MS >= EVAL_PASS_TIMEOUT_MS`.
3. **Mode/secret invariant**
   - If `EVAL_EXTERNAL_ADJUDICATION_MODE in {required,veto}` then `PERPLEXITY_API_KEY` is mandatory.
4. **Canonical required-secret invariant**
   - Canonical runtime must fail fast without `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
5. **Dev bypass invariant**
   - `WORKER_ALLOW_SERVICE_ROLE_DEV` can only affect behavior when `NODE_ENV=development`; production use must hard-fail.
6. **Single precedence invariant for config families**
   - For each family, precedence is explicit and test-backed:
     - file baseline (`.env`/`.env.local`) vs shell env override policy
     - default fallback policy

---

## Contract test matrix to add

1. Clean defaults (no optional vars set)
2. Poisoned env values (malformed numerics)
3. Conflicting shell export vs file baseline (for all file-backed families)
4. Absent optional vars
5. Prod-like env with only required secrets present
6. Feature-enabled missing secret (e.g., `required` adjudication mode without Perplexity key)
7. Dev-only bypass attempts in non-dev env

---

## Observed risk hotspots

1. **Legacy path fallback drift**
   - `workers/phase2Worker.ts`/`workers/phase2Evaluation.ts` still include simulated fallback semantics when `OPENAI_API_KEY` absent.
2. **Distributed numeric parsing**
   - Multiple modules parse bounded numbers with slightly different fallback semantics.
3. **Duplicated worker config clamping**
   - Route and processor clamp overlapping worker vars separately.

---

## Recommended implementation sequence (next)

1. Introduce `lib/config/evaluationRuntimeConfig.ts` as canonical resolver for pass caps, prompt budgets, and processor controls.
2. Introduce strict integer parsing helper reuse from timeout resolver logic.
3. Replace ad hoc `process.env` reads in pipeline pass modules + processor with resolver outputs.
4. Add invariant assertions in resolver init path.
5. Add focused contract tests covering malformed/conflict/prod-like scenarios.
6. Add one concise docs table for precedence + failure behavior.

No runtime behavior changes were made in this audit commit; this is analysis-only groundwork.
