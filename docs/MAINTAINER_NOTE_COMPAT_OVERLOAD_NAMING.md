# Future Maintainer Note: Compat Overload Parameter Naming

**Date**: 2026-02-07  
**Context**: A4 — claim_job_atomic PostgREST overload resolution fix  
**Status**: PERMANENT RULE

---

## The Rule

**When creating compatibility wrapper overloads for functions exposed via PostgREST RPC:**

### ✅ DO THIS

**Use `c_*` prefix for ALL compat wrapper parameters:**

```sql
-- Compat wrapper (legacy signature support)
CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  c_lease_seconds INTEGER,      -- Use c_* prefix
  c_now TIMESTAMPTZ,             -- Use c_* prefix
  c_worker_id TEXT               -- Use c_* prefix
)
```

**Use `p_*` prefix for canonical function parameters:**

```sql
-- Canonical function (current/preferred signature)
CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  p_worker_id TEXT,              -- Use p_* prefix
  p_now TIMESTAMPTZ,             -- Use p_* prefix
  p_lease_seconds INTEGER        -- Use p_* prefix
)
```

### ❌ NEVER DO THIS

**DO NOT use `p_*` prefix in compat wrapper parameters:**

```sql
-- ❌ WRONG: This creates PostgREST ambiguity!
CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  p_lease_seconds INTEGER,       -- ❌ Shares name with canonical param
  p_now TIMESTAMPTZ,             -- ❌ Shares name with canonical param
  p_worker_id TEXT               -- ❌ Shares name with canonical param
)
```

---

## Why This Matters

### PostgREST Named-Argument Resolution

When a client calls an RPC via PostgREST with named arguments (JSON payload):

```javascript
supabase.rpc("claim_job_atomic", {
  p_worker_id: "worker-123",
  p_now: "2026-02-07T15:00:00Z",
  p_lease_seconds: 30
})
```

**PostgREST matches parameter names to function signatures.**

If multiple overloads exist with **identical parameter names**, PostgREST cannot deterministically choose which one to call. This results in:

- `Could not choose the best candidate function` errors, OR
- Silent binding to the wrong overload

### The Fix: Namespace Separation

By using **different parameter name prefixes** for canonical vs compat:

- **Canonical**: `p_worker_id`, `p_now`, `p_lease_seconds`
- **Compat**: `c_worker_id`, `c_now`, `c_lease_seconds`

...the named-argument payload `{p_worker_id, p_now, p_lease_seconds}` can **only** match the canonical function.

**Positional callers** (if any) still resolve correctly to the compat wrapper based on type signature and argument order.

---

## Implementation Pattern

### 1. Canonical Function (Primary)

```sql
CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  p_worker_id TEXT,
  p_now TIMESTAMPTZ,
  p_lease_seconds INTEGER
)
RETURNS TABLE (...)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Implementation here
END;
$$;
```

**Exposed to clients via named-arg RPC:**
```javascript
{p_worker_id: X, p_now: Y, p_lease_seconds: Z}
```

### 2. Compat Wrapper (Legacy Support)

```sql
CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  c_lease_seconds INTEGER,      -- Different order + different names
  c_now TIMESTAMPTZ,
  c_worker_id TEXT
)
RETURNS TABLE (...)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delegate to canonical using POSITIONAL args
  -- (not named args, to avoid recursion)
  RETURN QUERY
  SELECT *
  FROM public.claim_job_atomic(
    c_worker_id,          -- Positional: matches p_worker_id
    c_now,                -- Positional: matches p_now
    c_lease_seconds       -- Positional: matches p_lease_seconds
  );
END;
$$;
```

**Key points:**
- ✅ Parameters use `c_*` prefix (never matches `p_*` in JSON payload)
- ✅ Delegates with **positional** arguments (not named)
- ✅ Positional callers can still invoke this overload by type/order

---

## Migration Pattern (Drop + Create)

**PostgreSQL does not allow parameter renames via `CREATE OR REPLACE`.**

To change parameter names, you must:

1. **DROP** the old overload by exact signature
2. **CREATE** the new overload with renamed parameters

**Example:**

```sql
-- Migration 1: Drop old compat overload
DROP FUNCTION IF EXISTS public.claim_job_atomic(INTEGER, TIMESTAMPTZ, TEXT);
```

```sql
-- Migration 2: Create compat overload with c_* params
CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  c_lease_seconds INTEGER,
  c_now TIMESTAMPTZ,
  c_worker_id TEXT
)
RETURNS TABLE (...)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.claim_job_atomic(c_worker_id, c_now, c_lease_seconds);
END;
$$;
```

**Each migration must be a single statement** (Supabase requirement).

---

## Verification

After applying compat wrapper migrations, verify:

### 1. Both overloads exist

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS type_signature,
  proargnames AS param_names
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'claim_job_atomic'
ORDER BY type_signature;
```

**Expected:**
- One overload with params: `{p_worker_id, p_now, p_lease_seconds}`
- One overload with params: `{c_lease_seconds, c_now, c_worker_id}`

### 2. Named-arg RPC resolves to canonical

Test via PostgREST/Supabase client:

```javascript
const { data, error } = await supabase.rpc("claim_job_atomic", {
  p_worker_id: "test-worker",
  p_now: new Date().toISOString(),
  p_lease_seconds: 30
});
```

**Should succeed without ambiguity errors.**

### 3. RPC signature tripwire passes

CI smoke test includes a "tripwire" that:
- Calls `claim_job_atomic` with named args
- Verifies no ambiguity errors
- Verifies correct signature resolution (no unexpected claims)

---

## Related Issues Fixed

- **Infinite recursion**: Compat wrapper calling itself via named params (fixed by positional delegation)
- **PostgREST ambiguity**: Two overloads with identical param names (fixed by `c_*` namespace)
- **SQL ambiguity**: `started_at` ambiguous between RETURNS TABLE and table column (fixed by table alias qualification)

---

## References

- **Job Contract**: `docs/JOB_CONTRACT_v1.md`
- **A4 PR**: https://github.com/Mmeraw/literary-ai-partner/pull/9
- **CI Run (green)**: #328
- **Migrations**: `supabase/migrations/202602070000{11,12,15,16,17}_*.sql`

---

## Summary for Future Devs

**If you need to add a compat wrapper for any PostgREST-exposed function:**

1. ✅ Use `c_*` prefix for ALL compat parameters
2. ✅ Use `p_*` prefix for canonical parameters
3. ✅ Delegate from compat to canonical using **positional** arguments
4. ✅ Use DROP + CREATE migrations (not CREATE OR REPLACE) when renaming params
5. ✅ Test with named-arg RPC calls to verify no ambiguity

**This prevents PostgREST from ever confusing which overload to invoke.**

---

**Approved by**: Mmeraw  
**Enforcement**: Pre-commit Canon Guard (JOB_CONTRACT_v1)  
**Audit**: Permanent governance requirement
