# 72-Hour Sprint: START HERE

**Save this file. Read it when you wake up on Day 1.**

---

## 📍 You Are Here

✅ System is **governance-complete** and **technically correct**
- 98 Jest tests passing
- CI Canon Guard passing
- Supabase boundary locked
- No open loops

❌ System is **not yet market-proven**
- 0 agents using it
- 0 real evaluation runs
- 0 customer feedback

---

## 🎯 Mission (72 Hours)

Move from "correct system" → "agents using it" → "evidence of market demand"

**Win condition:** 3+ agents using the portal, 1+ says "I'd pay for this"

---

## 📅 The Plan

### DAY 1 (6 hours)

**Hours 0–1: Verify System**
```bash
bash scripts/pre-work-checklist.sh
bash scripts/verify-canon-schema.sh
npm run dev
```
✅ System online.

**Hours 1–6: Real Evaluations Proof**
- Run 10–15 real evaluations against actual manuscripts/screenplays
- Capture timing: target < 5 min per eval
- Verify gates working correctly
- Create evidence file: `docs/PHASE1-EVALUATION-PROOF.md`

**📊 Success metric:** 15 evaluations done, avg < 5 min, 0 errors

---

### DAY 2 (8 hours)

**Hours 7–14: Build Minimal Agent Portal**

**Files to create:**
1. `hooks/useAgentAuth.ts` (auth management)
2. `components/agent/AgentLogin.tsx` (login form)
3. `components/agent/AgentDashboard.tsx` (results display)
4. `app/agent/page.tsx` (main portal page)
5. `app/api/agent/validate-key/route.ts` (auth endpoint)
6. `app/api/agent/submissions/route.ts` (get user's evals)

**Copy all code from:** `72-HOUR-SPRINT-QUICK-START.md` (in this repo)

**Deploy to:** `https://revisiongrade.vercel.app/agent`

**📊 Success metric:** Portal live, login works, dashboard displays scores

---

### DAY 3 (4 hours)

**Hours 15–18: Invite Agents & Capture Signal**

**Action items:**
1. Email 5 agents with unique API keys (template in quick-start guide)
2. Set up feedback form (simple textarea in dashboard)
3. Monitor who logs in: `supabase query "SELECT * FROM agent_telemetry"`
4. Read feedback emails

**📊 Success metric:** 3+ agents logged in, 1+ sent feedback

---

## 🚨 CRITICAL: What NOT to Do

❌ Fix JobPhaseDetail nullability (it works, ship it)
❌ Add fancy UI (function > form)
❌ Build perfect auth (basic API key is fine)
❌ Write more tests (98 passing is enough)
❌ Polish documentation (you have plenty)
❌ Build observability dashboards (Phase 2 only)
❌ Expand endpoints (keep scope tiny)

---

## 📖 Reference Docs (In This Repo)

- `72-HOUR-SPRINT.md` - Full detailed plan with all code snippets
- `72-HOUR-SPRINT-QUICK-START.md` - Copy-paste ready code + templates
- `STRATEGIC-ALIGNMENT-72HR.md` - Why this matters strategically

---

## 🏁 Done = Success

By end of Day 3:

- ✅ Quantified proof the system works (15 evals, < 5 min avg)
- ✅ Agents have a place to see results (working portal)
- ✅ Real agent feedback in hand (emails + telemetry)
- ✅ Market signal captured (1+ "I'd pay" response)

**This is your competitive advantage: data + user relationships, not just code.**

---

## ⏭️ What's Next (After This Sprint)

**Week 2:** Formally close Phase-1 with exit tests + closure record
**Week 3:** Build Phase-2 observability (read-only dashboards)
**Week 4:** Run calibration on gold set (make "95% confident" mean 95%)
**Weeks 5–6:** Scale agents, wire StoryGate eligibility, market proof

---

## 🎬 GO

Open a terminal. Run:
```bash
bash scripts/pre-work-checklist.sh
```

Then read `72-HOUR-SPRINT-QUICK-START.md` for copy-paste code.

You've got this. 🚀

