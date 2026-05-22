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
| ~~`SUPABASE_URL_CI`~~ | ✅ deleted | was `ci.yml` only | Removed — `ci.yml` now reads `SUPABASE_URL` directly. Delete this secret from GitHub repo settings. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ canonical | Next.js client bundle, `phase1-evidence.yml`, `phase2d-evidence.yml` | Safe for browser |
| `SUPABASE_ANON_KEY` | ⚠️ alias | `phase1-evidence.yml`, `phase2d-evidence.yml` | Server-side alias. Acceptable — no dual-check anti-pattern remaining. |
| ~~`SUPABASE_ANON_KEY_CI`~~ | ✅ deleted | was `ci.yml` only | Removed — `ci.yml` now reads `SUPABASE_ANON_KEY` directly. Delete this secret from GitHub repo settings. |

## Supabase — Server-only secrets

| Secret name | Canonical? | Where used | Notes |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ canonical | workers, guards, all CI jobs | Must never reach client bundle |
| ~~`SUPABASE_SERVICE_ROLE_KEY_CI`~~ | ✅ deleted | was `ci.yml` only | Removed — `ci.yml` now reads `SUPABASE_SERVICE_ROLE_KEY` directly. Delete this secret from GitHub repo settings. |
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

## Normalization Status

✅ **Done (this PR):**
1. Deleted `SUPABASE_URL_CI` from `ci.yml` → now reads `SUPABASE_URL`
2. Deleted `SUPABASE_ANON_KEY_CI` from `ci.yml` → now reads `SUPABASE_ANON_KEY`
3. Deleted `SUPABASE_SERVICE_ROLE_KEY_CI` from `ci.yml` → now reads `SUPABASE_SERVICE_ROLE_KEY`
4. Fixed `guards.ts` dual-check anti-pattern → single guard on `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Removed stale `_CI` secret references from error messages in `admin.ts` and `adminClient.js`

⚠️ **Action required (manual — cannot be done in code):**
Once this PR is merged and CI is green, delete these 3 secrets from GitHub repo settings:
- `SUPABASE_URL_CI`
- `SUPABASE_ANON_KEY_CI`
- `SUPABASE_SERVICE_ROLE_KEY_CI`

**Do not delete them before CI confirms green** — if something regresses mid-merge, you want the option to roll back.

⏳ **Future (separate PR, not urgent):**
- Consolidate `SUPABASE_URL` server-alias usage — `admin.ts` fallback chain `NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL` is acceptable for now
- Collapse `SUPABASE_ANON_KEY` server alias if all consumer paths migrate to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
