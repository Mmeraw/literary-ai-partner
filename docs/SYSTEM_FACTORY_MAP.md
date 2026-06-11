# RevisionGrade — System Factory Map

> **Status:** Living document. Updated as each factory's SIPOC/FIPOC governance is completed.
> **Governance:** `AI_GOVERNANCE.md` (binding)
> **Last updated:** 2026-06-11

---

## Purpose

This document is the executive view of the RevisionGrade system as a chain of
factories. Each factory takes the output of the previous one as its primary
input. Each factory has a SIPOC constitution and an executable TypeScript registry.

A factory is **registry-described** when its SIPOC exists and is test-protected.
A factory is **SIPOC-enforced** when every stage in its registry is backed by a
real artifact, real persistence, real authority source, and real backward-kick
behavior — not UI simulation or client-state approximation.

**Registry-described ≠ complete. Accurately mapped ≠ fully implemented.**

---

## The Factory Chain

```
Author uploads manuscript
        │
        ▼
┌────────────────────────────────────────────────────────────────────┐
│  FACTORY 1: EVALUATION                                             │
│  Manuscript → Professional literary diagnosis                      │
│  SIPOC: docs/SIPOC_EVALUATION_PROCESS.md       ✅ registry-described │
│  Registry: lib/evaluation/fipocRegistry.ts                        │
│  Registries: docs/registries/ (evaluation)                         │
└────────────────────────────────────────────────────────────────────┘
        │
        │  evaluation_result_v2
        │  (score, narrative, mode, story ledger, revision opportunities)
        ▼
┌────────────────────────────────────────────────────────────────────┐
│  FACTORY 2: REVISE                                                 │
│  Evaluation result → Author revision decisions                     │
│  SIPOC: docs/SIPOC_REVISE_PROCESS.md           ✅ registry-described │
│  Registry: lib/revision/reviseRegistry.ts                         │
│  Registries: docs/registries/revise/                               │
└────────────────────────────────────────────────────────────────────┘
        │
        │  revision_completion_record_v1
        │  (accepted decisions, ledger sync, completion state)
        ▼
┌────────────────────────────────────────────────────────────────────┐
│  FACTORY 3: AGENT READINESS                                        │
│  Revised manuscript → Professional submission package              │
│  SIPOC: docs/SIPOC_AGENT_READINESS_PROCESS.md  ✅ registry-described │
│  Registry: lib/agent-readiness/agentReadinessRegistry.ts          │
│  Registries: docs/registries/agent-readiness/                      │
│  Known gaps: AR04, AR05, AR06, AR08, AR09 (issues #1117–#1122)    │
└────────────────────────────────────────────────────────────────────┘
        │
        │  agent_readiness_package_v1
        │  (query letter, synopsis, pitch, comparables, bio, export)
        ▼
┌────────────────────────────────────────────────────────────────────┐
│  FACTORY 4: STORYGATE                                              │
│  Vetted package → Controlled professional access                   │
│  SIPOC: (not yet created)                      ⬜ not yet mapped    │
│  Registry: (not yet created)                                       │
│  Runtime: app/storygate-studio/, app/storygate/                   │
│  See: base44/functions/STORYGATE_FLOW_MAP.md                      │
└────────────────────────────────────────────────────────────────────┘
        │
        │  (future)
        ▼
  Publishing professional discovery, access, and response
```

---

## Factory 1: Evaluation

**Product surface:** `/evaluate`, `/report`
**Entry artifact:** manuscript text (chunked)
**Exit artifact:** `evaluation_result_v2`

| Registry Table | File |
|----------------|------|
| Process | `docs/registries/process_registry.csv` |
| Artifact | `docs/registries/artifact_registry.csv` |
| Field | `docs/registries/field_registry.csv` |
| Kick Matrix | `docs/registries/kick_matrix.csv` |
| Renderer | `docs/registries/renderer_consumption_matrix.csv` |
| Authority Source | `docs/registries/authority_source_registry.csv` |

**Certification gate:** `author_exposure_certification_v1` must pass before any
evaluation field is surfaced to an author.

**Governance status:** Registry-described. Missing critical: completion
certification (`RS08`-equivalent), WAVE cross-check full enforcement.

---

## Factory 2: Revise

**Product surface:** `/revise`, `/workbench`
**Entry artifact:** `revision_opportunity_ledger_v1` (from Evaluation)
**Exit artifact:** `revision_completion_record_v1`

| Registry Table | File |
|----------------|------|
| Process (RS01–RS10) | `docs/registries/revise/revise_process_registry.csv` |
| Artifact | `docs/registries/revise/revise_artifact_registry.csv` |
| Field | `docs/registries/revise/revise_field_registry.csv` |
| Kick Matrix | `docs/registries/revise/revise_kick_matrix.csv` |
| Renderer | `docs/registries/revise/revise_renderer_consumption_matrix.csv` |
| Authority Source | `docs/registries/revise/revise_authority_source_registry.csv` |
| Certification Gate | `docs/registries/revise/revise_certification_gate_registry.csv` |

**Six-part diagnostic canonical fields:**
`symptom` → `cause` → `fixDirection` → `readerEffect` → `evidence_anchor` → `revision_operation`

**Governance status:** Registry-described. Missing critical: `RS08_COMPLETION`
(completion certification does not exist). PR #1116 open (runtime audit corrections).

---

## Factory 3: Agent Readiness

**Product surface:** `/agent-readiness`
**Entry artifact:** `manuscript_context_v1` + completed `evaluation_result_v2`
**Exit artifact:** `package_export_v1` (.txt or .docx)

| Registry Table | File |
|----------------|------|
| Process (AR01–AR09) | `docs/registries/agent-readiness/agent_readiness_process_registry.csv` |
| Artifact | `docs/registries/agent-readiness/agent_readiness_artifact_registry.csv` |
| Field | `docs/registries/agent-readiness/agent_readiness_field_registry.csv` |
| Kick Matrix | `docs/registries/agent-readiness/agent_readiness_kick_matrix.csv` |
| Renderer | `docs/registries/agent-readiness/agent_readiness_renderer_matrix.csv` |
| Authority Source | `docs/registries/agent-readiness/agent_readiness_authority_source_registry.csv` |
| Certification Gate | `docs/registries/agent-readiness/agent_readiness_certification_gate_registry.csv` |
| Section Word Limits | `docs/registries/agent-readiness/section_word_limit_registry.csv` |

**Canonical section types:**
`query_letter` · `what_makes_unique` · `synopsis` · `query_pitch` · `comparables` · `author_bio`

**Known implementation gaps (issues open):**

| Stage | Gap | Issue |
|-------|-----|-------|
| AR04 | DB persistence failure is non-fatal | #1117 |
| AR05 | Section approval not persisted to DB | #1118 |
| AR06 | Completeness derived from client state only | #1119 |
| AR08 | Export accepts any sections payload; no approval enforcement | #1121 |
| AR07+AR09 | No durable package entity or version history | #1120, #1122 |

**Governance status:** Registry-described. SIPOC merged in PR #1115.
SIPOC merged ≠ Agent Readiness complete.

---

## Factory 4: Storygate

**Product surface:** `/storygate-studio`, `/storygate` (industry portal)
**Entry artifact:** `agent_readiness_package_v1` + readiness gate (score ≥ 8.0 or equivalent)
**Exit artifact:** controlled professional access record (access request, approval, logged view)

**Runtime flow:**
1. **Creator Submission** — Author submits project via `/storygate-studio/apply`. Creates `StorygateSubmission` with status `SUBMITTED`.
2. **Internal Screening** — Internal review assigns Tier (1=auto-decline, 2=hold, 3=engage). Status transitions: `REVIEWING`, `DECLINED`, `HOLD`.
3. **Gate 1 — Professional Package** — Verified professional manuscript package required (query letter, synopsis, author bio, sample pages). RevisionGrade package satisfies this, but is not required.
4. **Gate 2 — Readiness Threshold** — Score ≥ 8.0 from a full RevisionGrade evaluation, or equivalent from a qualified third party (literary agent, acquiring editor, professional editor).
5. **Industry Verification** — Publishing professionals verified before portal access. `verification_state: verified | unverified`.
6. **Access Request / Approval** — Industry users request access per project. Creator approves or declines. Access is per-project, per-role.
7. **Controlled Access** — Verified professionals see creator-approved materials only. All access is logged (append-only).
8. **Access Log** — Project access, view activity, and key events are recorded.

**Runtime code locations:**
- `app/storygate-studio/` — creator submission surface
- `app/storygate/` — industry portal
- `app/storygate-studio/industry/` — industry user dashboard
- `app/storygate-studio/apply/` — creator application
- `components/storygate/StorygateReadinessBridge.tsx` — readiness bridge UI
- `base44/functions/createStoryGateListing/` — listing creation
- `base44/functions/submitStoryGateFilm/` — film/project submission
- `base44/functions/screenStorygateSubmission/` — screening logic

**Governance doctrine:** `base44/functions/STORYGATE_FLOW_MAP.md`,
`base44/functions/STORYGATE_SUBSCRIPTION_INDEPENDENCE_CANON.md`

**Subscription independence rule (CANON-LOCKED):** Once a submission is accepted
into the Storygate queue, the submission record remains active and reviewable
regardless of the author's current subscription status.

**Governance status:** ⬜ **Not yet registry-described.** SIPOC and executable
registry do not yet exist. The Storygate FIPOC/SIPOC is the highest-priority
remaining governance gap after Evaluation + Revise + Agent Readiness are
SIPOC-enforced.

---

## Governance Coverage Summary

| Factory | SIPOC | Executable Registry | Test Guards | Known Gaps Documented | SIPOC-Enforced |
|---------|-------|---------------------|-------------|----------------------|----------------|
| Evaluation | ✅ | ✅ `fipocRegistry.ts` | ✅ | Partial | ⬜ No |
| Revise | ✅ | ✅ `reviseRegistry.ts` | ✅ | Yes (RS08) | ⬜ No |
| Agent Readiness | ✅ | ✅ `agentReadinessRegistry.ts` | ✅ | Yes (AR04–AR09) | ⬜ No |
| Storygate | ⬜ | ⬜ | ⬜ | — | ⬜ No |

**SIPOC-enforced** = every stage backed by real artifact, real persistence, real
backward-kick, no UI simulation. No factory is SIPOC-enforced yet.

---

## Cross-Factory Artifact Handoffs

| From | To | Artifact | Description |
|------|----|----------|-------------|
| Evaluation | Revise | `revision_opportunity_ledger_v1` | Prioritized revision opportunities with ledger backing |
| Evaluation | Revise | `accepted_story_ledger_v1` | Canon-locked story facts gating Phase 2 |
| Evaluation | Agent Readiness | `evaluation_result_v2` | Readiness score, narrative summary, mode |
| Agent Readiness | Storygate | `agent_readiness_package_v1` | Professional submission package (query, synopsis, bio) |
| Storygate | Industry | access record | Creator-approved, logged professional access |

---

## Cross-Factory Canonical Values

These enum values are shared across factories and must not drift:

| Value | Canonical Set | Owner Factory |
|-------|--------------|---------------|
| `JobStatus` | `queued \| running \| complete \| failed` | Evaluation |
| `RevisionReadiness` | `ready_for_revise \| needs_targeting` | Revise |
| `RevisionLedgerDecision` | `accepted_a \| accepted_b \| accepted_c \| custom \| keep_original \| reject \| deferred` | Revise |
| `EvaluationMode` | `STANDARD \| TRANSGRESSIVE \| TESTIMONY` | Evaluation |
| `SectionType` | `query_letter \| what_makes_unique \| synopsis \| query_pitch \| comparables \| author_bio` | Agent Readiness |
| `SectionStatus` | `draft \| approved` | Agent Readiness |
| `PackageStatus` | `Not Started \| Draft \| Approved \| Exported` | Agent Readiness |
| `ExportFormat` | `txt \| docx` | Agent Readiness |
| `StorygateVerificationState` | `verified \| unverified` *(from STORYGATE_FLOW_MAP)* | Storygate |
| `StorygateSubmissionStatus` | `SUBMITTED \| REVIEWING \| DECLINED \| HOLD \| APPROVED` *(from STORYGATE_FLOW_MAP)* | Storygate |

---

## Next Governance Priorities

| Priority | Work | Depends On |
|----------|------|------------|
| P1 | Merge PR #1116 — Revise FIPOC runtime audit corrections | — |
| P1 | AR04 hard-fail persistence (#1117) | — |
| P1 | AR05 section approval persistence (#1118) | — |
| P1 | AR06 completeness enforcement (#1119) | #1118 |
| P2 | AR07/AR08 durable package entity (#1120) | — |
| P2 | AR08 export gating (#1121) | #1118, #1119, #1120 |
| P2 | AR09 package history (#1122) | #1120 |
| P3 | Storygate SIPOC/FIPOC — create executable registry | — |
| P3 | Update this document when Storygate SIPOC is complete | Storygate SIPOC |
