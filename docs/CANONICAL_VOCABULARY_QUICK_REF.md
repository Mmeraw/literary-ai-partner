# Canonical Vocabulary - Quick Reference

**One-page cheat sheet for canonical terms**

## Job Status (Top-Level)
```typescript
"queued" | "running" | "failed" | "complete"
```
❌ Don't use: `completed`, `done`, `error`, `pending` (as job status), `retry_pending`, `canceled`

## Storage Phases (`evaluation_jobs.phase`)
```typescript
"phase_0" | "phase_1a" | "phase_2" | "phase_3" | "wave_revision"
```

These are **Vercel/Supabase execution envelopes**, not the same thing as editorial passes.

| Storage value | Canonical display name | What runs |
|---|---|---|
| `phase_1a` | Phase 1A — Story Ledger Fork | Pass 1A Story/Character Ledger and Pass 3A Preflight run in parallel |
| `phase_2` | Phase 2 — Pass 1+2 Handoff | Pass 1 craft execution + Pass 2 editorial/literary read; writes `pass12_handoff_v1` |
| `phase_3` | Phase 3B — Final Synthesis & Report Assembly | Pass 3B synthesis, deterministic Pass 4 Quality Gate, `evaluation_result_v2`, and WAVE plan |

❌ Don't use: `phase_1`, `phase1`, `phase2`, `p1`, `p2`, `Phase 1`.

## Pass / Artifact Labels

| Artifact / pass label | Canonical display name | Notes |
|---|---|---|
| `pass1a_chunk_cache_v1` | Pass 1A Chunk Cache | Resume checkpoint for the Story Ledger sweep |
| `pass1a_character_ledger_v1` | Pass 1A Story Ledger / Character Ledger | Durable ledger used by later passes |
| `pass3_preflight_draft_v1` | **Phase 3A / Pass 3A Preflight** | Independent preflight read produced during `phase_1a`; consumed by Phase 3B |
| `pass12_handoff_v1` | Pass 1+2 Handoff | Captured Pass 1 and Pass 2 outputs; not a separate pass |
| `evaluation_result_v2` | Phase 3B Final Evaluation Result | Final report payload after synthesis and gate |

Binding rule: **Preflight is Phase 3A / Pass 3A by display name.** The current storage envelope may still be `phase_1a` because Phase 3A runs in parallel with Story Ledger work, but operator-facing labels, Supabase comments, dashboards, logs, and docs must not call it plain `phase_3`.

## Phase Status (Intra-Phase State)
```typescript
"queued" | "running" | "complete" | "failed"
```
❌ Don't use: `progress.stage`, `starting`, `processing`, `completed`, `phase2_error`, `pending` (for `phase_status`)

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
  toDisplayPhase,
  type CanonicalPhase,
  type CanonicalJobStatus,
  type CanonicalPhaseStatus,
} from '@/lib/jobs/canon';
```

### Writing to storage (always canonical):
```typescript
await updateJob(jobId, {
  status: CANONICAL_JOB_STATUS.RUNNING,
  progress: {
    phase: CANONICAL_PHASE.PHASE_1A,                // storage envelope
    phase_status: CANONICAL_PHASE_STATUS.RUNNING,  // NOT stage
    display_stage: "phase_3a_preflight",           // optional display label only
  }
});
```

### Displaying in UI:
```typescript
const label = toDisplayPhase(job.progress?.phase ?? null);
// For artifacts, map pass3_preflight_draft_v1 → "Phase 3A / Pass 3A Preflight".
```

## Testing for Violations

Run the canon audit before every commit:
```bash
./scripts/canon-audit-banned-aliases.sh
```

**Error-level** (blocks merge): Violations in `app/`, `lib/`, `supabase/`, `tests/`  
**Warning-level** (informational): Violations in `scripts/`, `docs/`, archived migrations

## Common Violations & Fixes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `phase: "phase_1"` | `phase: CANONICAL_PHASE.PHASE_1A` |
| `phase: "phase1"` | `phase: CANONICAL_PHASE.PHASE_1A` |
| `message: "Resuming from phase 1 handoff"` | `message: "Resuming from Pass 1+2 handoff"` |
| `pass3_preflight_draft_v1` displayed as `phase_3` | Display as `Phase 3A / Pass 3A Preflight` |
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

- **Read operations**: Runtime may tolerate `phase_1` only as a legacy compatibility alias.
- **Write operations**: Use `CANONICAL_*` constants only; never write `phase_1`.
- **Artifact display**: `pass3_preflight_draft_v1` is Phase 3A / Pass 3A Preflight.
- **Tests**: Update fixtures to use canonical storage values and artifact display labels.

## Full Documentation

- **Governance**: [CANONICAL_VOCABULARY.md](./CANONICAL_VOCABULARY.md)
- **Migration Guide**: [CANONICAL_VOCABULARY_MIGRATION.md](./CANONICAL_VOCABULARY_MIGRATION.md)
- **Schema Rules**: [SCHEMA_CODE_NAMING_GOVERNANCE.md](./SCHEMA_CODE_NAMING_GOVERNANCE.md)
- **Implementation**: [lib/jobs/canon.ts](../lib/jobs/canon.ts)

**This is law.** No merge without passing audit.