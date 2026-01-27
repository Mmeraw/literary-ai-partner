# RevisionGrade: 72-Hour Sprint Plan (Jan 27–30, 2026)

**Goal:** Move from "system proven correct" → "agents using it" → "market proof in hand"

**Win condition:** 3–5 agents have used the system, provided feedback, and shown signal that they'd pay.

---

## ✅ PRE-SPRINT CHECKLIST (Hour 0 — 15 minutes)

### Day 1, Hour 0: System Verification

```bash
# Step 1: Verify system is in known-good state
bash scripts/pre-work-checklist.sh
bash scripts/verify-canon-schema.sh
bash scripts/verify-supabase-project.sh

# Step 2: Start dev server
npm run dev

# Expected output:
# ✅ Supabase Project Configuration ✅
#    Environment: PRODUCTION
#    Project ID: xtumxjnzdswuumndcbwc
#    ✅ Production database active
```

**✅ System is live and ready**

---

## PHASE 1: BUILD PROOF (Hours 1–6, ~6 hours)

### Goal
Generate **real evaluation runs** with timing, quality, and evidence artifacts.
This is your data advantage over competitors.

### What You're Doing
- Running 10–15 real evaluations against actual manuscripts/screenplays
- Capturing:
  - **Speed**: How long does a full evaluation take? (target: < 5 min)
  - **Quality**: Do the gates catch what you expect?
  - **Coverage**: Did matrixPreflight enforce all paths?

### Exact Steps

#### 1a. Preparation (30 min)
**File:** Create `tests/phase1-real-evaluations.ts` (test script)

```typescript
// Pseudo-code; adapt to your exact API
import { evaluateFullManuscript } from '@/app/api/evaluate';

const testCases = [
  {
    projectId: 'test-project-1',
    manuscriptId: 'ms-literary-fiction-1',
    title: 'The Inheritance',
    type: 'manuscript',
    wordCount: 85000,
    expectedGates: ['coverage', 'integrity', 'eligibility'],
  },
  {
    projectId: 'test-project-2',
    manuscriptId: 'sp-screenplay-1',
    title: 'Chase Scene – Action',
    type: 'screenplay',
    pageCount: 12,
    expectedGates: ['coverage', 'integrity', 'eligibility'],
  },
  // ... 13 more cases, varying work types + sizes
];

export async function runPhase1EvaluationProof() {
  const results = [];
  
  for (const testCase of testCases) {
    const startTime = Date.now();
    
    const result = await evaluateFullManuscript({
      projectId: testCase.projectId,
      manuscriptId: testCase.manuscriptId,
      workType: testCase.type,
      // ... rest of payload
    });
    
    const duration = Date.now() - startTime;
    
    results.push({
      testCase,
      duration,
      gatesPassed: result.gates.filter(g => g.status === 'pass').length,
      eligibility: result.eligibility,
      timestamp: new Date().toISOString(),
    });
  }
  
  return results;
}
```

#### 1b. Execute Evaluations (5 hours)
**Command:**
```bash
# Run the proof script
npm run test -- tests/phase1-real-evaluations.ts --runInBand

# Or use your existing smoke test script and extend it:
npm run jobs:smoke:real
```

**Capture output:**
```bash
npm run jobs:smoke:real > evaluation-proof-run-1.txt 2>&1
```

#### 1c. Archive Evidence (30 min)
**Create:** `docs/PHASE1-EVALUATION-PROOF.md`

```markdown
# Phase 1 Evaluation Proof (Jan 27, 2026)

## Summary
- Evaluations run: 15
- Average speed: 3.2 minutes per full evaluation
- Gate pass rate: 93% (14/15)
- Coverage failures: 1 (expected — edge case in screenplay formatting)

## Evidence
- Run timestamp: 2026-01-27T14:32:00Z
- Commit: (your current commit hash)
- Raw logs: [evaluation-proof-run-1.txt](../evaluation-proof-run-1.txt)

## Key Finding
Speed is sub-5-minute across all work types.
This is competitive.
```

**Result:** You now have proof that the system works, is fast, and enforces gates.

---

## PHASE 2: BUILD AGENT SURFACE (Hours 7–14, ~8 hours)

### Goal
Create a minimal agent portal so agents can:
1. Log in (or paste an API key)
2. See their manuscript queue
3. View evaluation results
4. Download feedback

### Why This Matters
Agents need to **see** value before they'll commit. Screenshots beat pitches.

### Exact Steps

#### 2a. Agent Portal Scaffold (2 hours)
**Create:** `app/agent/page.tsx` and supporting routes

```typescript
// app/agent/page.tsx (minimal)
'use client';

import { useAgentAuth } from '@/hooks/useAgentAuth';
import { AgentDashboard } from '@/components/agent/AgentDashboard';
import { AgentLogin } from '@/components/agent/AgentLogin';

export default function AgentPortal() {
  const { agentId, isLoading } = useAgentAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!agentId) return <AgentLogin />;

  return <AgentDashboard agentId={agentId} />;
}
```

**Create:** `components/agent/AgentDashboard.tsx`

```typescript
// Minimal dashboard showing:
// 1. Welcome message
// 2. List of submitted manuscripts (with status)
// 3. Latest evaluation result (score + top 3 criteria)
// 4. Download button for full feedback

export async function AgentDashboard({ agentId }) {
  const submissions = await getAgentSubmissions(agentId);
  
  return (
    <div className="p-8">
      <h1>Your Manuscripts</h1>
      {submissions.map(sub => (
        <div key={sub.id} className="border p-4 mb-4">
          <h2>{sub.title}</h2>
          <p>Status: {sub.status}</p>
          {sub.latestEvaluation && (
            <>
              <p>Score: {sub.latestEvaluation.score}/100</p>
              <p>Key strengths:</p>
              <ul>
                {sub.latestEvaluation.topCriteria.map(c => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
              <button>Download Full Feedback</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### 2b. API Route for Agent Results (2 hours)
**Create:** `app/api/agent/submissions/route.ts`

```typescript
// GET /api/agent/submissions?agentId=...
// Returns: { submissions: [...], latest_eval: {...} }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  // Query: get latest 5 manuscripts + latest evaluation per manuscript
  const submissions = await supabase
    .from('agent_manuscripts')
    .select(
      `
      id,
      title,
      status,
      created_at,
      evaluation_runs!inner (
        id,
        status,
        criteria_scores,
        gates
      )
    `
    )
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(5);

  return Response.json(submissions);
}
```

#### 2c. Auth & Session (2 hours)
**Minimal approach:** Basic auth or API key auth (skip JWT complexity for now)

```typescript
// hooks/useAgentAuth.ts
export function useAgentAuth() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for API key
    const key = localStorage.getItem('agent_api_key');
    if (key) {
      // Validate key against backend
      validateAgentKey(key).then(id => {
        setAgentId(id);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  return { agentId, isLoading };
}
```

#### 2d. Polish & Deploy (2 hours)
- Add a simple CSS theme (use Tailwind, keep it minimal)
- Test on phone (agents will use on mobile)
- Deploy to `https://revisiongrade.vercel.app/agent` (or similar)

**Result:** Live agent portal. Agents can log in and see their results.

---

## PHASE 3: INVITE AGENTS & CAPTURE SIGNAL (Hours 15–18, ~4 hours)

### Goal
Get 3–5 agents using the system. Observe:
1. Do they find the portal intuitive?
2. Do they find the feedback useful?
3. Would they pay?

### Exact Steps

#### 3a. Agent Outreach (1 hour)
**Email template:**

```
Subject: Free RevisionGrade Evaluation — Your Work (No Cost)

Hi [Agent Name],

I've been building an AI evaluation tool for manuscripts and screenplays. I'd love to get your feedback.

You'll get:
- One free evaluation (normally $X)
- Speed: results in < 5 minutes
- Specific feedback on structure, pacing, character arc, dialogue quality
- A score and gate assessment (would this book/script be competitive?)

Free access here: https://revisiongrade.vercel.app/agent
API Key: [key]

No credit card. No long-term commitment. Just 15 minutes to try it on one of your manuscripts.

After you run it, I'd love to chat:
- Was the feedback useful?
- Was it fast?
- Would you use this again?

Reply to this email and let me know what you think.

Thanks,
[Your name]
```

#### 3b. Logging & Monitoring (1 hour)
**Add:** Telemetry to track agent behavior

```typescript
// In your AgentDashboard component:
// - Log when they view results
// - Log when they download feedback
// - Log time spent on page
// - Optional: Analytics events

export async function logAgentEvent(agentId, event, metadata) {
  await supabase
    .from('agent_telemetry')
    .insert({
      agent_id: agentId,
      event,
      metadata,
      timestamp: new Date().toISOString(),
    });
}
```

#### 3c. Feedback Collection (1 hour)
**Add:** Simple feedback form at bottom of dashboard

```typescript
export function FeedbackForm({ agentId }) {
  const [feedback, setFeedback] = useState('');
  
  return (
    <form onSubmit={e => {
      e.preventDefault();
      logAgentEvent(agentId, 'feedback_submitted', { text: feedback });
      alert('Thanks! Your feedback helps us improve.');
    }}>
      <label>Would you use this again?</label>
      <textarea value={feedback} onChange={e => setFeedback(e.target.value)} />
      <button type="submit">Send Feedback</button>
    </form>
  );
}
```

#### 3d. Monitor & Iterate (1 hour)
**Daily check:**
```bash
# See who's using it
supabase --function query "SELECT agent_id, event, COUNT(*) FROM agent_telemetry GROUP BY agent_id, event ORDER BY COUNT(*) DESC"

# Read incoming feedback emails
```

**Result:** Real agents are using the system. You have feedback and usage data.

---

## 📊 METRICS TO CAPTURE

### Phase 1 Success = Speed + Coverage
- ✅ Average evaluation time < 5 minutes
- ✅ Gate pass rate > 90%
- ✅ Zero ungoverned outputs

### Phase 2 Success = Portal Works
- ✅ Portal loads in < 3 seconds
- ✅ Agents can view results in < 10 clicks
- ✅ Download works without errors

### Phase 3 Success = Agents Engage
- ✅ 3+ agents have tried it
- ✅ Average session time > 5 minutes (they're exploring)
- ✅ At least 1 agent says "I'd pay for this"

---

## 🚨 WHAT TO SKIP (DO NOT DO)

❌ Perfect auth system (basic is fine)
❌ Fancy UI polish (function > form for now)
❌ More tests (you have 98 passing)
❌ More documentation (you're drowning in it)
❌ JobPhaseDetail nullability fix (it works, ship it)
❌ Analytics / observability dashboards (Phase 2 only)
❌ Agent onboarding flows (do it manually for now)

---

## 📅 TIMELINE (72 hours)

| Phase | Hours | Task | Deliverable |
|-------|-------|------|-------------|
| 0 | 0-0.25 | System verification | ✅ Dev server running |
| 1 | 1-6 | Real evaluations | `PHASE1-EVALUATION-PROOF.md` + logs |
| 2 | 7-14 | Agent portal | Live URL (`/agent`) |
| 3 | 15-18 | Agent invites + feedback | Email log + telemetry data |
| Buffer | 18+ | Iterate / fix bugs | Refinement as needed |

---

## 🎯 SUCCESS OUTCOME (End of Sprint)

By Jan 30 EOD:
1. ✅ You have **quantified proof** that the system works (15 real evaluations, < 5 min avg)
2. ✅ Agents have **a place to see results** (working portal)
3. ✅ You have **real agent feedback** (emails + telemetry)
4. ✅ You know **who might pay** (at least 1 agent signal)

This is your **competitive moat**: not code, but **data + user relationships**.

---

## 🚀 AFTER THE SPRINT (Next Week)

Once agents have used it:
- Pick top 2–3 feedback themes and fix them (quick iterations)
- Add 5 more agents
- Start calibration work (Phase 3 formally)
- Begin "Results UI governed-first" alignment

You've now moved from "correct system" to "proven market fit."

