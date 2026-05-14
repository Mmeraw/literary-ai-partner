# Operations policy — RevisionGrade pre-launch

**Status:** Pre-launch. Mike is the sole user. Customer-facing safety nets deferred until launch.

## Environments

**Production is the only environment.**

- Preview deployments are disabled at the Vercel project level via the Ignored Build Step.
- The Vercel Development environment is unused; Codespaces is the dev environment.
- All env vars live in Production scope only.
- All code merges land directly in Production via PR → main → Vercel auto-deploy.

This policy is intentional for the pre-launch period. Every real failure in the past month was caught by Production reality, not by Preview rehearsal. Three environments was a drift-generator that wasted money on Preview AI calls and obscured config truth.

**When we go public, branch the prod env**: Production becomes customer-facing, a new Staging environment mirrors production exactly, and feature work merges to Staging first.

## Safety mechanisms

### Kill switch — `EVAL_PIPELINE_ENABLED`

Set `EVAL_PIPELINE_ENABLED=false` in Vercel Production env to halt all evaluation work within seconds. Worker entrypoints return a skip envelope without touching the DB or any AI provider. Set back to `true` (or unset) to resume. No code deploy required.

Use cases: emergency stop during a runaway billing event, pause during a known-broken model deploy, planned maintenance window.

### Test manuscript range — `manuscript_id >= 9000`

Any manuscript with `id >= 9000` is treated as a test record. Admin dashboards hide them by default. Use this range for stress tests, harness runs, fixture-driven evaluations. Real user manuscripts always live in `id < 9000`.

### Migration discipline

Every Supabase migration is reviewed manually via Supabase MCP (`apply_migration` against a branch DB) before merge to main. No auto-applied migrations.

## Feature flags

All risky behavior changes ship behind an env-var flag in Production scope. The flag is the rollback path; code revert is the last resort.

Established flags:
- `EVAL_EXTERNAL_ADJUDICATION_MODE` — `required` | `optional` (controls Pass 4 cross-check enforcement)
- `EVAL_PIPELINE_ENABLED` — `true` (default) | `false` (kill switch)
- `EVAL_CHUNK_MAX_PER_PASS` — integer cap on chunks per pass (fail-closed when exceeded)
- `EVAL_CHUNK_PASS_CONCURRENCY` — worker concurrency for chunk-native paths

## Cost discipline

- Spend Management cap set in Vercel billing.
- Function memory tier reviewed quarterly (we want the smallest tier the workload fits).
- Vercel AI Gateway is NOT used — provider calls go direct to OpenAI and Perplexity.
- Add-ons (Speed Insights, Analytics, Observability) enabled only when actively read.

## When this policy changes

We revisit on public launch. At that point we re-introduce Staging and Preview deliberately, with their own feature-flag scopes and a documented promotion path Staging → Production.
