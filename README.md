# RevisionGrade - Literary AI Partner

## 🎯 Quick Start

### 🚀 NEXT 72 HOURS: Build Agent Proof
**Start here:** [72HR-INDEX.md](./72HR-INDEX.md) — Complete sprint documentation hub

Then choose your entry point:
- **Quick action plan:** [START-HERE-72HR.md](./START-HERE-72HR.md)
- **Copy-paste code:** [72-HOUR-SPRINT-QUICK-START.md](./72-HOUR-SPRINT-QUICK-START.md)
- **Full context:** [72-HOUR-SPRINT.md](./72-HOUR-SPRINT.md)
- **Executive summary:** [72HR-EXECUTIVE-SUMMARY.md](./72HR-EXECUTIVE-SUMMARY.md)

### ⚠️ First Time Setup
**Start here:** [docs/QUICK_START.md](./docs/QUICK_START.md)

### 💻 GitHub Codespaces
**Using Codespaces?** See [docs/CODESPACES_SETUP.md](./docs/CODESPACES_SETUP.md) for:
- Enabling GitHub Copilot AI assistant
- Automatic development environment setup
- Codespace-specific configuration

### Daily Workflow
```bash
# 1. Verify configuration (CRITICAL - do this daily!)
bash scripts/verify-supabase-project.sh

# 2. Start development
npm run dev
```

## 🔒 Supabase Configuration

### Production Project (Active)
- **Name**: RevisionGrade Production
- **Project ID**: `xtumxjnzdswuumndcbwc`
- **Status**: ✅ ALL CODE POINTS HERE
- **Used By**: Local dev, Vercel, CI/CD

**Full Details**: [docs/SUPABASE_PROJECTS.md](./docs/SUPABASE_PROJECTS.md)

## 📋 Prerequisites

1. Clone the repository using the project's Git URL
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file with production credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[from Supabase Dashboard → RevisionGrade Production → Settings → API]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[from same location]
USE_SUPABASE_JOBS=true
ALLOW_HEADER_USER_ID=true
```

## 🛡️ Safety Features

### Automatic Guards
- ✅ **Project Guard**: Prevents accidental use of testing database
- ✅ **RLS Security**: Row Level Security enabled on all production tables
- ✅ **Verification Scripts**: Check configuration before work

### Manual Checks
```bash
# Verify Supabase project
bash scripts/verify-supabase-project.sh

# Verify remote migrations
bash scripts/verify-remote-migration.sh

# Run tests
npm test
```

### Phase 2C Evidence (TypeScript Type Verification)
⚠️ **CRITICAL**: Evidence must be produced via `tsc -p <tsconfig>`, never single-file tsc.

Single-file TypeScript compilation bypasses project configuration and surfaces spurious errors (e.g., ES2018 private field errors in ES2020+ code).

```bash
# ✅ CANONICAL (use this for evidence)
npm run evidence:phase2c

# ❌ WRONG (surfaces TS18028 errors, not in actual build)
npx tsc --noEmit workers/phase2Evaluation.ts
```

See [docs/PERSISTENCE_CONTRACT.md](./docs/PERSISTENCE_CONTRACT.md) for Phase 2C contract.

## 📚 Documentation

- **[QUICK_START.md](./docs/QUICK_START.md)** - First-time setup and daily workflow
- **[CODESPACES_SETUP.md](./docs/CODESPACES_SETUP.md)** - GitHub Codespaces and Copilot setup
- **[SUPABASE_PROJECTS.md](./docs/SUPABASE_PROJECTS.md)** - Complete Supabase configuration
- **[JOB_CONTRACT_v1.md](./docs/JOB_CONTRACT_v1.md)** - Canonical job state machine contract
- **[DEPLOYMENT_QUICK_REFERENCE.md](./DEPLOYMENT_QUICK_REFERENCE.md)** - Deployment guide

## 🚀 Deployment

### Vercel (Automatic)
```bash
git push origin main
# Vercel auto-deploys from main branch
# ✅ Already configured to use Production project
```

### Base44 (Manual Publish)
Open [Base44.com](http://Base44.com) and click Publish.

## 🔧 Development

### Run Development Server
```bash
npm run dev
```

Expected startup message:
```
✅ Supabase Project Configuration ✅
   Environment: PRODUCTION
   Project ID: xtumxjnzdswuumndcbwc
   ✅ Production database active
```

### Run Tests
```bash
npm test                     # All tests
npm test -- jobStore.test.ts # Specific test
```

## 🚨 Troubleshooting

### Wrong Supabase Project Error
If you see: `❌ CRITICAL ERROR: TESTING DATABASE DETECTED!`

**Fix**: Update `.env.local` to use production URL (see Prerequisites above)

### Migration Not Found
If `verify-remote-migration.sh` fails:

1. Go to Supabase Dashboard → **RevisionGrade Production** (not testing!)
2. SQL Editor → Run your migration
3. Rerun: `bash scripts/verify-remote-migration.sh`

### Full Troubleshooting
See [docs/QUICK_START.md](./docs/QUICK_START.md#-emergency-procedures)

## 📞 Support

- **Documentation**: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)
- **Support**: [https://app.base44.com/support](https://app.base44.com/support)

---

**⚠️ CRITICAL**: Always verify you're using the **Production** project before starting work!

```bash
bash scripts/verify-supabase-project.sh
```

**Last Updated**: January 27, 2026  
**Status**: ✅ Error-proof and production-ready
