# Handoff Brief — Held Recovery "Unit 3" (reconstruction worker/writer)

> Audience: Devin (or any implementer picking up this branch).
> This branch (`feature/held-recovery-reconstruction-worker-v2`) is a **clean pointer at
> `main` after PR #1340** (`22eb84f3`), with **zero commits above main** except this
> docs-only file. The code tree is intentionally a pristine starting point.

## Current state of play

**Repo:** `github.com/Mmeraw/literary-ai-partner`. **Node 24 required** (`nvm use 24`).
Git identity used so far: `mikemeraw@gmail.com` / Mike Meraw.

- **PR #1340 — merged** to `main` (merge commit `22eb84f3`). Established the non-negotiable
  manuscript-identity contract (below).
- **Draft PR #1341 — open.** Branch `feature/held-recovery-resolve-anchor-wiring-v2`, based on
  main after #1340. Contains **only** Unit 1 (anchor CAS writer + migrations) and Unit 7
  (isolated resolve_anchor caller/core). Default-off, no wiring. **Leave it alone** — it's a
  bounded foundation under CI/review. Unit 3 gets its **own** PR; do not fold into #1341.
- **This branch (`feature/held-recovery-reconstruction-worker-v2`) — your starting point.**
  Based on **main @ 22eb84f3**, independent of #1341. Unit 1/7 files are intentionally absent;
  Unit 3 does **not** depend on them (verified: no imports, no migration FK, no test refs).

> Note: an earlier cancelled agent run created three partial stub files
> (`heldRecoveryReconstructionWriter.ts`, `heldRecoveryReconstructionWorker.ts`, and a
> `20260719120000_create_held_recovery_reconstruction_work.sql` migration). Those were
> **NOT finished** and have been **deleted**. Do not go looking for them — author fresh.

## The decision already made (do NOT re-litigate)

Build Unit 3 **clean-room** directly against main. Do **not** copy the divergent branch's
regressed files and repair them — author fresh against main's real interfaces, using the
divergent branch as **behavioral reference only**.

## Non-negotiable contract (from PR #1340) — this is the whole point

The divergent branch predates #1340 and reverts all of this. Do not reintroduce any of it:

1. `manuscriptId` is a **canonical decimal STRING end-to-end**. Never `number`.
2. **No** `Number(row.manuscript_id)` / `parseInt` / `parseFloat` / any numeric coercion of the
   manuscript id. (Numeric coercion of genuine counts/offsets/versions is fine — never the id.)
3. Persistence column for the manuscript id is **`text`**, never `bigint`.
4. Fingerprints computed from the **canonical string** id value.
5. Reads go through the RPC `get_held_recovery_manuscript_chunks` (projects `manuscript_id::text`)
   — **never** a direct `.from('manuscript_chunks')` read.
6. Any new recorder read path must apply the **`isRecord()` malformed-row guard** before
   destructuring.
7. **Do not modify/weaken/delete:** `heldRecoveryManuscriptIdFidelity.contract.test.ts`, the
   orchestrator `isRecord()` guard, or the canonical-string plumbing in
   `heldRecoveryRuntimeInputs.ts` (`CANONICAL_INTEGER_STRING`, `isCanonicalManuscriptId()`).

## Where the numeric landmines are (divergent branch, for reference — AVOID)

Divergent branch: `feature/held-recovery-resolve-anchor-wiring-tests`.
In its `lib/revision/heldRecoveryReconstructionWriter.ts`:

- `readonly manuscriptId: number` at lines **64, 157, 181**
- `num()` / `Number()` coercion of `manuscript_id` at **:484** and **:566**
- `requirePositiveInteger(attempt.manuscriptId, …)` at **:355**
- migration used a **bigint** id column

The recorder's new `findByHeldItemAndOpportunity` was added **without** an `isRecord()` guard —
you must add it **with** the guard.

## Deliverables (smallest correct diff)

1. **Migration** — reconstruction-work table, `text` manuscript_id column, forward-only, styled
   like existing held-recovery migrations. Plus a SQL-text contract test (read the file; assert
   `text`, not `bigint`).
2. **Writer** — RPC-only, string id throughout, canonical-string fingerprint,
   `asObject()`/`isRecord()` guards, idempotency-conflict discriminated union preserved
   (`{ status:'idempotency_conflict', reason:'completion_fingerprint_mismatch' }`). Contract test
   with STRING fixtures including a **> 2^53** id (precision proof) and a malformed-row case.
3. **Worker skeleton** — composes with main's orchestrator/recorder, **default-off** feature flag,
   strict no-op when off, **NOT wired to any production entrypoint/cron/queue consumer**.
   Contract test.
4. **Recorder** — add `findByHeldItemAndOpportunity` **with** `isRecord()` guard, returning string
   `manuscriptId`. Smallest possible addition; do not alter existing recorder behavior.
5. **Baseline fence** — source-level test asserting: writer has no `Number(row.manuscript_id)` and
   no `manuscriptId: number`; migration uses `text` not `bigint`; new recorder path has an
   `isRecord` guard. Model it on `heldRecoveryResolveAnchorPortBaselineFence.contract.test.ts`
   (on the #1341 branch) — it strips comments before source-text assertions to avoid false
   positives, and each assertion should be negative-control verified.

## Verification (Node 24, before committing)

- Focused Unit 3 suites (writer / worker / migration / recorder / fence)
- `heldRecoveryManuscriptIdFidelity.contract.test.ts` (must still pass)
- `npx jest "lib/revision/__tests__/heldRecovery"` (all held-recovery contract tests — ~490 on this tree)
- `npx tsc --noEmit` (exit 0)
- Scoped ESLint on new/changed files
- `git diff --check`
- Negative-control each new fence assertion (corrupt → confirm fail → restore)

## Scope guardrails

- **No production wiring.** No queue transition, re-admission, or later-stage units — separate work.
- Commit on `feature/held-recovery-reconstruction-worker-v2`; open a **separate** PR (not #1341).
- **Verification honesty:** only claim "verified" if the exact suites actually ran on that exact
  commit under Node 24.

## Contract reference points in the repo

- Preserve: `lib/revision/__tests__/heldRecoveryManuscriptIdFidelity.contract.test.ts`
- Preserve: `isRecord()` guard in `lib/revision/heldRecoveryRuntimeOrchestrator.ts`
- Preserve: `lib/revision/heldRecoveryRuntimeInputs.ts` (`CANONICAL_INTEGER_STRING`, `isCanonicalManuscriptId()`)
- Fence to model on: `lib/revision/__tests__/heldRecoveryResolveAnchorPortBaselineFence.contract.test.ts` (on the #1341 branch)
- Behavioral reference (numeric — do NOT copy): divergent branch `feature/held-recovery-resolve-anchor-wiring-tests`
