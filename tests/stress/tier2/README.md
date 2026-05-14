# Tier 2 Stress Harness — Live OpenAI + Live Perplexity

## What it does

Runs the full evaluation pipeline (Pass 1 → 2 → 3 → 4) against a real
~52k-word public-domain manuscript using **live OpenAI** and **live
Perplexity**. Asserts on the production-shaped result:

- `outcome === "success"`
- `evaluation_result.cross_check` is a non-empty object
- `evaluation_result.pass4_governance` is populated
- total pipeline wall-time ≤ 15 min

This PR establishes **Tier 2 direct live integration harness infrastructure**.
It is not a proven regression lock until at least one secret-backed live run
passes end-to-end.

This is the smallest possible footprint that would have caught prod eval
`609dc776-6ccd-41dd-9353-1425697f1fb2` (Froggin Noggin, 53,903 words),
which failed on 2026-05-13 with:

```
External adjudication mode 'required' requires cross-check output
```

The Tier 1 mock harness was 100% green for the same change. **Tier 1
cannot fail on a class it does not cover.** Tier 2 is that cover.

## When it runs

| Trigger             | When                                                    |
| ------------------- | ------------------------------------------------------- |
| `workflow_dispatch` | Manual only (run explicitly from Actions UI)            |

Workflow file: `.github/workflows/pipeline-stress-tier2.yml`.

## Cost

- ~$8–15 per manual run (model and token-size dependent)
- No recurring cost by default; execution occurs only when explicitly dispatched.

## Signal this catches

What Tier 2 catches that Tier 1 (mocks) cannot:

- **Real refusals / shape variants** from OpenAI or Perplexity on
  production-shaped prompts
- **Real network/timeout behavior** of Pass 4 against the live Perplexity
  endpoint
- **`cross_check` empty/missing** — the silent-skip class that PR #481
  hardened against and PR-OBS instrumented
- **Long-form route activation** — fixture is sized to trigger
  `route=long_form` (threshold = 25k words) and ~30+ chunks, matching the
  structural shape of the Froggin Noggin failure

What it does **not** catch:

- UI rendering behavior (that's Tier 3a — Playwright)
- Full E2E worker flow including DB persistence semantics (Tier 3b)
- Quality-of-output scoring drift (future Q2/Q3 rows)

## Re-running locally

```bash
# Required env:
export OPENAI_API_KEY=sk-...
export PERPLEXITY_API_KEY=pplx-...

# Optional safety metadata (for prod-project guard only):
export SUPABASE_STRESS_URL=https://<dev-project>.supabase.co

npm run pipeline:stress:tier2
```

If a Supabase URL is provided, the runner hard-aborts when it resolves to the prod project id
`xtumxjnzdswuumndcbwc`.

## First-run requirement (post-merge)

Tier 2 needs GitHub repo secrets before a live run can execute:

1. `OPENAI_API_KEY`
2. `PERPLEXITY_API_KEY`
3. `SUPABASE_STRESS_URL` (non-prod project URL)

Add them at: Settings → Secrets and variables → Actions.

`SUPABASE_STRESS_URL` must point to the non-prod test project; the runner
hard-aborts if it detects the production project id.

## How to disable

No-op by default until manually dispatched. To disable entirely, remove or
rename `.github/workflows/pipeline-stress-tier2.yml`.

## Adding rows

This file ships with one row by design: `Q-long-real-perplexity`. Adding
more rows (variant coverage, refusal handling, quality-drift) belongs in
follow-up PRs — keep each row a separate, reviewable change so cost and
flake exposure stay bounded.
