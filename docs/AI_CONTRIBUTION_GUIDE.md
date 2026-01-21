# AI Contribution Guide

## Project Context
**Project:** RevisionGrade — evaluation pipeline and Day-1 user experience.

A prior prototype built on Base44 was abandoned and is **out of scope**. Do not reference, revive, or infer patterns from the Base44-era work. The current repository represents a clean, stabilized architecture.

---

## Backend Status (Locked Infrastructure)

The job system is **complete, production-ready, and frozen** at tag:

**`job-system-v1.0.0`**

It provides:
- Two-phase evaluation pipeline (Phase 1 → Phase 2)
- Lease-based concurrency control
- Resume via progress snapshots
- Cancellation (terminal semantics, lease clearing)
- Retry with exponential backoff (2ⁿ) + jitter
- Metrics hooks (safe no-op, pluggable backends)
- Admin jobs dashboard

### Guarantees
All behavior is protected by:
- Invariant validation
- Phase smoke tests
- Retry backoff tests
- Metrics runtime execution tests
- CI with multiple test tracks

**Directive:** Treat the job system as locked infrastructure.  
If a change appears necessary, stop and ask before proceeding.
Do **NOT** refactor, redesign, or extend it unless a defect is proven with failing tests.

Locked areas include (but are not limited to):
- `lib/jobs/*`
- `app/api/jobs/*`
- `scripts/jobs-*`

---

## Current Initiative (New Scope)

**Initiative:** Day-1 Evaluation UI

This is a **new project** layered on top of the locked job system.

### Goal
By the end of Day 1, a new user can:
1. Submit manuscript text
2. Start an `evaluate_full` job
3. See live job status (queued → running → complete)
4. Reach a clear “evaluation complete” state
5. Click a **“View Evaluation Report”** call-to-action

---

## Non-Goals (Hard Constraints)

Do **NOT**:
- Modify job engine semantics
- Change database schema
- Alter invariants, retry logic, or lease behavior
- Duplicate job lifecycle logic in UI components
- Reintroduce concepts from the abandoned Base44 prototype

You may **ONLY**:
- Call existing `/api/jobs` endpoints
- Consume job fields defined in `docs/jobs/UI_CONTRACT.md`
- Use canonical helpers from `lib/ui/ui-helpers.ts` for job rendering

---

## Approved Scope of Work

### Track A — Evaluation Entry
- Provide a single UI entry point to create `evaluate_full` jobs via `POST /api/jobs`

### Track B — Job Visibility
- Render a jobs list view using `GET /api/jobs`
- Sort by `created_at DESC`
- Use canonical helpers (e.g., `getJobDisplayInfo`, `getJobStatusBadge`)
- Do not replicate job logic inside components

### First-Run & Empty States
- No jobs:
  - Message: “No evaluations yet”
  - CTA: **Run your first evaluation**
- Job queued:
  - Message: “Preparing evaluation… this usually takes ~2–3 minutes”

---

## Quality Bar

- Follow existing Next.js, React, and Tailwind patterns already present in the repo
- Add or update tests so the Day-1 flow can be validated without manual clicking
- When in doubt, ask before changing anything that appears to be infrastructure

---

## Manuscript Staging & Chunking (Design Intent)

**All user text (paste or upload) must be normalized into a single `manuscripts` model.**

Jobs never receive raw text directly—only `manuscript_id`.

### Planned (Not Yet Implemented)
- Large works (e.g., novels > N words) will be split into `manuscript_chunks` and processed chunk-by-chunk in Phase 1, with a convergence pass in Phase 2.
- The Dashboard is the canonical UI surface over this staging area.

### Constraints
- **Do not introduce alternate "hidden" staging paths** that bypass the `manuscripts` model.
- **Do not implement chunking/convergence logic without an explicit issue and tests.**
- When future issues reference this section, respect the staging model boundary.

This section exists to prevent premature or inconsistent implementations. The chunking pipeline is part of the long-term design but requires careful coordination with the locked job system.

---

## Guiding Principle

**Infrastructure is done.**

The job system is not the product users see.

Your role is to deliver visible user value by **connecting existing pieces**, not inventing new systems.

