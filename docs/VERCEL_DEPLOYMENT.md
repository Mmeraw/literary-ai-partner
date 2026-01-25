# Vercel Deployment Checklist

## Prerequisites
- [ ] Migration applied (run `scripts/apply-evaluation-result-migration.sql` in Supabase SQL Editor)
- [ ] Test data seeded (run `scripts/seed-test-evaluation-result.sql`, save the job UUID)
- [ ] Git changes committed and pushed to GitHub

## Vercel Environment Variables
Set these in Vercel Dashboard → Settings → Environment Variables:

```bash
# Public variables (visible in browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...your-anon-key

# Server-only variable (NEVER expose to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your-service-role-key
```

**Where to find these values:**
1. Go to Supabase Dashboard → Settings → API
2. `NEXT_PUBLIC_SUPABASE_URL` = "Project URL"
3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` = "anon public" key
4. `SUPABASE_SERVICE_ROLE_KEY` = "service_role" key (click "Reveal" to copy)

## Deploy
```bash
# Option 1: Push to main (if auto-deploy enabled)
git push origin main

# Option 2: Manual deploy via Vercel CLI
npx vercel --prod

# Option 3: Trigger deploy from Vercel Dashboard
# Go to Deployments → Deploy → Production
```

## Verification Steps

### 1. Health Check
```bash
# Should return: { ok: true, commit: "<sha>", branch: "main", timestamp: "..." }
curl https://your-app.vercel.app/api/health
```

**Expected response:**
```json
{
  "ok": true,
  "commit": "0363348...",
  "branch": "main",
  "timestamp": "2026-01-25T20:30:00.000Z"
}
```

If this fails:
- Check Vercel build logs for errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` is set
- Check that Next.js built successfully

### 2. Report Page
```bash
# Replace <job-uuid> with UUID from seed script output
curl https://your-app.vercel.app/reports/<job-uuid>
```

**Expected**: HTML page rendering evaluation report (verdict, scores, recommendations)

**Or visit in browser:**
```
https://your-app.vercel.app/reports/<job-uuid>
```

You should see:
- ✅ Verdict badge (e.g., "PROMISING")
- ✅ Overall score (e.g., "7.2 / 10")
- ✅ Summary text
- ✅ 13 criteria scores in grid
- ✅ Quick wins (⚡) and strategic revisions (📊)
- ✅ Artifacts list
- ✅ Metadata (model, word count, etc.)

If this fails:
- Check Vercel function logs (Deployments → Function Logs)
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Confirm migration was applied (check Supabase Table Editor → evaluation_jobs → columns)
- Verify seed data exists (check evaluation_jobs table for row with evaluation_result)

### 3. 404 Handling
```bash
# Try with a non-existent UUID
curl https://your-app.vercel.app/reports/00000000-0000-0000-0000-000000000000
```

**Expected**: 404 page with "Evaluation report not found"

## Success Criteria

When all 3 checks pass, you can truthfully say:

✅ "Evaluation results are stored" (evaluation_result column exists with data)
✅ "There is a report page" (/reports/[jobId] renders)
✅ "The app is deployed" (Vercel URL is live)
✅ "A URL renders real data" (report page shows actual database content)

## Troubleshooting

### Build fails
- Check `npm run build` locally first
- Review Vercel build logs for specific errors
- Verify all dependencies in package.json

### 500 errors on /reports/[jobId]
- Check Vercel function logs
- Verify Supabase service role key has read access to evaluation_jobs
- Confirm evaluation_result column exists in database

### Empty/incomplete report
- Verify evaluation_result JSON structure matches EvaluationResultV1 schema
- Check browser console for validation errors
- Confirm all required fields are present in database

### Health check returns 404
- Verify /app/api/health/route.ts was deployed
- Check Vercel build output includes API routes
- Try redeploying

## Next Steps (After Operational)

Priority order:
1. Auto-write evaluation_result when evaluation completes
2. Add "Run Evaluation" button to trigger jobs
3. List page showing all reports (/reports)
4. Shareable report links (public access)
5. PDF export for reports
6. Package generator consuming EvaluationResultV1
