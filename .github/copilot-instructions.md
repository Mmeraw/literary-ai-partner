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
