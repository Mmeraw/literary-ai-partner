# Canon Loader

## Default behavior

Production canon ingestion defaults to:

    pnpm tsx scripts/load-canon.ts

Which loads:

    docs/canon/registered/

## Intake loading

Intake canon is non-binding and may only be loaded with explicit opt-in:

    INTAKE_MODE=true pnpm tsx scripts/load-canon.ts ./docs/canon/intake

## Archive policy

docs/canon/archive/** must never be loaded into the production canon index.

## Required environment variables

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY

## Authority model

- docs/canon/registered/** = binding production canon
- docs/canon/intake/** = candidate / non-binding canon
- docs/canon/archive/** = provenance only

Repo = source of truth
Supabase = search index
