# Quick Start Guide

> **💻 Using GitHub Codespaces?** See [CODESPACES_SETUP.md](./CODESPACES_SETUP.md) for automatic setup with GitHub Copilot AI assistant.

## 🚀 First-Time Setup

### 1. Verify Supabase Configuration (CRITICAL)
```bash
# Check which project you're using
bash scripts/verify-supabase-project.sh
```

Expected output:
```
✅ CORRECT: You are using PRODUCTION
   Project: RevisionGrade Production
```

If you see ⚠️ warnings, **STOP** and fix your .env.local file before continuing.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

Look for this startup message:
```
✅ Supabase Project Configuration ✅
   Environment: PRODUCTION
   Project ID: xtumxjnzdswuumndcbwc
   ✅ Production database active
```

### 4. Access the App
- Frontend: http://localhost:3000
- API: http://localhost:3000/api

## 🛡️ Safety Checks

### Daily Pre-Work Checklist
1. ✅ Verify project: `bash scripts/verify-supabase-project.sh`
2. ✅ Check git branch: `git branch --show-current`
3. ✅ Pull latest: `git pull origin main`
4. ✅ Start dev server: `npm run dev`

### When Returning After Time Away
Run the full verification:
```bash
# Check which project
bash scripts/verify-supabase-project.sh

# Check remote migrations
bash scripts/verify-remote-migration.sh

# Run tests
npm test
```

## 📁 Project Structure

### Critical Files
- `.env.local` - Your local environment config (MUST point to production)
- `docs/JOB_CONTRACT_v1.md` - Canonical job state machine contract
- `docs/SUPABASE_PROJECTS.md` - Detailed project configuration guide
- `lib/supabase/projectGuard.ts` - Runtime safety guard

### Supabase Projects
- **Production**: `xtumxjnzdswuumndcbwc` (RevisionGrade Production) ← YOUR CODE USES THIS
- **Testing**: `ngfszuqjoyixmtlbthyv` (⚠️ TESTING ONLY - DO NOT USE) ← NEVER USE

## 🔧 Common Tasks

### Run Tests
```bash
# All tests
npm test

# Specific test
npm test -- jobStore.test.ts
```

### Check Job Status
```bash
# Get all jobs
curl http://localhost:3000/api/jobs

# Get specific job
curl http://localhost:3000/api/jobs/{job-id}
```

### Verify Migrations
```bash
bash scripts/verify-remote-migration.sh
```

### Deploy to Vercel
```bash
git push origin main
# Vercel auto-deploys from main branch
```

## 🚨 Emergency Procedures

### Wrong Supabase Project Error
```
❌ CRITICAL ERROR: TESTING DATABASE DETECTED!
```

**Fix**:
1. Open `.env.local`
2. Update:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[get from Supabase Dashboard → RevisionGrade Production → Settings → API]
   ```
3. Restart dev server: `npm run dev`

### Migration Not Found
**Symptom**: `verify-remote-migration.sh` says migration not applied

**Cause**: You ran it in testing project, but code uses production

**Fix**:
1. Go to Supabase Dashboard → RevisionGrade Production
2. Navigate to SQL Editor
3. Run the migration SQL
4. Verify: `bash scripts/verify-remote-migration.sh`

### Tests Failing
```bash
# 1. Check you're on production project
bash scripts/verify-supabase-project.sh

# 2. Check environment
echo $NODE_ENV

# 3. Run with verbose output
npm test -- --verbose
```

## 📚 Documentation Index

- **[SUPABASE_PROJECTS.md](./SUPABASE_PROJECTS.md)** - Complete project configuration
- **[JOB_CONTRACT_v1.md](./JOB_CONTRACT_v1.md)** - Job state machine rules
- **[DEPLOYMENT_QUICK_REFERENCE.md](../DEPLOYMENT_QUICK_REFERENCE.md)** - Deployment guide
- **[README.md](../README.md)** - Main project documentation

## 🎯 What Makes This Project Error-Proof

1. **Project Guard**: Runtime checks prevent wrong database usage
2. **Verification Scripts**: Easy-to-run checks before any work
3. **Clear Naming**: ⚠️ TESTING ONLY label impossible to miss
4. **RLS Security**: All production tables protected
5. **Automated Checks**: Vercel, CI/CD all point to production

## ✅ Success Indicators

You'll know everything is working when:
- ✅ `verify-supabase-project.sh` shows "CORRECT: You are using PRODUCTION"
- ✅ Dev server starts with "Production database active" message
- ✅ Tests pass: `npm test`
- ✅ Migrations verify: `bash scripts/verify-remote-migration.sh`
- ✅ Vercel deployments succeed

---

**Last Updated**: January 27, 2026  
**Status**: ✅ Production-ready and error-proof
