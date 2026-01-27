# 🚀 ONE-COMMAND REFERENCE CARD

Copy-paste these commands when you need them:

## Daily Start
```bash
bash scripts/pre-work-checklist.sh && npm run dev
```

## Quick Verification
```bash
bash scripts/verify-supabase-project.sh
```

## Check Current Project
```bash
node -e "require('dotenv').config({path:'.env.local', debug: false}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);"
```

## Run Tests
```bash
npm test
```

## Verify Migrations
```bash
bash scripts/verify-remote-migration.sh
```

## Git Status
```bash
git status && git branch --show-current
```

---

## Supabase Projects

**Production** (USE THIS): `xtumxjnzdswuumndcbwc`  
**Testing** (DON'T USE): `ngfszuqjoyixmtlbthyv`

---

## Expected Output (All Good ✅)

```
✅ CORRECT: You are using PRODUCTION
✅ ALL CHECKS PASSED - Safe to start development!
✅ Supabase Project Configuration ✅
   Environment: PRODUCTION
   Project ID: xtumxjnzdswuumndcbwc
   ✅ Production database active
```

---

## Emergency Fix

If wrong project detected:

```bash
# Edit .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[from Supabase Dashboard]

# Then restart
npm run dev
```

---

**Full Docs**: [docs/WHEN_YOU_RETURN.md](./WHEN_YOU_RETURN.md)
