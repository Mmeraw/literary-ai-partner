# RevisionGrade Canon

**Status:** ACTIVE  
**Authority:** Mike Meraw  
**Last Updated:** 2026-03-09  
**Version:** 1.0

---

This directory contains the complete canonical governance, doctrine, and execution architecture for the RevisionGrade platform. Markdown files in `volumes/` and `control/` are **authoritative**. Word files in `archive/` are provenance only.

---

## Structure

```
/canon
  /volumes          ← Canonical volumes (authoritative .md)
  /control          ← Control documents (authoritative .md)
  /archive
    /docx           ← Original Word files (provenance only)
    /old-drafts     ← Superseded drafts (non-authoritative)
  README.md         ← This file
```

---

## Volumes

| # | File | Canon ID | What It Covers |
|---|---|---|---|
| I | [VOLUME-I-WAVE-REVISION-GUIDE-CANON.md](volumes/VOLUME-I-WAVE-REVISION-GUIDE-CANON.md) | VOL-I-WAVE-V20 | 62 diagnostic waves, 6 tsunamis, wave execution rules |
| II | [VOLUME-II-STORY-EVALUATION-CRITERIA.md](volumes/VOLUME-II-STORY-EVALUATION-CRITERIA.md) | VOL-II-CRITERIA-1.0 | 13 core evaluation criteria, scoring model, eligibility gates |
| III-PG | [VOLUME-III-PLATFORM-GOVERNANCE-CANON.md](volumes/VOLUME-III-PLATFORM-GOVERNANCE-CANON.md) | VOL-III-PLATFORM-GOV-1.0 | Platform identity, user rights, governance constraints |
| III-TI | [VOLUME-III-TOOLS-IMPLEMENTATION-SYSTEMS.md](volumes/VOLUME-III-TOOLS-IMPLEMENTATION-SYSTEMS.md) | VOL-III-TOOLS-1.0 | Schemas, prompts, adapters, evaluators, integration contracts |
| III-OS | [VOLUME-III-OPERATIONAL-SPECIFICATION.md](volumes/VOLUME-III-OPERATIONAL-SPECIFICATION.md) | VOL-III-OPS-1.0 | Gates, routing rules, operational triggers |
| IV | [VOLUME-IV-AI-GOVERNANCE-CANON.md](volumes/VOLUME-IV-AI-GOVERNANCE-CANON.md) | VOL-IV-AI-GOV-1.0 | AI authority levels, constraints, risk/failure management, canon protection |
| V | [VOLUME-V-EXECUTION-ARCHITECTURE.md](volumes/VOLUME-V-EXECUTION-ARCHITECTURE.md) | VOL-V-EXEC-1.0 | Deployment, reliability, scaling, disaster recovery, industry interface |

### Reading Order
1. Volume III-PG — understand what the platform is
2. Volume I — understand the WAVE methodology
3. Volume II — understand how manuscripts are evaluated
4. Volume IV — understand AI governance
5. Volume III-TI — understand how it’s built
6. Volume III-OS — understand how it operates
7. Volume V — understand how it deploys

---

## Control Documents

| File | Canon ID | What It Covers |
|---|---|---|
| [REVISIONGRADE-CANON-DOCTRINE-REGISTRY.md](control/REVISIONGRADE-CANON-DOCTRINE-REGISTRY.md) | CTRL-DOCTRINE-REG-1.0 | Index of all 30 doctrines across Volumes I–V |
| [REVISIONGRADE-CANON-ASSEMBLY-MATRIX.md](control/REVISIONGRADE-CANON-ASSEMBLY-MATRIX.md) | CTRL-ASSEMBLY-MTX-1.0 | Wiring diagram: how volumes, doctrines, and systems connect |
| [VOLUMES-I-V-DEFINITIONS-CONTENT-REGISTRY-VIEW.md](control/VOLUMES-I-V-DEFINITIONS-CONTENT-REGISTRY-VIEW.md) | CTRL-DEFINITIONS-REG-1.0 | Cross-volume term definitions and content location registry |
| [VOLUME-II-A-OPERATIONAL-SCHEMA.md](control/VOLUME-II-A-OPERATIONAL-SCHEMA.md) | VOL-IIA-OPS-SCHEMA-1.0 | Operationalization of Volume II criteria: rubrics, evidence rules, mappings |

---

## Canon Policy

- **Canonical:** `.md` files in `volumes/` and `control/`
- **Archive:** `.docx` files in `archive/docx/` are provenance only—not authoritative
- **Changes:** Proposed via `canon/revisions/<date>-<topic>` branches, merged to `main` only after review
- **AI use:** AI systems treat all canonical `.md` files as read-only per Volume IV
- **Disputes:** Resolved using conflict hierarchy in Assembly Matrix, Part 4

---

## Volume Dependencies

```
Volume I  → feeds → Volume II
Volume II → informs → Volume III-PG
Volume IV → constrains → ALL volumes
Volume V  → hosts → ALL volumes
```

---

## Doctrine Summary

30 canonical doctrines are registered across Volumes I–V. See [Doctrine Registry](control/REVISIONGRADE-CANON-DOCTRINE-REGISTRY.md) for the complete index.

| Volume | Doctrines |
|---|---|
| Volume I | 5 (D-I-01 through D-I-05) |
| Volume II | 4 (D-II-01 through D-II-04) |
| Volume III | 15 (D-III-01 through D-III-15) |
| Volume IV | 6 (D-IV-01 through D-IV-06) |
| Volume V | 5 (D-V-01 through D-V-05) |
| **Total** | **30** |

---

*RevisionGrade Canon — Version 1.0 — March 2026*
