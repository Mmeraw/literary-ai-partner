# Author-Facing Prose: Single-Authority Migration

## Goal

Every punctuation, truncation, ellipsis, lowercase-start, delimiter, duplicate-word, and sentence-completeness decision must enter through one public inspection API. Recovery validates the projected EvaluationResultV2 once, repairs canonical sources, rebuilds, re-inspects, and certifies. Persistence and renderers consume the certified artifact and do not create independent prose rules.

## Existing authorities inventoried

| Surface | Current responsibility | Migration action |
| --- | --- | --- |
| `lib/text/authorFacingProse.ts` | Mechanical text primitives, sentence endings, fallback sentinels | Keep as low-level primitives only |
| `lib/text/authorFacingIntegrity.ts` | Recursive integrity inspection and violation codes | Retain implementation authority; expose through central API |
| `lib/evaluation/pipeline/normalizeArtifact.ts` | Tier-1 normalization plus contract assertions | Split safe normalization from fail-closed inspection |
| `lib/evaluation/pipeline/requiredProseRegeneration.ts` | Targeted required-field regeneration | Consume registry contract and central inspector |
| `lib/evaluation/pipeline/candidateIntegrityRepair.ts` | Candidate repair/quarantine | Consume registry contract and central inspector |
| `lib/evaluation/pipeline/repairSynthesisIntegrity.ts` | Projection repair orchestration | Become the single recovery stage |
| `lib/evaluation/pipeline/evaluationCertificationGate.ts` | Certification integrity check | Delegate to central artifact inspector |
| `lib/evaluation/pipeline/shortFormFinalSanityCheck.ts` | Independent copy-integrity backstop | Delegate after PR #1298; disagreement becomes invariant drift |
| persistence sanitizers | Last-resort transformations and validation | No new prose classification after certification |
| web/PDF/DOCX/TXT renderers | Presentation | Verify rendering/existence/no internal leakage only |

## Migration sequence

1. Introduce `inspectAuthorFacingProse`, path-pattern contracts, and registered-artifact inspection with behavior parity.
2. Migrate repair and certification callers to the central API.
3. Split Tier-1 normalization from validation so recovery can collect every violation before regeneration.
4. Migrate short-form final sanity to the central API and classify post-certification disagreement as `CERTIFIED_ARTIFACT_INTEGRITY_DRIFT`.
5. Remove duplicate field lists and independent prose regex decisions after parity tests pass.
6. Add cross-consumer proof: one certified artifact is accepted unchanged by persistence, web, PDF, DOCX, TXT, and revise-queue preparation.

## Invariants

- Every inspected author-facing path resolves to exactly one contract.
- Every derived repairable path resolves to exactly one canonical writable source.
- Candidate fields are optional and quarantinable; required fields fail closed after bounded regeneration.
- Source quotations and evidence are never rewritten.
- No prose-integrity classifier runs after certification except the same central inspector acting as an invariant assertion.
- Renderers never repair or reclassify prose.

## PR boundaries

PR #1298 remains the narrow production hotfix for whole-token dangling-word handling and field-level diagnostics. This branch does not modify that PR or its files during Stage 1.
