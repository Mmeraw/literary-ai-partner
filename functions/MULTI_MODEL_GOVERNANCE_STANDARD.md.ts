# MULTI-MODEL GOVERNANCE STANDARD (CANONICAL)

**Applies To:** RevisionGrade, StoryGate, and all derivative systems  
**Status:** Enforced Canon

---

## 1. Purpose

This standard defines how multiple AI systems may be used within RevisionGrade and StoryGate while preserving deterministic behavior, auditability, and canonical consistency.

It ensures that auxiliary systems enhance reliability without compromising authoritative judgment or introducing ambiguity.

---

## 2. Authority Model

### Primary System (Authoritative)

The Primary System is the sole authority for:

- Final scoring and evaluations
- Readiness determinations
- Canonical language and output
- Pass/fail and classification decisions

**No other system may override or modify these outputs.**

### Advisory Systems (Non-Authoritative)

Advisory systems may assist by:

- Validating factual claims
- Identifying inconsistencies or risks
- Suggesting alternative phrasings or contextual information

Advisory systems may not:

- Alter scores or readiness states
- Replace or rewrite canonical output
- Override Primary System decisions

**All advisory input is non-binding.**

---

## 3. Non-Negotiable Rules

- Advisory systems must never alter authoritative outputs automatically.
- Any disagreement or anomaly must trigger an internal review flag.
- All user-visible outputs must be traceable to a single authoritative decision path.
- Silent overrides are prohibited.

---

## 4. Perplexity Usage Scope

Perplexity may be used only for:

- Agent and market research
- Verification of factual or time-sensitive information
- Contextual reference checks

Perplexity may not:

- Generate or modify final scores
- Influence readiness labels
- Produce user-facing determinations

---

## 5. Error Handling & Observability

- No primary action may fail silently.
- Failures must generate a visible error state and a structured log entry.
- Logs must include timestamp, route, and failure category.

---

## 6. Compliance Requirement

All features and refactors must explicitly declare:

- Which system is Primary
- Which systems are Advisory

**Any deviation from this standard constitutes a defect.**

---

## Canonical Enforcement Statement

StoryGate operates under a single authoritative decision model.  
Supporting systems may inform but never override that authority.  
This guarantees consistency, traceability, and trust across all outputs.