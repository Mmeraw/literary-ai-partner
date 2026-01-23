# Production Secrets & Staging Deploy Guide

## Overview

This document covers the complete flow for secrets configuration and deployment to staging/production, enforcing the discipline:
- No silent fallback to anon keys for writes
- All server-side operations use `SUPABASE_SERVICE_ROLE_KEY`
- Staging smoke runbook validates before production promotion

---

## Secrets Configuration

### Local Development (.env.local)

Your `.env.local` is already correctly configured with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...  # Safe to expose (subject to RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJh...       # ⚠️  NEVER commit or expose in browser
USE_SUPABASE_JOBS=true
```

**Important:**
- `.env.local` is listed in `.gitignore` (never committed)
- `SUPABASE_SERVICE_ROLE_KEY` is loaded server-side only in:
  - API routes (`app/api/**/*.ts`)
  - Server-side functions (`lib/supabase.js`, `lib/manuscripts/chunks.ts`)
  - Background jobs (`lib/jobs/**/*.ts`)

### Verifying Secrets Are Not Silently Falling Back

The codebase has built-in protections:

**1. Explicit Warning if Anon is Used:**
```javascript
// lib/supabase.js
export function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("[RG-SUPABASE] Using ANON key for admin client - RLS will block writes. Set SUPABASE_SERVICE_ROLE_KEY.");
    }
    supabaseAdminClient = createClient(SUPABASE_URL ?? "", key ?? "");
  }
  return supabaseAdminClient;
}
```

**2. All Write Paths Use Admin Client + RPC:**
```typescript
// lib/manuscripts/chunks.ts
import { getSupabaseAdminClient } from "@/lib/supabase";
const supabase = getSupabaseAdminClient();  // Enforced at module level

export async function claimChunkForProcessing(chunkId: string): Promise<boolean> {
  // Preferred: Use RPC (atomic, safe)
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "claim_chunk_for_processing",
    { chunk_id: chunkId }
  );
  // Fallback: Use optimistic locking if RPC unavailable
  ...
}
```

**3. Phase 1 Processing Requires Service Role:**
```typescript
// lib/jobs/phase1.ts
const claimed = await claimChunkForProcessing(chunk.id, 3);
// This will fail with RLS error if only ANON_KEY is available
```

---

## Deployment to Staging / Production

### Step 1: Configure Vercel Environment Variables

In **Vercel Dashboard** → Project Settings → Environment Variables, add:

**For Staging:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...  (same as local, safe to expose)
SUPABASE_SERVICE_ROLE_KEY=eyJh...      (different secret, staging project)
NODE_ENV=production
USE_SUPABASE_JOBS=true
```

**For Production:**
```
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...  (prod anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJh...      (prod service role key)
NODE_ENV=production
USE_SUPABASE_JOBS=true
```

### Step 2: Verify Staging Database Schema

Staging Supabase must have the complete schema. Check:

```bash
# Verify migrations are applied
supabase migration list --project-ref $STAGING_PROJECT_ID

# Expected output should include:
#   20260122000000 (manuscript_chunks table)
#   20260122000001 (claim_chunk_for_processing RPC)
#   20260122051139 (resume/retry fields)
```

### Step 3: Run Staging Smoke Runbook

Before promoting to production, run the complete validation:

```bash
# Local testing (without pushing migrations)
bash scripts/staging-smoke-runbook.sh local

# Staging validation (pushes migrations + tests)
export SUPABASE_PROJECT_ID=staging-project-id
bash scripts/staging-smoke-runbook.sh staging

# Production validation (final check before deploy)
export SUPABASE_PROJECT_ID=prod-project-id
bash scripts/staging-smoke-runbook.sh production
```

**What the runbook validates:**
1. ✅ Migrations push successfully
2. ✅ Crash recovery for stuck chunks works
3. ✅ End-to-end manuscript processing completes
4. ✅ Output JSON is schema-compliant

---

## Migration Management

### Applying Migrations Locally

```bash
cd /workspaces/literary-ai-partner
supabase db push
```

### Applying Migrations to Remote (Staging/Prod)

```bash
# Link project (one-time setup)
supabase link --project-ref staging-project-id

# Push pending migrations
supabase db push
```

### Recent Migration Files

These files make up the production-ready job engine:

| File | Purpose |
|------|---------|
| `20260122000000_manuscript_chunks.sql` | Chunking table + `chunk_status` enum |
| `20260122000001_claim_chunk_function.sql` | Atomic RPC for chunk claiming |
| `20260122051139_add_chunk_resume_fields.sql` | Attempt tracking + crash recovery |

### Verifying Migration Expectations

After applying migrations, verify:

```sql
-- Check manuscript_chunks exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'manuscript_chunks'
ORDER BY ordinal_position;

-- Check chunk_status enum
SELECT 1 FROM pg_type WHERE typname = 'chunk_status';

-- Check RPC exists
SELECT proname FROM pg_proc WHERE proname = 'claim_chunk_for_processing';

-- Test RPC call
SELECT claim_chunk_for_processing('00000000-0000-0000-0000-000000000000'::uuid);
```

---

## Monitoring & Troubleshooting

### Issue: Writes Blocked with RLS Error

**Symptom:**
```
PostgrestError: [PGRST005] [permission denied] [new row violates row-level security policy]
```

**Cause:** Using ANON_KEY instead of SERVICE_ROLE_KEY

**Fix:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env vars
2. Check logs for warning: `[RG-SUPABASE] Using ANON key for admin client`
3. Restart/redeploy after adding the key

### Issue: Claim Fails with "Function Does Not Exist"

**Symptom:**
```
[claimChunk] RPC error: function claim_chunk_for_processing does not exist
```

**Cause:** Migration not applied to remote database

**Fix:**
```bash
supabase migration list --project-ref your-project-id  # verify status
supabase db push                                        # push if pending
```

### Issue: Stuck Chunks Not Being Recovered

**Symptom:** Chunks remain in `processing` state for >15 minutes

**Cause:** Crash recovery lease timeout not triggered or RPC claim fails

**Debug:**
```sql
-- Find stuck chunks
SELECT id, manuscript_id, status, attempt_count, processing_started_at
FROM manuscript_chunks
WHERE status = 'processing'
AND processing_started_at < now() - interval '15 minutes';

-- Manually claim one
SELECT claim_chunk_for_processing(id)
FROM manuscript_chunks
WHERE id = 'stuck-chunk-uuid';
```

---

## Phase 2: LLM Provider Factory & Finalize Logic

Once secrets/migrations/staging are solid:

1. **LLM Provider Factory:** Strict interface + deterministic fallbacks
   - Route to Claude → Fallback to GPT → Offline mode
   - Retry policy with exponential backoff

2. **Phase 2 Aggregation:** Idempotent finalize logic
   - All chunks done → run finalize RPC
   - Finalize is rerunnable (idempotent keys)
   - Schema-validated outputs before commit

3. **Continued Smoke Runbook Discipline:**
   - Add Phase 2 LLM tests to runbook
   - Validate finalized outputs
   - Keep same quality bar forever

---

## Checklist for Production Deploy

- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel env (staging + production)
- [ ] Migrations applied to both staging and production
- [ ] Staging smoke runbook passes with `exit 0`
- [ ] Crash recovery test validates stuck chunk recovery
- [ ] End-to-end test completes with valid outputs
- [ ] Logs show NO warnings about ANON key fallback
- [ ] Production secrets differ from staging (different Supabase project)
- [ ] Ready to promote ✅

---

**Last Updated:** 2026-01-22
