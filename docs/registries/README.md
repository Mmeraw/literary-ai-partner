# Evaluation FIPOC Registries

Status: executable registry mirror for `docs/SIPOC_EVALUATION_PROCESS.md` after PR #1111.

These registry files make the SIPOC visible as spreadsheet-style contracts:

- `process_registry.csv` — one row per active/planned-required process stage.
- `artifact_registry.csv` — producer/consumer ownership for every key artifact.
- `field_registry.csv` — canonical source and render-consumption contract for author-visible fields.
- `kick_matrix.csv` — dirty-data detection, backward kick, retry, and blocking behavior.
- `renderer_consumption_matrix.csv` — which surfaces may render which fields and what inputs are forbidden.
- `authority_source_registry.csv` — canon, governance, reference, benchmark, template, DREAM, GOLD standard, exemplar, SIPOC, and registry authority docs that must surface in SIPOC UI/execution.

The executable source of truth is `lib/evaluation/fipocRegistry.ts`. These CSVs are human review mirrors for planning and audit. Runtime behavior is intentionally unchanged in PR #1112; later PRs implement the missing critical contracts.

## Revise FIPOC Registries

Status: executable registry mirror for `docs/SIPOC_REVISE_PROCESS.md` after PR #1113.

These files make the Revise Workbench, Revise Queue, Author Decision, Ledger Sync, Completion, Cross-Check, and TrustedPath contracts visible as spreadsheet-style contracts:

- `revise/revise_process_registry.csv` — one row per Revise stage (`RS01`–`RS10`).
- `revise/revise_artifact_registry.csv` — producer/consumer ownership for every Revise artifact.
- `revise/revise_field_registry.csv` — canonical field names, enum contracts, and validation rules.
- `revise/revise_kick_matrix.csv` — kick-back conditions, target stages, severity, and author-exposure blocking behavior.
- `revise/revise_authority_source_registry.csv` — governance and code contracts that are Revise authority sources.
- `revise/revise_renderer_consumption_matrix.csv` — Revise UI/API consumer surfaces, canonical inputs, forbidden inputs, and required certification gates.
- `revise/revise_certification_gate_registry.csv` — Revise certification gates (`RCG01`–`RCG08`) and their blocking failures.

The executable source of truth is `lib/revision/reviseRegistry.ts`. These CSVs are human review mirrors for planning and audit. Runtime behavior is intentionally unchanged; missing/critical Revise completion certification is captured explicitly rather than implied.

## Current critical gaps captured

1. `S10b_PHASE5_AUTHOR_EXPOSURE_GATE` is planned-required and missing-critical.
2. `S11a_RENDERER_WEBPAGE` must be refactored to consume `UnifiedEvaluationDocument`.
3. Gate 15 / final audit / dialogue canon failures must block author exposure when configured as blocking.
4. WAVE, DREAM, Canon Governance, and Final External Audit are active production stages, not deferred.
5. Renderers must format only; they must not recalculate report type, score, genre, criteria, confidence, warnings, pitch, premise, or entity names.
6. Canon/governance/reference/benchmark/template/DREAM/GOLD standard/exemplar docs are explicit authority sources and must not be hidden implementation lore.
