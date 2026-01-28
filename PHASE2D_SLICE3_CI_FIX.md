# Phase 2D Slice 3 CI Fix

## Root Cause
CI is failing with "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL" because GitHub Actions secrets are not configured.

## Production Project
- **Project ref**: `xtumxjnzdswuumndcbwc`
- **URL**: `https://xtumxjnzdswuumndcbwc.supabase.co`

## Required GitHub Secrets

Go to: https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions

Add these secrets:

### 1. SUPABASE_URL
```
https://xtumxjnzdswuumndcbwc.supabase.co
```

### 2. SUPABASE_SERVICE_ROLE_KEY
Get from: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/settings/api
- Copy the "service_role" key (starts with `eyJ...`)

### 3. NEXT_PUBLIC_SUPABASE_URL (optional but recommended)
```
https://xtumxjnzdswuumndcbwc.supabase.co
```

### 4. SUPABASE_ANON_KEY (optional)
Get from same API page, copy the "anon" / "public" key

### 5. NEXT_PUBLIC_SUPABASE_ANON_KEY (optional)
Same as SUPABASE_ANON_KEY

## After Adding Secrets

Re-run the failed workflow:
```bash
gh run rerun 21457791546
```

Or push a new commit:
```bash
git commit --allow-empty -m "Trigger CI with secrets configured"
git push origin main
```

## Local Testing (Optional)

To test locally against production Supabase:

```bash
# Get keys from: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/settings/api
export SUPABASE_URL="https://xtumxjnzdswuumndcbwc.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<your_service_role_key>"

bash scripts/evidence-phase2d.sh
```

## Evidence Script Improvements

Added URL validation in `scripts/evidence-phase2d.sh`:
- Now fails fast with clear error if URL is missing or invalid
- Shows actual URL format issue instead of letting supabase-js throw generic error

## Node Version Note

Local: v24.11.1  
CI: v20.20.0

This shouldn't cause issues, but for exact parity:
```bash
nvm install 20
nvm use 20
```
