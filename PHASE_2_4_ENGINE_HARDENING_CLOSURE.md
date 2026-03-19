# Phase 2.4 — Failure Classification & Engine Hardening

**Status:** ✅ COMPLETED  
**Date:** 2026-03-19  
**Published Commit:** `abe6146` (origin/main, clean working tree)  
**Implementer:** GitHub Copilot (Codespace `shiny-chainsaw-5gjw9q97w4w637r9v`)  
**Spec Author:** ChatGPT  
**Governance Author:** Perplexity Computer  

---

## Objective

Every failure must be diagnosable. Unclassified failures are invisible failures — they erode trust and make debugging impossible. Phase 2.4 closes the loop on the apply engine by:

- Enumerating failure codes for every apply path
- Classifying failures by type (anchor miss, conflict, parse error, invariant violation)
- Persisting failure codes to revision sessions
- Proving 100% classification across all failure modes
- Hardening the full engine through systematic pack-based verification

---

## Deliverables

### Core 2.4 — Failure Classification

| Subtask | Description | Status |
|---------|------------|--------|
| 2.4.a — Enumerate failure codes | Closed set of failure codes in `lib/errors/revisionCodes.ts` (ANCHOR_MISS, CONFLICT, PARSE_ERROR, INVARIANT_VIOLATION, etc.). **Canonical source of truth: `lib/errors/revisionCodes.ts`** | ✅ Done |
| 2.4.b — Persist codes to revision_sessions | Schema + write path extended so every failed apply stores a specific failure code + context | ✅ Done |
| 2.4.c — Tests: 100% classified failures | Tests simulate each failure mode and assert a non-generic code is stored; no UNKNOWN or empty failures | ✅ Done |

### Engine Hardening Packs

Phase 2.4 expanded into a comprehensive hardening program with six evidence packs:

| Pack | Name | Scope | Evidence |
|------|------|-------|----------|
| **A** | Anchor Parity / Validation / Extraction Contract | Schema/runtime agreement, canonical anchor fields, extraction contract | 3 suites, 27 tests passing (commit `70a4184`) |
| **B** | Fail-Closed Classification | Refreshed fail-closed/classification logs archived | Refreshed evidence archived |
| **C** | Golden Extraction Corpus | Edge-case coverage: CRLF, unicode, punctuation, whitespace | 2 suites, 24 tests passing |
| **D** | Apply Reliability Harness | Deterministic apply with gate metrics | valid_total: 182, valid_pass: 182, success_rate: 100%, wrong_location_edits: 0 |
| **E** | Jobs Endpoint / Evidence Refresh | Jobs endpoint logs, fail-closed verification | Refreshed evidence archived |
| **F** | Soak/Chaos Qualification | Sustained load testing across 1k/10k/100k event ladders | See Pack F details below |

### 2.2 Fix — Fail-Closed Malformed Candidate Handling

`normalizeProposalCandidates(...)` now explicitly rejects malformed candidates instead of silently dropping them. This closed a real silent-failure hole in the extraction pipeline.

---

## Full Hardening Verification Batch

Combined run at commit `abe6146`:

```
10 suites passed
100 tests passed
```

This proves A/C/D plus jobs/failure coverage are coherent together.

---

## Pack F — Soak/Chaos Qualification Ladder

### Specification Documents (Published)

- `OPERATIONS_HARDENING_SPEC.md` — 12-section reliability spec
- `OPERATIONS_HARDENING_RUNBOOK.md` — Operational procedures
- `SOAK_CHAOS_HARNESS_SPEC.md` — Harness design specification
- `PACK_F_EXECUTION_CONTRACT.md` — Execution contract with go/no-go gates

### Harness Code (Published)

- Soak harness runner with deterministic classification
- CLI execution via `npm run soak:run -- ...` (tsx + tsconfig-paths)
- Focused test: `tests/operations/soak-harness.test.ts` — passing under Jest

### Evidence Ladder (Archived & Published)

| Run | Events | Status |
|-----|--------|--------|
| `2026-03-19_packF_debug_1k` | 1,000 | ✅ Green |
| `2026-03-19_packF_stability_10k` | 10,000 | ✅ Green |
| `2026-03-19_packF_qualification_100k` | 100,000 | ✅ Green |

### 100k Qualification Metrics

```
total_events_processed     = 100,000
unclassified_failures_total = 0
wrong_location_edits_total  = 0
lost_writes_total           = 0
non_canonical_status_total  = 0
```

Pack F is complete at `abe6146` — executed, archived, and published. No longer scaffold-only or blocked.

---

## Phase Gate Criteria

All criteria satisfied:

| Gate | Status |
|------|--------|
| Failure codes enumerated (closed set) | ✅ |
| Every failed apply stores specific failure code | ✅ |
| No unclassified/unknown failures in apply pipeline | ✅ |
| 100% failures classified in test coverage | ✅ |
| Pack A: anchor parity proven | ✅ 3 suites, 27 tests |
| Pack C: golden extraction corpus | ✅ 2 suites, 24 tests |
| Pack D: apply reliability ≥99.5%, 0 wrong-location edits | ✅ 100%, 0 wrong |
| Pack F: 100k soak qualification | ✅ 0 unclassified, 0 wrong, 0 lost |
| Full hardening batch | ✅ 10 suites, 100 tests |
| Publish state clean on main | ✅ `abe6146` |

---

## Dependencies

| Dependency | Status |
|------------|--------|
| Phase 2.1 — Anchor Metadata System | ✅ Complete |
| Phase 2.2 — Proposal Extraction Contract | ✅ Complete |
| Phase 2.3 — Apply Integrity & Multi-Proposal Execution | ✅ Complete |

---

## What This Means

With Phase 2.4 complete, the system has crossed from "hardening in progress" to **hardening baseline achieved**:

- **Truth anchoring** (2.2) — proposals grounded to exact source positions
- **Truth-preserving transformation** (2.3) — batch apply is deterministic, atomic, fail-closed
- **Failure visibility** (2.4) — every failure classified, diagnosed, and measurable
- **Operational proof** (Packs A-F) — reliability proven at scale through 100k events

The engine is no longer a prototype — it is a verified, production-grade revision engine within the proven scope of the current hardening packs. This does not claim all future reliability concerns are solved; it claims the hardening baseline is now achieved, measured, and governance-recorded.

---

## Remaining Operational Item

**GitHub token rotation** — deferred by project owner. Not a gate for Phase 2.4 closure.

---

## What's Next

The project has crossed from "hardening in progress" to "hardening baseline achieved and governance-recorded." The next frontier is no longer proving the engine can behave — it is proving the next layer of product behavior on top of that engine.

Recommended sequence:

1. **Phase 2.5 — Stage Validation** — full anchor-to-apply pipeline integration proof
2. **Phase 2.6 — A6 Report Credibility** — expose rubric, confidence, provenance on the report UI
3. **Phase 2.7 — Evaluation Uplift** — dual-axis evaluation, quality guards, "senior editor" quality jump

Operationalization work (corpus expansion, observability, alert thresholds, release gating automation) runs in parallel as the engine matures.
