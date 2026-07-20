# Revise Production Readiness Certification

This matrix certifies the author journey from Revise Workbench through Final Review and revised-version creation. It does not grant semantic authority to UI or renderer code.

Cross-cutting production findings, owners, proof gaps, and exit criteria are governed by [REVISIONGRADE_PRODUCTION_CORRECTIVE_ACTION_REGISTER.md](./REVISIONGRADE_PRODUCTION_CORRECTIVE_ACTION_REGISTER.md). This matrix is a capability-specific proof view; it must not redefine or close a corrective action independently.

## Evidence classification

Each captured result must be labelled as one of: **Static Contract**, **CI Verification**, **Production Deployment**, or **Live Production Proof**. A capability is production proven only by Live Production Proof on an exact deployed SHA; green CI or deployment alone is insufficient.

## Required proof states

| State | Required proof | Expected result |
|---|---|---|
| Copy-Paste A | Accept A, sync, reload, open Final Review | A remains selected; exact source is highlighted; Apply is available |
| Copy-Paste B | Accept B, sync, reload, open Final Review | B remains selected; exact source is highlighted; Apply is available |
| Copy-Paste C | Accept C, sync, reload, open Final Review | C remains selected; exact source is highlighted; Apply is available |
| Strategy | Defer, reject, or record custom plan | No A/B/C or Accept controls; decision persists; nothing is auto-applied |
| Held item | Open Held Items Summary | Hold reason and recovery action visible; no Generate or Accept controls |
| Save recovery | Force ledger save failure, then Retry | Failed state is announced; retry succeeds; decision rehydrates after reload |
| Exact source | One unique source excerpt | Correct paragraph is highlighted and replacement is staged |
| Ambiguous source | Same source excerpt appears more than once | Apply fails closed; no revised version is created; changelog remains available |
| Missing source | Source manuscript unavailable | Apply and clean draft remain blocked; changelog remains available |
| Deferred Must | Defer one Must item | Dedicated Review recommended warning is visible |
| Apply success | All applicable decisions uniquely match | One revised version is created; success banner shows version ID and applied count |
| Apply failure | Preflight or runtime rejects | No revised version is created; author-safe error is visible |
| Identity | Navigate Workbench → Final Review → Workbench | manuscriptId and evaluationJobId remain unchanged |
| Responsive | Desktop and tablet widths | Queue, cards, Final Review, banners, and controls remain usable without overflow |

## Explicitly open proof boundaries

The following are not certified by the matrix above until their dedicated register exit criteria pass:

- Held Recovery initial authority creation, reconstruction, canonical anchor verification, and identity-only Readmission (RCA-001).
- Recommendation-suppression editorial calibration and zero-card adjudication (RCA-002 and RCA-005).
- Complete producer → persistence → validator → consumer reconciliation for every registered artifact (RCA-003).
- Cross-version deterministic replay and duplicate prevention beyond the captured proof targets (RCA-006).
- Phase 3 latency attribution and truncation-retry optimization (RCA-007 and RCA-012).

## Automated contracts

- Apply route must preflight against the canonical Final Review payload.
- Runtime must not be invoked when source text is unavailable, no applicable decisions exist, or any applicable decision lacks a unique exact source match.
- HTML redirects must preserve manuscript and evaluation identity.
- Successful redirects must include revised version ID and applied count.
- Failure redirects must include an author-safe error and must not imply that a version was created.

## Manual authenticated proof

Capture screenshots for:

1. mixed Workbench queue;
2. selected A/B/C card;
3. Strategy card;
4. Held Items Summary;
5. failed save and retry;
6. Final Review ready-to-apply state;
7. ambiguous-source blocked state;
8. source-unavailable changelog-only state;
9. deferred-Must warning;
10. successful revised-version confirmation.

Record the tested manuscript ID, evaluation job ID, source version ID, revised version ID, browser, viewport, and deployment SHA. Never include manuscript prose, credentials, model traces, prompts, or internal admission diagnostics in public evidence.

## Freeze rule

The Revise presentation layer may be frozen only when every automated contract is green and the authenticated proof matrix is complete on the production deployment.
