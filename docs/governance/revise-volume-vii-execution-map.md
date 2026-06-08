# Revise Volume VII — Execution Map

**Authority family:** Volume VII — Revise Governance  
**Purpose:** Translate Revise governance authorities into enforceable code, tests, telemetry, and user-visibility rules.  
**Status:** Implementation map for the next Revise hardening PR series.

RevisionGrade already has mature evaluation governance. The Revise side must now meet the same standard: doctrine first, executable gates second, user-visible cards last.

This document is the bridge between the Revise governance markdown files and the runtime enforcement files.

---

## 1. Governing authorities

The following authorities define the Revise standard:

- `docs/governance/revise-governance-volume-vii.md`
- `docs/governance/revise-candidate-contract.md`
- `docs/governance/revise-quality-standard.md`
- `docs/governance/revise-voice-preservation-standard.md`
- `docs/governance/revise-canon-preservation-standard.md`
- `docs/governance/revise-regeneration-protocol.md`
- `docs/governance/revise-telemetry-doctrine.md`
- `docs/governance/revise-admission-gate.md`

These authorities are binding for candidate generation, hydration, regeneration, admission, TrustedPath, Final Review, export, and telemetry.

---

## 2. Runtime enforcement modules

The following files are the runtime implementation layer for Volume VII:

- `lib/revision/candidateQuality.ts`
- `lib/revision/candidateRegeneration.ts`
- `lib/revision/voiceGate.ts`
- `lib/revision/canonGate.ts`
- `lib/revision/reviseAdmissionGate.ts`
- `lib/revision/candidateHydration.ts`
- `lib/revision/opportunityLedger.ts`
- `lib/revision/workbenchQueue.ts`

The first five are gate modules. The last three are integration/admission points.

---

## 3. User-facing admission contract

A Revise card may be visible to a user only when all of the following are true:

1. `grounding_status === "supported"`
2. `preflight_status === "passed"`
3. the card is not `needs_targeting`
4. the card has no placeholder or machine-only coordinates
5. the card has no hydration-blocking reason
6. the card has no RES/preflight blocker reason
7. the card passes the Volume VII admission gate
8. at least two of three candidate options are executable, non-generic, context-fit prose
9. no candidate introduces unsupported facts, names, dates, numbers, locations, or canon
10. no candidate drifts from voice, POV, tense, rhythm, or character knowledge

If any condition fails, the card is withheld from the user.

---

## 4. Admin-only treatment of blocked cards

Blocked cards are not user inventory.

Users must never see:

- blocked cards
- rejected candidates
- internal diagnostics
- hydration failures
- regeneration failures
- prompt failures
- model failure reasons
- phase names
- hidden queue counts

Admin and support tooling may see reason-code telemetry and governance diagnostics only under the applicable privacy permission model. Manuscript prose and candidate prose must not be stored in telemetry unless the user has explicitly opted into review/support/training access.

---

## 5. Candidate A/B/C contract

Candidate options are governed as follows:

### Candidate A — Conservative repair

- Minimal intervention
- Lowest risk
- Strongest preservation of author voice
- Best for local clarity, continuity, and small bridge beats

### Candidate B — Recommended repair

- Best overall balance
- Default TrustedPath candidate when all gates pass
- Highest expected improvement without unnecessary disruption

### Candidate C — Aggressive repair

- Highest impact
- Greater structural or tonal movement
- Must still preserve voice, canon, chronology, and character knowledge

No option may be generic filler, editorial advice, analysis, summary, or non-executable prose.

---

## 6. Regeneration doctrine

Blocking bad cards is necessary but not sufficient for a premium product.

When candidate prose fails quality after hydration:

1. withhold the card from the user
2. attempt governed regeneration
3. re-run candidate quality, voice, canon, and admission gates
4. admit only if the regenerated card passes
5. if regeneration still fails, keep the card blocked with `candidate_quality_failed_after_regen`

RevisionGrade must prefer seven excellent cards over seventy mediocre cards.

---

## 7. Current resolved issue

The current regeneration work resolves the bad state loop exposed by Sister:

- quality-failed hydrated candidates trigger regeneration
- regenerated candidates can be restored to `supported` / `passed`
- failed regeneration remains blocked
- user-facing Revise queue remains fail-closed

This fixes the state-management failure where a card could remain `unsupported_blocked` even after healed candidates passed quality checks.

---

## 8. Remaining enforcement tasks

The next implementation PRs must complete the following wiring:

### 8.1 Workbench queue admission

`lib/revision/workbenchQueue.ts` must call the Volume VII admission gate before returning any user-visible opportunity.

Required behavior:

```ts
const admission = runWorkbenchAdmissionGate(opportunity)
if (admission.admission_status !== 'admission_passed') return false
```

This check must happen after existing support/preflight/coordinate filters and before the card is admitted to the user queue.

### 8.2 TrustedPath admission

TrustedPath may consume only admission-passed cards.

Required behavior:

- no unsupported card
- no blocked card
- no limited-context card unless explicitly permitted by future policy
- no candidate-quality-failed card
- no voice/canon failed card
- Candidate B is eligible as default only when the full card passes admission

### 8.3 Final Review admission

Final Review may evaluate only opportunities eligible for author adoption.

Required behavior:

- blocked opportunities excluded
- regeneration failures excluded
- hidden/internal diagnostics excluded
- only admission-passed cards participate in adoption/readiness claims

### 8.4 Telemetry hygiene

Telemetry should store reason codes and counts, not manuscript or candidate prose, unless explicit user permission exists.

Required fields:

- criterion
- severity
- operation
- quality reason codes
- gate status
- regeneration attempt count
- prompt version
- model version

Forbidden without explicit permission:

- manuscript text
- anchor text
- rationale text
- candidate text

---

## 9. Acceptance tests required

The next code PR must include or update tests for:

- `__tests__/lib/revision/workbenchQueue.test.ts`
- `__tests__/lib/revision/reviseAdmissionGate.test.ts`
- `__tests__/lib/revision/candidateQuality.test.ts`
- `__tests__/lib/revision/candidateRegeneration.test.ts`
- `__tests__/lib/revision/opportunityLedger.test.ts`

Minimum assertions:

1. workbench queue excludes candidate-quality-failed cards
2. workbench queue excludes voice-drift cards
3. workbench queue excludes canon-drift cards
4. workbench queue admits supported/passed cards with at least two good candidates
5. TrustedPath cannot select a blocked or non-admission-passed card
6. Final Review does not count blocked cards as adoptable revisions
7. telemetry reason codes do not include manuscript or candidate prose

---

## 10. Build order

Implement remaining work in this order:

1. wire `workbenchQueue.ts` through `runWorkbenchAdmissionGate`
2. add focused workbench queue tests
3. wire TrustedPath to use admission-passed candidates only
4. add TrustedPath admission tests
5. wire Final Review to ignore blocked/non-admitted cards
6. add Final Review tests
7. add telemetry privacy assertions
8. run targeted revision suite
9. run `npx tsc --noEmit`

---

## 11. Non-negotiable product rule

A Revise card is not user-facing because it exists in a ledger.

A Revise card is user-facing only because it independently earns admission under Volume VII.
