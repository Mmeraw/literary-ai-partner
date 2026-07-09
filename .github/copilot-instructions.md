# Copilot Instructions — RevisionGrade Governance

This repository is governed by explicit, versioned contracts.

## AI GOVERNANCE
- All AI assistants MUST follow `AI_GOVERNANCE.md` (binding).
- Use only canonical identifiers from `docs/NOMENCLATURE_CANON_v1.md`.
- Do NOT invent, rename, or infer identifiers.
- Non-canonical identifiers are CI-failing defects.

## CANONICAL SOURCE OF TRUTH
- `docs/JOB_CONTRACT_v1.md` is binding.
- JobStatus is canonical and MUST be exactly:
  - `"queued"`
  - `"running"`
  - `"complete"`
  - `"failed"`

No other status values are permitted.

## STRICT RULES (DO NOT VIOLATE)
- Do NOT invent new job statuses or job types.
- Do NOT rename canonical values (e.g., "completed" is forbidden; use "complete").
- Do NOT infer or fabricate job progress or state.
- Do NOT silently handle illegal job state transitions.
- Illegal transitions MUST throw and MUST NOT write to the database.
- Do NOT mask system or database errors as client (400) errors.

## GOVERNANCE
- All job state transitions must be validated against JOB_CONTRACT_v1.
- Observability (metrics, logs) is passive only and must not alter control flow.
- UI and API layers may read persisted state only; they must not guess or simulate progress.

## WHEN UNCERTAIN
- Ask for the canonical contract.
- Prefer failing explicitly over guessing.

Correctness, auditability, and contract adherence are more important than convenience.

## FINAL ARCHITECTURE ROADMAP CONTROL

The architecture is frozen.

Do NOT invent new architecture.
Do NOT create new authorities.
The remaining work is to prove and complete the existing architecture.

The governing principle is:

> No new authority. Only stronger proof of existing authority.

Existing authority is:

```text
UED
↓
ViewModel
↓
Renderers
(Web / PDF / DOCX / TXT)
```

Everything must preserve that architecture.

## EXECUTION ORDER

Work ONLY in this order. Do not skip. Do not combine issues. Use one branch and one PR per issue.

### Step 1 — Complete Issue #1220

Scope ONLY: remove the remaining RevisionPackage diagnostic padding path.

Requirements:
- Remove inferred filler.
- Remove generic diagnostics.
- Empty required diagnostics remain empty.
- Admission gate withholds the card.
- No fabricated author-facing prose.
- Tests cover admit and withhold paths.
- CI is green.

Do not touch renderers. Do not touch presentation. Open one PR. Stop.

### Step 2 — Complete Issue #1222

Scope ONLY: certification ENFORCE rollout.

Requirements:
- Measure FATAL rate.
- Use a staged rollout.
- Provide a rollback path.
- Add focused tests.
- Do not touch renderers.
- Do not touch presentation.

Open one PR. Stop.

### Step 3 — Complete Issue #1225

Goal: prove identical semantics across the canonical path:

```text
UED
↓
ViewModel
↓
Web
PDF
DOCX
TXT
↓
Identical semantics
```

Deliver:
- ViewModel completeness proof.
- Renderer semantic parity harness.
- Canonical accessor usage.
- Missing-field fail-closed behavior.
- Semantic Golden Masters.
- CI parity tests.

This work proves: "There is one canonical evaluation rendered four different ways."

Do NOT perform presentation work. Open PRs only if necessary because of size.

### Step 4 — Presentation Governance

Specification work only. Not renderer implementation.

Produce a presentation contract covering:
- Typography.
- Spacing.
- Hierarchy.
- Cards.
- Executive dashboard.
- Recommendations.
- Opportunity cards.
- PDF pagination.
- DOCX styles.
- TXT formatting.
- Copy polish.

No CSS-first implementation. No renderer hacks. Open one PR.

### Step 5 — Renderer Completion

Implement the presentation specification across Web, PDF, DOCX, and TXT.

No semantic changes. No ViewModel changes. No UED changes. Renderers consume proven semantics only.

### Step 6 — Presentation Golden Masters

Create visual golden masters protecting typography, whitespace, hierarchy, cards, navigation, pagination, and premium appearance.

### Step 7 — Production Readiness

Final audit: semantic correctness, parity, presentation, accessibility, performance, regression, and deployment.

No feature additions. No architecture additions.

## HARD CONSTRAINTS

- Never invent a second source of truth.
- Never duplicate renderer logic.
- Never duplicate ViewModel logic.
- Never repair semantics inside renderers.
- Never create renderer-specific business logic.
- Always prefer canonical shared accessors.
- Always fail closed.
- One issue. One branch. One PR.
- Keep `main` green.
- No unrelated changes.
- No secrets.
- No `.env` changes.

## VERIFIER-FIRST RULE

Before writing code for each issue, inspect the current `origin/main` implementation and prove the issue still exists.

If the issue has already been resolved by another merged PR, stop, document the finding, and do not duplicate the work.

Otherwise, implement the smallest change that satisfies the issue acceptance criteria.

## DEFINITION OF DONE

RevisionGrade is complete when integrity is proven, semantic parity is proven, presentation is governed, renderers are complete, Golden Masters pass, production readiness passes, and the launch criteria in `ROADMAP.md` are satisfied.
