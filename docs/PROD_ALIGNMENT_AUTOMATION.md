# Production Alignment Automation

This repository now includes a hardened alignment workflow:

- Workflow: `.github/workflows/prod-alignment-guard.yml`
- Triggers: `push` to `main`, scheduled every 15 minutes, and manual dispatch.

## What it enforces

1. **Vercel production alias must match `origin/main` SHA**
   - Resolves current alias deployment.
   - Reads deployment metadata from Vercel API.
   - Fails if production alias does not converge to `origin/main` within timeout.

2. **Supabase production schema must match repo migrations**
   - Applies migrations (`supabase db push --linked --include-all`) to linked production project.
   - Verifies migration ID parity between local `supabase/migrations` and remote linked DB.
   - Fails on either direction of drift:
     - repo migration missing in production
     - remote-only migration missing from repo

## Required GitHub Secrets

### Vercel

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_PROD_ALIAS` (example: `literary-ai-partner.vercel.app`)

### Supabase production

- `SUPABASE_ACCESS_TOKEN`
- `PROD_SUPABASE_PROJECT_REF`
- `PROD_SUPABASE_DB_URL`
- `PROD_SUPABASE_DB_PASSWORD` (optional if derivable from `PROD_SUPABASE_DB_URL`)

## Environment protection recommendation

Set the `production` GitHub Environment with:

- required reviewers
- branch restrictions (`main`)
- scoped secret access

This prevents unreviewed schema-changing automation while preserving deterministic alignment checks.

## Operational note

No pipeline can guarantee absolute "100% mistake-proof" behavior under all external failures.
This workflow is designed to be **fail-closed** and to surface drift quickly with explicit blocking errors.
