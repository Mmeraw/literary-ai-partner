# RevisionGrade Canon

**Status:** ACTIVE  
**Authority:** Mike Meraw  
**Last Updated:** 2026-03-20  
**Version:** 2.1

---

This directory contains the complete canonical governance, doctrine, and execution architecture for the RevisionGrade platform. Markdown files in `volumes/` and `control/` are **authoritative**. Word files in `archive/docx/` are provenance only.

---

## Structure

```
/canon
  /volumes          ← Canonical volumes (authoritative .md)
  /control          ← Control documents (authoritative .md)
  /archive
    /docx           ← Original Word files (provenance only)
  README.md         ← This file
```

---

## Volumes

| # | File | Canon ID | What It Covers |
|---|---|---|---|
| I | [VOLUME-I-WAVE-REVISION-GUIDE-CANON.md](volumes/VOLUME-I-WAVE-REVISION-GUIDE-CANON.md) | VOL-I-WAVE-V20 | 62 diagnostic waves, 5 tsunamis, Velocity Bundle, WAVE governance layer |
| II | [VOLUME-II-STORY-EVALUATION-CRITERIA.md](volumes/VOLUME-II-STORY-EVALUATION-CRITERIA.md) | VOL-II-CRITERIA-V20 | 13 core evaluation criteria, scoring model, DCS, addendum (DAM, Breath & Sound) |
| III | [VOLUME-III-PLATFORM-GOVERNANCE-CANON.md](volumes/VOLUME-III-PLATFORM-GOVERNANCE-CANON.md) | VOL-III-PLATFORM-GOV-V10 | Platform governance: 5 doctrines, system constants, gates, schemas, implementation specs (Sections 1–17) |
| IV | [VOLUME-IV-AI-GOVERNANCE-CANON.md](volumes/VOLUME-IV-AI-GOVERNANCE-CANON.md) | VOL-IV-AI-GOV-V20 | AI authority, governance architecture, canon protection, risk controls, runtime enforcement reference |
| V | [VOLUME-V-EXECUTION-ARCHITECTURE.md](volumes/VOLUME-V-EXECUTION-ARCHITECTURE.md) | VOL-V-EXEC-V20 | Pipeline architecture, AEP execution, Trifecta model, orchestration, Section VII Canon Enforcement System |
| Canon III | [CANON-III-LESSONS-OF-THE-LIVING-SYSTEM.md](volumes/CANON-III-LESSONS-OF-THE-LIVING-SYSTEM.md) | CANON-III-LESSONS-V10 | 8 governing laws derived from narrative system failure and observation |

---

## Control Documents

| File | Canon ID | What It Covers |
|---|---|---|
| [REVISIONGRADE-CANON-DOCTRINE-REGISTRY.md](control/REVISIONGRADE-CANON-DOCTRINE-REGISTRY.md) | CTRL-DOCTRINE-REG-V21 | Master index of all 49 canonical doctrines across Volumes I–V |
| [REVISIONGRADE-CANON-ASSEMBLY-MATRIX.md](control/REVISIONGRADE-CANON-ASSEMBLY-MATRIX.md) | CTRL-ASSEMBLY-MTX-V21 | Source-to-volume routing for every document in the canon system |
| [VOLUMES-I-V-DEFINITIONS-CONTENT-REGISTRY-VIEW.md](control/VOLUMES-I-V-DEFINITIONS-CONTENT-REGISTRY-VIEW.md) | CTRL-DEFINITIONS-REG-V21 | Quick-reference index of what each volume contains |
| [VOLUME-II-A-OPERATIONAL-SCHEMA.md](control/VOLUME-II-A-OPERATIONAL-SCHEMA.md) | VOL-IIA-OPS-SCHEMA-V10 | Machine-operational specification for evaluation, routing, scoring |
| [CPDR-001-CANON-ENFORCEMENT-PLACEMENT.md](control/CPDR-001-CANON-ENFORCEMENT-PLACEMENT.md) | CPDR-001 | Immutable placement decision: Canon Enforcement System → Volume V Section VII |

---

## Architectural Truth

> Canon is defined in Volume III and constrained by Volume IV, but enforced at runtime in Volume V.

| Volume | Role |
|---|---|
| Volume I | Writing execution (WAVE methodology) |
| Volume II | Evaluation (13 Criteria + scoring) |
| Volume III | System rules, schemas, governance doctrine |
| Volume IV | AI authority and constraints |
| Volume V | Runtime execution + enforcement (pipeline) |
| Canon III | Governing laws from observed system behavior |

See [CPDR-001](control/CPDR-001-CANON-ENFORCEMENT-PLACEMENT.md) for the authoritative placement decision record.

---

## Canon Policy

- **Canonical:** `.md` files in `volumes/` and `control/`
- **Archive:** `.docx` files in `archive/docx/` are provenance only — not authoritative
- **Changes:** Proposed via `canon/revisions/<date>-<topic>` branches, merged to `main` only after review
- **AI use:** AI systems treat all canonical `.md` files as read-only per Volume IV
- **Disputes:** Resolved using conflict hierarchy in Assembly Matrix
- **Placement decisions:** Recorded in CPDR documents (immutable)

---

## Doctrine Summary

49 canonical doctrines are registered across all volumes. See [Doctrine Registry](control/REVISIONGRADE-CANON-DOCTRINE-REGISTRY.md) for the complete index.

| Volume | Doctrine Count |
|---|---|
| Volume I — WAVE Canon | 18 entries (#1–18) |
| Volume II — 13 Story Criteria | 17 entries (#19–35) |
| Volume II Addendum | 4 entries (#36–39) |
| Volume II-A — Operational Schema | 1 entry (#40) |
| Canon III — Lessons Learned | 1 entry (#41) |
| Volume III — Platform Governance | See RCAM for detailed routing |
| Volume IV — AI Governance | See RCAM for detailed routing |
| Volume V — Execution + Enforcement | 8 entries (#42–49) |
| **Total** | **49 registered doctrine units** |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-03-09 | Initial canon repository (30 doctrines, split Vol III) |
| 2.1 | 2026-03-20 | Consolidated Vol III to single master. Added Canon III, Vol V Section VII (Canon Enforcement System), CPDR-001. Updated Doctrine Registry to v2.1 (49 entries). Updated RCAM to v2.1. Updated Definitions View to v2.1. Archived superseded files. |

---

*RevisionGrade Canon — Version 2.1 — March 2026*
