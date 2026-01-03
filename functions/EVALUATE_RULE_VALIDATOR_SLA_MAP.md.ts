# REVISIONGRADE™ — EVALUATE RULE → VALIDATOR → SLA MAP

**Status:** CANON / BINDING  
**Applies to:** Engineering, QA, Infrastructure  
**Purpose:** Mechanical enforcement layer for EVALUATE canon

---

## Rule EVAL-R1 — Single Entry Point

**Rule:**  
There shall be exactly one user-facing "Evaluate" entry point.

**Validator:**  
`EVAL_UI_SINGLE_ENTRY_VALIDATOR`

**Where it runs:**
- CI (snapshot UI test)
- Runtime (navigation registry check)

**Severity:**  
`HARD_FAIL`

**Failure condition:**
- More than one Evaluate entry detected
- Any sub-menu under Evaluate

**SLA:**
- Error budget: **0%**
- Measured: per build

**Failure code:**  
`EVAL-HARD-001`

---

## Rule EVAL-R2 — Zero User Format Selection

**Rule:**  
Users must never select scene/chapter/manuscript/screenplay format.

**Validator:**  
`EVAL_NO_FORMAT_SELECTION_VALIDATOR`

**Where it runs:**
- UI render
- Pre-submit hook

**Severity:**  
`HARD_FAIL`

**Failure condition:**
- Any format dropdown, toggle, radio, or implicit choice
- Any required format field in payload

**SLA:**
- Error budget: **0%**
- Measured: per request

**Failure code:**  
`EVAL-HARD-002`

---

## Rule EVAL-R3 — Automatic Format Detection

**Rule:**  
The system must automatically detect submission type.

**Validator:**  
`EVAL_DETECTION_REQUIRED_VALIDATOR`

**Where it runs:**
- Server-side pre-routing

**Severity:**  
`HARD_FAIL`

**Failure condition:**
- Detection returns unknown
- Detection bypassed
- Default/fallback routing used

**SLA:**
- Error budget: **0%**
- Measured: per request

**Failure code:**  
`EVAL-HARD-003`

---

## Rule EVAL-R4 — Correct Pipeline Routing

**Rule:**  
Detected format must route to the correct pipeline.

**Validator:**  
`EVAL_PIPELINE_MATCH_VALIDATOR`

**Where it runs:**
- Server-side post-detection
- Async job enqueue (for manuscripts)

**Severity:**  
`HARD_FAIL`

**Failure condition:**
- Full manuscript routed to Quick Evaluation
- Short submission routed to Manuscript pipeline

**SLA:**
- Error budget: **0%**
- Measured: per request

**Failure code:**  
`EVAL-HARD-004`

---

## Rule EVAL-R5 — Revision Gated Behind Evaluation

**Rule:**  
Revision may not occur unless evaluation is complete.

**Validator:**  
`EVAL_REVISION_GATE_VALIDATOR`

**Where it runs:**
- Pre-revision action

**Severity:**  
`HARD_FAIL`

**Failure condition:**
- Revision initiated without completed evaluation

**SLA:**
- Error budget: **0%**
- Measured: per request

**Failure code:**  
`EVAL-HARD-005`

---

## Rule EVAL-R6 — User Never Sees Routing Logic

**Rule:**  
Routing decisions are invisible to the user.

**Validator:**  
`EVAL_ROUTING_VISIBILITY_VALIDATOR`

**Where it runs:**
- UI snapshot tests
- Response payload scan

**Severity:**  
`SOFT_FAIL` (log + alert)

**Failure condition:**
- Pipeline names surfaced
- Detection labels exposed
- Debug flags visible

**SLA:**
- Error budget: **<0.1%**
- Measured: per release

**Failure code:**  
`EVAL-SOFT-006`

---

## VALIDATOR IMPLEMENTATION REQUIREMENTS

All validators must:
1. Log execution with timestamp and result
2. Emit failure codes on violation
3. Block execution on HARD_FAIL
4. Report to audit system on any failure
5. Never be bypassable without explicit override log

---

## SLA MEASUREMENT PROTOCOL

- **Per request:** Measured on every evaluation submission
- **Per build:** Measured on every deployment/release candidate
- **Per release:** Measured across entire release window

**Error budget enforcement:**
- 0% error budget = zero tolerance, any violation blocks release
- <0.1% error budget = log and alert, review required before release