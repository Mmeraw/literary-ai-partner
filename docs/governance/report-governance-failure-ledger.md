# Report Governance Failure Ledger

RevisionGrade customer-facing reports must never ship with contradictory state, score-ledger mismatch, canonical entity drift, quote mutation, or weak recommendation prioritization.

This ledger converts real evaluation-report failures into deterministic gates. It is based on the Cartel Babies failed customer-report governance case from 2026-05-24/2026-05-25.

## Purpose

The evaluation engine may produce strong literary intelligence, but customer trust depends on the final report artifact being internally consistent, factually faithful, and publication-clean.

A report is not customer-ready merely because Pass 1, Pass 2, Pass 3, or Narrative Synthesis generated useful analysis. The final rendered artifact must pass report governance before PDF export, report download, or customer-facing display.

## Real Training Event

The Cartel Babies report contained strong manuscript understanding but leaked customer-facing governance defects:

- final/ready state appeared beside pending/in-progress/error state,
- `Overall Score: 86` appeared beside `Score: 9 / 10`,
- the protagonist label `No` appeared as if it were a character name,
- at least one quoted manuscript phrase drifted from the submitted source,
- top recommendations under-prioritized larger structural risks.

This is not primarily a model fine-tuning problem. It is a report governance problem. The failure must become fixtures, validators, gates, and regression tests.

## Blocking Failure Codes

### REPORT_STATE_CONTRADICTION

**Severity:** Critical  
**Gate behavior:** Block report export / customer display.

A report must not display terminal-complete language while also displaying pending, in-progress, retrying, server-error, or unavailable-download states.

Forbidden terminal-ready examples:

- `Report ready`
- `Evaluation complete`
- `Evaluation complete! 100%`
- `Your evaluation report is ready`
- `Evaluation completed successfully`

Forbidden non-terminal examples when the report is presented as final:

- `Calibration — pending`
- `Craft diagnostics — in progress`
- `Temporary connection issue`
- `Server error`
- `Retrying automatically`
- `Download Report Available after evaluation completes`
- `Report not ready yet`

If any sub-process is pending, retrying, failed, or unavailable, the report must render as interim, partial, or blocked — not final.

---

### SCORE_LEDGER_MISMATCH

**Severity:** Critical  
**Gate behavior:** Block report export / customer display.

The canonical 0–10 score and the 0–100 score must reconcile.

Invalid example:

```txt
Overall Score: 86
Score Ledger: Score: 9 / 10
Score (0–10) is the canonical weighted score. Overall Score (0–100) is the same value rescaled.
```

This is invalid unless the canonical score is actually `8.6 / 10` or the overall score is actually `90 / 100`.

Required display:

```txt
Overall Score: 86 / 100
Canonical Score: 8.6 / 10
Displayed Band: Strong / Near-ready
```

Do not round the canonical score to `9 / 10` while displaying `86 / 100`.

---

### CANONICAL_ENTITY_ALIAS_LEAK

**Severity:** High  
**Gate behavior:** Block report export / customer display.

The final report must not use malformed, placeholder, generic, or extracted non-names as character names.

Forbidden protagonist-label examples from the Cartel Babies failure case:

- `No’s captivity`
- `No’s abduction`
- `No’s highway scenes`
- `No is pulled`
- `No and Raúl`
- `foreign-captive angle in No`
- `the close first-person voice channeled through No`

The final report must use the canonical character ledger generated during evaluation.

Example:

```json
{
  "canonical_name": "Michael",
  "aliases": ["Mike", "Michael Salter", "Miguel", "McGill", "Mr. Salter", "Michael Wagner"],
  "role": "primary POV / abducted Canadian survivor"
}
```

---

### QUOTE_FIDELITY_DRIFT

**Severity:** High  
**Gate behavior:** Block report export / customer display when source text is available.

Any text inside quotation marks must exist verbatim in the submitted manuscript or source artifact. If the system cannot verify an exact quote, it must paraphrase without quotation marks.

Valid quote:

```txt
The manuscript says, "The leather was warm, nearly sticky."
```

Invalid quote unless the source text exactly contains it:

```txt
The manuscript says, "The leather was warm, nearly slick with heat under my palms."
```

## Warning Failure Codes

### WEAK_TOP_RECOMMENDATION_PRIORITY

**Severity:** Medium-high  
**Gate behavior:** Warn by default; fail in strict mode.

The report must prioritize the most consequential revision risks, not merely the easiest or most cosmetic improvements.

Top recommendations should prioritize:

1. reader confusion risk,
2. structural payoff risk,
3. identity/name continuity risk,
4. market-positioning risk,
5. trust/fidelity risk.

A recommendation such as trimming repeated metaphors should not outrank a more important issue such as identity transition clarity, protagonist naming, macro closure, or threat-field legibility.

---

### SCENE_GEOGRAPHY_COMPRESSION

**Severity:** Medium  
**Gate behavior:** Warn by default.

The report must not collapse scene geography, character presence, or authority chains in ways that create false staging.

Example: if Raúl is invoked by another handler under the overpass but appears physically later at the basin, the report must not state that Raúl himself was physically under the overpass unless the manuscript supports it.

## Governance Principle

The final report must pass this standard:

```txt
No visible contradiction.
No unreconciled score.
No malformed character identity.
No mutated quotation.
No cosmetic recommendation ranked above structural risk.
```

## Required CI Behavior

Minimum command:

```bash
node scripts/validate-report-governance.mjs --report ./artifacts/report.txt
```

With source manuscript for quote validation:

```bash
node scripts/validate-report-governance.mjs \
  --report ./artifacts/report.txt \
  --source ./artifacts/manuscript.txt \
  --entities ./fixtures/report-governance/cartel-babies/entities.json
```

Regression fixture command:

```bash
npm run report:governance:fixture
```

The regression fixture intentionally contains the known Cartel Babies failure patterns. The validator should detect the expected blocking failures and exit successfully only because those failures were expected.

## Acceptance Criteria

A report is customer-ready only when:

- no blocking failure codes are detected,
- score ledger reconciles,
- report state is internally consistent,
- canonical entity aliases are respected,
- exact quotes are source-verifiable when source text is provided,
- top recommendations reflect highest structural risk,
- warnings are either resolved or explicitly accepted as non-blocking.
