# Canonical Vocabulary - Quick Reference

**One-page cheat sheet for canonical terms**

## Job Status (Top-Level)
```typescript
"queued" | "running" | "retry_pending" | "failed" | "complete" | "canceled"
```
❌ Don't use: `completed`, `done`, `error`, `pending` (as job status)

## Phases (Pipeline Stages)
```typescript
"phase_0" | "phase_1" | "phase_2"
```
❌ Don't use: `phase1`, `phase2`, `p1`, `p2`, `Phase 1`

## Phase Status (Intra-Phase State)
```typescript
"pending" | "running" | "complete" | "failed"
```
❌ Don't use: `progress.stage`, `starting`, `processing`, `completed`, `phase2_error`

## Ownership
```typescript
user_id: UUID          // Who owns/can access this record
created_by?: UUID      // Who created it (if different from owner)
```
❌ Don't use: `owner_id`, `author_id`

## Manuscript Identity
```typescript
manuscript_id: BIGINT  // References manuscripts.id
```
❌ Don't use: `document_id`, `work_id`, `doc_id`, `submission_id`

## Using Canonical Values

### Import the canon module:
```typescript
import {
  CANONICAL_JOB_STATUS,
  CANONICAL_PHASE,
  CANONICAL_PHASE_STATUS,
  toCanonicalPhase,
  toDisplayPhase,
  CanonicalPhase,
  CanonicalJobStatus,
  CanonicalPhaseStatus,
} from '@/lib/jobs/canon';
```

### Writing to storage (always canonical):
```typescript
await updateJob(jobId, {
  status: CANONICAL_JOB_STATUS.RUNNING,
  phase: CANONICAL_PHASE.PHASE_1,
  progress: {
    phase_status: CANONICAL_PHASE_STATUS.RUNNING,  // NOT stage
    // ...
  }
});
```

### Reading from storage (normalize legacy data):
```typescript
const job = await getJob(jobId);
const phase = toCanonicalPhase(job.phase);  // Handles "phase1" → "phase_1"
```

### Displaying in UI:
```typescript
const label = toDisplayPhase(job.phase);  // "phase_1" → "Phase 1"
```

## Testing for Violations

Run the canon audit before every commit:
```bash
./scripts/canon-audit-banned-aliases.sh
```

**Error-level** (blocks merge): Violations in `app/`, `lib/`, `supabase/`, `tests/`  
**Warning-level** (informational): Violations in `scripts/`, `docs/`

## Common Violations & Fixes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `phase: "phase1"` | `phase: CANONICAL_PHASE.PHASE_1` |
| `progress.stage = "processing"` | `progress.phase_status = CANONICAL_PHASE_STATUS.RUNNING` |
| `if (status === "completed")` | `if (status === CANONICAL_JOB_STATUS.COMPLETE)` |
| `owner_id UUID` | `user_id UUID` |
| `manuscript.document_id` | `manuscript_id` |

## RLS Patterns

### ✅ Canonical (correct):
```sql
CREATE POLICY "Users view own jobs" ON evaluation_jobs
FOR SELECT USING (user_id = auth.uid());
```

### ❌ Non-canonical (wrong):
```sql
-- Don't use owner_id, author_id, or created_by for authorization
CREATE POLICY "Users view own jobs" ON evaluation_jobs
FOR SELECT USING (owner_id = auth.uid());  -- WRONG
```

## Migration Notes

- **Read operations**: Wrap with `toCanonical*()` for backward compatibility
- **Write operations**: Use `CANONICAL_*` constants only
- **Database**: Run migrations in [CANONICAL_VOCABULARY_MIGRATION.md](./CANONICAL_VOCABULARY_MIGRATION.md)
- **Tests**: Update all test fixtures to use canonical values

## Full Documentation

- **Governance**: [CANONICAL_VOCABULARY.md](./CANONICAL_VOCABULARY.md)
- **Migration Guide**: [CANONICAL_VOCABULARY_MIGRATION.md](./CANONICAL_VOCABULARY_MIGRATION.md)
- **Schema Rules**: [SCHEMA_CODE_NAMING_GOVERNANCE.md](./SCHEMA_CODE_NAMING_GOVERNANCE.md)
- **Implementation**: [lib/jobs/canon.ts](../lib/jobs/canon.ts)

## Questions?

If you need to use a non-canonical term:
1. Check if it's a display-only context (UI/logs) → use `toDisplay*()` helper
2. Check if it's external API compatibility → document in CANONICAL_VOCABULARY.md "Approved Exceptions"
3. Otherwise → use canonical value

**This is law.** No merge without passing audit.
