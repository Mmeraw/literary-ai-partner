# BASE44 — Document Governance Specification
**Internal Engineering + QA + Data Ops**

**Version:** V1.1 (refined)  
**Date:** January 01, 2026  
**Audience:** Engineering, QA, Data Management, Document Management

---

## 0) Scope

This document operationalizes the canonical Base44 governance model into enforceable backend behavior, QA tests, and data/doc management requirements.

---

## 1) Canonical Enums (Source of Truth)

Backend must expose enums exactly as defined in the implementation spec:
- `DocumentType`
- `DocumentScope`
- `DocumentState`

---

## 2) Server-Side Enforcement (Non-Negotiable)

- **All state transitions are validated server-side** against the allowed transition table.
- **UI may not "simulate" a state change**; it must be a result of a successful mutation/route.
- If a request attempts an invalid transition, return `ErrorCode.INVALID_STATE_TRANSITION` with details: `{from, to, allowedFromStateList}`.
- **Locked documents reject any mutation** that alters content or title (except clone).

---

## 3) Data Model Requirements

### Minimum required fields for **Document**:
- `documentId` (immutable)
- `projectId`
- `type` (DocumentType)
- `scope` (DocumentScope)
- `state` (DocumentState)
- `title`
- `parentDocumentId` (nullable)
- `createdAt`, `updatedAt`
- `allowedActions` (computed server-side)

### Minimum required fields for **Version** (append-only):
- `versionId` (immutable)
- `documentId`
- `kind` (UPLOAD / EVALUATION / REVISION_DRAFT / REVISION_FINAL / RESCORE / OUTPUT)
- `stateAtTime` (DocumentState snapshot)
- `createdAt`
- `contentRef` or `contentPayload`
- `scoreSnapshot` (nullable)
- `diffRef` (nullable)
- `analysisRef` (nullable)

---

## 4) Versioning and Audit Trail Rules

- **Versions are append-only** (never overwrite).
- Every state transition must create a **Version record** with `kind` aligned to the transition.
- For revisions: store both draft (optional) and final; only `REVISION_FINAL` may advance document to `REVISED`.
- For evaluation/rescore: persist score snapshot + breakdown at the Version level.
- All mutations must write an **audit log entry**: actor, action, documentId, fromState, toState, timestamps, and requestId.

---

## 5) Content Storage + Document Management

**Document Management requirements** (ownership, retention, retrieval):

- Content is stored via durable references (e.g., docx_ref, text blob ref, object storage key).
- Store content format metadata (text/markdown/docx/pdf) and original filename when applicable.
- **Never delete user content** as part of a state change; retention is policy-driven, not workflow-driven.
- **Clones must create a new Document** with a new documentId and a new UPLOAD Version referencing the chosen baseline content.

---

## 6) UI/Backend Contract: `allowedActions`

Backend computes `allowedActions` based on state (and optionally user role). UI renders actions strictly from `allowedActions`.

| State | AllowedActions (minimum set) |
|-------|------------------------------|
| UPLOADED | RUN_EVALUATION, EDIT_TITLE, EXPORT, VIEW_HISTORY |
| EVALUATED | START_REVISION, EXPORT, VIEW_HISTORY, COMPARE |
| REVISION_IN_PROGRESS | SAVE_REVISION, EXPORT, VIEW_HISTORY, COMPARE |
| REVISED | RUN_RESCORE, EXPORT, VIEW_HISTORY, COMPARE |
| RESCORED | LOCK, START_REVISION, EXPORT, VIEW_HISTORY, COMPARE |
| LOCKED | CLONE, EXPORT, VIEW_HISTORY, COMPARE |

---

## 7) QA Acceptance Criteria (Blocking)

**These must pass before release. Any failure blocks launch.**

| ID | Scenario | Expected Result |
|----|----------|----------------|
| QA-01 | Create Document | Document created in UPLOADED; UPLOAD version exists. |
| QA-02 | UPLOADED → EVALUATED | Evaluation succeeds; state becomes EVALUATED; EVALUATION version exists with score snapshot. |
| QA-03 | Skip-state attempt | Any attempt to go UPLOADED → REVISION_IN_PROGRESS is rejected with INVALID_STATE_TRANSITION. |
| QA-04 | EVALUATED → REVISION_IN_PROGRESS | Start revision succeeds; state changes; revision draft version exists (optional). |
| QA-05 | REVISION_IN_PROGRESS → REVISED | Save/finalize revision creates REVISION_FINAL version; state becomes REVISED. |
| QA-06 | REVISED → RESCORED | Rescore creates RESCORE version; state becomes RESCORED; score snapshot updated. |
| QA-07 | RESCORED → LOCKED | Lock succeeds; state becomes LOCKED; content becomes read-only. |
| QA-08 | LOCKED edit attempt | Any content/title mutation rejected with FORBIDDEN (or VALIDATION) and no Version is written. |
| QA-09 | LOCKED → CLONE | Clone creates new Document in UPLOADED and copies baseline content by policy. |
| QA-10 | UI action gating | UI only shows actions present in allowedActions; never shows forbidden actions. |

---

## 8) Data Quality + Backfill Requirements

- Migration/backfill must ensure every existing artifact has: `type`, `scope`, `state`, `title`, `createdAt`, `updatedAt`.
- Any legacy artifact missing a valid state is **quarantined** into a "needs attention" queue and is not processed further until repaired.
- Analytics must report `countsByState` per project (used by Overview).

---

## 9) Error Handling Contract

Standardize error reporting so UI can render deterministic messages.

| ErrorCode | When it occurs | Required details |
|-----------|----------------|------------------|
| INVALID_STATE_TRANSITION | Requested state change is not allowed | `{from, to, allowedTransitionsFromFromState}` |
| FORBIDDEN | User lacks permission or document is LOCKED | `{action, state}` |
| VALIDATION | Missing required inputs/content | `{fieldErrors[]}` |
| CONFLICT | Concurrent edit / stale version conflict | `{expectedVersionId, gotVersionId}` |
| NOT_FOUND | documentId/versionId does not exist | `{id}` |
| INTERNAL | Unhandled server error | `{requestId}` |

---

## 10) Ownership + Access Notes (Teams)

If/when RBAC is enabled, it must **not change the state machine**. RBAC only changes `allowedActions`, not allowed transitions.