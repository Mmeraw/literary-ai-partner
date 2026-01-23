# Staging Test Environment

These tests require a real Supabase project (staging) and a service role key.

## Files

- .env.test.local (NOT committed): real secrets
- .env.test.example (committed): template only

## Required variables

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>

## Run

npm run test:staging:chunks
npm run test:staging

## Common failure

If you run with SUPABASE_URL="..." you will get:
"Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL."
Use .env.test.local + npm run test:staging instead.
