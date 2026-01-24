# Staging Test Environment

These tests require a real Supabase project (staging) and a service role key.

## Files

- `.env.test.local` (gitignored): real secrets for staging tests
- `.env.test.example` (committed): template showing required variables

## Setup

1. Copy the template:
   ```bash
   cp .env.test.example .env.test.local
   ```

2. Fill in real values in `.env.test.local`:
   ```bash
   SUPABASE_URL=https://ngfszuqjoyixmtlbthyv.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Run Tests

```bash
npm run test:staging:chunks  # Run stability tests only
npm run test:staging         # Run all tests against staging
```

**How it works:** The npm scripts use `DOTENV_CONFIG_PATH=.env.test.local node -r dotenv/config` to load environment variables from `.env.test.local` before running Jest.

## Troubleshooting

**Tests fail with "TypeError: fetch failed"**
- Your `.env.test.local` may not exist or have placeholder values
- Verify: `cat .env.test.local` should show real credentials

**"Invalid supabaseUrl" error**
- Don't pass credentials via command-line strings: `export SUPABASE_URL="..."` 
- Always use npm scripts which load `.env.test.local` automatically
