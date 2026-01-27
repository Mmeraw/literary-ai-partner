# GitHub Copilot Quick Reference

## One-Line Instruction (Copy-Paste at Session Start)

When starting a new GitHub Copilot Chat session, paste this:

```
This repo is governed by JOB_CONTRACT_v1. Do not invent or rename job statuses. Canonical JobStatus is exactly: queued, running, complete, failed. Illegal transitions must throw and must not write to DB. Observability must be passive. If uncertain, stop and ask for the canonical source.
```

## What This Does

GitHub Copilot will:
- ✅ Refuse to suggest forbidden status values like `"completed"`, `"done"`, `"success"`
- ✅ Ask for the canonical contract when uncertain
- ✅ Avoid inferring or fabricating job state
- ✅ Not suggest code that bypasses transition validation
- ✅ Keep metrics/logging passive (no control flow)

## Verification

To verify Copilot is constrained:

1. Open a file with job status logic
2. Start typing a comment: `// TODO: add status "completed"`
3. Copilot should either:
   - Not autocomplete it, or
   - Suggest `"complete"` instead

## Permanent Constraints

These files enforce governance automatically:

- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** — Loaded by GitHub Copilot
- **[docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md)** — Canonical source of truth
- **[scripts/canon-guard.sh](scripts/canon-guard.sh)** — Commit-time validation

## If Copilot Suggests a Canon Violation

1. Don't accept the suggestion
2. Run: `npm run canon:guard`
3. If it passes, the suggestion is safe
4. If it fails, reject the suggestion and reference JOB_CONTRACT_v1

## Example Conversations

### ✅ Good
**You**: "Add logging to track job status transitions"  
**Copilot**: *Suggests passive logging that observes state changes without altering control flow*

### ❌ Bad (Copilot should refuse)
**You**: "Let's add a 'completed' status for clarity"  
**Copilot**: "I cannot do that. JOB_CONTRACT_v1 specifies the canonical status is 'complete', not 'completed'. Changing this would require versioning to JOB_CONTRACT_v2."

## Override (Emergency Only)

If you truly need to change canon:

1. Update [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md)
2. Bump version to `v2`
3. Update [scripts/canon-guard.sh](scripts/canon-guard.sh)
4. Document migration plan
5. Update [.github/copilot-instructions.md](.github/copilot-instructions.md)

---

**TL;DR**: GitHub Copilot is now boxed in by canonical contracts. Trust but verify with `npm run canon:guard`.
