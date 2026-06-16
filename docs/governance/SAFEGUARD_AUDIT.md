# Evaluation Safeguard Audit

> Issue #1012: Inventory of retired/modified evaluation safeguards with restoration decisions.

## Safeguard Status Table

| # | Safeguard | Current Status | Changed In | Risk Introduced | Restoration Decision | Blocks Report? |
|---|-----------|---------------|------------|-----------------|---------------------|----------------|
| 1 | **Legacy Perplexity Pass 4 Adjudicator** | Retired | PR #605 | Reduced external validation of final artifact coherence | Replaced by `finalExternalAudit.ts` (compact Perplexity audit) — runs post-persistence in DREAM worker. Adequate. | No (advisory) |
| 2 | **Pass 3B/DREAM inside main pipeline** | Async (moved to `/api/workers/process-dream`) | ~PR #800 era | Report could ship before DREAM artifacts finalize | PR #1158 adds `dream_ready` gate: long-form report display waits for DREAM artifact completion. Restored as lightweight hold. | Yes (long-form only) |
| 3 | **LLR rules (Lessons Learned Registry)** | Warning-only | PR #960 | Repeated defects may pass to author-facing output unblocked | Keep warning-only. LLR rules are heuristic/ML-derived and not deterministic enough to hard-block. Advisory diagnostics persist in governance artifact. | No |
| 4 | **WAVE/Phase 5 execution** | Active but optional for evaluation | Architecture v2 | Ambiguity about whether WAVE is required for report readiness | WAVE is post-evaluation (runs after `persistEvaluationResultV2`). Not required for report release. Only fires for long-form (≥25K words + all criteria ≥6.0 + CharacterLedgerV2 present). Correctly optional. | No |
| 5 | **Short-form sparse routing** | Active | Architecture v2 | Long-form could accidentally take short-form skip paths | `modeRouting.ts` uses strict word-count thresholds (`LONG_FORM_MIN_WORDS = 25_000`). Mode is set once at routing time and propagated immutably through pipeline context. Gate 15 uses the same canonical word-count source. Safe. | No |
| 6 | **Gate 15 (template completeness)** | Active — pre-finalization invariant | PR #1151 | N/A (recently restored) | Runs before `persistEvaluationResultV2`. Blocks completion if template is incomplete. Correctly positioned. | Yes (blocks persistence) |
| 7 | **Evidence Grounding Gate** | Active | PR #1097 | N/A | Verifies manuscript anchors exist for scored criteria. Active and deterministic. | Yes (blocks if zero anchors on scored criterion) |
| 8 | **Recommendation Integrity Gate** | Active | PR #1044 | N/A | Filters malformed/generic recommendations before author-facing output. Deterministic. | Yes (removes bad recs, does not block report) |
| 9 | **Short-Form Evidence Sufficiency Gate** | Active | Issue #1013 implementation | N/A | Marks non-scorable criteria, caps confidence. Deterministic. | No (adjusts scores, does not block) |
| 10 | **Short-Form Final Sanity Check** | Active | Issue #1014 implementation | N/A | Catches internal process leaks, unsupported global claims, placeholder scores. Can block. | Yes (blocks if internal leaks detected) |
| 11 | **Density Repair Gate** | Active | PR #1066-#1068 | N/A | Ensures all 13 criteria meet minimum recommendation density. Deterministic fallback. | Yes (repairs, then passes) |
| 12 | **Quality Gate (Finalization Quality Guard)** | Active — post-completion advisory | Phase 3 architecture | Post-completion mutations create split-brain if lifecycle state is downgraded | Per PR #1151 architecture: post-completion quality guard is advisory-only. It may annotate/report but must not downgrade lifecycle state. Gate 15 handles pre-persistence blocking. | No (advisory only) |
| 13 | **Canon Governance Runner** | Active — post-completion diagnostic | Canon architecture | Diagnostic-only; cannot block since job is already complete | Correctly positioned as advisory. Logs governance diagnostics but does not mutate lifecycle. | No |
| 14 | **Pitch Identity Separation** | Active | PR #1098, #1150 | N/A | Deterministic repair + DO NOT constraints prevent pitch/summary collapse. | No (repairs in-place) |
| 15 | **CMOS Sanitizer (`mistakeProofText`)** | Active | PR #1150 | N/A | Deterministic text correction (curly quotes, bullets, headings, repeated words). | No (repairs in-place) |

## Architecture Invariants

1. **Pre-persistence blocking gates** (run before `persistEvaluationResultV2`):
   - Artifact Consistency Gate
   - Gate 15 (template completeness)
   - Evidence Grounding Gate (zero-anchor check)
   - Short-Form Final Sanity Check (if blocking codes found)

2. **In-pipeline deterministic repair** (runs during synthesis, repairs in-place):
   - Density Repair
   - Recommendation Integrity Gate
   - Pitch Identity Separation
   - CMOS Sanitizer
   - Short-Form Evidence Sufficiency Gate (adjusts confidence/scorability)

3. **Post-completion advisory** (runs after job is `complete`, never downgrades state):
   - Canon Governance Runner
   - Finalization Quality Guard
   - Final External Audit (Perplexity, in DREAM worker)

4. **Report-readiness holds** (delay report display, do not affect job lifecycle):
   - `dream_ready` gate (long-form waits for DREAM artifact)
   - WAVE eligibility check (optional, post-evaluation)

## Restoration Summary

| Safeguard | Action Taken |
|-----------|-------------|
| Legacy Pass 4 | ✓ Replaced by compact `finalExternalAudit.ts` |
| Pass 3B/DREAM blocking | ✓ Restored as `dream_ready` gate (PR #1158) |
| LLR rules | ✗ Keep warning-only (not deterministic enough to block) |
| WAVE mandatory | ✗ Keep optional (post-evaluation, not report-blocking) |
| Short-form routing | ✓ Already safe (immutable mode routing) |

## Acceptance Criteria Checklist

- [x] No safeguard restored just because it existed before
- [x] Restored safeguards are compact and deterministic
- [x] No user-facing internal phase names (enforced by Short-Form Final Sanity Check)
- [x] Short-form remains fast (no external API calls unless `EVAL_PPLX_SHORT_FORM_ENABLED`)
- [x] Long-form is fail-closed on required artifacts (Gate 15 + dream_ready gate)
