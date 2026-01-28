# Dev Server Runbook

**Status**: Production-grade dev stability locked as of 2026-01-27

## 🎯 The One True Way™

```bash
# Start (recommended)
./scripts/dev-server-start.sh

# Stop
./scripts/dev-server-stop.sh
```

That's it. No exceptions.

---

## ⚠️ Never Do This Again

❌ `npm run dev` (raw, no guard)  
❌ Multiple terminal tabs running servers  
❌ Background `&` without PID tracking  
❌ `CTRL+Z` (suspend) — only `CTRL+C` (terminate)  
❌ Ignoring "port already in use" errors  

---

## 🔍 Diagnostic Commands

### Check what's running
```bash
# Quick process check
ps aux | grep next

# Port binding check
lsof -i :3002
lsof -i :3111

# Health check
curl http://localhost:3111/api/health
```

### Emergency cleanup
```bash
# Nuclear option (kills all Node processes)
pkill -9 node

# Surgical option (specific port)
kill -9 $(lsof -t -i:3002)
kill -9 $(lsof -t -i:3111)

# Remove stale PID file
rm -f .dev-server.pid
```

---

## 📊 Expected Process Tree

When running correctly, `ps aux | grep next` shows:

```
npm run dev -p 3111                    # Entry point
  └─ sh -c next dev -p 3002 ...       # Shell wrapper
      └─ node .../next/dist/bin/next  # Next.js CLI
          └─ next-server (v15.5.9)    # Actual server
```

**Key facts:**
- One `next-server` process
- Bound to port `3002` (app) and `3111` (internal API)
- PID tracked in `.dev-server.pid`

---

## 🚨 Troubleshooting

### "Port already in use"
1. Check PID file: `cat .dev-server.pid`
2. Kill process: `kill $(cat .dev-server.pid)`
3. If that fails: `./scripts/dev-server-stop.sh`
4. If THAT fails: `kill -9 $(lsof -t -i:3002)`

### Server won't start
1. Check git status: `git status` (should be clean)
2. Check node_modules: `ls node_modules/.bin/next` (should exist)
3. Check Supabase: `docker ps` (should show running containers)
4. Check env vars: `grep SUPABASE .env.local`

### Tests fail after server changes
1. Stop server: `./scripts/dev-server-stop.sh`
2. Run tests: `npm test`
3. Restart: `./scripts/dev-server-start.sh`

Tests use ephemeral Supabase instance; active dev server can interfere.

---

## 🧠 Why This Matters

**Before (chaos):**
- 3 zombie Next.js processes
- Random port conflicts
- Tests fail mysteriously
- Unclear which terminal "owns" the server

**After (locked):**
- One server, one PID file, zero ambiguity
- Pre-flight checks prevent bad states
- Clean shutdown guaranteed
- Reproducible dev loop

---

## 🔐 Governance Alignment

Per `.github/copilot-instructions.md`:

> Correctness, auditability, and contract adherence are more important than convenience.

**This runbook enforces:**
- ✅ Deterministic startup/shutdown
- ✅ Observable process state (PID file)
- ✅ Fail-fast on violations (port check)
- ✅ No silent degradation

---

## 📝 Maintenance

Update this runbook when:
- Changing dev ports
- Adding new background workers
- Modifying `package.json` scripts
- Discovering new failure modes

**Last verified:** 2026-01-27  
**Test suite status:** 98/98 passing  
**Supabase status:** Local stack healthy
