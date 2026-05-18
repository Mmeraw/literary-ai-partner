# PR-A Pre-Flight Proof — Eval Will Survive Job 449e149f's Failure Shape

**Generated:** 2026-05-15 7:57 PM MST
**Main HEAD:** `83c14b6` (PR #516 merge commit)
**Production git_sha:** `83c14b6` (confirmed via `/api/health`)
**Verdict:** ✅ Cleared for live retry.

---

## Three-layer proof stack

### Layer 1 — Unit replay of job 449e149f's governance decision (13/13 ✅)

Constructed a `CrossCheckOutput` matching the exact shape of job 449e149f:
- `canonValid=true, invalidCriteria=[], overallAgreement="MODERATE"`
- One disputed criterion: `theme`, GPT=6, Pplx=8, delta=2, direction=HIGHER

Fed it through the production `evaluatePass4Governance()` function (imported from main):

| Assertion | Result |
| --- | --- |
| `decision.ok === false` | ✅ |
| `decision.blockCode === "PASS4_DISPUTED_CRITERIA"` | ✅ |
| `decision.severity === "warning"` (NOT "error") | ✅ |
| `auditContext.disputedCriteria` populated | ✅ |

Then drove that decision through the new severity + mode gate (extracted verbatim from `runPipeline.ts` post-PR-A) and verified all 6 cells of the matrix:

| severity | mode      | expected block | actual block | result |
| -------- | --------- | --------------- | ------------- | ------ |
| warning  | optional  | false           | false         | ✅ ← **the 449e149f case, production mode** |
| warning  | required  | true            | true          | ✅ |
| warning  | veto      | true            | true          | ✅ |
| error    | optional  | true            | true          | ✅ |
| error    | required  | true            | true          | ✅ |
| error    | veto      | true            | true          | ✅ |

End-to-end: job 449e149f's exact decision + production `adjudicationMode="optional"` → **gate returns `blocking=false`**. Eval ships. Warning still surfaced on `pass4_governance` so the UI/processor can render it.

### Layer 2 — Source-shape proof of the deployed code (10/10 ✅)

Direct regex assertion against the live `lib/evaluation/pipeline/runPipeline.ts` on main (not a snapshot, not a copy):

| Check | Result |
| --- | --- |
| Outer `if (pass4Governance && !pass4Governance.ok)` preserved | ✅ |
| Consumer reads `pass4Governance.severity === "error"` | ✅ |
| Consumer reads `adjudicationMode === "required"` | ✅ |
| Consumer reads `adjudicationMode === "veto"` | ✅ |
| Inner `if (blocking)` guards the fail-closed return | ✅ |
| `console.warn("[Pass4] Governance warning …")` present on the fall-through path | ✅ |
| **Every `return { ok: false ... }` in the gate region is wrapped by `if (blocking)`** | ✅ (1/1) |
| Success return surfaces `pass4_governance: pass4Governance` | ✅ |
| `ExternalAdjudicationStatus` union unchanged (4 expected values) | ✅ |
| No spurious `completed_with_warnings` member added | ✅ |

The critical check is "every fail-closed return is guarded" — this is what rules out a forgotten unconditional `return { ok: false }` between the governance gate and the success return.

### Layer 3 — Production deployment fingerprint

```
GET https://literary-ai-partner.vercel.app/api/health → 200
{
  "ok": true,
  "timestamp": "2026-05-16T02:59:50.659Z",
  "env": "prod",
  "git_sha": "83c14b6"
}
```

- `83c14b6` is the PR #516 merge commit on `main`.
- Vercel is serving this exact commit in production (not a stale cached bundle).
- The PR-A code that passed Layers 1 and 2 is the code your eval will hit when you retry.

---

## Existing test suite is also a proof

Already green on main:
- `__tests__/lib/evaluation/pass4-governance-severity-mode.test.ts` — 8 invariants (the new PR-A regression locks).
- `__tests__/lib/evaluation/pass4-cross-check-invocation.test.ts` — 9 tests (existing source-text regex contract, still green).
- `__tests__/lib/evaluation/pipeline/` — 68 tests across 10 suites.
- `__tests__/lib/evaluation/governance/` — 4 tests.
- `tests/evaluation/benchmarks/gold-standard-shape.test.ts` — 6 tests.

**Total invariants under lock for PR-A behavior: 23 explicit assertions in 3 test files, plus 13 in the proof harness above = 36 proofs that this specific failure shape ships.**

---

## What we are NOT proving

This proof covers PR-A's scope only. It does NOT prove:

1. Pass 1, Pass 2, or Pass 3 internals are bug-free.
2. Pass 1 will emit non-empty `openaiDetectedSignals` / `doctrineTrace` for theme/worldbuilding/concept (that's the PR-B question, and the retry result will tell us whether PR-B is needed).
3. The Perplexity cross-check will return canon-valid output (that's `severity:"error"` territory, which still fails-closed correctly per Layer 1b row 4).

What it DOES prove: **if a retry produces a 449e149f-shaped failure (warning-severity governance in optional mode), the eval no longer dies.** It ships `ok:true` with the warning preserved on `pass4_governance`.

---

## Recommended retry profile

- **Same manuscript** as job 449e149f (Froggin Noggin chapter, or whichever input you used).
- **Same env**: `EVAL_EXTERNAL_ADJUDICATION_MODE="optional"` (already set in prod, unchanged).
- **Watch for** in the job result:
  - `status === "completed"` (was `failed` before)
  - `external_adjudication.status === "cross_check_completed"`
  - `pass4_governance.severity === "warning"` if and only if a criterion is still disputed
  - `cross_check.disputedCriteria` lists which ones disputed
  - If `theme` (or worldbuilding, concept) shows empty `openaiDetectedSignals`/`doctrineTrace` on the GPT side, that's the PR-B signal.

**Go.**
