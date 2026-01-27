# Multi-Tenant Deployment Guide

**Version**: 1.0  
**Status**: Active  
**Last Updated**: 2026-01-26

---

## Purpose

Guide for deploying RevisionGrade with **multi-tenant hardening** enabled for production use with external users.

This document covers:
- Supabase production project setup
- Environment variable configuration
- RLS policy deployment
- Auth flow configuration
- Monitoring and observability

---

## Prerequisites

- Supabase account with production project created
- Domain name configured (optional, for custom auth)
- Admin API key generated (for /api/admin/metrics)
- SSL certificates (handled by Vercel/hosting provider)

---

## Deployment Checklist

### 1. Create Production Supabase Project

**Steps**:
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Configure:
   - **Name**: `revisiongrade-prod`
   - **Database Password**: Generate strong password (save to password manager)
   - **Region**: Choose closest to majority of users (e.g., `us-west-1`)
   - **Pricing Plan**: Pro (for production support + RLS)
4. Wait for project provisioning (~2 minutes)

**Output**:
- Project URL: `https://xxxxx.supabase.co`
- Project API Keys:
  - `anon` (public): For client-side auth
  - `service_role` (secret): For server-side operations

---

### 2. Apply Database Migrations

**Local to Remote Sync**:
```bash
# Link local Supabase project to remote
supabase link --project-ref <your-project-ref>

# Push all migrations to production
supabase db push

# Verify migration status
supabase db remote commit
```

**Manual Alternative** (if `supabase` CLI not available):
1. Open Supabase SQL Editor
2. Copy contents of each migration file in `supabase/migrations/`
3. Run in order (oldest to newest)
4. Verify tables created: `evaluation_jobs`, `manuscript_chunks`, `evaluation_artifacts`

---

### 3. Enable RLS Policies

**Apply policies from [RLS_POLICIES_v1.md](./RLS_POLICIES_v1.md)**:

```sql
-- Enable RLS on evaluation_jobs
ALTER TABLE public.evaluation_jobs ENABLE ROW LEVEL SECURITY;

-- Users view own jobs
CREATE POLICY "Users view own evaluation jobs"
ON public.evaluation_jobs FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users create own jobs
CREATE POLICY "Users create own evaluation jobs"
ON public.evaluation_jobs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Service role bypass
CREATE POLICY "Service role full access"
ON public.evaluation_jobs FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Enable RLS on manuscript_chunks
ALTER TABLE public.manuscript_chunks ENABLE ROW LEVEL SECURITY;

-- Users view own chunks (via job ownership)
CREATE POLICY "Users view own manuscript chunks"
ON public.manuscript_chunks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluation_jobs
    WHERE evaluation_jobs.id = manuscript_chunks.job_id
      AND evaluation_jobs.user_id = auth.uid()
  )
);

-- Service role bypass
CREATE POLICY "Service role full access chunks"
ON public.manuscript_chunks FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

**Verify**:
```sql
-- Check RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('evaluation_jobs', 'manuscript_chunks');
-- Expected: rowsecurity = true

-- Check policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('evaluation_jobs', 'manuscript_chunks');
-- Expected: 3+ policies per table
```

---

### 4. Configure Environment Variables

**Production `.env` (Vercel/hosting provider)**:

```bash
# Supabase (Production Project)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>

# Database
USE_SUPABASE_JOBS=true
DATABASE_URL=postgresql://postgres:<password>@db.xxxxx.supabase.co:5432/postgres

# Admin API
ADMIN_API_KEY=<generate-strong-random-key>
# Generate: openssl rand -base64 32

# Metrics
METRICS_ENABLED=true
METRICS_BACKEND=console  # Or datadog/cloudwatch in future

# OpenAI (if using AI evaluation)
OPENAI_API_KEY=<prod-openai-key>

# Node Environment
NODE_ENV=production
```

**Security Notes**:
- ⚠️ Never commit `.env` to git
- ✅ Use Vercel environment variables UI
- ✅ Rotate `ADMIN_API_KEY` quarterly
- ✅ Use separate OpenAI key for prod (billing isolation)

---

### 5. Configure Supabase Auth

**Enable Email Authentication**:
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Email" provider
3. Configure:
   - **Confirm email**: Enabled (prevents spam signups)
   - **Email templates**: Customize welcome email
   - **Redirect URLs**: Add production domain(s)

**Redirect URLs** (for auth callbacks):
```
https://yourdomain.com/auth/callback
https://yourdomain.com/
```

**JWT Settings**:
1. Go to Settings → API
2. Verify JWT expiry: 3600 seconds (1 hour) is default
3. Note JWT Secret (used for token validation)

**Email Templates** (optional):
- Customize `Confirm signup`, `Magic link`, `Reset password` templates
- Add branding, support contact, terms of service links

---

### 6. Deploy Application

**Vercel Deployment**:
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod

# Configure environment variables via UI or CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... (repeat for all env vars)
```

**Manual Deployment** (other providers):
1. Build production bundle: `npm run build`
2. Upload to hosting provider
3. Configure environment variables in provider's UI
4. Ensure `NODE_ENV=production` is set
5. Start server: `npm start`

---

### 7. Start Daemon (Job Processor)

**Option A: PM2 (Recommended)**:
```bash
# On production server
pm2 start npm --name "rg-daemon" -- run daemon
pm2 save
pm2 startup  # Enable auto-restart on reboot
```

**Option B: Systemd** (Linux):
```bash
# Create /etc/systemd/system/rg-daemon.service
[Unit]
Description=RevisionGrade Job Daemon
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/revisiongrade
ExecStart=/usr/bin/node scripts/daemon.js
Restart=always
EnvironmentFile=/var/www/revisiongrade/.env

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable rg-daemon
sudo systemctl start rg-daemon
sudo systemctl status rg-daemon
```

**Option C: Vercel Cron** (Serverless):
- Configure cron job to hit `/api/workers/process-evaluations`
- Set `CRON_SECRET` env var for auth
- Not recommended for long-running jobs (15s timeout)

---

### 8. Verify Auth Flow

**Test User Signup**:
```bash
# Create test user via Supabase API
curl -X POST "https://xxxxx.supabase.co/auth/v1/signup" \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Expected: 200 OK with user object
```

**Test Job Creation**:
```bash
# Get JWT token from signup response
TOKEN="<jwt-from-signup>"

# Create job (should succeed with own user_id)
curl -X POST "https://yourdomain.com/api/evaluate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manuscript_id": "test-123",
    "job_type": "evaluate_quick"
  }'

# Expected: 201 Created with job_id
```

**Test Cross-User Access** (should fail):
```bash
# Get second user token
TOKEN_USER2="<different-user-jwt>"

# Try to access first user's job
curl -X GET "https://yourdomain.com/api/jobs/<user1-job-id>" \
  -H "Authorization: Bearer $TOKEN_USER2"

# Expected: 403 Forbidden (RLS blocks access)
```

---

### 9. Enable Monitoring

**Supabase Monitoring**:
1. Go to Supabase Dashboard → Database → Database
2. Enable **Query Performance** insights
3. Set up **Alerts** for:
   - Database CPU > 80%
   - Database connections > 90% of limit
   - Slow queries > 1s

**Application Monitoring** (optional):
```bash
# Add Sentry for error tracking
npm install @sentry/nextjs

# Configure in next.config.js
SENTRY_DSN=<your-sentry-dsn>
```

**Metrics Dashboard**:
- Access `/api/admin/metrics` with `X-Admin-Key` header
- Monitor job counts, stale jobs, recent events
- Set up alerting if `stale_running_jobs.count > 5`

---

### 10. Security Hardening

**Rate Limiting** (Vercel):
- Enable Vercel Edge Config for rate limiting
- Limit `/api/evaluate` to 10 requests/minute per user

**CORS Configuration**:
```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  res.headers.set('Access-Control-Allow-Origin', 'https://yourdomain.com');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST');
  res.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  return res;
}
```

**Secrets Rotation**:
- Rotate `ADMIN_API_KEY` quarterly
- Rotate Supabase `service_role` key annually
- Rotate OpenAI key if leaked or compromised

---

## Post-Deployment Checklist

- [ ] RLS policies enabled and tested
- [ ] Auth flow works (signup, login, job creation)
- [ ] Cross-user access blocked (403 Forbidden)
- [ ] Admin metrics accessible with key
- [ ] Daemon processing jobs successfully
- [ ] Monitoring/alerts configured
- [ ] Environment variables secured
- [ ] Backup strategy in place (Supabase auto-backups enabled)
- [ ] Domain SSL verified (https:// only)
- [ ] Rate limiting enabled (if applicable)

---

## Rollback Plan

**If critical issues emerge**:

1. **Disable RLS** (temporary, emergency only):
   ```sql
   ALTER TABLE public.evaluation_jobs DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.manuscript_chunks DISABLE ROW LEVEL SECURITY;
   ```

2. **Revert to development Supabase**:
   ```bash
   # Update env vars to point to dev project
   vercel env rm NEXT_PUBLIC_SUPABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_URL <dev-url> production
   ```

3. **Stop daemon** (prevent job processing):
   ```bash
   pm2 stop rg-daemon
   ```

4. **Notify users** via status page or email

---

## Production Maintenance

**Weekly**:
- Check `/api/admin/metrics` for stale jobs
- Review Supabase logs for auth errors
- Monitor database storage usage

**Monthly**:
- Review slow queries in Supabase dashboard
- Check for failed jobs (retry exhausted)
- Update dependencies: `npm audit fix`

**Quarterly**:
- Rotate `ADMIN_API_KEY`
- Review RLS policies for drift
- Audit user access patterns
- Performance testing (load test `/api/evaluate`)

---

## Troubleshooting

### Issue: "Forbidden" errors after RLS enabled

**Cause**: Jobs created before RLS don't have `user_id` set

**Fix**:
```sql
-- Backfill user_id for old jobs (use system user or admin)
UPDATE public.evaluation_jobs 
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;
```

### Issue: Daemon can't update jobs

**Cause**: Daemon not using service role key

**Fix**:
```bash
# Verify env var set
echo $SUPABASE_SERVICE_ROLE_KEY

# Restart daemon with service role
pm2 restart rg-daemon
```

### Issue: Metrics endpoint returns 403

**Cause**: `ADMIN_API_KEY` not set or incorrect

**Fix**:
```bash
# Generate new key
openssl rand -base64 32

# Set in Vercel env vars
vercel env add ADMIN_API_KEY production
```

---

## Related Documents

- [RLS_POLICIES_v1.md](./RLS_POLICIES_v1.md) - Database security policies
- [JOB_CONTRACT_v1.md](./JOB_CONTRACT_v1.md) - Canonical job state definitions
- [METRICS_API_v1.md](./METRICS_API_v1.md) - Admin metrics endpoint documentation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-26 | Initial multi-tenant deployment guide |
