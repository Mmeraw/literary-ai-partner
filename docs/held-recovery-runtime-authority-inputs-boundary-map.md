# Held Recovery Runtime Authority Inputs — Boundary Map

Status: proof/infrastructure boundary map for the Held Recovery runtime-readiness lane.

## Scope

This proof lane establishes trusted runtime inputs for the pure Held Recovery executor. It does not wire `executeRecoveryAction` into production and does not mutate queues, ledgers, manuscripts, Final Review state, UI, or evaluation scoring.

## Existing canonical representations inventoried

| Existing representation | What it already proves | Gap for Held Recovery runtime authority | Decision |
|---|---|---|---|
| `manuscript_chunks` rows via `lib/manuscripts/chunks.ts` / `ChunkRow` | Stable row `id`, `manuscript_id`, ordered `chunk_index`, source offsets (`char_start`, `char_end`), persisted `content`, persisted `content_hash` | Row alone does not carry the recovery request's `manuscriptVersionSha`; it must be bound by the runtime adapter to the canonical evaluation/manuscript version being recovered | Reuse through derived typed `CanonicalManuscriptChunkReference`; do not create a new chunk persistence type |
| `lib/evaluation/pipeline/types.ts` / `ManuscriptChunkEvidence` | Minimal chunk index + content used by evaluation prompts | Lacks stable row id, content hash, offsets, manuscript id, manuscript-version binding, and provenance | Insufficient for Held Recovery authority; do not use as runtime recovery input |
| Revision opportunity ledger opportunity shape in `lib/revision/opportunityLedger.ts` | Canonical opportunity id, evidence anchor, manuscript coordinates, diagnostic fields, candidate A/B/C, ledger source hash | Does not own manuscript chunk text; chunk content must come from persisted `manuscript_chunks` authority | Use as canonical opportunity input source and join with typed chunk references |
| `heldRecoveryVersioning.ts` helpers | Canonical opportunity and candidate-set version derivation using the opportunity-ledger hash helper | Does not construct runtime snapshots independently | Reuse for adapter-built authority snapshot |

## Input source map

| Executor input | Canonical source | Notes |
|---|---|---|
| `source_text` | Canonical recovery opportunity projection | The adapter supplies it from canonical opportunity state, not from the caller request |
| `manuscript_coordinates` | Canonical recovery opportunity projection | Used for anchor recovery provenance |
| `evidence_anchor` | Canonical recovery opportunity projection | Used by anchor/context recovery |
| `manuscript_chunks` | Derived `CanonicalManuscriptChunkReference[]` from existing `manuscript_chunks` rows | Replaces free-form `string[]`; includes row id, index, offsets, content hash, version binding, and provenance |
| `symptom`, `cause`, `fix_direction`, `reader_effect`, `diagnostic_object` | Canonical opportunity diagnostic fields | Used for diagnosis and candidate-set recovery |
| `rationale` | Canonical opportunity rationale | Optional supporting diagnostic context |
| `existing_candidates_a_b_c` | Persisted opportunity ledger candidate fields | Used only as authoritative prior candidate state |

## Authority-snapshot boundary

The proof adapter constructs `RecoveryAuthoritySnapshot` only from canonical state:

```text
canonical opportunity ledger state
+ persisted candidate A/B/C state
+ typed manuscript chunk references
→ canonical recovery inputs
→ recoveryInputFingerprint
→ RecoveryAuthoritySnapshot
```

The adapter intentionally ignores request-supplied hashes, opportunity versions, candidate-set versions, recovery fingerprints, and manuscript-version claims. Adversarial tests prove those forged request fields cannot satisfy executor authority validation.

## Runtime integration boundary

The proof harness executes only this side-effect-free chain:

```text
held reason
→ canonical contract resolution
→ canonical input loading
→ independently built authority snapshot
→ executeRecoveryAction
→ deterministic result
```

It does not persist attempt records, mutate queues, write ledgers, update manuscripts, alter Final Review state, or render UI.

## Follow-on before production wiring

A later bounded runtime wiring PR may begin only after this proof remains green and review confirms:

- typed canonical manuscript chunk provenance is sufficient;
- chunk identity is stable across reload;
- stale manuscript/chunk versions fail closed;
- `RecoveryAuthoritySnapshot` is independently constructed;
- forged request identity is rejected;
- LLM work and unchanged anchor reconstruction defer without side effects.
