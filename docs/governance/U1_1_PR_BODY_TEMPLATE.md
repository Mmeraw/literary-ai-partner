# U1.1 PR body template — staged pending #159 resolution

> **Status:** Not yet live. This file exists as the ready-to-paste PR body
> for `feat/u1.1-confidence-wiring` once #159 (post-merge main breakage)
> is resolved and `main` CI is green again.
>
> **When U1.1 ships:** delete this file as part of that PR.
>
> **Usage:** `gh pr create --body-file docs/governance/U1_1_PR_BODY_TEMPLATE.md`

---

## Closes #158

This PR wires the pure U1 confidence derivation module (landed in #157) into the live finalizer/artifact path.

It does **not** change U1 derivation logic.
It does **not** add new DB columns.
It does **not** touch UI, A6 numeric confidence, or pipeline-adapter numeric confidence.

This is a narrow wiring PR only.

---

## Purpose

Attach canonical confidence output to the final evaluation artifact so the system can state, in a deterministic and auditable way, how much confidence it is permitted to claim in the completed evaluation.

This PR persists:

- `confidence_label`
- `confidence_reasons`
- `confidence_derivation_version`

under the artifact governance block.

---

## Scope choice

This PR implements **Option B** from #158.

That means U1.1 ships with the **5 confirmed inputs** and uses conservative defaults for the 5 not-yet-confirmed signals:

```ts
usedFallbackPath = false
executionDegraded = false
invalidOutput = false
quarantinedOutput = false
evidenceCoverage = "partial"
```

This keeps U1 honest and small: no invented signals, no hidden expansion into U1.2/U1.3/U1.4 work, no premature coupling to unresolved surfaces.

---

## What changed

1. **Finalizer/artifact wiring** — a single `deriveConfidence()` call is made during artifact assembly.
2. **Thin input adapter** — a narrow mapper converts finalizer-confirmed signals into `ConfidenceInputs`.
3. **Artifact governance fields added** — the final artifact now includes:

```ts
governance: {
  ...existing,
  confidence_label: 'high' | 'medium' | 'low' | 'withheld',
  confidence_reasons: ConfidenceReason[],
  confidence_derivation_version: 'u1.v1',
}
```

4. **Version sourced from module constant** — the caller uses `CONFIDENCE_DERIVATION_VERSION` from `lib/governance/confidenceDerivation.ts`. The version string is **not** hardcoded in the caller.

---

## Confirmed input sources used in U1.1

These five inputs are wired from real sources already confirmed on main:

- `criterionCompletenessPassed`
- `anchorIntegrityPassed`
- `governancePassed`
- `passConvergencePassed`
- `hasMaterialPassDisagreement`

The remaining five stay on conservative defaults for this PR only:

- `usedFallbackPath`
- `executionDegraded`
- `invalidOutput`
- `quarantinedOutput`
- `evidenceCoverage`

Those will be wired in follow-up PRs rather than invented here.

---

## Acceptance criteria

- [ ] `deriveConfidence()` is called exactly once per finalizer run
- [ ] Artifact JSON includes `confidence_label`, `confidence_reasons`, `confidence_derivation_version`
- [ ] `confidence_derivation_version` is sourced from `CONFIDENCE_DERIVATION_VERSION`
- [ ] No new DB columns
- [ ] No UI changes
- [ ] No changes to U1 derivation logic
- [ ] Existing finalizer tests remain green
- [ ] Integration tests cover the expected confidence outputs for confirmed signals
- [ ] This template file (`docs/governance/U1_1_PR_BODY_TEMPLATE.md`) is deleted as part of this PR

---

## Tests

This PR adds/updates tests to assert:

- governance block → `withheld`
- completeness failure → `withheld`
- anchor integrity failure → `withheld`
- disagreement present → `low`
- all-clean with Option B defaults → `medium`
- artifact always includes `confidence_derivation_version`

---

## Non-goals

This PR intentionally does **not** do any of the following:

- wire `usedFallbackPath`
- wire `executionDegraded`
- wire `invalidOutput`
- wire `quarantinedOutput`
- define `evidenceCoverage` aggregation policy
- modify A6 numeric confidence
- modify pipeline numeric confidence
- add UI rendering
- add DB persistence columns

Those are separate follow-ups.

---

## Follow-ups

Expected follow-up sequence after this PR:

- **U1.2** — real `executionDegraded`
- **U1.3** — real `invalidOutput` / `quarantinedOutput` (requires adding `validity_status` to finalizer `EvaluationJob` type)
- **U1.4** — real `usedFallbackPath`
- **U1.5** — `evidenceCoverage` aggregation policy

---

## Self-discipline marker (from session doctrine)

> *"If you feel tempted to 'just derive one more signal' → stop."*

Any commit on this branch that adds, infers, or mutates a `ConfidenceInputs` field beyond the five confirmed mappings and five conservative defaults above is out of scope and must be extracted to a follow-up PR.
