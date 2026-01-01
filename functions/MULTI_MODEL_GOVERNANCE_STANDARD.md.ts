# Multi-Model Governance & Decision Authority Policy

**Applies To:** StoryGate, RevisionGrade, and all derivative systems  
**Status:** Canonical / Enforced  
**Locked:** 2026-01-01

---

## 1. Purpose

This policy defines how multiple AI systems are used within the StoryGate ecosystem to ensure accuracy, consistency, and accountability in all evaluative and generative outputs.

It establishes a single-authority decision model supported by auxiliary systems that enhance reliability without introducing inconsistency.

---

## 2. Core Principle

**Only one system may issue authoritative judgments.**  
**All other systems may advise, validate, or flag — but never override.**

This preserves deterministic behavior, auditability, and trust.

---

## 3. System Roles

### Primary System (Authoritative Layer)

Responsible for:
- Final scoring and evaluation
- Narrative and structural judgment
- Output language and framing
- Pass/fail decisions

**Only this system may produce user-visible conclusions.**

### Secondary Systems (Advisory Layer)

May be used for:
- Fact checking
- Market validation
- Inconsistency detection
- Alternative phrasing suggestions

**They cannot:**
- Change scores
- Rewrite outputs directly
- Override primary decisions

---

## 4. Conflict Resolution Protocol

When a discrepancy is detected:

1. Flag issue internally
2. Mark output as "Review Required"
3. Route to human or primary-system adjudication
4. Log decision and rationale

**No automatic override is permitted.**

---

## 5. Enforcement Rule

Any feature or workflow that:
- Alters evaluation logic
- Introduces alternate scoring
- Modifies narrative output

**Must explicitly designate which system is authoritative.**

Failure to do so is a compliance violation.

---

## 6. Canonical Statement (External-Facing)

> "Our platform employs a layered intelligence model: one system establishes authoritative judgments, while supporting systems provide verification and context. This ensures consistency, accuracy, and accountability."

---

## 7. Technical Architecture

```
                ┌──────────────────────┐
                │   User Submission    │
                └─────────┬────────────┘
                          │
              ┌───────────▼───────────┐
              │   Primary Engine       │
              │  (Authoritative Core)  │
              └───────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐
│ Fact Validator │ │ Style Checker │ │ Risk Analyzer │
│ (Perplexity)   │ │ (LLM)         │ │ (Rules)       │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │                 │                 │
        └──────────────┬──┴───────┬─────────┘
                       ▼          ▼
                ┌─────────────────────────┐
                │  Consolidation Layer    │
                │  (Flags, Notes, Alerts) │
                └──────────┬──────────────┘
                           ▼
                ┌─────────────────────────┐
                │   Final Output Engine   │
                └─────────────────────────┘
```

---

## 8. QA & Compliance Checklist

### Pre-Release Validation
- ✓ All outputs traceable to a single authoritative system
- ✓ Advisory systems marked as "non-decisional"
- ✓ Conflicting results trigger review flag
- ✓ No silent overwrites of core output
- ✓ Logs capture input, decision path, and final output

### Runtime Checks
- ✓ Errors surfaced to user
- ✓ Partial failures never appear as success
- ✓ All external calls logged with timestamps

### Audit Readiness
- ✓ Versioned outputs retained
- ✓ Clear distinction between evaluation and advisory data
- ✓ Reproducible results under same inputs

---

## 9. Executive Summary (For Stakeholders)

StoryGate employs a layered intelligence architecture to ensure quality, accuracy, and accountability.

Rather than relying on a single model, we use:
- **One authoritative system** to make final determinations
- **Supporting systems** to validate facts, surface risks, and improve confidence

This structure eliminates silent errors, ensures reproducibility, and supports professional-grade decision-making.

It is intentionally conservative, auditable, and designed to scale without loss of integrity.

---

## 10. Implementation Status

- ✔ Governance defined
- ✔ Technical framework specified
- ✔ Enforcement mechanisms established
- ✔ Perplexity integrated as advisory-only system (agent research, market comps)
- ✔ Primary evaluation engine retains all scoring authority
- ✔ Conflicts surface to user—no silent overrides

---

**Last Updated:** 2026-01-01  
**Authority:** RevisionGrade Core Team  
**Compliance:** Mandatory for all new features and integrations