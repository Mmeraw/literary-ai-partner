# OpenAI Cost Routing Audit — 2026-06-03

## Purpose

This audit records why the current cost-optimization claim is not proven by PR #937 alone. It is intended to prevent the OpenAI API cost spike from being closed as solved before production routing, telemetry, and billing evidence all agree.

## Trigger

Two recent RevisionGrade evaluations reportedly cost approximately **$64 USD** in OpenAI API usage. That is inconsistent with the claim that the high-volume evaluation phases are safely routed to cheap models unless the jobs were unusually large, retried heavily, generated excessive output, or still used expensive model paths.

## Verified repository facts

### PR #937 was useful but conditional

PR #937 merged task-based model routing into `policy.ts`. It added `EVAL_CHEAP_MODEL` and routes seed generation, story ledger generation, Pass 1/Pass 2 chunk evaluation, and polish through cheaper models when configured.

However, the PR was intentionally backward-compatible. If `EVAL_CHEAP_MODEL` is not present in the production environment, the affected phases fall back to the prior canonical model path.

Operational implication: **the merge alone does not reduce spending.** Production Vercel env configuration must be verified.

### Runtime diagnostics are not fully aligned

`policy.ts` now considers `EVAL_CHEAP_MODEL` for cheap/high-volume phases, but `lib/config/evaluationRuntimeConfig.ts` still resolves `routing.pass1Model` and `routing.pass2Model` from only:

- `EVAL_PASS1_MODEL` / `EVAL_CHUNK_MODEL`
- `EVAL_PASS2_MODEL` / `EVAL_CHUNK_MODEL`

It does not include `EVAL_CHEAP_MODEL` in that diagnostic routing snapshot.

Operational implication: dashboards, debug output, or config inspections can misrepresent the effective routing. A system can therefore appear optimized in `policy.ts` while runtime diagnostics remain stale or misleading.

### Cost telemetry is not proven complete

`lib/jobs/cost.ts` defines pricing and a `recordCost()` function, but repository search did not show `recordCost()` integrated across the live OpenAI call sites. If completion calls do not record model, token usage, phase, retry attempt, and estimated cost, then per-job spending cannot be reconciled from RevisionGrade’s own database.

Operational implication: without per-call telemetry, no one can explain a $64 charge job-by-job or phase-by-phase.

### Legacy entry points still require audit

`supabase/functions/evaluate/index.ts` still contains a standalone OpenAI call path using `OPENAI_MODEL || "gpt-5.1"`. If this edge function is deployed or reachable from production, it bypasses the newer `EVAL_CHEAP_MODEL` routing architecture.

Operational implication: old paths can silently defeat cost routing.

## Required code changes

### 1. Align runtime routing with policy routing

Patch `lib/config/evaluationRuntimeConfig.ts` so the diagnostic/config routing cascade matches `policy.ts`.

Required Pass 1 cascade:

```ts
const pass1Model = resolvePassModel([
  "EVAL_PASS1_MODEL",
  "EVAL_CHUNK_MODEL",
  "EVAL_CHEAP_MODEL",
]);
```

Required Pass 2 cascade:

```ts
const pass2Model = resolvePassModel([
  "EVAL_PASS2_MODEL",
  "EVAL_CHUNK_MODEL",
  "EVAL_CHEAP_MODEL",
]);
```

Recommended additional visible fields in `EvaluationPassRouting`:

```ts
chunkModel: string;
seedModel: string;
ledgerModel: string;
polishModel: string;
synthesisModel: string;
```

Recommended cascades:

```ts
const chunkModel = resolvePassModel(["EVAL_CHUNK_MODEL", "EVAL_CHEAP_MODEL"]);
const seedModel = resolvePassModel(["EVAL_SEED_MODEL", "EVAL_CHEAP_MODEL"]);
const ledgerModel = resolvePassModel(["EVAL_LEDGER_MODEL", "EVAL_CHEAP_MODEL"]);
const polishModel = resolvePassModel(["EVAL_POLISH_MODEL", "EVAL_CHEAP_MODEL"]);
const synthesisModel = resolvePassModel(["EVAL_SYNTHESIS_MODEL"]);
```

### 2. Add regression tests

Add tests proving:

- `EVAL_CHEAP_MODEL=gpt-5-mini` changes `routing.pass1Model` to `gpt-5-mini` when pass/chunk overrides are absent.
- `EVAL_CHEAP_MODEL=gpt-5-mini` changes `routing.pass2Model` to `gpt-5-mini` when pass/chunk overrides are absent.
- `EVAL_CHUNK_MODEL` overrides `EVAL_CHEAP_MODEL`.
- `EVAL_PASS1_MODEL` and `EVAL_PASS2_MODEL` override both.
- `routing.seedModel`, `routing.ledgerModel`, and `routing.polishModel` show the effective cheap route.

### 3. Add GPT-5.5 production guard

No production evaluation path should call `gpt-5.5` unless it records an explicit escalation reason.

Allowed reasons:

- `premium_tier`
- `quality_gate_failure`
- `contradiction_detected`
- `appeal`
- `manual_override`
- `black_label`

Any direct `gpt-5.5` route without one of those reasons should fail closed.

### 4. Wire cost telemetry into every OpenAI call

Each OpenAI completion path should record:

- `job_id`
- `phase`
- `pass`
- `model`
- `request_id`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `cached_input_tokens` if available
- `retry_attempt`
- `estimated_cost_usd`
- `called_at`

If `recordCost()` is retained, it must be invoked from every live OpenAI call path. Otherwise replace it with a canonical telemetry wrapper and require all OpenAI calls to go through that wrapper.

### 5. Add job-level cost ceilings

Recommended beta/testing ceiling:

- Warn at `$3` estimated cost per evaluation.
- Soft block at `$5` unless admin override is present.
- Hard block at `$10` unless the job is explicitly premium/admin-approved.

The ceiling must log the responsible phase/model before blocking.

### 6. Audit/disable legacy routes

Confirm whether these paths are deployed or reachable:

- `supabase/functions/evaluate/index.ts`
- `base44/functions/*`
- archived Base44 exports

If not used, mark as archived/non-production or remove from deploy scripts. If used, route through canonical policy and telemetry.

## Production environment checklist

Verify Vercel Production values:

```text
EVAL_CHEAP_MODEL=gpt-5-mini
EVAL_OPENAI_MODEL=gpt-5.1
EVAL_CHUNK_MODEL unset or gpt-5-mini
EVAL_PASS1_MODEL unset or gpt-5-mini
EVAL_PASS2_MODEL unset or gpt-5-mini
EVAL_SEED_MODEL unset or gpt-5-mini
EVAL_LEDGER_MODEL unset or gpt-5-mini
EVAL_POLISH_MODEL unset or gpt-5-mini
EVAL_PASS3_MODEL unset or gpt-5.1
EVAL_SYNTHESIS_MODEL unset or gpt-5.1
EVAL_PASS3_FALLBACK_MODEL unset or explicit non-5.5 model unless guarded
```

If any high-volume phase is set to `gpt-5.1`, `gpt-5.4`, or `gpt-5.5`, PR #937 will not deliver the expected savings.

## Acceptance criteria

Do not mark the cost issue solved until all are true:

1. Runtime config and policy routing agree.
2. Production env vars are verified.
3. Every OpenAI call records per-call cost telemetry.
4. The two expensive jobs can be explained by job, phase, model, call count, tokens, retries, and cost.
5. `gpt-5.5` cannot be called without an explicit escalation reason.
6. Legacy OpenAI entry points are confirmed unreachable or routed through canonical policy.

## Bottom line

PR #937 made cheaper routing possible. It did not prove cheaper routing was active in production. The cost spike must remain open until telemetry and production configuration prove it.