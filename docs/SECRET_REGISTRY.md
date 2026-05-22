# Secret Registry

Single source of truth for all environment/secret names used across workflows and source code.

> **Normalization status:** The `_CI` suffix variants and `PROD_` prefix variants are legacy.
> They are documented here for visibility. A future normalization PR should collapse them
> per the "canonical name" column below.

---

## Supabase — Client-visible (browser + server)

| Secret name | Canonical? | Where used | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ canonical | `process-evaluations/route.ts`, `process-dream/route.ts`, Next.js client bundle | Required to have `NEXT_PUBLIC_` prefix for client bundle inclusion |
| `SUPABASE_URL` | ⚠️ alias | `job-system-ci.yml`, `guards.ts`, CI scripts | Server-side alias for same value. Fallback chain: `NEXT_PUBLIC_SUPABASE_URL \|\| SUPABASE_URL` |
| `SUPABASE_URL_CI` | ❌ legacy | `ci.yml` only | Same project URL, `_CI` suffix added historically — no functional difference. Normalize → `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ canonical | Next.js client bundle, `phase1-evidence.yml`, `phase2d-evidence.yml` | Safe for browser |
| `SUPABASE_ANON_KEY` | ⚠️ alias | `phase1-evidence.yml`, `phase2d-evidence.yml`, `guards.ts` | Server-side alias. Normalize → always use `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_ANON_KEY_CI` | ❌ legacy | `ci.yml` only | Same value, `_CI` suffix. Normalize → `SUPABASE_ANON_KEY` |

## Supabase — Server-only secrets

| Secret name | Canonical? | Where used | Notes |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ canonical | workers, guards, all CI jobs | Must never reach client bundle |
| `SUPABASE_SERVICE_ROLE_KEY_CI` | ❌ legacy | `ci.yml` only | Same value. Normalize → `SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_ACCESS_TOKEN` | ✅ canonical | `prod-alignment-guard.yml`, `job-system-ci.yml` | Supabase management API token (not a DB credential) |
| `SUPABASE_PROJECT_REF` | ✅ canonical | `job-system-ci.yml` | CI/shared project ref |
| `SUPABASE_DB_URL` | ✅ canonical | `job-system-ci.yml` | postgres:// connection string for CI project |
| `SUPABASE_DB_PASSWORD` | ✅ canonical | `job-system-ci.yml` | Optional — derived from `SUPABASE_DB_URL` if absent |

## Supabase — Production-specific secrets

| Secret name | Canonical? | Where used | Notes |
|---|---|---|---|
| `PROD_SUPABASE_PROJECT_REF` | ⚠️ prefixed | `prod-alignment-guard.yml` | `PROD_` prefix distinguishes from CI ref. Keep prefix — it's intentional isolation |
| `PROD_SUPABASE_DB_URL` | ⚠️ prefixed | `prod-alignment-guard.yml` | Same rationale |
| `PROD_SUPABASE_DB_PASSWORD` | ⚠️ prefixed | `prod-alignment-guard.yml` | Same rationale |

## Supabase — Stress / isolated project

| Secret name | Canonical? | Where used | Notes |
|---|---|---|---|
| `SUPABASE_STRESS_URL` | ⚠️ purpose-named | `pipeline-stress-tier2.yml` | Points to a separate Supabase project for stress isolation. Keep name — intentional separation |

## Vercel

| Secret name | Canonical? | Where used | Notes |
|---|---|---|---|
| `VERCEL_TOKEN` | ✅ canonical | `prod-alignment-guard.yml` | Vercel API token |
| `VERCEL_PROJECT_ID` | ✅ canonical | `prod-alignment-guard.yml` | Vercel project ID |
| `VERCEL_PROD_ALIAS` | ✅ canonical | `prod-alignment-guard.yml` | Production alias URL (e.g. revisiongrade.com) |

---

## Normalization Backlog

When ready to normalize, do these atomically (one PR):

1. **Delete `SUPABASE_URL_CI`** — replace with `SUPABASE_URL` in `ci.yml`
2. **Delete `SUPABASE_ANON_KEY_CI`** — replace with `SUPABASE_ANON_KEY` in `ci.yml`
3. **Delete `SUPABASE_SERVICE_ROLE_KEY_CI`** — replace with `SUPABASE_SERVICE_ROLE_KEY` in `ci.yml`
4. **Consolidate `SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL`** — pick one canonical name at each usage site (server = `SUPABASE_URL`, client = `NEXT_PUBLIC_SUPABASE_URL`)
5. **Fix `guards.ts:73-78`** — remove the dual-check; guard on `NEXT_PUBLIC_SUPABASE_URL` for client paths only, `SUPABASE_URL` for server

**Prerequisite:** All three `_CI` secrets must exist in GitHub repo settings until `ci.yml` is updated. Do not delete secrets before the workflow is updated.
