# RevisionGrade Production Corrective Action Register

**Authority:** Repository source of truth
**Version:** 1.2
**Effective date:** 2026-07-21
**Derived consumers:** forensic workbooks, release dashboards, executive summaries, PR descriptions

This register is the authoritative backlog for production findings that cross Evaluate, Held Recovery, and Revise. Derived spreadsheets may summarize these records but must not change their classification, status, evidence, or exit criteria.

## Controlled vocabulary

### Work type

- **Production defect:** observed production behavior violates an existing contract.
- **Proof gap:** a deployed contract has not been demonstrated through its complete live causal chain.
- **Contract reconciliation:** producer, persistence, validator, consumer, or renderer expectations disagree.
- **Forensic investigation:** production evidence is surprising but does not yet establish a defect.
- **Reliability hardening:** prevention, replay, kickback, isolation, or diagnostics work.
- **Optimization:** measured quality, latency, cost, or friction improvement that preserves authority and editorial intelligence.

### Evidence class

1. **Observed production:** durable production evidence or reproducible author-visible behavior.
2. **Live production proof:** controlled execution proves the complete declared causal boundary.
3. **CI verification:** repository tests or guards pass on an exact commit.
4. **Static contract:** code, schema, registry, or documentation establishes intended behavior.
5. **Inference:** evidence supports a likely explanation but root cause is not yet proven.
6. **Hypothesis:** a bounded question requiring characterization.

### Status

- **Open:** evidence exists and work has not started.
- **Characterizing:** causal boundary is under investigation.
- **Correcting:** implementation or contract reconciliation is active.
- **Awaiting CI:** exact published head is under repository verification.
- **Awaiting deployment:** merged correction is not yet verified live.
- **Awaiting production proof:** deployed contract lacks full live evidence.
- **Blocked:** a named dependency prevents safe progress.
- **Closed:** every exit criterion is satisfied by linked evidence.

## Change-control rules

1. A row may move to **Closed** only when all exit criteria have evidence IDs.
2. **Merged**, **deployed**, and **production proven** are separate states.
3. A surprising score, recommendation count, or empty queue is not a defect without a violated contract.
4. Metrics explain decisions; metrics do not grant opportunity admission authority.
5. Correct the entire demonstrated causal boundary, not an isolated symptom and not unrelated system scope.
6. Dirty input must be rejected or kicked back by the receiving process before it can become certified downstream authority.
7. A workbook discrepancy is resolved in favor of this register and the cited repository registries.
8. Each live proof records target isolation and verifies zero unauthorized mutation outside the proof target.

## Current release evidence

| Evidence ID | Classification | Exact authority | Result |
|---|---|---|---|
| REL-E001 | Production deployment | PR #1358 / `c98774c37a77476bcc9eb09188528cb9919987e3` | Shared Revise ledger validation, exact collection-path certification, envelope/schema alignment, and dead-producer removal are merged and were verified live by `/api/health`. This is deployment evidence, not a fresh Workbench behavioral proof. |
| REL-E002 | Production alignment | Production Alignment Guard run `29774634848` | Applied `20260720140000_delete_manuscripts_permanently.sql` and `20260720160000_delete_manuscripts_permanently_v2.sql`; repository and production migration sets matched at 195/195 with zero malformed, missing, or production-only IDs. |
| REL-E003 | CI verification + production deployment | PR #1360 / `f715dc011a1e4757a2cf0f9fc5c0950be2dc30f3` | Nomenclature enforcement now parses Windows paths correctly, invokes ripgrep without host-shell syntax, and fails closed when enforcement cannot run; exact commit reached production health. |
| REL-E004 | CI verification | PR #1361 / `d57325c4545cb670a345d0508ec12d93d23668b6` | Test-only browser discovery removed the Windows PDF-suite environment failure; 594 suites and 6,866 tests passed without a manually supplied browser path. No production renderer behavior changed. |
| REL-E005 | CI verification + static contract | PR #1362 / `73824a9a153bcee457d8f287704ce169c8b03fcd` | Recommendation-disposition authority now preserves Pass 2 status/rationale metadata, rejects unknown or contradictory criterion dispositions, separates coverage-specific kickback from generic template failure, proves one durable Pass 3 retry and fail-closed persistence blocking, and updates SIPOC/FIPOC registry mirrors. This advances RCA-002/RCA-008 but is not live Held Recovery or editorial-calibration proof. |
| REL-E006 | CI remediation | PR #1363 / `c72e0210a0261d7b055a39d5a87113c8c938831b` | Post-merge River/Froggin active-path sweep no longer self-matches its workflow and active fixtures/docs now reference consolidated long-form gold-standard benchmark paths. RG One-Shot River Froggin Validation run `29790376288` passed on the merge commit. |

## Master register

| ID | Finding / objective | Work type | Evidence class | Evidence strength | Owner | Current status | Verification method | Dirty-input kickback / invariant | Dependencies | Exit criteria | Evidence IDs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| RCA-001 | Complete Held Recovery from deterministic recoverable condition through persisted decision and reload | Proof gap | Static contract + partial production evidence | Strong contract; incomplete live proof | Revision runtime | Awaiting production proof | Controlled production proof; SQL cardinality snapshots; bounded logs; authenticated Workbench inspection | Missing/ambiguous initial authority, reconstruction, anchor identity, version, hash, fingerprint, candidate hydration, or readmission identity fails closed at the owning boundary | Exact deployed commit; production migration parity; deterministic one-condition manuscript; proof-only target isolation | One source condition, Held identity, deferred attempt, work item, reconstruction, verified anchor, identity-only readmission, hydrated Workbench item, persisted decision, stable reload; replay cardinalities remain one; unrelated mutations zero; proof flag removed | HR-E000–HR-E015; PR #1343–#1351 history |
| RCA-002 | Explain all recommendation dispositions without converting lineage into queue quota | Forensic investigation | Observed production + CI verification | Strong observation; malformed propagation corrected; editorial diagnosis pending | Editorial governance | Characterizing | Trace each authoritative source recommendation through identity, materiality/actionability, disposition, optional opportunity identity, persistence, certification, and Revise consumption | Missing, duplicate, unknown-version, orphan admitted, or unauthorized Held disposition blocks certification; suppressed/informational lineage remains non-queue authority | Governed disposition v1; stable source identity; deployed current-ledger validator; representative calibration corpus | Representative calibration set records one disposition per material source recommendation, governing rule and evidence; zero silent loss; no score/count admission predicate; no synthetic Held promotion | Criminality V2 production evidence; PR #1354; PR #1358 / REL-E001; PR #1362 / REL-E005 |
| RCA-003 | Reconcile artifact producer → persistence → validator → consumer contracts | Contract reconciliation | Observed production + static contract | Strong | Evaluation runtime / persistence contracts | Correcting | Registry-to-code audit; exact-path validator tests; dirty sibling fixtures; replay fixtures | Missing required root, malformed collection sibling, obsolete phantom requirement, duplicate identity, or unauthorized field rejects before certification/reuse | Registry authority; artifact schemas; consumer inventory | Every certified artifact has one named producer, persisted schema/version, deterministic validator, named consumers, kickback owner, and regression fixture; zero phantom required fields | PR #1356–#1358; SIPOC/FIPOC registries |
| RCA-004 | Preserve repository registries and SIPOC/FIPOC documents as the only governance authority | Reliability hardening | CI verification + static contract | Strong | Governance / release engineering | Correcting | Registry mirror generation; drift guard; workbook comparison | Generated CSV or workbook values that disagree with TypeScript registries fail validation and cannot overwrite source authority | TypeScript FIPOC/Revise registries; export tooling | One reproducible export command; zero generated drift; workbook carries source SHA and derived-artifact notice; CI detects stale mirrors and unauthorized authority inversion | PR #1355; repository registries; revised workbook 2026-07-20 |
| RCA-005 | Determine whether zero actionable opportunities on strong-but-imperfect evaluations is governed suppression or editorial loss | Forensic investigation | Observed production | Moderate | Editorial governance | Characterizing | Stratified evaluation calibration; per-criterion lineage review; blind editorial adjudication | Unsafe or ungrounded recommendations remain suppressed; investigation cannot promote work solely to satisfy a count or score expectation | RCA-002 lineage evidence; representative manuscript corpus; adjudication rubric; PR #1362 propagation fix | Split the historical PG-06 question into (A) malformed disposition propagation, advanced by REL-E005, and (B) valid editorial calibration, still open. At least 30 consented/redacted evaluations across score and genre strata classify every zero/low-card case as correct suppression, producer omission, ownership loss, canonicalization loss, or threshold hypothesis; correction follows only proven defects | Criminality V2; historical 82/100 zero-card run; PR #1362 / REL-E005 |
| RCA-006 | Prove deterministic replay and version compatibility for Evaluate → Revise authority | Reliability hardening | CI verification | Moderate-to-strong | Revision runtime / persistence | Open | Same-input replay; legacy/current schema fixtures; repeated Workbench opens; persisted identity comparison | Unknown explicit versions, malformed authority, and identity drift fail closed; legacy behavior is explicitly versioned rather than silently reinterpreted | RCA-003 contract reconciliation; deployed canonical ledger validator | Same source and accepted upstream authority reproduce stable disposition/opportunity identities; repeated opens create zero rows/cards; supported legacy fixtures remain readable; unknown versions fail | Replay Harness CI; PR #1348; PR #1358 / REL-E001 |
| RCA-007 | Instrument and reduce Phase 3 latency without reducing editorial intelligence | Optimization | Observed production | Moderate (aggregate only) | LLM orchestration / observability | Open | Phase/pass/span timing; model-call attempt and token metrics; retry attribution; baseline/post-change comparison | Timing data is observational only and cannot alter scoring, admission, ownership, or quality gates | Stable contract boundary; production-safe telemetry; cost budget | Attribute at least 95% of Phase 3 wall time to named spans; identify p50/p95 and retry cost; implement only evidence-backed changes; post-change quality gates and calibration remain non-inferior | Historical Phase 3 ≈496 s; future LAT evidence |
| RCA-008 | Expand dirty-data and kickback proofs at every Evaluate → Revise process boundary | Reliability hardening | Static contract + CI verification | Strong for covered paths; incomplete breadth | Process owners per SIPOC/FIPOC | Correcting | Boundary fixture matrix; negative contract tests; persistence non-mutation assertions; author-safe error tests | Each receiver rejects malformed, missing, duplicated, ambiguous, unauthorized, stale-version, or leaking input and records the upstream owning boundary | RCA-003; repository SIPOC/FIPOC maps | Every registered process row has input metrics, output metrics, kickback condition, writer/owner, failure class, regression test, and non-mutation proof | SIPOC/FIPOC registries; PR #1354–#1358; PR #1362 / REL-E005 |
| RCA-009 | Separate green CI, deployment, and live production proof in every readiness claim | Reliability hardening | Static contract | Strong | Release engineering / QA | Correcting | Release evidence audit; deployed SHA check; proof classification | No feature may be marked production proven from merge or CI evidence alone | Repository evidence standard; deployment health SHA | Every readiness row carries evidence class; deployed SHA is exact; live proof is linked where claimed; unknowns remain open | Revised workbook Release Dashboard / Open Proof Gaps |
| RCA-010 | Improve author-facing operational diagnostics without leaking internal codes, prose, prompts, or credentials | Reliability hardening | Observed production + CI verification | Strong for Held presentation | Revision UI / observability | Correcting | Author-safe presentation tests; internal-vs-public metric audit; production screenshot inspection | Every raw diagnostic is classified internally; every distinct public family yields safe prose; raw leakage count must be zero | Canonical author-safety mapper; Workbench audit | All Workbench adapters/renderers use one mapper; unknown codes map to generic safe language; source-array loss remains internally observable; public leakage zero | PR #1354 |
| RCA-011 | Preserve complete provenance across evaluation artifacts and Revise authority | Contract reconciliation | Observed production + inference | Moderate | Persistence / evaluation runtime | Open | Artifact lineage graph; source/version/hash/fingerprint completeness audit | Missing provenance blocks certification where identity or replay safety depends on it; public surfaces omit sensitive internals | RCA-003; artifact version inventory | Required artifacts bind evaluation job, manuscript/version, producer/version, timestamps, and integrity identifiers; missing bindings have named kickbacks and tests | Workbook findings; forthcoming provenance audit |
| RCA-012 | Eliminate avoidable truncation retries while preserving complete outputs | Optimization | Observed production | Moderate | LLM orchestration | Open | Retry telemetry; output/token-limit characterization; schema-completeness comparison | Truncated or schema-incomplete model output never advances as certified authority | RCA-007 instrumentation; model/output contracts | Retry cause distribution measured; truncation-specific failures reduced against baseline; completeness and editorial quality non-inferior; no relaxed validator | Historical Pass 2 warnings/retries |

## Process input/output metric floor

Every registered Evaluate → Revise process must expose or make derivable the following bounded metrics. Sensitive manuscript content is excluded.

| Boundary | Required input metrics | Required output metrics | Mandatory kickback evidence |
|---|---|---|---|
| Evaluation producer → artifact persistence | artifact type/version, producer version, source identity presence, collection cardinality, required-path coverage | persisted identity/version, byte/count summary, certification state, duration | rejection code, owning producer, zero certified write on invalid input |
| Artifact persistence → certification | persisted artifact identity, schema/version, integrity identifiers, required path/sibling results | certification result, failed invariant count, disposition/lineage coverage | fail-closed status, bounded diagnostics, no release authority |
| Certification → canonical opportunity ledger | source recommendation count/identities, disposition coverage, admitted identity set | ledger identity/version, opportunity count, governed-empty state, duplicate count | missing/duplicate/unexpected lineage, orphan admitted identity, malformed opportunity sibling |
| Ledger → Workbench admission | ledger/version, opportunity identity, operation, executability, candidates, anchor integrity | active/held/non-queue disposition counts, card identities, hydration completeness, duration | invalid current ledger, missing candidates, unsupported operation, ambiguous/missing anchor, no partial admission |
| Held condition → reconstruction | source condition identity, Held identity/state/version, recovery action, target isolation marker | deferred attempt ID, work item ID/state, reconstruction attempt count | ambiguity, replay conflict, unsupported recovery contract, proof target mismatch |
| Reconstruction → Readmission | completed work identity, canonical anchor identity/version/hash/fingerprint, persisted candidates | readmission identity/result, Workbench opportunity identity, admission duration | stale/mismatched/ambiguous authority, duplicate CAS, missing hydration; no caller-supplied prose/coordinates accepted |
| Workbench decision → reload | ledger/card identity, decision/version, source manuscript/version | persisted decision, revised ledger/version, reload identity/cardinality | stale version, duplicate decision, missing source, ambiguous apply target; no revised version on failure |

## Evidence appendix requirements

Each evidence ID used to close a row must identify:

- exact environment and deployment SHA;
- timestamp and bounded target identity;
- verification method;
- expected and actual result;
- relevant counts and relationships, not only row presence;
- isolation comparison;
- failure classification when applicable;
- location of SQL snapshots, logs, screenshots, CI runs, or rendered workbook evidence;
- cleanup/rollback result for temporary production controls.

Manuscript prose, credentials, secrets, prompts, raw model traces, and internal-only author-unsafe diagnostics must not be included in public evidence.

## Derived workbook contract

The forensic workbook must:

1. identify the repository commit from which it was generated;
2. label itself as derived and non-authoritative;
3. preserve the IDs, classifications, statuses, owners, dependencies, and exit criteria above;
4. visually distinguish static contract, CI, deployment, and live production proof;
5. include an explicit open-unknowns view;
6. never close an item based only on a merged PR or green CI;
7. treat this file and the repository TypeScript registries as controlling when discrepancies occur.
