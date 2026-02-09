# Phase D — Release Gates (Public + Agent Exposure)

**Authority:** Release Governance (Binding)  
**Status:** LOCKED  
**Effective Date:** 2026-02-08  
**Last Updated:** 2026-02-08  
**Execution Model:** Solo + AI-native (GitHub Copilot, Perplexity AI, ChatGPT)

**Change Control:** This document is LOCKED. No changes to gate definitions, closure requirements, weights, or No-Go conditions are permitted except via governance PR with explicit rationale. Changes to RRS formula or thresholds require board-level review.
---

## Executive Summary

Phase D defines the **release gates** that determine whether RevisionGrade may be exposed to the public and/or literary agents.

**Phase C** (complete, 60% RRS) proves governance correctness and auditability.  
**Phase D** (target: 40% RRS) proves exposure safety: user experience stability, agent trust signals, abuse/cost controls, incident readiness, and disclosure alignment.

**No Phase D gate may be treated as "implicitly satisfied."** Each gate must be **CLOSED with explicit evidence**.

---

## Part 1: Core Definitions

### "Gate"
A release gate is a **binary control**: OPEN or CLOSED.

A gate is **CLOSED** only when:
- Required artifacts exist
- Required checks/tests pass
- Evidence is present (linkable in GitHub)
- No-Go conditions are not triggered

### "Evidence"
Evidence is an **auditable artifact**: document, test output, CI logs, screenshot, or reproducible command + recorded output.

Evidence must be **linkable** to a commit, PR, or tagged build.

### "Exposure"
Exposure means any of:
- Public user access
- Agent onboarding (even invitation-only)
- Live demos to external parties
- Press or partnership evaluation
- Any activity where system output may be interpreted as authoritative

---

## Part 2: Phase D Invariants (Binding)

### Invariant D-01: No Exposure Without Closed Gates
No exposure may occur unless required Phase D gates are **CLOSED** and Release Readiness Score (RRS) threshold is met.

### Invariant D-02: Fail-Closed Behavior Must Be User-Safe
If governance or validation fails (including MDM violations), the system must fail closed in a way that is:
- Clear to the user
- Non-leaking (no internal secrets)
- Non-destructive (no partial results presented as complete)
- Logged for audit

### Invariant D-03: Abuse and Cost Safety Must Be Proven
Rate limiting, workload shaping, and cost-control protections must be **verified via tests** or controlled proofs before exposure.

### Invariant D-04: Disclosures Must Match Reality
Any claims made to users or agents about what the system does must be **accurate and consistent with canon**. No "capability implication" is allowed.

---

## Part 3: Phase D Gates (D1–D5)

Each gate has:
- **Scope**
- **Closure requirements** (artifacts + tests)
- **Evidence requirements**
- **No-Go conditions**

---

### Gate D1 — Public UX Safety and Error Contracts (8%)

**Scope:** User experience is stable under normal failure modes; error messages are safe, consistent, and non-deceptive.

**Closure Requirements:**
1. Public-facing error taxonomy exists (user-safe codes/messages)
2. Governance fail-closed messages are standardized and tested
3. "No partial results" rule enforced: incomplete evals cannot render as completed
4. Client/server errors are de-identified and non-sensitive

**Required Artifacts:**
- `docs/PHASE_D1_PUBLIC_UX_SAFETY.md`
- `docs/ERROR_TAXONOMY_v1.md`
- CI proof run demonstrating:
  - MDM validation failure → user-safe message
  - LLM timeout → user-safe message + job state preserved
  - Parsing failure → evaluation blocked safely

**Evidence Requirements:**
- Links to CI logs showing test execution and pass
- Screenshots of user-facing error states

**No-Go Conditions:**
- Any raw stack trace visible to user
- Any secret or internal identifier displayed
- Any "evaluation complete" shown without stored audit evidence

**Estimated Effort (Solo + AI):** 5-7 days

---

### Gate D2 — Agent Trust Signals and Output Clarity (8%)

**Scope:** Agent-facing outputs are clear about what the system evaluated, what it did not, and why.

**Closure Requirements:**
1. Agent-facing summary contains:
   - Work Type used
   - Matrix version
   - Criteria applicability (R/O/NA/C) summarized
   - Explicit statement that NA criteria are structurally excluded
2. No hallucinated market claims ("this will sell")
3. Output includes reproducibility anchor: evaluation ID + matrix version + timestamp

**Required Artifacts:**
- `docs/PHASE_D2_AGENT_TRUST_OUTPUTS.md`
- Sample "agent view" output fixture set (sanitized)

**Evidence Requirements:**
- Screenshot examples demonstrating:
  - Work Type and matrix version visible
  - NA exclusions explained
  - No forbidden claims

**No-Go Conditions:**
- Any "market guarantee" language
- Any output implying evaluation of NA criteria
- Missing Work Type / matrix version in agent view

**Estimated Effort (Solo + AI):** 4-6 days  
**Priority:** **CLOSE THIS FIRST** (fastest confidence win)

---

### Gate D3 — Abuse, Rate Limiting, and Cost Controls (8%)

**Scope:** System remains safe and financially bounded under load, misuse, or adversarial patterns.

**Closure Requirements:**
1. Rate limiting exists at correct boundary (API/job creation)
2. Concurrency caps exist for evaluation workers
3. Cost guardrails exist (max tokens, max retries, per-user limits)
4. "Runaway job" protection exists (time limits, dead-letter handling)

**Required Artifacts:**
- `docs/PHASE_D3_ABUSE_AND_COST_CONTROLS.md`
- Proof scripts/tests for:
  - Burst requests
  - Repeated failures
  - Max size inputs
  - Retry storms

**Evidence Requirements:**
- Test output proving limits engage (429s or equivalent)
- Worker/concurrency proofs (logs showing caps)

**No-Go Conditions:**
- Unbounded retries
- Unlimited concurrency
- No observable rate limiting

**Estimated Effort (Solo + AI):** 5-7 days

---

### Gate D4 — Support, Rollback, and Incident Readiness (8%)

**Scope:** If something goes wrong, you can detect it, stop it, and recover quickly.

**Closure Requirements:**
1. Incident playbooks exist:
   - Disable evaluations
   - Disable specific work types
2. Rollback path documented and proven:
   - Revert deploy
   - Revert master data version
3. Owner-response process exists (founder on-call acceptable)

**Required Artifacts:**
- `docs/PHASE_D4_INCIDENT_AND_ROLLBACK.md`
- Rollback proof record (staging acceptable)

**Evidence Requirements:**
- Links to runbook and proof output
- Clear "kill switch" locations

**No-Go Conditions:**
- No documented kill switch
- No rollback method
- No owner-response path

**Estimated Effort (Solo + AI):** 3-4 days

---

### Gate D5 — Legal, Ethical, and Disclosure Alignment (8%)

**Scope:** User-facing and agent-facing disclosures match true system behavior.

**Closure Requirements:**
1. Terms/Disclosures state:
   - What is evaluated
   - What is not evaluated
   - Limitations and non-guarantees
2. Privacy posture documented:
   - What is stored
   - Retention policy
   - User deletion path (if applicable)
3. No medical/legal/financial claims policy

**Required Artifacts:**
- `docs/PHASE_D5_DISCLOSURES_AND_PRIVACY.md`
- Public-facing disclosure text (beta draft acceptable)

**Evidence Requirements:**
- Disclosure copy committed
- Evidence of review (PR approval)

**No-Go Conditions:**
- Any misleading capability claim
- Missing disclosure while claiming "agent-grade"
- Storage/retention ambiguity

**Estimated Effort (Solo + AI):** 2-3 days

---

## Part 4: Gate Closure Protocol

A gate is closed via **PR** that includes:
- Required artifacts
- Evidence links (or embedded proof outputs)
- Checklist completion
- Updated RRS score record

**Template PR title:**  
`feat(phase-d): close gate D[X] — [gate name]`

**Template PR description:**
```
Gate Closure: D[X]
Status: CLOSED
Evidence:

[Link to artifact 1]
[Link to proof run / screenshot]

RRS Impact: [old]% → [new]%

Checklist:

- [x] Required artifacts committed
- [x] Tests/proofs pass
- [x] No-Go conditions verified clear
- [x] RRS updated in PHASE_D_RELEASE_READINESS.md
```

---

## Part 5: Phase D Acceptance Fixtures

These are **proof-of-behavior** tests that must pass for gate closure:

### Fixture D1-A: Governance Fail-Closed UX
Trigger MDM validation failure and prove:
- Evaluation blocked
- User sees safe message
- Audit event stored
- No partial results shown

### Fixture D2-A: Agent Summary Fidelity
Run evaluation and prove agent view includes:
- Work Type
- Matrix version
- Applicability summary (R/O/NA/C)
- No NA leakage

### Fixture D3-A: Burst Protection
Simulate burst job creation and prove:
- Rate limiting engages
- Jobs not created unbounded
- No runaway cost

### Fixture D4-A: Rollback Drill
Demonstrate:
- Disable evaluations
- Roll back deployment
- Confirm recovery

### Fixture D5-A: Disclosure Consistency
Confirm:
- Published disclosure matches behavior

---

## Part 6: Execution Timeline (Solo + AI-Native)

Based on proven Phase C velocity (5 weeks, 60% RRS):

| Week | Activity | Gate | RRS |
|------|----------|------|-----|
| 1-2 | Framework commit + D2 start | — | 60% |
| 3-4 | Close D2 (agent outputs) | D2 | 68% |
| 5-6 | Close D1 (error safety) | D1 | 76% |
| 7-8 | **Controlled beta** (5-10 agents) | — | 76% |
| 9-10 | Close D3 + D4 (abuse/rollback) | D3, D4 | 92% |
| 11-12 | Close D5 (disclosures) | D5 | 100% |

**Total:** 10-12 weeks to military-grade launch

---

## Final Lock Statement (Canon)

**Phase D gates are binding release controls.**  
**No exposure is permitted unless required gates are closed and evidenced.**  
**RRS is computed from gate closure only, not sentiment.**

---

**Next Action:** Close D2 (agent trust outputs) — fastest confidence win.
