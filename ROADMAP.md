# RevisionGrade Roadmap

**Status date:** 2026-07-07  
**Current baseline:** `60feab38`  
**Authority:** This file is the single canonical roadmap for the repository.

All older roadmap ledgers, CSV mirrors, spreadsheets, phase notes, session summaries, and archived planning artifacts are non-authoritative. They must not be used to determine current execution order.

---

## Current State

| Area | Status | Evidence |
|---|---:|---|
| Legacy purge | COMPLETE | `e7c0002b` removed stale phase/session/archive material; `149e37a8` restored the required quarantined `OPENAI_INTEGRATION.md` stub; `0200192b` fully removed Base44 legacy references and dead Vite/Base44 app material. |
| U2 implementation | COMPLETE | All six U2 RCA implementation surfaces appear present individually: U2-001 score/confidence enforcement + VM display authority; U2-002 Pass3 anti-washing; U2-003 confidence derivation; U2-004 propagation; U2-005 UI authority lock; U2-006 evidence anchor enforcement. |
| U2 enforcement proof | COMPLETE | `24c8c3a8` added the synthetic four-layer U2 Enforcement Proof covering gate firing, persistence path, ViewModel reflection, and TXT/HTML/DOCX/web renderer consistency. |
| CI state | GREEN at handoff | Reported green after `24c8c3a8`; continue to treat CI as the source of truth before merging further roadmap changes. |
| U3 implementation | COMPLETE | U3-001: deterministic summary↔criterion consistency gate (`d307dbc1`). U3-002: removed dead `contradicted` status from `seedConsistencyReport` (`60feab38`). U3-003 and U3-004 deferred by design. |

---

## Promotion State

```text
U2: ENFORCED
U3: ENFORCED
```

U2 is enforcement-complete because the implementation surfaces are present and the U2 Enforcement Proof now verifies that the critical pieces work together end-to-end.

U3 is enforcement-complete. U3-001 added the deterministic summary↔criterion consistency gate (`summaryCriterionConsistencyGate.ts`, 14 tests, `d307dbc1`). U3-002 removed the unreachable `contradicted` dead branch from `seedConsistencyReport.ts` (16 tests, `60feab38`). U3-003 (dual-surface convergence) deferred — requires production evidence. U3-004 (cross-criterion attribution UX) deferred — reclassified as renderer UX, not a correctness gap.

---

## Next Work

### 1. U4 — Next Unit (inspection-first)

**Status:** NEXT — inspection only.  
**Goal:** identify the next highest-priority correctness gap after U3 enforcement.

Required starting instruction:

```text
Start U4 inspection only.
No implementation until findings are reviewed.
```

### 2. Deferred from U3: `contradicted` detection (future feature)

**Status:** DEFERRED.  
Property-level contradiction detection in `seedConsistencyReport` requires extending the call contract to pass seed entity properties alongside names. Removed as dead code in U3-002 (`60feab38`). Design as a new feature when production evidence justifies it.

### 3. Deferred from U3: Cross-criterion attribution UX (U3-004)

**Status:** DEFERRED — UX.  
Expose `collapsed_from_criteria` in the renderer so users can see which criteria collapsed into a shared recommendation. Not a correctness gap.

### 4. Follow-up: `summaryMentionsBottomWeakness` adversarial tests

**Status:** FOLLOW-UP.  
The current anti-washing check is lexical/token based. Add adversarial tests for paraphrased weakness language.

### 5. Follow-up: `LLR_POST_STRUCTURAL_BLOCK` subtype classification

**Status:** DIAGNOSTIC FOLLOW-UP.  
Classify recurring post-structural blockers as `MODEL_OUTPUT_INVALID`, `RULE_TOO_STRICT`, or `REGISTRY_DRIFT`.

### 6. Follow-up: PHASE_1_OBSERVABILITY proof capture

**Status:** EMPIRICAL FOLLOW-UP.  
Code is patched; still needs a controlled runtime proof row when convenient.

---

## Non-Goals

- Do not recreate Base44 files or Base44 references.
- Do not use deleted roadmap CSVs, old workbooks, phase files, or session summaries as authority.
- Do not add another roadmap file.
- Do not start benchmark-novel work as a substitute for U3.
- Do not treat Golden Spine, benchmark authority, or DREAM references as roadmap state.

---

## Roadmap Authority Rule

There is only one roadmap authority:

```text
ROADMAP.md
```

If another file disagrees with this file, this file wins. If automation requires roadmap state, it must read this file or an explicitly generated derivative of this file.
