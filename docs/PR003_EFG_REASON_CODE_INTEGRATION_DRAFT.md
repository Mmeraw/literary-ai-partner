# PR-003 Draft — EFG Reason-Code Integration

## Intent
Integrate EFG behavior with persisted enforcement signals from `evaluation_result_v2.score_adjustments`.

## Locked contract
- Source seam: `score_adjustments[].reason`
- Primary signal: `AUTHORITY_CAP_APPLIED`
- PR-003 must consume enforcement records (artifact-level), not ledger-only signals.

## Planned behavior
- If `AUTHORITY_CAP_APPLIED` exists, EFG verdict must downgrade to `DEGRADED` unless already `FAIL`.
- Preserve existing EFG logic (append/merge behavior only).
- Use worst-wins verdict ordering: `FAIL > DEGRADED > PASS`.
- Emit/append EFG reason codes without replacing existing ones.

## Preconditions for implementation
- PR-002 merged and live.
- Persisted artifact contract validated from production artifact samples.

## Test matrix (to be implemented in PR-003)
1. No score adjustments -> existing EFG verdict unchanged.
2. `AUTHORITY_CAP_APPLIED` present + current PASS -> DEGRADED.
3. `AUTHORITY_CAP_APPLIED` present + current FAIL -> remain FAIL.
4. Existing reason codes are preserved and extended (append-only).
5. Idempotency: repeated evaluation of same artifact does not duplicate reason codes.

## Out of scope
- Criterion-4 structured mechanism enforcement (`MECHANISM_MISSING`) — deferred to later PR.
- Prompt rewrites.
- Genre detection/intent conditioning.
