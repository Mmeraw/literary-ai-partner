# Evaluation FIPOC Registries

Status: executable registry mirror for `docs/SIPOC_EVALUATION_PROCESS.md` after Phase 5A authority alignment.

These registry files make the SIPOC visible as spreadsheet-style contracts:

- `process_registry.csv` — one row per active/planned-required process stage.
- `artifact_registry.csv` — producer/consumer ownership for every key artifact.
- `field_registry.csv` — canonical source and render-consumption contract for author-visible fields.
- `kick_matrix.csv` — dirty-data detection, backward kick, retry, and blocking behavior.
- `renderer_consumption_matrix.csv` — which surfaces may render which fields and what inputs are forbidden.
- `authority_source_registry.csv` — canon, governance, reference, benchmark, template, DREAM, GOLD standard, exemplar, SIPOC, and registry authority docs that must surface in SIPOC UI/execution.

The executable source of truth is `lib/evaluation/fipocRegistry.ts`. These CSVs are human review mirrors for planning and audit. Runtime behavior is intentionally unchanged by docs-only registry alignment; missing or emerging contracts must be captured explicitly rather than implied.

## Revise FIPOC Registries

Status: executable registry mirror for `docs/SIPOC_REVISE_PROCESS.md` after Phase 5A authority alignment.

These files make the Revise Workbench, Revise Queue, Author Decision, Ledger Sync, Completion, Cross-Check, and TrustedPath contracts visible as spreadsheet-style contracts:

- `revise/revise_process_registry.csv` — one row per Revise stage (`RS01`–`RS10`).
- `revise/revise_artifact_registry.csv` — producer/consumer ownership for every Revise artifact.
- `revise/revise_field_registry.csv` — canonical field names, enum contracts, and validation rules.
- `revise/revise_kick_matrix.csv` — kick-back conditions, target stages, severity, and author-exposure blocking behavior.
- `revise/revise_authority_source_registry.csv` — governance and code contracts that are Revise authority sources.
- `revise/revise_renderer_consumption_matrix.csv` — Revise UI/API consumer surfaces, canonical inputs, forbidden inputs, and required certification gates.
- `revise/revise_certification_gate_registry.csv` — Revise certification gates (`RCG01`–`RCG08`) and their blocking failures.

The executable source of truth is `lib/revision/reviseRegistry.ts`. These CSVs are human review mirrors for planning and audit. Runtime behavior is intentionally unchanged; missing/critical Revise completion certification is captured explicitly rather than implied.

## Authority Chain

Top-level doctrine now lives in:

- `docs/governance/AUTHORITY_CHAIN.md`
- `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md`
- `docs/SIPOC_FIPOC_PHASE5A_AUTHORITY_AUDIT.md`

All registry mirrors must follow this authority order:

```text
Template / Golden Record
    ↓
Executable Contract / Registry
    ↓
Certified Runtime Artifact
    ↓
ViewModel / Product Boundary
    ↓
Renderer / UI / Download Surface
    ↓
Validation Asset
```

## Current critical gaps and active constraints captured

1. `S10b_PHASE5_AUTHOR_EXPOSURE_GATE` is proven/active: runtime certification is enforced by `authorExposureCertification.ts`, `reportRenderParity.ts`, and constitutional registry / DCIP loading.
2. `S10c_VIEWMODEL_BOUNDARY_GATE` is proven/active: evaluation renderers must consume `evaluation_report_view_model_v1` for author-facing report content.
3. Web/PDF/DOCX/TXT renderers must format only; they must not recalculate report type, score, genre, criteria, confidence, warnings, pitch, premise, opportunity counts, or entity names.
4. Revise must consume `revision_opportunity_ledger_v1`; it must not consume `evaluation_report_view_model_v1`. The Revise ledger quality manifest carries DCIP compliance and constitutional authority registry status inherited from certified Evaluation context.
5. Agent Readiness must consume certified UED + certified ledger + certified decisions; it must not consume `evaluation_report_view_model_v1`.
6. Gate 15 / final audit / dialogue canon failures must block author exposure when configured as blocking.
7. WAVE, DREAM, Canon Governance, and Final External Audit are active production stages where configured, but DREAM and benchmarks remain validation assets only — not template or runtime authority.
8. Canon/governance/reference/benchmark/template/DREAM/GOLD standard/exemplar docs are explicit authority sources and must not be hidden implementation lore; their authority level must be correctly classified.
