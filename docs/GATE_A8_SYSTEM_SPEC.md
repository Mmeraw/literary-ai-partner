# Gate A8 — Artifact Index & Discovery
System Specification

**Status:** PLANNED  
**Created:** 2026-02-17 UTC  
**Owner:** Founder / Architect  
**Preconditions:** A5 CLOSED, A6 CLOSED, A7 CI-VERIFIED

---

## 1. Thesis

Evaluation artifacts are **queryable, organizable resources** under owner authority, with optional public projection of collections via share tokens.

A7 proved artifacts can exist independently of user sessions.  
A8 organizes them into a queryable platform.

---

## 2. Architecture Shift: From Workflow to Platform

### Before A8: User Workflow Model
- Artifacts are "user's private outputs"
- Access pattern: "Is this user allowed to see their own thing?"
- Lifecycle: born when queued, retrieved once, forgotten

### After A8: Artifact Platform Model
- Artifacts are **first-class addressable resources**
- Access patterns: owner auth, token projection, future: API keys
- Lifecycle: indexed, queryable, organizable, shareable, archivable
- Collections are **projections**, not mutations

**Critical distinction:** A8 is NOT "batch submission." Batch is a client convenience layered on top of a durable artifact index.

---

## 3. Guarantees

### 3.1 Index Authority
- Owner can list their jobs/artifacts with filters: status, date range, limit
- Listing is deterministic and returns **canonical artifact metadata only** (`one_page_summary`)
- Queries are O(log n) via proper indexing (`manuscript_id, status, created_at DESC`)

### 3.2 Collection Projection
- Owner can create collections referencing owned jobs
- Collections are **read-only projections**; they never mutate canonical artifacts
- Collections support metadata: name, description, timestamps
- One collection can reference N artifacts; one artifact can appear in M collections

### 3.3 Share Projection (Extends A7 Pattern)
- Public access to a collection is **only via token-hash lookup** (SHA-256)
- Fail-closed 404 on invalid/revoked/expired token
- Share lifecycle: create → optional expiry → optional revocation
- View tracking: `view_count`, `last_viewed_at` (best-effort)

### 3.4 No Privilege Escalation (Strict Governance)
- **Owner listing uses SECURITY INVOKER** (RLS-based, no privilege bypass)
- **SECURITY DEFINER used ONLY for:**
  - Token-based public projection (`get_public_artifact_collection`)
  - Token creation/revocation (requires hash storage privilege)
- Ownership derived correctly: `evaluation_jobs → manuscripts → created_by`

### 3.5 A5/A6/A7 Invariants Preserved
- Index never mutates canonical artifacts
- Queries respect RLS (owner sees own, shares use tokens)
- A6 credibility enforcement applies to all views
- A7 share tokens remain independent (job-level vs collection-level)

---

## 4. Schema Design

### 4.1 Query Indexes (evaluation_jobs)
```sql
-- Owner listing with status filter
CREATE INDEX idx_jobs_manuscript_status_created
  ON evaluation_jobs(manuscript_id, status, created_at DESC);

-- Temporal queries
CREATE INDEX idx_jobs_manuscript_updated
  ON evaluation_jobs(manuscript_id, updated_at DESC);
```

### 4.2 artifact_collections
```sql
CREATE TABLE artifact_collections (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description text,
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_public boolean DEFAULT false  -- future: discovery
);
```

**No `share_token_hash` column** — violates lifecycle governance. Shares are separate resources.

### 4.3 collection_artifacts (junction)
```sql
CREATE TABLE collection_artifacts (
  collection_id uuid REFERENCES artifact_collections ON DELETE CASCADE,
  job_id uuid REFERENCES evaluation_jobs ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  added_by uuid REFERENCES auth.users NOT NULL,
  PRIMARY KEY (collection_id, job_id)
);
```

### 4.4 collection_shares (A7 pattern)
```sql
CREATE TABLE collection_shares (
  id uuid PRIMARY KEY,
  collection_id uuid REFERENCES artifact_collections ON DELETE CASCADE,
  token_hash bytea UNIQUE NOT NULL,  -- SHA-256, never plaintext
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int DEFAULT 0,
  last_viewed_at timestamptz,
  
  -- One active share per collection
  CONSTRAINT unique_active_collection_share 
    UNIQUE NULLS NOT DISTINCT (collection_id, revoked_at)
    WHERE (revoked_at IS NULL)
);
```

---

## 5. RPC Functions (Governance-Correct)

### 5.1 list_my_artifacts (SECURITY INVOKER)
```sql
CREATE FUNCTION list_my_artifacts(
  p_status text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (...) 
SECURITY INVOKER  -- ← RLS-based, no privilege escalation
```

**Why INVOKER:** Owner-only read should use RLS, not privilege bypass.

### 5.2 create_artifact_collection (SECURITY INVOKER)
```sql
CREATE FUNCTION create_artifact_collection(
  p_name text,
  p_description text,
  p_artifact_ids uuid[]
)
RETURNS uuid
SECURITY INVOKER  -- ← Ownership validation via RLS
```

**Validation:** User must own all `p_artifact_ids` (via `manuscripts.created_by = auth.uid()`).

### 5.3 share_artifact_collection (SECURITY DEFINER)
```sql
CREATE FUNCTION share_artifact_collection(
  p_collection_id uuid,
  p_expires_hours int
)
RETURNS text  -- plaintext token (ONLY TIME visible)
SECURITY DEFINER  -- ← Required for hash storage
```

**Why DEFINER:** Token creation requires privilege to write hash, but still validates ownership first.

### 5.4 get_public_artifact_collection (SECURITY DEFINER, anon-callable)
```sql
CREATE FUNCTION get_public_artifact_collection(p_token text)
RETURNS TABLE (
  collection_id uuid,
  collection_name text,
  artifacts jsonb
)
SECURITY DEFINER  -- ← Anon access requires privilege bypass
```

**Why DEFINER:** Anon role cannot query `evaluation_jobs`/`manuscripts` directly; RPC provides controlled projection.

**Fail-closed:** Invalid/revoked/expired token → no results (not an error, just empty).

---

## 6. Server-Side Query Pattern (NOT HTTP API Round-Trip)

### ❌ WRONG (Dashboard anti-pattern)
```typescript
// Server component fetching its own API
const artifacts = await fetch('/api/artifacts?status=complete')
```

**Problem:** Cookie handling, absolute URLs, caching, duplicate logic.

### ✅ CORRECT (Direct server-side query)
```typescript
// app/dashboard/page.tsx (Server Component)
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = createClient()
  
  const { data: artifacts } = await supabase
    .rpc('list_my_artifacts', { p_status: 'complete', p_limit: 50 })
  
  return <ArtifactList artifacts={artifacts} />
}
```

**Benefit:** Single query path, proper auth context, no HTTP overhead.

---

## 7. Evidence Requirements (Two-Phase Closure Like A7)

### 7.1 Unit Tests
- Collection ownership validation (cannot add unowned artifacts)
- Share token hashing/expiry/revocation semantics
- Canonical artifact selection (deterministic `one_page_summary`)

### 7.2 Evidence Script: `scripts/evidence-a8.sh`

**Test Scenarios (8):**
1. ✅ Owner lists artifacts (status filter, date filter)
2. ✅ Non-owner cannot list others' artifacts (RLS enforcement)
3. ✅ Owner creates collection with owned artifacts → 200
4. ✅ Owner cannot add unowned artifacts → validation error
5. ✅ Owner shares collection → token returned
6. ✅ Anon views collection via token → 200 + artifact array
7. ✅ Revoked collection share → 404 (fail-closed)
8. ✅ Expired/invalid token → 404 (fail-closed)

### 7.3 Two-Phase Closure
**Phase 1:** CI-VERIFIED  
- All unit tests passing
- Evidence script executable
- No regressions (Flow 1, Canon Guard, Security Scan)

**Phase 2:** RUNTIME SEALED  
- Migrations applied to deployed DB
- Evidence script executed against deployed instance
- Runtime output recorded in closure doc

---

## 8. Out of Scope for A8

**Not included** (deferred to later gates):
- Batch submission API (trivial after A8: just create N jobs, query index)
- Advanced search/filters beyond status+date (A9+)
- Analytics/aggregations (avg score, completion rate) (A9+)
- Public API exposure (REST/GraphQL endpoints) (A10+)
- Discovery/marketplace (requires `is_public` flag activation) (A10+)

**Why defer:** A8 proves the core primitive (artifact index + collection projection). Advanced queries are additive, not foundational.

---

## 9. Strategic Win

**A7 proved:** Artifacts can exist outside user sessions (independent authority).

**A8 proves:** Artifacts are queryable, organizable resources (platform primitive).

**A9+ becomes:** Advanced queries, federation, external API, analytics — all emerging from A8's index authority.

**This is the difference between:**
- ❌ Building features (batch API, dashboard, search, analytics as silos)
- ✅ Building a platform (artifact authority → all features emerge from index queries)

---

## 10. Next Steps

1. Review A8 migration SQL (`20260217140000_gate_a8_artifact_index.sql`)
2. Create A8 routes:
   - `GET /api/artifacts` (server-side query, not HTTP round-trip in components)
   - `POST /api/collections`
   - `POST /api/collections/[id]/share`
   - `GET /collection/[token]` (public view)
3. Create A8 UI:
   - Dashboard page (artifact list with status filters)
   - Collection create/edit page
   - Collection share page (extends `app/share/[token]` pattern)
4. Create unit tests
5. Create `scripts/evidence-a8.sh`
6. Run CI
7. Document runtime evidence
8. Close A8 (two-phase: CI-VERIFIED → RUNTIME SEALED)

---

## 11. Approval Gates

**Ready to proceed when:**
- [ ] A7 status = CI-VERIFIED or RUNTIME SEALED
- [ ] Migration reviewed (governance principles verified)
- [ ] RPC privilege model approved (INVOKER vs DEFINER separation)
- [ ] Evidence script scope defined (8 scenarios minimum)

**Blocked if:**
- A7 not CI-verified (dependency)
- Governance violations found (DEFINER used for owner queries)
- Canonical artifact selection ambiguous (must filter `artifact_type = 'one_page_summary'`)
