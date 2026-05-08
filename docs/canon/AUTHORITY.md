---
canon_status: meta
domain: canon-authority-index
runtime_binding: false
---

# Canon Authority Index (PR-0 scaffold)

> PR-0 status: scaffold only.
> This file enumerates registered canon surfaces so CI and future authority
> enforcement can operate deterministically.
>
> Ownership decisions are deferred to follow-up PRs.

---

## Canon layer model

- `intake/`
  - drafts/proposals only
  - never authoritative
  - temporary staging zone

- `registered/control/`
  - indexes
  - registries
  - matrices
  - maps
  - authority routing
  - no long-form doctrine prose

- `registered/volumes/`
  - canonical doctrine/specification
  - exactly one authoritative owner per domain

- `archive/`
  - superseded canon retained for audit/provenance

---

## Frontmatter contract

Every file under:
- `docs/canon/registered/control/`
- `docs/canon/registered/volumes/`

MUST eventually declare:

```yaml
canon_status:
domain:
supersedes:
superseded_by:
runtime_binding:
```

(PR-0 scaffolds this requirement. Enforcement lands later.)

---

## Allowlisted authority zones

Only these paths may declare:

```yaml
canon_status: authoritative
```

Allowed:

- `docs/canon/registered/control/`
- `docs/canon/registered/volumes/`

Everything else defaults non-authoritative unless explicitly allowlisted.

---

## Non-authoritative default zones

The following folders are non-authoritative by default:

- `docs/sprints/**`
- `docs/pr/**`
- `docs/prs/**`
- `docs/roadmap/**`
- `docs/release/**`
- `docs/archive/**`
- `.worktrees/**`
- `archive/**`
- `ops/**`
- `runs/**`
- root-level historical/closure/evidence docs

Allowed statuses there:

- `draft`
- `historical`
- `planning`
- `evidence`
- `deprecated`
- `secondary`

Not allowed:

- `authoritative`

---

## Registered file inventory (ownership TBD)

### control/

- `registered/control/BENCHMARK-CHARTER.md`
- `registered/control/CPDR-001-CANON-ENFORCEMENT-PLACEMENT.md`
- `registered/control/criterion-observability-model.md`
- `registered/control/LOST-WORLD-LESSONS-DOCTRINE-ADDENDUM.md`
- `registered/control/REVISIONGRADE-CANON-ASSEMBLY-MATRIX.md`
- `registered/control/REVISIONGRADE-CANON-DOCTRINE-REGISTRY.md`
- `registered/control/VOLUME-II-A-OPERATIONAL-SCHEMA.md`
- `registered/control/VOLUMES-I-V-DEFINITIONS-CONTENT-REGISTRY-VIEW.md`
- `registered/control/WAVE-SYSTEM-EXECUTION-LAYER-MAP.md`

### volumes/

- `registered/volumes/CANON-III-LESSONS-OF-THE-LIVING-SYSTEM.md`
- `registered/volumes/REVISIONGRADE-EVALUATION-RUNTIME-GOVERNANCE.md`
- `registered/volumes/RITUAL-EDITOR-1.md`
- `registered/volumes/VOLUME-I-II-MERGED-ADDENDUMS-PROSE-ENFORCEMENT.md`
- `registered/volumes/VOLUME-I-WAVE-REVISION-GUIDE-CANON.md`
- `registered/volumes/VOLUME-II-A-PR-PROMPT-RUNTIME-BINDING-SPEC.md`
- `registered/volumes/VOLUME-II-STORY-EVALUATION-CRITERIA.md`
- `registered/volumes/VOLUME-III-EVALUATION-PIPELINE-ARCHITECTURE.md`
- `registered/volumes/VOLUME-III-EVALUATION-PIPELINE-PASS-SYSTEM.md`
- `registered/volumes/VOLUME-III-FINAL-PIPELINE-DIAGRAM-STATE-MODEL.md`
- `registered/volumes/VOLUME-III-PIPELINE-API-JSON-SCHEMA.md`
- `registered/volumes/VOLUME-III-PLATFORM-GOVERNANCE-CANON.md`
- `registered/volumes/VOLUME-IV-AI-GOVERNANCE-CANON.md`
- `registered/volumes/VOLUME-V-EXECUTION-ARCHITECTURE.md`
- `registered/volumes/VOLUME-VI-GOVERNANCE-FRONTEND-VISIBILITY.md`
- `registered/volumes/WAVE-31-LW.md`
- `registered/volumes/WAVE-55-L.md`

---

## PR-0 warning policy

PR-0 emits warnings only. Do not address warnings inside this PR.
Warnings are tracked for follow-up PRs (PR-1..PR-6).

## Escalation note

- PR-0 = warnings/reporting only for legacy debt.
- PR-1 = inventory/classification.
- PR-2 = frontmatter normalization.
- PR-3 = hard-fail enforcement once remediation baseline exists.

## Deferred enforcement tracking

- PR-1 tracking issue: https://github.com/Mmeraw/literary-ai-partner/issues/368
- PR-2 tracking issue: https://github.com/Mmeraw/literary-ai-partner/issues/369
- PR-3 tracking issue: https://github.com/Mmeraw/literary-ai-partner/issues/370
- PR-5 tracking issue: https://github.com/Mmeraw/literary-ai-partner/issues/371
