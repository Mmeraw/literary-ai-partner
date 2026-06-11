# Evaluation FIPOC Registries

Status: executable registry mirror for `docs/SIPOC_EVALUATION_PROCESS.md` after PR #1111.

These registry files make the SIPOC visible as spreadsheet-style contracts:

- `process_registry.csv` — one row per active/planned-required process stage.
- `artifact_registry.csv` — producer/consumer ownership for every key artifact.
- `field_registry.csv` — canonical source and render-consumption contract for author-visible fields.
- `kick_matrix.csv` — dirty-data detection, backward kick, retry, and blocking behavior.
- `renderer_consumption_matrix.csv` — which surfaces may render which fields and what inputs are forbidden.

The executable source of truth is `lib/evaluation/fipocRegistry.ts`. These CSVs are human review mirrors for planning and audit. Runtime behavior is intentionally unchanged in PR #1112; later PRs implement the missing critical contracts.

## Current critical gaps captured

1. `S10b_PHASE5_AUTHOR_EXPOSURE_GATE` is planned-required and missing-critical.
2. `S11a_RENDERER_WEBPAGE` must be refactored to consume `UnifiedEvaluationDocument`.
3. Gate 15 / final audit / dialogue canon failures must block author exposure when configured as blocking.
4. WAVE, DREAM, Canon Governance, and Final External Audit are active production stages, not deferred.
5. Renderers must format only; they must not recalculate report type, score, genre, criteria, confidence, warnings, pitch, premise, or entity names.
