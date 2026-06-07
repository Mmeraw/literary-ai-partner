# Contract Coverage Roadmap

Date: 2026-06-07

## Purpose

RevisionGrade has reached the point where implementation must not run ahead of subsystem contracts. This roadmap tracks which areas have a canonical authority layer and which still depend on scattered UI labels, metrics, docs, or tests.

A subsystem contract should define, at minimum:

- canonical identifiers and states;
- required inputs;
- required outputs;
- metrics and observability fields;
- fail-closed behavior;
- forward / backward kick semantics;
- public-safe vs internal-only fields;
- contract tests proving the runtime consumes the authority.

## Current execution evidence

Targeted governance suite executed locally in the dev container on Ubuntu 24.04.4 LTS:

```text
Test Suites: 14 passed, 14 total
Tests:       127 passed, 127 total
Snapshots:   0 total
```

Included deterministic burn coverage:

```text
100 short-form jobs claim exactly once across concurrent workers
25 long-form jobs claim exactly once with long leases and no duplicate ownership
concurrent recovery exhaustion is guarded so only one worker escalates and emails the user
```

Important limitation: this is deterministic/local burn evidence using mocked Supabase/RPC behavior. It proves concurrency invariants at the code-contract boundary; it is not yet live database or production traffic validation.

## Coverage status

| Subsystem | Current authority | Runtime contract? | Contract tests? | Status | Next action |
|---|---|---:|---:|---|---|
| Job lifecycle / statuses | `docs/JOB_CONTRACT_v1.md`, `lib/jobs/types.ts` | Yes | Yes | Strong | Keep canonical status guard strict: only `queued`, `running`, `complete`, `failed`. |
| Evaluation queue claim RPC | `lib/jobs/contracts/claimEvaluationJobs.contract.ts` | Yes | Yes | Strong | Add live/staging RPC contention proof. |
| Evaluation recovery / hard stop | `lib/evaluation/hardStopGovernance.ts`, processor tests | Partial | Yes | Good | Extract a single `evaluationRecoveryContract.ts` for terminal failure classes, alert rules, retry caps, and owner-email routing. |
| Evaluation output rendering | `lib/evaluation/reportTemplateContract.ts`, docs templates | Partial | Yes | Good | Consolidate report/UI/download field requirements into one evaluation-output contract. |
| Evaluation provider calls | `lib/evaluation/orchestration/providerContracts.ts`, `docs/canon/EVAL2_PROVIDER_VERIFICATION_CONTRACT_V1.md` | Partial | Partial | Moderate | Bind provider metrics, retry semantics, and redaction rules into one runtime contract. |
| Revise Queue columns / ledger | `lib/revision/reviseQueueLedgerContract.ts` | Yes | Yes | Strong | Keep UI labels sourced from the contract; add route-level Revise governance tests. |
| Revise card readiness | `lib/revision/reviseCardContract.ts` | Yes | Yes | Strong | Keep Ready vs Needs Targeting fail-closed. |
| Revision mode / TrustedPath eligibility | `lib/revision/modeContract.ts`, `docs/canon/revise-queue-v2-contract.md` | Partial | Yes | Good | Extract TrustedPath auto-apply contract into its own runtime authority. |
| Revision anchors | `lib/revision/anchorContract.ts` | Partial | Partial | Moderate | Add explicit anchor metrics and route/workbench enforcement tests. |
| Agent Readiness | `docs/product/agent-readiness-workflow-doctrine.md`, UI pages | No | Limited | Gap | Create `lib/agent-readiness/agentReadinessContract.ts` for eligibility, package sections, approval gates, metrics, and Storygate handoff. |
| Storygate Studio | Product/FAQ pages and archived Base44 docs | No | Limited | Gap | Create `lib/storygate/storygateContract.ts` for readiness threshold, creator approval, industry-role access, visibility, and audit logging. |
| Downloads / exports | `lib/evaluation/downloadParityGate.ts` | Partial | Yes | Gap | Create `lib/downloads/downloadContract.ts` covering report downloads, ledger downloads, final-review exports, parity, redaction, filenames, and failure states. |
| Admin costs / observability | Admin routes and dashboards | Partial | Partial | Gap | Create an observability contract defining passive-only metrics, cost rollups, retention, redaction, and no-control-flow side effects. |
| Manuscript chunking / storage | Chunking tests and comments | Partial | Yes | Moderate | Promote chunk/storage invariants into a single runtime contract. |
| Public copy / claims | Guard scripts and page copy | Partial | Yes | Moderate | Maintain guard scripts; add product-claim contract for all public assertions. |

## Priority roadmap

### P0 — production confidence evidence

1. Run deterministic governance suite on every governance change.
2. Add staging Supabase contention proof for claim/recovery paths.
3. Capture live/staging evidence for:
   - no duplicate job claims;
   - no stale lease reclaim loops;
   - no illegal status values;
   - alert delivery on technical-review escalation;
   - Revise Queue cap enforcement from cached and rebuilt ledgers.

### P1 — contract extraction

1. `evaluationRecoveryContract.ts`
   - retryable vs terminal failure codes;
   - retry caps;
   - escalation copy;
   - support/user alert rules;
   - guarded update proof requirements.

2. `agentReadinessContract.ts`
   - completed evaluation requirement;
   - readiness score semantics;
   - package section definitions;
   - approval gates;
   - output/export metrics;
   - Storygate handoff requirements.

3. `storygateContract.ts`
   - readiness threshold;
   - creator-controlled visibility;
   - verified-professional roles;
   - request/approve/access log states;
   - no-public-indexing rule;
   - no-outcome-guarantee public copy rules.

4. `downloadContract.ts`
   - downloadable artifact types;
   - field parity requirements;
   - redaction/public-safety rules;
   - filename/version requirements;
   - failure and retry states;
   - download metrics.

### P2 — drift prevention

1. Add contract tests that fail if UI labels are hardcoded outside contract sources.
2. Add contract tests requiring every metric to map to a defined field and owner.
3. Add route-level governance tests for Revise actions and TrustedPath.
4. Add docs/runtime parity checks so docs cannot drift from exported constants.

## Governance rule

No new major subsystem behavior should ship unless it either:

1. consumes an existing canonical contract; or
2. adds/updates the canonical contract in the same change with tests proving runtime consumption.
