# Revise Unfinished Work — Issue #1024 Action Plan

**Linked issue:** #1024  
**Related PR:** #1023  
**Scope:** Remaining Revise work not fully covered by the Volume VII execution-map PR.

PR #1023 defines the broad Volume VII admission-enforcement map. This document is narrower. It turns the unfinished Revise findings into action-ready PR lanes so they do not disappear inside a governance-only PR.

---

## 1. Why this exists

The Sister Revise investigation confirmed that several safety fixes are already in place:

- bad cards are withheld from normal users
- supported-only queue assembly is enforced
- regeneration state management is improved
- TrustedPath and Final Review are aligned to supported cards

The same investigation also exposed remaining quality, consent, admin-workflow, and telemetry work.

A blocked Revise card is not user inventory. It must be regenerated, safely retained for authorized quality review, or discarded.

---

## 2. Items not fully covered by PR #1023

PR #1023 covers the governance-to-admission map.

It does not complete these items:

1. Candidate context-fit threshold tuning.
2. Written-number unsupported fact detection.
3. Blocked-candidate retention/quarantine policy.
4. Product-level Quality Review Permission UX and copy.
5. Admin-only repair workflow for hidden blocked cards.
6. CostOps and telemetry coverage for regeneration and TrustedPath.
7. Production acceptance checklist for Sister-style cases.

---

## 3. PR lane A — Candidate-quality detector refinement

### Problem

`lacksContextFit()` can reject otherwise valid prose when token overlap lands just below the current Jaccard threshold. The Sister notes identified a boundary case around `0.048` versus `0.05`.

`introducesUnsupportedFacts()` catches digit numerals such as `47`, `128`, and `2026`, but not written numerals such as `forty-seven`, `twenty`, or `one hundred`.

### Required changes

- Introduce a named constant for the context-fit threshold.
- Add tests around boundary candidates.
- Decide intentionally whether the threshold remains `0.05` or moves to `0.03` / `0.025`.
- Add written-number detection or explicitly document written numbers as out of scope.
- Add tests for written and hyphenated numbers.

### Acceptance

- Valid context-fit prose is not rejected because of rounding-level overlap.
- Unsupported written numbers are caught or intentionally scoped.
- No broad false positives on normal prose.

### Likely files

- `lib/revision/candidateQuality.ts`
- `__tests__/lib/revision/candidateQuality.test.ts`
- `__tests__/lib/revision/opportunityLedger.test.ts`

---

## 4. PR lane B — Blocked-candidate quarantine policy

### Problem

The block path may clear `candidate_text_a`, `candidate_text_b`, and `candidate_text_c`. That protects users, but it can also remove evidence needed for debugging and quality review.

### Required changes

- Define a non-user-facing blocked-card retention model.
- Keep normal user payloads free of blocked candidate prose.
- Keep telemetry reason-code based by default.
- Add a clear permission/authorization boundary for any review of retained blocked artifacts.

### Acceptance

- Normal users never see blocked/rejected candidates.
- Root-cause review remains possible through an authorized path.
- Candidate data is not destroyed before the system can diagnose why it failed.

### Likely files

- `lib/revision/opportunityLedger.ts`
- `lib/revision/telemetry.ts`
- admin Revise/debug surfaces
- persistence/migration files if a separate quarantine store is required

---

## 5. PR lane C — Quality Review Permission UX

### Problem

The product needs one clean consent model. Revise should not add scattered toggles or confusing “training” language.

### Required changes

- Add or confirm one account-level Quality Review Permission setting.
- Add clear privacy-policy language for manuscript and revision artifact access.
- Evaluation Report and Revise Queue should display permission status only.
- Revise Queue should not ask for training consent inline.

### Acceptance

- Consent is managed in one place.
- Evaluation and Revise pages show status, not duplicate toggles.
- Copy supports author trust and sovereignty.

### Likely files

- account/settings page
- privacy policy page
- evaluation report status component
- Revise Queue status component
- admin/support access checks

---

## 6. PR lane D — Admin-only repair workflow for hidden blocked cards

### Problem

Sister produced a supported/withheld split such as 9 user-safe cards and 8 hidden blocked cards. Users should see only the supported cards, but the product still needs a controlled way to repair or discard blocked cards.

### Required changes

- Add an admin-only blocked-card list or repair workflow.
- Show reason codes and safe diagnostics by default.
- Add actions such as regenerate, rewrite anchor, discard, or mark for quality review.
- Ensure repaired cards must pass all admission gates before becoming user-visible.

### Acceptance

- User queue count remains supported-only.
- Hidden blocked inventory never appears in normal user UI.
- Admin repair actions do not bypass candidate quality, voice, canon, or admission gates.

### Likely files

- admin Revise pages/components
- `lib/revision/candidateRegeneration.ts`
- `lib/revision/opportunityLedger.ts`
- audit/event logging files

---

## 7. PR lane E — CostOps and telemetry for Revise regeneration

### Problem

Open Issue #998 already requires Revise Queue and TrustedPath cost ledgers. Candidate generation, regeneration, admin repair, and TrustedPath model calls must be represented in that cost model.

### Required changes

- Link this lane to #998.
- Record model costs for candidate generation and regeneration.
- Track reason-code counts, regeneration attempts, failure rates, prompt version, and model version.
- Keep telemetry privacy-safe by default.

### Acceptance

- `/admin/costs/revise-queue` accounts for regeneration and TrustedPath costs.
- CostOps rollup includes Revise spend.
- Telemetry stores codes and counts unless explicit permission allows deeper inspection.

### Likely files

- CostOps ledger/persistence files
- admin cost pages
- `candidateRegeneration.ts`
- TrustedPath routes/services
- telemetry utilities

---

## 8. PR lane F — Production acceptance checklist

For any Revise admission/regeneration change, verify:

- `npx tsc --noEmit`
- targeted revision tests
- supported-only user queue count
- withheld/internal count
- TrustedPath uses supported-only set
- Final Review uses supported-only set
- `/revise-queue` displays ready cards only
- `/workbench-v2` displays supported-only queue count
- no blocked/rejected cards render to normal users
- production deployment check is green

---

## 9. GitHub issue mapping

### Must include in this backlog

- #1024 — unfinished Revise work.
- #998 — CostOps Revise Queue / TrustedPath instrumentation.

### Adjacent, separate PR streams

- #1021 — report export renderer divergence.
- #841 — Revise UI cockpit/fixed viewport.
- #843 — queue artifact persistence must not block render.
- #1010, #1011, #1012 — long-form/external-audit/evaluation safeguard stream.
- #1013, #1014, #1015 — short-form evaluation hardening stream.

These should not be collapsed into the #1024 PR because they need separate review and validation.

---

## 10. Definition of done for #1024

Issue #1024 can close only when all of the following have landed or been split into explicit follow-up issues:

- context-fit threshold policy is intentional and tested
- written-number unsupported fact detection is handled or scoped
- blocked-card retention/quarantine policy is implemented or rejected by decision record
- Quality Review Permission UX is implemented
- admin-only blocked-card repair path is designed or implemented
- Revise CostOps/telemetry integration is linked to #998
- production acceptance checklist exists for Revise queue quality changes
