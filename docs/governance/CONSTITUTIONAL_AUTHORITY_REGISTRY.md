---
document: Constitutional Authority Registry
version: 1.0
status: CANONICAL
authority: GOVERNANCE_INDEX
runtime-authority: true
owner: RevisionGrade
---

# Constitutional Authority Registry

## Purpose

This registry is the single constitutional entry point for runtime authority loading.

Runtime systems must consume this registry before reading constitutional authority documents directly. This prevents drift between policy intent, executable loaders, and certification gates.

## Authority Hierarchy

### Level 1 — Constitutional Contracts (Required)

- DREAM Cognitive Initialization Protocol (DCIP)
- Long-Form Multi-Layer Evaluation Template
- Evaluation Rendering Contract
- Evaluation Output Mode Contract

### Level 2 — Runtime Governance Contracts

- Story Ledger 10-Layer Template
- Review Gate and Final External Audit contracts
- Golden Spine
- Dialogue Canon
- WAVE canon references

### Level 3 — Benchmark Calibration Authorities

- Runtime benchmark authority map
- DREAM long-form benchmark index
- Native/public benchmark corpus references

## Runtime Loading Rules

1. Load this registry first.
2. Resolve all `required=true` authorities.
3. Persist authority status and missing required authorities in runtime diagnostics.
4. Fail closed for release certification when required constitutional authorities are missing.
5. Never substitute benchmark text for manuscript evidence.

## Machine-Readable Entries

Format:

`AUTHORITY_ID|LEVEL|REQUIRED|RUNTIME_BINDING|PATH`

```text
DCIP|1|true|binding|docs/governance/DREAM-COGNITIVE-INITIALIZATION-PROTOCOL-V1.md
EVALUATION_TEMPLATE_LONG_FORM_MULTI_LAYER|1|true|template|docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
EVALUATION_RENDERING_CONTRACT|1|true|binding|docs/templates/evaluation/evaluation-rendering-contract.md
EVALUATION_OUTPUT_MODE_CONTRACT|1|true|binding|docs/governance/evaluation-output-mode-contract.md
STORY_LEDGER_TEMPLATE|2|true|binding|docs/benchmarks/story-ledger/STORY_LEDGER_10_LAYER_TEMPLATE.md
RUNTIME_BENCHMARK_AUTHORITY_MAP|3|true|calibration|docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
DREAM_LONGFORM_BENCHMARK_INDEX|3|true|calibration|docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
```

## Change Control

- Adding or removing required authorities is a constitutional change.
- Any runtime loader changes must remain consistent with this registry.
- Registry/runtime mismatches are governance defects.