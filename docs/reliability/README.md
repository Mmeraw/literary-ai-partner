# RevisionGrade Reliability

This directory contains the canonical reliability and governance artifacts for RevisionGrade’s governed evaluation system.

## Canonical Doctrine

- [RevisionGrade Reliability Doctrine v1](./REVISIONGRADE_RELIABILITY_DOCTRINE_v1.md)

## Architecture Generation

Current generation: V1 — Concatenation-Window Evaluation  
Target generation: V2 — Chunk-Grounded Map-Reduce Evaluation

Issue #384 is the architectural gateway from V1 to V2. Until post-#384 transition criteria are satisfied, long-form runs must be treated as sampled or partial unless coverage metrics prove otherwise.

## Reliability Programs

- Replay governance: `replays/`
- Failure taxonomy and morphology: `taxonomy/`
- Coverage certification: `coverage/`
- Provenance / trust graph: planned

## Review Policy

Doctrine changes are architecture-governance events, not incidental markdown edits.

Doctrine changes should:
- be reviewed explicitly
- avoid unrelated implementation churn
- reference affected replay IDs, coverage semantics, or architecture generation when relevant

Owner: RevisionGrade maintainers  
Last reviewed: 2026-05-09
