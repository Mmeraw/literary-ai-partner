# Supabase Projects Configuration

## 🎯 Canonical Project

### Production: RevisionGrade Production
- **Project ID**: `xtumxjnzdswuumndcbwc`
- **URL**: `https://xtumxjnzdswuumndcbwc.supabase.co`
- **Purpose**: Live production database
- **Used By**: 
  - Local development (.env.local)
  - Vercel production deployments
  - Vercel preview deployments
  - All CI/CD workflows
- **Tier**: NANO
- **Status**: ✅ ACTIVE
- **Security**: RLS enabled on all tables

## 🔒 Security Configuration

### Row Level Security (RLS)
All production tables have RLS enabled with service_role policies:

```sql
-- Enabled on:
- public.evaluation_jobs ✅
- public.manuscripts ✅
- public.evaluation_artifacts ✅

-- Service role policies allow backend access while protecting from unauthorized access
CREATE POLICY "Service role access" ON [table]
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Environment Variables

#### Production (.env.local, Vercel)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[from Supabase Dashboard → RevisionGrade Production → Settings → API]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[from same location]
```

#### Testing (.env.test) - NEVER use in production!
```bash
# ⚠️ FOR MIGRATION TESTING ONLY ⚠️
SUPABASE_URL=https://ngfszuqjoyixmtlbthyv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[from Supabase Dashboard → ⚠️ TESTING ONLY → Settings → API]
```

## 🛡️ Error-Proofing Mechanisms

### 1. Project Guard (Runtime)
Location: `lib/supabase/projectGuard.ts`

Automatically runs when creating Supabase admin clients. Will:
- ✅ Log which project is being used at startup
- ⚠️ Warn loudly if testing database detected in development
- ❌ Throw error if testing database detected in production

### 2. Verification Script
Location: `scripts/verify-supabase-project.sh`

Run anytime to verify configuration:
```bash
bash scripts/verify-supabase-project.sh
```

Expected output:
```
✅ CORRECT: You are using PRODUCTION
   Project: RevisionGrade Production
   This is the correct configuration for development and deployment.
```

### 3. Visual Warnings
- Supabase Dashboard: Testing project displays as "⚠️ TESTING ONLY - DO NOT USE"
- Impossible to miss the ⚠️ symbol
- Clear distinction from "RevisionGrade Production"

## 📋 Workflow Best Practices

### Testing Migrations
1. Test in TESTING project first:
   - Go to Supabase Dashboard → ⚠️ TESTING ONLY
   - Run migration SQL in SQL Editor
   - Verify it works
2. Apply to PRODUCTION:
   - Go to Supabase Dashboard → RevisionGrade Production
   - Run same SQL
   - Run `bash scripts/verify-remote-migration.sh` to confirm

### Daily Development
1. Always verify project on startup:
   ```bash
   bash scripts/verify-supabase-project.sh
   ```
2. Look for the startup log:
   ```
   ✅ Supabase Project Configuration ✅
      Environment: PRODUCTION
      Project ID: xtumxjnzdswuumndcbwc
      ✅ Production database active
   ```

### Vercel Deployment
- Production and Preview environments both use Production project
- Environment variables auto-configured
- No manual changes needed

## 🚨 What NOT To Do

### ❌ NEVER:
1. Point .env.local to the testing project (ngfszuqjoyixmtlbthyv)
2. Deploy to Vercel with testing project credentials
3. Disable the project guard in production
4. Rename projects back to ambiguous names
5. Delete either project without backing up data

### ⚠️ DANGEROUS:
1. Running production code against testing database
2. Testing with production API keys in public repos
3. Disabling RLS on production tables
4. Ignoring warnings from the project guard

## 📊 Current Data Distribution

### Production (xtumxjnzdswuumndcbwc)
- `evaluation_jobs`: 125+ rows (actively used)
- `manuscripts`: 56 rows
- `manuscript_chunks`: 5 rows
- Last activity: Jan 27, 2026 (TODAY)
- REST requests: 1,572+ in last 24h

### Testing (ngfszuqjoyixmtlbthyv)
- `evaluation_jobs`: 1 row (old test data)
- `manuscripts`: 612 rows (old test data)
- `manuscript_chunks`: 3,666 rows (old test data)
- Last activity: Jan 26, 2026
- REST requests: 0 in last 24h (unused)

## 🔍 Troubleshooting

### "Wrong project" Error
```
❌ CRITICAL ERROR: TESTING DATABASE DETECTED!
```

**Fix**:
1. Check .env.local:
   ```bash
   cat .env.local | grep SUPABASE_URL
   ```
2. Should show: `https://xtumxjnzdswuumndcbwc.supabase.co`
3. If wrong, update and restart:
   ```bash
   npm run dev
   ```

### Migration Doesn't Show Up
- **Cause**: You ran it in testing but code uses production
- **Fix**: Run migration in RevisionGrade Production project
- **Verify**: `bash scripts/verify-remote-migration.sh`

### Vercel Deployment Issues
1. Go to Vercel → Project → Settings → Environment Variables
2. Verify `NEXT_PUBLIC_SUPABASE_URL` shows `xtumxjnzdswuumndcbwc`
3. If wrong, update and redeploy

## 📞 Quick Reference

### Get Current Configuration
```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);"
```

### Verify Everything Is Correct
```bash
bash scripts/verify-supabase-project.sh
```

### Access Dashboards
- Production: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc
- Testing: https://supabase.com/dashboard/project/ngfszuqjoyixmtlbthyv

---

**Last Updated**: January 27, 2026  
**Status**: ✅ Error-proof and production-ready
