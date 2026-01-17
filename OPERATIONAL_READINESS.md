# RevisionGrade MVP Readiness Checklist

## Status: Migration Complete - Ready for Verification

All code changes committed to GitHub. Run these 6 checks to prove Base44 independence.

---

## ✅ Check 1: Base44 Purge (REQUIRED)

**Run this command in your project root:**

**Windows PowerShell:**
```powershell
rg "@base44/sdk|base44\.|app\.base44\.com|base44Client" -n
```

**macOS/Linux:**
```bash
rg "@base44/sdk|base44\.|app\.base44\.com|base44Client" -n
```

**Expected Result:**
- ✅ Zero hits in `src/` directory
- ✅ Hits in `/base44-export/` or `/legacy/` are acceptable (archived)
- ✅ Hits in docs/comments are acceptable
- ❌ Any active imports in `src/` = blocker

**Paste output here for verification**

---

## ✅ Check 2: Local Build Passes

**Run:**
```bash
npm install
npm run build
```

**Expected Result:**
- ✅ Build completes without errors
- ❌ Import errors mentioning Base44 = fix imports first

---

## ✅ Check 3: Edge Function Deploys Successfully

**Run:**
```bash
# 1. Link to Supabase project
supabase link --project-ref xtumxjnzdswuumndcbwc

# 2. Deploy the evaluate function
supabase functions deploy evaluate --no-verify-jwt
```

**Expected Output:**
```
Deploying evaluate (project: xtumxjnzdswuumndcbwc)
Successfully deployed evaluate
```

---

## ✅ Check 4: Secrets Configured (Server-Side)

**Set required secrets:**
```bash
# Required: OpenAI API key
supabase secrets set OPENAI_API_KEY=your_actual_openai_key_here

# Optional: Abuse speed bump token
supabase secrets set EVAL_TOKEN=your_random_token_here

# Optional: Specific OpenAI model
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

**Verify secrets exist:**
```bash
supabase secrets list
```

**Expected Output:**
```
OPENAI_API_KEY (set)
EVAL_TOKEN (set)
```

---

## ✅ Check 5: Curl Test Returns Valid JSON with 13 Criteria

**Test the deployed Edge Function:**

```bash
curl -X POST "https://xtumxjnzdswuumndcbwc.functions.supabase.co/evaluate" \
  -H "Content-Type: application/json" \
  -H "X-Eval-Token: your_random_token" \
  -d '{"text":"Once upon a time in a kingdom far away, a young princess discovered a magical book that could change the world. She opened it carefully, wondering what secrets it held."}'
```

**Expected JSON Response Structure:**
```json
{
  "overall_score": 45,
  "criteria": [
    {
      "key": "opening_hook",
      "name": "Opening Hook",
      "score": 5,
      "strengths": [...],
      "weaknesses": [...],
      "recommendations": [...]
    },
    // ... exactly 13 total
  ],
  "agent_ready": false,
  "next_actions": [...],
  "notes": [...],
  "meta": {
    "model": "gpt-4o-mini",
    "latency_ms": 2340
  }
}
```

**Verify:**
- ✅ `criteria.length === 13`
- ✅ Each criterion has `key` (snake_case) and `name` (display)
- ✅ All canonical keys present:
  - `opening_hook`
  - `narrative_voice_style`
  - `character_depth_introduction`
  - `conflict_tension_escalation`
  - `thematic_resonance`
  - `structure_pacing_flow`
  - `dialogue_subtext`
  - `worldbuilding_immersion`
  - `stakes_emotional_investment`
  - `line_level_craft_polish`
  - `marketability_genre_position`
  - `narrative_closure_promises_kept`
  - `would_keep_reading_gate`

---

## ✅ Check 6: Vercel Deployment + UI Click Test

**1. Set environment variables in Vercel Dashboard:**

```env
NEXT_PUBLIC_EVALUATE_FUNCTION_URL=https://xtumxjnzdswuumndcbwc.functions.supabase.co/evaluate
VITE_EVAL_TOKEN=your_random_token  # Optional speed bump
```

**2. Deploy to Vercel:**
```bash
git push origin main
# Vercel auto-deploys on push
```

**3. Test in deployed UI:**
- Navigate to your Vercel preview URL
- Click "Evaluate" button with sample text
- Verify response displays 13 criteria
- Check browser DevTools Network tab:
  - Request goes to Supabase Edge Function (not Base44)
  - Response has all 13 `key` fields

---

## 🔒 Security Note: VITE_EVAL_TOKEN

**Current Setup:**
- `VITE_EVAL_TOKEN` is visible in browser DevTools
- It's a "speed bump" not real security
- Acceptable for MVP migration phase

**For Public Launch, Upgrade To:**
- Cloudflare Turnstile (CAPTCHA)
- Vercel serverless proxy
- Rate limiting at Edge Function level
- Real user authentication

---

## ✅ Migration Complete When:

- [ ] Check 1: Zero Base44 imports in `src/`
- [ ] Check 2: `npm run build` succeeds
- [ ] Check 3: Edge Function deployed
- [ ] Check 4: Secrets configured
- [ ] Check 5: Curl returns 13 criteria with keys
- [ ] Check 6: Vercel UI calls Supabase (not Base44)

**When all checks pass:** You are fully independent of Base44 and ready for MVP launch.

---

## Files Changed (Reference)

1. `supabase/functions/evaluate/index.ts` - Edge Function with canonical 13 criteria + keys
2. `src/api/evaluate.js` - Direct fetch to Edge Function (no auth)
3. `MIGRATION_GUIDE.md` - Canonical criteria documented

**Commits:**
- "Add canonical JSON keys to criteria output"
- "Remove auth requirement for MVP (no users yet)"
- "Document canonical 13 locked story criteria with JSON keys"
- "Update Edge Function with canonical 13 locked criteria"

---

## Next Steps After Verification

1. **If all checks pass:** Deploy to production
2. **If Check 1 fails:** Remove remaining Base44 imports
3. **If Check 5 fails:** Check Supabase secrets and function logs
4. **If Check 6 fails:** Verify Vercel env vars match Edge Function URL

**Support:** See MIGRATION_GUIDE.md for detailed deployment instructions.
