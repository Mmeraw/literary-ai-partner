# Held Recovery Runtime Orchestration — Boundary Map

Status: bounded runtime wiring proof for Held Recovery orchestration.

## Scope

This lane proves that production orchestration can invoke the established Held Recovery authority boundary:

```text
authoritative held-item reference
→ read-only canonical loaders
→ canonical recovery state
→ #1326 runtime-input adapter
→ pure executor
→ classified runtime outcome
```

It deliberately stops before durable business-state mutation.

## Authority flow

| Stage | Object | Authority rule |
|---|---|---|
| Held item reference | `HeldItemReference` / `CanonicalHeldItem` | Identifies the held item, opportunity, reason code/source, origin producer, persisted held-item version, manuscript id, and manuscript version. It does not carry hashes, chunks, candidate versions, recovery fingerprints, manuscript text, or executor inputs. |
| Read-only loaders | `HeldRecoveryRuntimeLoaders` | Load domain objects only: held item, canonical opportunity, candidate state, and manuscript chunk rows. The orchestrator never sees Supabase query builders, table-row unions, or raw artifact blobs. |
| Canonical recovery state | `CanonicalRecoveryState` | Constructed only from authoritative loader results. Missing, legacy-only, conflicting, invalid, or stale state fails closed before execution. |
| Runtime adapter | `buildRecoveryExecutorInputFromCanonicalState` | Reuses the #1326 authority adapter for hashing, versioning, input construction, and independent `RecoveryAuthoritySnapshot` creation. The orchestrator does not duplicate these rules. |
| Pure executor | `executeRecoveryAction` | Performs deterministic validation and pure action dispatch. The orchestrator only classifies its structured outcome. |

## Explicit legacy/current artifact policy

The Supabase loader must never use storage presence as authority through `current ?? legacy` fallback behavior.

The only allowed policy is:

```text
current canonical artifact exists and validates
→ load current artifact

only legacy artifact exists
→ legacy_artifact_unsupported

both current and legacy exist
→ verify identity equivalence or fail closed as conflicting_persisted_authority

neither exists
→ missing_canonical_input
```

Legacy artifact rows are not silently promoted into current canonical authority.

## Result classification

The orchestrator classifies structured executor outcomes into:

- `completed`
- `deferred`
- `unchanged`
- `rejected`

Rejected outcomes include explicit authority reasons:

- `unknown_held_reason`
- `missing_canonical_input`
- `invalid_canonical_input`
- `legacy_artifact_unsupported`
- `conflicting_persisted_authority`
- `stale_authority`
- `identity_mismatch`

Classification is a runtime control-flow result only. It is not a persisted attempt record.

## Future mutation boundary

Later PRs may persist or mutate only after this classified runtime outcome boundary:

```text
classified runtime outcome
→ future recovery-attempt persistence
→ future queue transition
→ future retry scheduling
→ future ledger/candidate/manuscript/Final Review mutation where separately authorized
```

This PR does not implement any of those arrows.

## Exclusions

This lane does not implement:

- recovery-attempt persistence;
- queue state transitions;
- retry scheduling;
- ledger mutation;
- candidate persistence;
- manuscript mutation;
- Final Review mutation;
- UI or API presentation changes.

## Guardrails proven by tests

- Unknown held reasons stop after held-item resolution.
- Missing canonical opportunity state stops before adapter/executor invocation.
- Legacy-only artifacts are explicitly rejected.
- Current/legacy artifact conflicts fail closed.
- Mixed current/legacy partial authority fails closed before later loaders or executor invocation.
- Valid canonical state is loaded in defined order and delegated to the #1326 adapter.
- The executor is called exactly once for valid state.
- Repeated unchanged invocation is deterministic and side-effect free.
- Repeated unchanged loader reads derive identical `CanonicalRecoveryState` values.
- Supabase loader tests fail if mutation methods are invoked.
