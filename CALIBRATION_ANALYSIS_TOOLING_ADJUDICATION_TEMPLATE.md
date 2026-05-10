# Calibration Analysis Tooling — Adjudication Template (PASS/FAIL)

## Gate 1 — Analysis script implemented
- [ ] PASS — `scripts/governance/analyze-phase-2-calibration.ts` exports a runnable function/CLI that produces histogram + statistical summary + class coverage from JSON input.
- [ ] FAIL — Script missing, non-runnable, or output incomplete.

## Gate 2 — Typed interfaces defined
- [ ] PASS — `scripts/governance/types.ts` exports input record type, histogram type, statistical summary type, class coverage type.
- [ ] FAIL — Types missing, untyped output, or `any`-leaking surfaces.

## Gate 3 — Unit tests cover required cases
- [ ] PASS — Tests for empty, uniform, skewed, mixed-form, outlier all green.
- [ ] FAIL — Any required case missing or failing.

## Gate 4 — Markdown calibration template complete
- [ ] PASS — `docs/governance/phase-2-calibration-template.md` includes the sections required across Phase 2 Prerequisites 2–4: histogram, per-genre breakdown, long-form class coverage table, outlier patterns, statistical summary, threshold derivation, and reversal mechanism.
- [ ] FAIL — Sections missing or under-specified.

## Gate 5 — No production scope leakage + CI green
- [ ] PASS — Diff confined to `scripts/governance/`, `tests/scripts/`, `docs/governance/`. CI green.
- [ ] FAIL — Production paths modified or CI red.

## Decision
- [ ] PASS on all five gates.
- [ ] FAIL — narrow follow-up patch required.
