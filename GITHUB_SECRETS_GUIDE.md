# GitHub Secrets Configuration Guide

## ✅ Currently Configured (Verified)
1. **SUPABASE_URL** = `https://xtumxjnzdswuumndcbwc.supabase.co` ✅
2. **SUPABASE_SERVICE_ROLE_KEY** = `[your service_role JWT]` ✅

## ❌ Missing Secrets (Required for CI)

Based on `.github/workflows/phase2d-evidence.yml` lines 52-56, you need 3 additional secrets:

### 1. SUPABASE_ANON_KEY
**Where to get it**:
- Go to: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/settings/api
- Look for **"anon" or "public"** key (NOT service_role)
- It starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...`

**Add to GitHub**:
- Name: `SUPABASE_ANON_KEY`
- Value: `[paste your anon key from Supabase dashboard]`

### 2. NEXT_PUBLIC_SUPABASE_URL
This is the same as your SUPABASE_URL (public-facing).

**Add to GitHub**:
- Name: `NEXT_PUBLIC_SUPABASE_URL`
- Value: `https://xtumxjnzdswuumndcbwc.supabase.co`

### 3. NEXT_PUBLIC_SUPABASE_ANON_KEY
This is the same as your SUPABASE_ANON_KEY (public-facing).

**Add to GitHub**:
- Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Value: `[same anon key as #1 above]`

## 🔧 Quick Add via GitHub UI

1. Open: https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions/new

2. Add these three secrets (one at a time):

   **Secret 1**:
   ```
   Name: SUPABASE_ANON_KEY
   Value: [Get from Supabase Dashboard → RevisionGrade Production → Settings → API → anon public key]
   ```

   **Secret 2**:
   ```
   Name: NEXT_PUBLIC_SUPABASE_URL
   Value: https://xtumxjnzdswuumndcbwc.supabase.co
   ```

   **Secret 3**:
   ```
   Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: [Same anon key from Secret 1]
   ```

## 🎯 Why These Are Needed

Looking at the workflow requirements:
```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}                           # ✅ Already set
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}  # ❌ Missing
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }} # ✅ Already set
  SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}                # ❌ Missing
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }} # ❌ Missing
```

The tests create a Supabase client which validates the URL format. Without these env vars, the client initialization fails with:
```
Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.
```

## 📋 After Adding Secrets

1. **Re-run the failed workflow**:
   ```bash
   gh run rerun 21457791546
   ```
   Or push a new commit:
   ```bash
   git commit --allow-empty -m "Trigger CI after configuring secrets"
   git push origin main
   ```

2. **Verify no keys leaked**:
   ```bash
   cd /workspaces/literary-ai-partner
   git grep -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJ" -- . ':!scripts/run-phase2d3-local.sh' ':!scripts/worker-start.sh' || echo "✅ No production keys found in git"
   ```
   Note: The excluded files contain only LOCAL dev keys (supabase-demo), not production keys.

## 🔒 Security Notes

- **Anon key is safe to expose**: It's used in client-side code and has Row Level Security (RLS) protection
- **Service role key must stay secret**: Never expose in client code or commit to git
- All production tables have RLS enabled (see `docs/SUPABASE_PROJECTS.md`)

## 📚 Reference

- Production project: **RevisionGrade Production** (`xtumxjnzdswuumndcbwc`)
- API keys location: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/settings/api
- Full docs: [docs/SUPABASE_PROJECTS.md](./docs/SUPABASE_PROJECTS.md)
