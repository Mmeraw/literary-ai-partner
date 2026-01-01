# MULTI-MODEL GOVERNANCE STANDARD (CANON)

**Applies to:** RevisionGrade, StoryGate, and all derivative outputs  
**Status:** Canonical / Enforced

---

## 1) Purpose

This standard defines how multiple AI systems may be used in RevisionGrade and StoryGate while preserving deterministic scoring, testability, and canon stability.

---

## 2) Authority Model

**Primary System (Authoritative):** Owns all scoring, pass/fail decisions, readiness labels, and final user-visible language.

**Advisory Systems (Non-authoritative):** May validate facts, detect risks, and suggest alternatives, but may not alter Primary outputs directly.

---

## 3) Non-Negotiable Rules

- Advisory systems must never change scores, readiness states, or canonical wording automatically.

- Any disagreement or anomaly detected by an advisory system must result in a flag (internal) and/or review state, not an overwrite.

- All user-visible outputs must be traceable to a single Primary decision chain.

---

## 4) Perplexity Usage Scope

Perplexity is permitted only as an advisory source for:

- Agent research and verification
- Market comparables validation
- Time-sensitive factual checks (dates, credits, imprints, deal/news context)

**Perplexity is not permitted to generate or modify scoring, readiness labels, or final determinations.**

---

## 5) Error Handling (No Silent Failures)

- No primary user action may fail silently.
- If a generation/evaluation step fails, the UI must render an explicit error state and the system must log a structured error record.

---

## 6) Compliance Requirement

All new routes and refactors must explicitly declare:

- Which system is Primary
- Which systems are Advisory

**Any deviation from this standard is a defect.**

---

**Last Updated:** 2026-01-01  
**Authority:** RevisionGrade Core Team