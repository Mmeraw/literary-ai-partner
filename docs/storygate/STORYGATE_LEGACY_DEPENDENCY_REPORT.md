# Storygate Legacy Dependency Report

> **Status:** audit evidence — do not delete legacy material yet  
> **Date:** 2026-06-11  
> **Scope:** `STORYGATE_FLOW_MAP.md`, `STORYGATE_SUBSCRIPTION_INDEPENDENCE_CANON.md`, `base44/`, `archive/base44-export/`  
> **Current authority:** `docs/storygate/STORYGATE_STUDIO_CANON.md`, `docs/SIPOC_STORYGATE_PROCESS.md`, `lib/storygate/storygateRegistry.ts`

---

## Executive Finding

No current Storygate SIPOC/FIPOC authority points at Base44 as binding authority.

Base44 Storygate material remains in the repository as legacy evidence and historical implementation/export content. It must not be deleted until a separate archive/removal decision is made, but it is no longer current Storygate authority.

Current Storygate governance is intentionally explicit:

1. `docs/storygate/STORYGATE_STUDIO_CANON.md` is primary binding authority.
2. `docs/SIPOC_STORYGATE_PROCESS.md` is binding process constitution.
3. `lib/storygate/storygateRegistry.ts` is the executable current-canon registry.
4. `docs/registries/storygate/*.csv` are generated human-review mirrors.
5. `base44/**` and `archive/base44-export/**` are legacy reference only.

---

## Audit Counts

Filesystem evidence collected on 2026-06-11:

| Item | Count | Classification |
|------|-------|----------------|
| Files under `base44/` | 229 | legacy reference / historical implementation |
| Files under `archive/base44-export/` | 211 | archive export / dead code for current Storygate |
| Exact references to `STORYGATE_FLOW_MAP.md` | 32 | mostly legacy/archive; two current refs are legacy locks |
| Exact references to `STORYGATE_SUBSCRIPTION_INDEPENDENCE_CANON.md` | 3 | legacy/archive only |
| Current Storygate scoped references to `base44/` / archive anchors | 11 | all legacy-policy or guard-test references |

---

## Required Proofs

### 1. No authority registry points at Base44 as binding/current authority

**Result:** proven.

Current Storygate authority registry Base44 entries are:

| Registry row | Path | Level | Applies to stages | Applies to artifacts | Classification |
|--------------|------|-------|-------------------|----------------------|----------------|
| `BASE44_STORYGATE_FLOW_MAP_LEGACY` | `base44/functions/STORYGATE_FLOW_MAP.md/entry.ts` | `legacy_reference_only` | empty | empty | legacy reference |
| `BASE44_STORYGATE_FUNCTIONS_LEGACY` | `base44/functions/screenStorygateSubmission/entry.ts` | `legacy_reference_only` | empty | empty | legacy reference |

Guard test evidence: `__tests__/lib/storygate/storygateRegistry.test.ts` asserts that any authority path containing `base44/` must have `authorityLevel === 'legacy_reference_only'`, empty `appliesToStageIds`, and empty `appliesToArtifacts`.

### 2. No SIPOC points at Base44 as binding/current authority

**Result:** proven.

`docs/SIPOC_STORYGATE_PROCESS.md` lists:

| SIPOC reference | Level | Classification |
|-----------------|-------|----------------|
| `base44/**` | `legacy_reference_only` | legacy reference |
| `archive/base44-export/**` | `legacy_reference_only` | legacy reference |

The SIPOC also states Base44 material is not binding and is not part of the current Storygate authority set.

### 3. No registry points at Base44 as binding/current authority

**Result:** proven.

`lib/storygate/storygateRegistry.ts` includes Base44 only as `legacy_reference_only`. These rows have no stage authority and no artifact authority. Generated CSV mirrors preserve the same classification in `docs/registries/storygate/storygate_authority_source_registry.csv`.

### 4. No tests rely on Base44 as current Storygate authority

**Result:** proven.

The only current Storygate test reference is a guard:

- `__tests__/lib/storygate/storygateRegistry.test.ts` checks `authority.path.includes('base44/')` only to enforce legacy-only classification.

This is not a runtime dependency and not a binding authority dependency.

### 5. Dependency report exists

**Result:** this file is the report.

---

## Current Scoped References and Classification

These are the current Storygate governance/runtime scoped references found under:

- `lib/storygate`
- `docs/SIPOC_STORYGATE_PROCESS.md`
- `docs/storygate`
- `docs/SYSTEM_FACTORY_MAP.md`
- `docs/registries/storygate`
- `__tests__/lib/storygate`
- `app/storygate-studio`
- `components/storygate`
- `scripts/export-fipoc-registries.ts`

| Path | Reference | Classification | Reason |
|------|-----------|----------------|--------|
| `lib/storygate/storygateRegistry.ts` | `base44/functions/STORYGATE_FLOW_MAP.md/entry.ts` | legacy reference | `authorityLevel` is `legacy_reference_only`; no stages/artifacts |
| `lib/storygate/storygateRegistry.ts` | `base44/functions/screenStorygateSubmission/entry.ts` | legacy reference | `authorityLevel` is `legacy_reference_only`; no stages/artifacts |
| `docs/SIPOC_STORYGATE_PROCESS.md` | `base44/**` | legacy reference | Authority source table says historical only, not binding |
| `docs/SIPOC_STORYGATE_PROCESS.md` | `archive/base44-export/**` | legacy reference | Authority source table says historical only, not binding |
| `docs/SIPOC_STORYGATE_PROCESS.md` | `base44/**` under do-not-use list | legacy reference | Explicitly excluded from binding authority |
| `docs/SIPOC_STORYGATE_PROCESS.md` | `archive/base44-export/**` under do-not-use list | legacy reference | Explicitly excluded from binding authority |
| `docs/storygate/STORYGATE_STUDIO_CANON.md` | `base44/**` and `archive/base44-export/**` | legacy reference | Canon authority order marks them non-binding |
| `docs/SYSTEM_FACTORY_MAP.md` | `base44/**` | legacy reference | Executive summary says not binding current authority |
| `docs/registries/storygate/storygate_authority_source_registry.csv` | `BASE44_STORYGATE_FLOW_MAP_LEGACY` | legacy reference | Generated CSV mirror of registry legacy lock |
| `docs/registries/storygate/storygate_authority_source_registry.csv` | `BASE44_STORYGATE_FUNCTIONS_LEGACY` | legacy reference | Generated CSV mirror of registry legacy lock |
| `__tests__/lib/storygate/storygateRegistry.test.ts` | `authority.path.includes('base44/')` | guard-test reference | Enforces legacy-only; does not use Base44 behavior |

No current scoped reference is classified as binding authority or runtime dependency for current Storygate Studio.

---

## Exact Legacy Document References

### `STORYGATE_FLOW_MAP.md`

| Location family | Examples | Classification |
|-----------------|----------|----------------|
| `base44/functions/**` | `MASTER-ARCHITECTURE.md/entry.ts`, `GOVERNANCE_EPIC_RG-STORYGATE-001.md/entry.ts`, `FUNCTION_INDEX.md/entry.ts` | legacy reference inside legacy Base44 export |
| `archive/phase0_docs/**` | phase 0 Base44 architecture/governance exports | dead code for current Storygate; archive evidence only |
| `archive/base44-export/**` | consolidated governance export and positioning export files | dead code for current Storygate; archive evidence only |
| `lib/storygate/storygateRegistry.ts` | `BASE44_STORYGATE_FLOW_MAP_LEGACY` | legacy reference lock, not binding |
| `docs/registries/storygate/storygate_authority_source_registry.csv` | generated `BASE44_STORYGATE_FLOW_MAP_LEGACY` row | legacy reference CSV mirror, not binding |

### `STORYGATE_SUBSCRIPTION_INDEPENDENCE_CANON.md`

| Location family | Examples | Classification |
|-----------------|----------|----------------|
| `base44/functions/CONSOLIDATED_GOVERNANCE_EXPORT.md/entry.ts` | historical export listing | legacy reference |
| `archive/base44-export/base44_consolidated_governance_export_holistic_review_for_gaps_in_governance_canon_code_and_documentation.txt` | archive export listing | dead code for current Storygate |
| `archive/base44-export/base44_consolidated_governance_export_holistic_review_for_gaps_in_governance_canon_code_and_documentation_entity-schema.txt` | archive export listing | dead code for current Storygate |

No current Storygate SIPOC, registry, test, CSV mirror, or app route uses `STORYGATE_SUBSCRIPTION_INDEPENDENCE_CANON.md` as authority.

---

## Directory Classification

### `base44/`

Classification: **legacy reference / historical implementation**.

Rationale:

- Contains old Base44 function exports and documentation.
- Contains Storygate and non-Storygate historical implementation files.
- Contains deprecated film/screen-adjacent functions that are not current Storygate scope.
- Current Storygate registry may reference selected Base44 paths only as `legacy_reference_only`.

Deletion status: **do not delete yet**. Retain until a separate archive/removal PR proves no non-Storygate dependency needs the directory.

### `archive/base44-export/`

Classification: **dead code for current Storygate / archive evidence**.

Rationale:

- Text exports are not imported by current Storygate runtime.
- Exact Storygate legacy document references appear only inside archive/export content.
- Current Storygate governance does not cite archive content as binding authority.

Deletion status: **do not delete yet**. Retain as audit evidence until archive policy is explicitly approved.

---

## Runtime Dependency Notes

This audit is Storygate-scoped. The broader repository still has general Base44 dependencies and imports, including package dependencies and legacy source surfaces outside current Storygate governance. Those are not evidence that current Storygate SIPOC/FIPOC depends on Base44.

Observed broader references include:

- `package.json` / `package-lock.json` dependencies on `@base44/sdk` and `@base44/vite-plugin`.
- `src/lib/AuthContext.jsx` and `src/api/base44Client.js` legacy client imports.
- Many `base44/functions/**` imports of `npm:@base44/sdk@0.8.6`.
- Many `archive/base44-export/**` text exports containing Base44 SDK snippets.

These require a separate platform-wide Base44 retirement audit before deletion.

---

## Conclusion

Current Storygate Studio is no longer grounded on Base44.

Base44 material remains present, but current Storygate governance classifies it only as legacy reference / archive evidence. No current Storygate authority registry, SIPOC, executable registry, CSV mirror, app route, or test uses Base44 as binding current authority.

Recommended next step: keep Base44 material untouched until a dedicated archive/deletion PR can prove platform-wide dependency safety, not just Storygate governance safety.
