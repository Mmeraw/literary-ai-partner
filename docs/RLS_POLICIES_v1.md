# RLS Policies for Multi-Tenant Hardening

**Version**: 1.0  
**Status**: Active  
**Last Updated**: 2026-01-26

---

## Purpose

Defines **Row Level Security (RLS) policies** for Supabase tables to enforce user-scoped data isolation in production.

RLS ensures users can only access their own data at the database level, providing defense-in-depth beyond API-level auth checks.

---

## Policy Principles

1. **Default Deny**: All tables have RLS enabled with no public access
2. **User Isolation**: Users can only read/write rows where `user_id = auth.uid()`
3. **Service Role Bypass**: Backend services use service role key (bypasses RLS)
4. **Admin Override**: Admin accounts have elevated read access where appropriate

---

## Required Policies by Table

### `evaluation_jobs`

**Enable RLS**:
```sql
ALTER TABLE public.evaluation_jobs ENABLE ROW LEVEL SECURITY;
```

**Policies**:

#### 1. Users can view their own jobs
```sql
CREATE POLICY "Users view own evaluation jobs"
ON public.evaluation_jobs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
```

#### 2. Users can create jobs for themselves
```sql
CREATE POLICY "Users create own evaluation jobs"
ON public.evaluation_jobs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
```

#### 3. Service role has full access (for daemon)
```sql
CREATE POLICY "Service role full access"
ON public.evaluation_jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Rationale**:
- Authors only see jobs they created
- Daemon (using service role) can update any job
- No cross-tenant data leakage

---

### `evaluation_artifacts`

**Enable RLS**:
```sql
ALTER TABLE public.evaluation_artifacts ENABLE ROW LEVEL SECURITY;
```

**Policies** (already exist per migration `20260124000000_evaluation_artifacts.sql`):

#### 1. Service role full access
```sql
CREATE POLICY "Service role full access" 
ON public.evaluation_artifacts 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
```

#### 2. Authors view own artifacts
```sql
CREATE POLICY "Authors view own artifacts" 
ON public.evaluation_artifacts 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());
```

**Status**: ✅ Already implemented

---

### `manuscript_chunks`

**Enable RLS**:
```sql
ALTER TABLE public.manuscript_chunks ENABLE ROW LEVEL SECURITY;
```

**Policies**:

#### 1. Users can view chunks for their own jobs
```sql
CREATE POLICY "Users view own manuscript chunks"
ON public.manuscript_chunks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluation_jobs
    WHERE evaluation_jobs.id = manuscript_chunks.job_id
      AND evaluation_jobs.user_id = auth.uid()
  )
);
```

#### 2. Service role has full access
```sql
CREATE POLICY "Service role full access"
ON public.manuscript_chunks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Rationale**:
- Chunks belong to jobs, jobs belong to users
- Transitive ownership via foreign key

---

### `manuscripts` (legacy table, if still in use)

**Enable RLS**:
```sql
ALTER TABLE public.manuscripts ENABLE ROW LEVEL SECURITY;
```

**Policies** (already exist per migration `20260117060042_remote_schema.sql`):

#### 1. Author: view own manuscripts
```sql
CREATE POLICY "Author: view own manuscripts" 
ON public.manuscripts 
FOR SELECT 
USING (
  ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'author')
  AND (created_by = auth.uid())
);
```

#### 2. Author: insert own manuscripts
```sql
CREATE POLICY "Author: insert own manuscripts" 
ON public.manuscripts 
FOR INSERT 
WITH CHECK (
  ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'author')
  AND (created_by = auth.uid())
);
```

#### 3. Author: update own manuscripts
```sql
CREATE POLICY "Author: update own manuscripts" 
ON public.manuscripts 
FOR UPDATE 
USING (
  ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'author')
  AND (created_by = auth.uid())
)
WITH CHECK (
  ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'author')
  AND (created_by = auth.uid())
);
```

**Status**: ✅ Already implemented

---

## Implementation Checklist

### Phase 1: Enable RLS on Core Tables

- [x] `evaluation_artifacts` - Already enabled
- [x] `manuscripts` - Already enabled with role-based policies
- [ ] **`evaluation_jobs`** - ⚠️ **REQUIRED**: Must enable RLS with user_id policies
- [ ] **`manuscript_chunks`** - ⚠️ **REQUIRED**: Must enable RLS with transitive ownership

### Phase 2: Add User ID Column (if missing)

```sql
-- Add user_id column to evaluation_jobs if not exists
ALTER TABLE public.evaluation_jobs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill existing jobs (optional, or set default)
UPDATE public.evaluation_jobs 
SET user_id = '00000000-0000-0000-0000-000000000000' 
WHERE user_id IS NULL;

-- Make user_id required for new rows
ALTER TABLE public.evaluation_jobs 
ALTER COLUMN user_id SET NOT NULL;
```

### Phase 3: Create RLS Policies

Run the SQL policy definitions above in Supabase SQL Editor or via migration.

### Phase 4: Test RLS Enforcement

```sql
-- Test as authenticated user (should only see own jobs)
SET request.jwt.claims = '{"sub": "user-uuid-here", "role": "authenticated"}';
SELECT * FROM public.evaluation_jobs; -- Should only return user's jobs

-- Test as service role (should see all jobs)
SET ROLE service_role;
SELECT * FROM public.evaluation_jobs; -- Should return all jobs
```

---

## Deployment Steps

### Development/Staging

1. **Create migration file**:
   ```bash
   # In supabase/migrations/
   touch 20260126000000_enable_rls_evaluation_jobs.sql
   ```

2. **Add RLS policies** (copy from sections above)

3. **Apply migration**:
   ```bash
   supabase db push
   ```

4. **Verify policies**:
   ```bash
   supabase db remote commit
   ```

### Production

1. **Review policies** in staging first
2. **Backup database** before applying
3. **Apply migration** during low-traffic window
4. **Monitor logs** for auth failures (may indicate missing user_id values)
5. **Rollback plan**: Disable RLS if critical issues emerge
   ```sql
   ALTER TABLE public.evaluation_jobs DISABLE ROW LEVEL SECURITY;
   ```

---

## Testing RLS Policies

### Manual Test (SQL Editor)

```sql
-- 1. Create test user
INSERT INTO auth.users (id, email) 
VALUES ('test-user-1', 'test@example.com');

-- 2. Create test job owned by user
INSERT INTO public.evaluation_jobs (id, user_id, manuscript_id, job_type, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test-user-1',
  'test-manuscript',
  'evaluate_quick',
  'queued'
);

-- 3. Try to access as different user (should fail)
SET request.jwt.claims = '{"sub": "different-user", "role": "authenticated"}';
SELECT * FROM public.evaluation_jobs WHERE id = '11111111-1111-1111-1111-111111111111';
-- Expected: 0 rows (RLS blocks access)

-- 4. Try to access as owner (should succeed)
SET request.jwt.claims = '{"sub": "test-user-1", "role": "authenticated"}';
SELECT * FROM public.evaluation_jobs WHERE id = '11111111-1111-1111-1111-111111111111';
-- Expected: 1 row
```

### API Test (curl)

```bash
# 1. Get auth token for user
USER_TOKEN="<supabase-jwt-for-user>"

# 2. Try to access another user's job (should fail)
curl -X GET \
  "http://localhost:3000/api/jobs/<other-user-job-id>" \
  -H "Authorization: Bearer $USER_TOKEN"
# Expected: 403 Forbidden

# 3. Access own job (should succeed)
curl -X GET \
  "http://localhost:3000/api/jobs/<own-job-id>" \
  -H "Authorization: Bearer $USER_TOKEN"
# Expected: 200 OK with job data
```

---

## Security Considerations

### ✅ Defense in Depth

- **Layer 1**: API auth checks (lib/auth/api.ts)
- **Layer 2**: RLS policies (database level)
- **Layer 3**: Service role isolation (daemon uses separate credentials)

### ⚠️ Potential Risks

1. **Missing user_id**: Old jobs without user_id will be inaccessible
   - **Mitigation**: Backfill script or default to system user
   
2. **Service role leakage**: If service role key leaks, bypasses RLS
   - **Mitigation**: Rotate keys, use Vault, restrict to daemon only
   
3. **Admin access**: Admin policies must be carefully scoped
   - **Mitigation**: Separate admin role from author role, audit admin queries

### 🔒 Best Practices

- Use `auth.uid()` for user identity (not JWT claims)
- Test policies with real JWT tokens, not SET ROLE
- Enable audit logging for policy violations
- Review policies quarterly for drift
- Never disable RLS in production without approval

---

## Related Documents

- [JOB_CONTRACT_v1.md](./JOB_CONTRACT_v1.md) - Canonical job state definitions
- [MULTI_TENANT_DEPLOYMENT.md](./MULTI_TENANT_DEPLOYMENT.md) - Prod deployment guide
- [lib/auth/api.ts](../lib/auth/api.ts) - API auth helpers

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-26 | Initial RLS policy documentation for multi-tenant hardening |
