# CRITERIA_KEYS — Canonical Criterion Registry

**Source of truth:** `schemas/criteria-keys.ts` (AUTHORITATIVE).  
This document is explanatory only.

## Governance Contract

- Criterion keys are **machine-stable** and **MUST NEVER CHANGE** once released.
- All evaluations, fixtures, and MDM matrices **MUST use only keys** in `CRITERIA_KEYS`.
- MDM matrices **consume** this registry (MDM does **not** define criteria keys).
- Any matrix or result referencing an **unknown key MUST fail validation**.
- Any matrix **missing any canonical key MUST fail validation** (full coverage required).
- Applicability status codes are **exactly**: `R` / `O` / `NA` / `C`.
- **CI enforces registry compliance** across MDM + fixtures.

## Migration Status

⚠️ **MIGRATION REQUIRED**: The current MDM matrix (`functions/masterdata/work_type_criteria_applicability.v1.json`) uses legacy keys and must be migrated to canonical keys before D2 gate can close.

See: `schemas/criteria-keys.ts` for the authoritative 13-criterion registry.
