# Old Canon Path Sweep Triage (PR #372)

This file classifies non-zero matches from the sweep pattern:

`canon/(?!registered|intake|archive)`

Status model:
- **FIX NOW**: actual old-root canon path that must be changed in this PR.
- **INTENTIONAL HISTORICAL REFERENCE**: frozen evidence/archive records.
- **EXEMPT WITH COMMENT**: legacy exports or dated artifacts; non-authoritative.
- **FALSE POSITIVE**: `canon/` namespace usage that is not old-root canon location.

## Result

- Raw hits: **86**
- Files: **28**
- **Actionable old-root canon path hits: 0**
- All current hits are historical/legacy or namespace false positives and are documented below.

## Blocker table

| File | Hit type | Action | Notes |
|---|---|---|---|
| `AI_GOVERNANCE.md` | `lib/canon/*` namespace | FALSE POSITIVE | Not old root canon location (`canon/**`). |
| `scripts/check-nomenclature-canon.js` | `lib/canon/*` namespace in executable script | FALSE POSITIVE | Runtime path to nomenclature asset, not old root canon path. |
| `tests/fixtures/sipoc/README.md` | taxonomy phrase `contract/canon/spec` | FALSE POSITIVE | Conceptual phrase, not file location. |
| `docs/canon/README.md` | `docs/canon/` references | FALSE POSITIVE | Current canonical root documentation, expected. |
| `docs/canon/registered/volumes/VOLUME-III-PLATFORM-GOVERNANCE-CANON.md` | `/lib/canon/*` mention | FALSE POSITIVE | Namespace mention in prose. |
| `docs/canon/intake/_md/REVISIONGRADE CANON ADDENDUM Criterion Observability & Signal Sufficiency Model.md` | prose mentions `canon/*` namespace | EXEMPT WITH COMMENT | Intake draft content, non-authoritative by design. |
| `docs/canon/intake/_md/PHASE 0.1–0.3 — CANON INTEGRATION & GOVERNANCE ENFORCEMENT SPEC.md` | prose mentions `lib/canon/*` | EXEMPT WITH COMMENT | Intake draft content, non-authoritative. |
| `docs/canon/intake/_md/GATE_15_1_PR1_CANON_AND_SCHEMA_SPEC.md.md` | prose namespace references | EXEMPT WITH COMMENT | Intake draft + typo file; tracked by PR-2. |
| `docs/canon/intake/_md/GATE_15_1_IMPLEMENTATION_PLAN.md.md` | prose namespace references | EXEMPT WITH COMMENT | Intake draft + typo file; tracked by PR-2. |
| `docs/canon/intake/_md/Gate 15 System Architecture.md.md` | prose namespace references | EXEMPT WITH COMMENT | Intake draft + typo file; tracked by PR-2. |
| `docs/canon/intake/_md/What the Canon Says About Scoring an Evaluation.md` | prose namespace references | EXEMPT WITH COMMENT | Intake draft content, non-authoritative. |
| `docs/canon/intake/_md/VOLUME III_PLATFORM_GOVERNANCE_CANON_MASTER.md` | prose namespace references | EXEMPT WITH COMMENT | Intake draft content, non-authoritative. |
| `docs/canon/intake/_md/REVISIONGRADE_REPO_AUTHORITY_RULES.md.md` | prose namespace references | EXEMPT WITH COMMENT | Intake draft + typo file; tracked by PR-2. |
| `docs/canon/intake/_md/Gate 15.1 Overcorrection Firewall (do not break what matters).md` | prose namespace references | EXEMPT WITH COMMENT | Intake draft content. |
| `docs/canon/intake/_md/Ritual-aware editor CANON.md` | prose namespace references | EXEMPT WITH COMMENT | Intake draft content. |
| `docs/canon/intake/_md/docs-canon-GENRE_INTENT_EVALUATION_CANON.md.md` | prose old docs reference | EXEMPT WITH COMMENT | Intake draft + typo file; tracked by PR-2. |
| `docs/operations/audits/repo-file-inventory.md` | baseline artifact references | INTENTIONAL HISTORICAL REFERENCE | Frozen PR-0 inventory evidence; do not rewrite. |
| `docs/archive/RevisionGrade_Roadmap_UPDATED.md` | archived roadmap references | INTENTIONAL HISTORICAL REFERENCE | Dated archived planning artifact. |
| `docs/ROADMAP_2026-04-01.md` | dated roadmap path mention | EXEMPT WITH COMMENT | Historical roadmap snapshot. |
| `docs/SIPOC_EVALUATION_PROCESS.md` | prose phrase with `canon/spec` | FALSE POSITIVE | Contract phrase, not old root canon file path. |
| `docs/PHASE_2_7_PASS1_CALIBRATION_SCORECARD.md` | narrative phrase `canon/*` | EXEMPT WITH COMMENT | Historical phase artifact. |
| `runs/pass1-calibration-001/PHASE_2_7_REAL_RUN_01.md` | narrative phrase `canon/lessons-learned` | EXEMPT WITH COMMENT | Frozen run artifact. |
| `runs/pass1-calibration-001/scorecard.md` | narrative phrase `canon/lessons-learned` | EXEMPT WITH COMMENT | Frozen run artifact. |
| `base44/functions/CONSOLIDATED_GOVERNANCE_EXPORT.md/entry.ts` | `_canon/*` legacy export references | INTENTIONAL HISTORICAL REFERENCE | Legacy export tree, non-authoritative. |
| `base44/functions/BASE44_FILE_ACCESS_BUG_REPORT.md/entry.ts` | `_canon/*` legacy export references | INTENTIONAL HISTORICAL REFERENCE | Legacy export incident record. |
| `base44/functions/GOVERNANCE_INCIDENT_LOG.md/entry.ts` | `_canon/*` legacy export references | INTENTIONAL HISTORICAL REFERENCE | Legacy export incident log. |
| `base44/functions/EXECUTABLE_FUNCTION_INVENTORY.md/entry.ts` | `_canon/*` legacy export references | INTENTIONAL HISTORICAL REFERENCE | Legacy export inventory. |
| `base44/functions/_canon/PHASE_3_EXECUTION_RULES_v1.0.0.md/entry.ts` | `_canon/*` legacy export references | INTENTIONAL HISTORICAL REFERENCE | Legacy export/captured history. |

## Approval rule for PR #372

- Merge is blocked if any **actionable old-root canon path** appears.
- Historical and namespace references are acceptable only when listed here.
- Follow-up hardening (PR-5) will re-expand and tighten scope for remaining namespace claims.
