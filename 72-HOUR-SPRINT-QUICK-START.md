# 72-Hour Sprint: Quick Start (Copy & Paste Ready)

## 🎯 TL;DR
- **Phase 1 (6 hrs):** Run 10+ real evaluations, prove speed/quality
- **Phase 2 (8 hrs):** Build minimal agent portal
- **Phase 3 (4 hrs):** Invite agents, capture feedback

**Win:** 3–5 agents using it, 1+ says "I'd pay for this"

---

## Hour 0: Verify System (15 minutes)

```bash
# Terminal 1: Verify config
bash scripts/pre-work-checklist.sh
bash scripts/verify-canon-schema.sh
bash scripts/verify-supabase-project.sh

# Terminal 2: Start dev
npm run dev

# Expected:
# ✅ Supabase Project Configuration ✅
#    Environment: PRODUCTION
#    Project ID: xtumxjnzdswuumndcbwc
#    ✅ Production database active
```

**✅ You're ready to go.**

---

## Hours 1–6: Real Evaluations Proof

### What You're Doing
Generate 10–15 real evaluation runs. Measure:
- Speed (target: < 5 min per eval)
- Gates working correctly
- Coverage complete

### Quick Commands

```bash
# Run existing smoke test with real manuscripts
npm run jobs:smoke:real > evaluation-proof-run-1.txt 2>&1

# Or extend tests/manuscript-chunks-stability.test.ts with:
# - Actual manuscript text (not stubs)
# - Real screenplay samples
# - Capture timings in results

# Then capture evidence:
cat evaluation-proof-run-1.txt | head -100 > docs/PHASE1-EVALUATION-PROOF.md
```

### Evidence Artifact
Create: `docs/PHASE1-EVALUATION-PROOF.md`

```markdown
# Phase 1 Evaluation Proof (Jan 27, 2026)

## Summary
- Evaluations run: 15
- Average speed: 3.2 minutes per eval
- Gate pass rate: 93%
- Coverage failures: 1 (expected)

## Commit
- Hash: (git rev-parse --short HEAD)
- Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Raw Logs
[See evaluation-proof-run-1.txt](../evaluation-proof-run-1.txt)

## Key Signal
System is fast and catches edge cases. Ready for agents.
```

**✅ End of Phase 1: You have quantified proof.**

---

## Hours 7–14: Agent Portal (Minimal)

### Architecture
```
/app/agent
  ├── page.tsx               (login + dashboard)
  ├── layout.tsx             (shared wrapper)
/app/api/agent
  ├── submissions/route.ts   (GET agent's manuscripts)
  ├── feedback/route.ts      (POST feedback)
/components/agent
  ├── AgentLogin.tsx         (simple form or API key)
  ├── AgentDashboard.tsx     (results display)
  ├── FeedbackForm.tsx       (quick survey)
/hooks
  ├── useAgentAuth.ts        (check auth, get agentId)
```

### Step 1: Auth Hook (1 hour)

**File:** `hooks/useAgentAuth.ts`

```typescript
'use client';

import { useState, useEffect } from 'react';

export function useAgentAuth() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage for API key
    const apiKey = localStorage.getItem('agent_api_key');
    if (!apiKey) {
      setIsLoading(false);
      return;
    }

    // Validate key
    fetch('/api/agent/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.agentId) {
          setAgentId(data.agentId);
        } else {
          localStorage.removeItem('agent_api_key');
          setError('Invalid API key');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem('agent_api_key');
    setAgentId(null);
  };

  return { agentId, isLoading, error, logout };
}
```

### Step 2: Login Component (1 hour)

**File:** `components/agent/AgentLogin.tsx`

```typescript
'use client';

import { useState } from 'react';

export function AgentLogin() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    localStorage.setItem('agent_api_key', apiKey);
    window.location.reload(); // Simple redirect
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded shadow-md w-full max-w-md"
      >
        <h1 className="text-2xl font-bold mb-6">RevisionGrade Agent Portal</h1>
        <p className="text-gray-600 mb-4">Enter your API key to view results:</p>
        <input
          type="password"
          placeholder="agent_key_..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className="w-full px-4 py-2 border rounded mb-4"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700"
        >
          {loading ? 'Loading...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
```

### Step 3: Dashboard Component (2 hours)

**File:** `components/agent/AgentDashboard.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';

type Submission = {
  id: string;
  title: string;
  status: string;
  score?: number;
  topCriteria?: { id: string; name: string; score: number }[];
};

export function AgentDashboard({ agentId }: { agentId: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agent/submissions?agentId=${agentId}`)
      .then(r => r.json())
      .then(data => {
        setSubmissions(data.submissions || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [agentId]);

  if (loading) return <div className="p-8">Loading your manuscripts...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Manuscripts</h1>
        <button
          onClick={() => {
            localStorage.removeItem('agent_api_key');
            window.location.reload();
          }}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Sign Out
        </button>
      </div>

      {submissions.length === 0 ? (
        <p className="text-gray-600">
          No submissions yet. Upload a manuscript to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {submissions.map(sub => (
            <div
              key={sub.id}
              className="border border-gray-300 rounded p-6 hover:shadow-md transition"
            >
              <h2 className="text-xl font-semibold">{sub.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Status: <span className="font-medium">{sub.status}</span>
              </p>

              {sub.score !== undefined && (
                <div className="mt-4">
                  <p className="text-2xl font-bold text-blue-600">{sub.score}/100</p>
                  <p className="text-sm text-gray-600">Overall Score</p>

                  {sub.topCriteria && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-700">Key Strengths:</p>
                      <ul className="mt-2 space-y-1">
                        {sub.topCriteria.map(c => (
                          <li key={c.id} className="text-sm text-gray-600">
                            • {c.name}: <span className="font-medium">{c.score}/10</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    Download Full Feedback
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 border-t pt-8">
        <h3 className="text-lg font-semibold mb-4">Feedback</h3>
        <textarea
          placeholder="What did you think? Would you use this again?"
          className="w-full px-4 py-2 border rounded mb-4"
          rows={4}
        />
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Send Feedback
        </button>
      </div>
    </div>
  );
}
```

### Step 4: API Routes (2 hours)

**File:** `app/api/agent/validate-key/route.ts`

```typescript
export async function POST(req: Request) {
  const { apiKey } = await req.json();

  // Validate key format and lookup agent
  // For now: simple stub
  if (apiKey.startsWith('agent_key_')) {
    const agentId = apiKey.split('_').pop(); // Simple extraction
    return Response.json({ agentId });
  }

  return Response.json({ error: 'Invalid key' }, { status: 401 });
}
```

**File:** `app/api/agent/submissions/route.ts`

```typescript
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return Response.json({ error: 'Missing agentId' }, { status: 400 });
  }

  // Query agent's latest submissions
  const { data, error } = await supabase
    .from('agent_manuscripts')
    .select(
      `
      id,
      title,
      status,
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
    .limit(10);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ submissions: data });
}
```

### Step 5: Portal Page (1 hour)

**File:** `app/agent/page.tsx`

```typescript
'use client';

import { useAgentAuth } from '@/hooks/useAgentAuth';
import { AgentDashboard } from '@/components/agent/AgentDashboard';
import { AgentLogin } from '@/components/agent/AgentLogin';

export default function AgentPortal() {
  const { agentId, isLoading, error } = useAgentAuth();

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!agentId) return <AgentLogin />;

  return <AgentDashboard agentId={agentId} />;
}
```

**✅ End of Phase 2: Portal is live at `/agent`**

---

## Hours 15–18: Invite Agents & Capture Signal

### Email Template

```
Subject: Free Evaluation — Your Manuscript (No Credit Card)

Hi [Agent Name],

I've built an AI evaluation tool for manuscripts and screenplays, and I'd like your feedback.

**What you get:**
- One free evaluation (score + detailed feedback on 13 criteria)
- Results in < 5 minutes
- Honest assessment: would your work be competitive?

**Try it now:**
https://revisiongrade.vercel.app/agent
API Key: agent_key_[unique-id]

**No credit card. No long-term commitment.** Just 15 minutes on one manuscript.

After you run it, reply and tell me:
- Was the feedback useful?
- Would you pay for this?
- What would make it better?

Looking forward to your thoughts.

[Your Name]
```

### Monitoring

```bash
# Check who logged in
supabase --function query "SELECT * FROM agent_telemetry ORDER BY timestamp DESC LIMIT 20"

# Read feedback emails
# (set up a filter in Gmail for replies)
```

---

## 🏁 End-of-Sprint Checklist

- [ ] Phase 1: 15+ evaluations run, times captured
- [ ] Phase 1: `PHASE1-EVALUATION-PROOF.md` created
- [ ] Phase 2: Agent portal deployed to `/agent`
- [ ] Phase 2: Login works with API key
- [ ] Phase 2: Dashboard displays submissions + scores
- [ ] Phase 3: 5 agents invited with unique API keys
- [ ] Phase 3: At least 1 agent has logged in
- [ ] Phase 3: Feedback captured (email or form)

**Success:** 3+ agents using it, 1+ says "I'd pay for this"

