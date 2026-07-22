# Certification Truth Overlay v1

Owner: RevisionGrade maintainers  
Status: Proposed constitutional overlay  
Applies to: governed evaluation requirements, implementations, evidence harnesses, registries, certification decisions, reliability reporting, and generated governance artifacts  
Effective basis: additive to `REVISIONGRADE_RELIABILITY_DOCTRINE_v1.md`; historical SIPOC records remain intact

## Purpose

This overlay prevents a declaration, implementation, test, certification label, or completion metric from standing in for another layer of truth. It records the current assurance model without rewriting the historical process narrative.

## Constitutional assurance chain

Every certified obligation must trace through all six layers:

`Policy -> Requirement -> Implementation -> Evidence -> Certification -> Reliability`

1. **Policy** states the product or governance decision and names its authority.
2. **Requirement** translates that decision into a precise, testable obligation.
3. **Implementation** identifies the real production enforcement point.
4. **Evidence** demonstrates the enforcement mechanism with a capable proof method.
5. **Certification** derives status from the requirement, implementation, and evidence; it does not create truth.
6. **Reliability** measures production outcomes over time. Certification contributes confidence but is not itself an operational outcome.

No layer may be inferred solely from the existence or success of a lower layer. In particular:

- a policy declaration does not prove implementation;
- an implementation reference does not prove enforcement;
- a green test does not prove an obligation unless the test exercises the named mechanism;
- certification does not imply operational reliability;
- operational success does not imply complete certification coverage.

## Certification states

Each obligation has exactly one current certification state:

| State | Meaning |
|---|---|
| `proven` | The policy and requirement are unambiguous, production enforces the obligation, and capable evidence passes. |
| `representable_but_unproven` | The harness can express the obligation, but sufficient evidence has not passed. |
| `unrepresentable` | The current harness cannot express a proof capable of testing the enforcement mechanism. |
| `implementation_conflict` | Policy and requirement are decided, but production behavior contradicts them. |
| `policy_conflict` | Controlling authorities disagree or no authorized product decision exists, so implementation cannot choose legitimately. |

`runtime_conflict` is a temporary compatibility alias for `implementation_conflict`. New artifacts must emit `implementation_conflict`; consumers must accept the alias only during the declared migration window.

An unresolved obligation must name its owner, gap bucket, remediation class, exact gap, blocker where applicable, and an exclusive `expires_before_utc`. Harness representation alone never promotes an obligation to `proven`.

## Evidence kinds and confidence

Evidence kind describes what mechanism is tested:

| Evidence kind | Capable proof domain |
|---|---|
| `runtime_fail_closed` | A real runtime boundary rejects or quarantines invalid input/output. |
| `static_architecture_invariant` | Import, type, ownership, or dependency structure prevents a forbidden path. |
| `pure_predicate_contract` | A deterministic in-memory decision contract maps inputs to outputs. |
| `integration_transactional` | Persistence, atomicity, rollback, concurrency, lease, network, or IO behavior is exercised against the real class of infrastructure. |

Evidence confidence is a separate property, not a substitute for state. It records certainty in the proof and must be derived from declared factors such as environment fidelity, enforcement-point coverage, replay breadth, determinism, and recency. Labels such as `medium`, `high`, or `very_high` may be displayed only when their derivation is machine-readable. A high-confidence test of the wrong mechanism cannot certify an obligation.

## Gap and remediation classification

Every unresolved obligation must use one gap bucket:

- `representation_gap`: the harness lacks a capable expression;
- `evidence_gap`: enforcement appears present, but capable evidence is absent or insufficient;
- `implementation_gap`: decided policy/requirement is not enforced;
- `policy_contradiction`: controlling policy authorities disagree or a product ruling is missing.

It must also name a remediation class, such as `schema`, `test_infrastructure`, `integration_evidence`, `runtime`, `policy`, or `toolchain`.

## Constitutional drift

Drift is a first-class assurance event:

| Drift class | Condition |
|---|---|
| `policy_drift` | Two controlling policy authorities disagree or an implementation follows an obsolete ruling. |
| `requirement_drift` | An obligation no longer translates the controlling policy faithfully. |
| `implementation_drift` | Production behavior departs from the decided requirement. |
| `evidence_drift` | Evidence no longer exercises the named enforcement point or environment. |
| `harness_drift` | Harness schema, fixtures, generator, or toolchain materially differs from CI or production assumptions. |
| `registry_drift` | Registry status or ownership disagrees with executable certification truth. |
| `documentation_drift` | Narrative documentation describes a state contradicted by current executable evidence. |

Drift must be classified and recorded; it must not be normalized as a pre-existing error or repaired by weakening a requirement.

## Toolchain provenance

Generated governance, lockfile, fixture, replay, and evidence artifacts must be produced with the repository-pinned toolchain. The producing record must identify, directly or by immutable repository reference:

- Node/runtime version;
- package-manager or generator version;
- artifact/schema version;
- exact generation command;
- source revision;
- deterministic inputs or input hashes where applicable.

CI must reproduce or validate the artifact using the same pinned generator/toolchain contract. A locally green artifact generated by a materially different toolchain is `harness_drift`, not valid evidence.

## Separate outcome dashboards

### Operational reliability SLO

Target: **98% successful governed evaluations** over a declared rolling, production-like cohort.

The SLO definition must publish cohort/window, eligible denominator, terminal success contract, exclusions, retry-exhaustion rate, terminal failure-code distribution, unsafe-author-exposure rate, and latency percentiles. A job that merely reaches a terminal state is not necessarily successful.

### Certification coverage objective

Target: **100% of in-scope obligations represented and truthfully classified**, with `proven` coverage reported separately from unresolved coverage.

Certification coverage must display counts by state, gap bucket, remediation class, evidence kind, owner, and expiry. `unrepresentable` is an honest classification but does not count as proven coverage.

The 98% SLO and 100% coverage objective must never be combined into one score. Neither may compensate for the other.

## Gate 15 rule

Gate 15 policy was resolved by the owner-approved Option 1 ruling recorded in issue #1391 on 2026-07-22.

- Gate 15 remains nonfatal to evaluation completion and artifact persistence.
- `pass`, permitted `warn`, and explicit `skipped` evidence are nonblocking, subject to all other Phase 5 gates.
- correctness-affecting `fail` blocks webpage exposure and PDF/DOCX/TXT downloads.
- missing, malformed, stale, unverifiable, or job-lineage-mismatched `gate_15_audit_v1` evidence fails closed for author exposure.
- staleness is constitutional, not reader-local guesswork: a Gate 15 audit is stale when `stale === true`, `superseded === true`, `lineage_status !== "current"`, or `valid_until` is missing, malformed, or earlier than the exposure decision time. The producer must deterministically set `valid_until` to 90 days after the artifact timestamp. The recovery path after expiry is re-audit, not grandfathering.
- every Gate 15 audit must carry a parseable generation timestamp, matching top-level job lineage, and a `lineage` object whose `artifact_type`, `jobId`, and `timestamp` match the audit identity.
- disposition-based recovery is disabled in #1400. A correctness-affecting `fail` cannot become nonblocking until a later governed change proves a server-authorized, non-forgeable `gate_15_author_exposure_disposition_v1` writer, immutable persistence restrictions, scope/effective-date enforcement, and audit lineage binding.

Read-side validation of `gate_15_author_exposure_disposition_v1` is not proof of an authorized, non-forgeable disposition write path. Runtime exposure must ignore any such artifact until that write/persistence authority is proven separately.

The production enforcement point is the shared author-exposure predicate in `lib/evaluation/authorExposureCertification.ts`, backed by the Gate 15 predicate in `lib/evaluation/gate15/authorExposureGate15.ts`.

## Promotion rule

Promotion to `proven` requires all of the following in one traceable record:

- controlling policy authority;
- requirement identifier and exact obligation;
- real production enforcement point;
- capable evidence kind;
- passing evidence reference;
- evidence-confidence derivation;
- source and toolchain provenance;
- absence of unresolved policy or implementation conflict.

Reliability improvement is the intended outcome of this system. Certification is the truthful assurance mechanism used to guide and verify that improvement.

