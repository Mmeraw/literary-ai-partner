# Canonical Vocabulary Governance (CANON)

## Principle
One concept = one canonical key name in storage. All other variants are banned aliases.

## Canonical Terms Map

| Domain | Canonical Key | Banned Aliases | Enforcement Scope |
| :--- | :--- | :--- | :--- |
| **Ownership** | `user_id` | `owner_id`, `created_by` (if same), `author_id` | DB, RLS, Types |
| **Job Status** | `status` | `state`, `stage`, `job_state` | DB, UI (succeeded) |
| **Job Phase** | `phase` | `stage`, `p1`, `p2`, `phase1`, `phase2` | DB, TS Enums |
| **Phase Status** | `phase_status` | `status`, `complete`, `done`, `error` | DB, Progress JSON |
| **Manuscript** | `manuscript_id` | `document_id`, `work_id`, `doc_id` | DB, FKs |
| **Chunk Index** | `chunk_index` | `index`, `chunk_number`, `chunkNo` | DB, Functions |
| **Time (Start)** | `started_at` | `start_time`, `time_started` | DB, Heartbeat |
| **Time (End)** | `completed_at` | `finished_at`, `end_time`, `done_at` | DB, Succeeded |

## Storage vs Display Rules
- **Storage (DB/TS):** Must use Canonical Key.
- **Display (UI/Logs):** May use labels (e.g., "Done", "Phase 1"), but must map 1:1 to Canonical Key.

## RLS Contract
- All user-owned tables MUST use `user_id` (UUID).
- RLS policies MUST reference `auth.uid() = user_id`.

## Verification Gate
- CI scripts must grep for Banned Aliases and fail on match.

- ---

## Domain Boundary Rules (HARD REQUIREMENTS)

### Job Completion Status
- Job completion MUST be `status='succeeded'`
- The word "complete" MUST appear ONLY in `phase_status` (or as a verb in code comments)
- The word "complete" MUST NEVER appear as a job status value

### Ownership vs Audit
- `user_id` is the canonical authorization key (RLS)
- `created_by` is for audit trail only; NEVER use in RLS policies
- If `user_id` and `created_by` have the same meaning on a table, keep only `user_id`

### Timestamp Semantics
Each timestamp has ONE meaning; never overload:
- `created_at`: row creation (immutable)
- `started_at`: first transition to running
- `heartbeat_at`: worker keep-alive signal
- `completed_at`: terminal success state
- `failed_at`: terminal failure state
- `updated_at`: ONLY for generic row update tracking; NEVER use as heartbeat

---

## Migration Safety Requirements (MANDATORY)

Every schema change MUST include:

### Pre-Flight Verification
1. **Inventory queries** (e.g., count non-UUID job IDs, orphan artifacts)
2. **Expected value checks** (document what counts/states you expect before migration)
3. **RLS policy inventory** (list all policies affected by the change)

### Rollback Script
1. Every migration MUST have a tested rollback script
2. Rollback script MUST be committed alongside forward migration
3. Rollback MUST restore both schema AND data state

### Deployment Strategy
1. **Staging dry-run first** (run migration on staging DB)
2. **Smoke tests per environment** (test critical paths after migration)
3. **Canary/blue-green rollout** for changes impacting workers or high-traffic tables
4. **Table lock budget**: document acceptable lock duration; abort if exceeded

### Post-Migration Validation
1. **End-to-end integration test** (job → chunks → artifact)
2. **RLS isolation test** (User A cannot see User B's data)
3. **Performance baseline comparison** (query latency before/after)
4. **Error rate monitoring** (set rollback trigger thresholds, e.g., 5% error spike)

---

## Bridge/Transition Policy

When renaming columns or enum values:

### Two-Column Swap (for risky renames)
1. Add new canonical column (e.g., `user_id`) alongside old column (e.g., `owner_id`)
2. Backfill new column from old column
3. Update application code to write to BOTH columns
4. Minimum bridge lifetime: **2 releases**
5. Add deprecation warnings in logs when old column is accessed
6. Monitor usage; remove old column only after **30 days of zero usage**

### Enum Value Swap
1. Add new canonical value to enum
2. Migrate data from old → new value
3. Update application code to use new value
4. Deprecation period: **2 releases**
5. Remove old enum value only after zero usage confirmed

---

## RLS Rewrite Protocol (HIGH RISK)

### Before Any RLS Change
1. **Inventory all affected policies** (e.g., `user_id` → `created_by` impacts 6 policies)
2. **Create RLS test suite** if not exists:
   - User A can CRUD own rows
   - User A CANNOT access User B rows
   - Service role can access all rows
   - Admin role can access Storygate rows only
3. **Run RLS tests BEFORE change** (establish baseline)

### During RLS Change
1. Update ONE policy at a time
2. Run RLS test suite after each policy update
3. Deploy with canary rollout (5% traffic first)

### After RLS Change
1. Run full RLS test suite
2. Manual QA: test UI as different user roles
3. Monitor for unauthorized access errors (set alert threshold)

---

## CI Enforcement (Drift Gate)

### Error-Level (Blocks PR)
- Banned aliases in **storage layer** (DB columns, enum values, RPC parameters)
- Missing rollback script for schema migrations
- RLS policy using `created_by` for authorization

### Warning-Level (Does Not Block)
- Banned aliases in **display layer** (UI labels, log messages)
- Comments using informal phase names (e.g., "phase1")

### Linter Output Format
```
❌ CANON_VIOLATION: Found banned alias 'owner_id' in storage layer
   File: supabase/migrations/001_add_table.sql:15
   Fix: Replace 'owner_id' with canonical 'user_id'
   See: docs/CANONICAL_VOCABULARY.md#ownership
```

### Exception Mechanism
- Rare legacy cases MAY use `// @canon-exception: <reason>` comment
- Exception MUST include Jira ticket or GitHub issue link
- Exceptions are reviewed in quarterly canon audit

---

## External API Compatibility

If external consumers depend on old field names:

### API Versioning
1. Maintain backward-compatible v1 API with old field names
2. Introduce v2 API with canonical field names
3. v1 → v2 response mapping layer (transform `owner_id` → `user_id` at API boundary)
4. Deprecation timeline: **6 months notice** before removing v1
5. Deprecation headers: `Warning: "v1 API deprecated; migrate to v2 by YYYY-MM-DD"`

---

## Execution Priority (Lock This Order)

1. ✅ Lock CANONICAL_TERMS.md (this document) + banned aliases
2. 🔍 Ripgrep audit → exact fix list (grep for all banned aliases)
3. 🛡️ RLS policy inventory + test suite creation
4. 🔧 Low-risk Supabase renames (e.g., index names, comments)
5. 🔄 Enum value normalization (e.g., "completed" → "succeeded")
6. 📝 TypeScript type cleanup + code sweep
7. ⚙️ Worker logic updates (heartbeat, lease, claim)
8. 🧹 Drop compatibility bridges (after 30-day zero-usage confirmation)
9. 🚦 Enable CI drift gate (enforce on all new PRs)
10. 📚 Publish canonical terms in API docs (for external consumers)
