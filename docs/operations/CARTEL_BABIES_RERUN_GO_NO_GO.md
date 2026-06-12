# Cartel Babies Rerun — Production Go/No-Go Gate

_Last updated: 2026-06-12_

## Release-control authority

This document is a **release-control gate**, not an informal operations note.
Cartel Babies rerun authorization must be recorded here and treated as binding for release signoff.

## Policy (binding)

Do **not** rerun Cartel Babies unless **all five** conditions are true:

1. PR merged to `main`
2. Production deploy completed
3. One known production evaluation completes end-to-end
4. Admin Forensics shows artifact health + RCA metadata correctly
5. Short/chapter/long-form confidence ladder passes

If any condition is false, Cartel Babies remains blocked.
If any condition is unknown, treat it as **NO-GO** until explicitly proven green.

---

## Gate status table (required)

| Gate | Status (GREEN / RED / UNKNOWN) | Evidence | Required |
| --- | --- | --- | --- |
| PR #1130 merged to `main` | UNKNOWN | Merge commit link/SHA | Required |
| Production deploy complete | UNKNOWN | Deployment ID / URL | Required |
| Known E2E production eval passed | UNKNOWN | Job ID + completion timestamp | Required |
| Admin Forensics verified in production | UNKNOWN | Screenshot + Job ID/API payload reference | Required |
| Confidence ladder passed (short/chapter/long-form) | UNKNOWN | 3 production Job IDs | Required |

---

## Why this gate exists

Cartel Babies must be used as a **real manuscript evaluation**, not as a **pipeline proof test**.

When processor/handoff/forensics infrastructure is still changing, failed reruns are ambiguous:
- manuscript quality signal and
- infrastructure instability

The gate removes that ambiguity.

---

## Current release candidate hardening scope

Expected hardening before rerun:
- recoverable `pass12_handoff_v1` repair/requeue
- canonical handoff validation
- handoff ownership checks (`job_id`, `manuscript_id`)
- repair-attempt cap (`HANDOFF_REPAIR_EXHAUSTED`)
- fail-soft forensic snapshot handling
- admin forensic visibility + privacy-safe RCA

---

## Verification checklist (operator)

### Gate 1 — PR merged to `main`
- [ ] Active hardening PR(s) merged
- [ ] Merge commit visible on `main`

Evidence:
- PR URL(s)
- merge commit SHA(s)

### Gate 2 — Production deploy completed
- [ ] App deployment succeeded
- [ ] Required migrations applied
- [ ] No deploy-time schema/runtime drift alerts

Evidence:
- deploy URL / build ID
- migration run output

### Gate 3 — One known production eval passes E2E
- [ ] Known manuscript run reaches `complete`
- [ ] Expected artifacts persist through final report surfaces
- [ ] No terminal infra failure code

Evidence:
- job id
- completion timestamp
- key artifact list

### Gate 4 — Admin Forensics RCA surfaces correct metadata
- [ ] Artifact Health Summary renders
- [ ] RCA fields render (failure class, blocking artifact, contamination start, salvage)
- [ ] Privacy-safe behavior confirmed (no manuscript/evidence prose)

Evidence:
- job id(s)
- screenshots / API payload sample (sanitized)

### Gate 5 — Confidence ladder passes in production
- [ ] Short form (3k–5k words) passes
- [ ] Chapter-sized (7k–10k words) passes
- [ ] Long-form/novella sample passes

Evidence:
- 3 job ids
- per-job final status and failure code (if any)

---

## Decision table

- **GO**: all five gates checked and evidenced.
- **NO-GO**: one or more gates unchecked.
- **NO-GO**: any gate status unknown/unverified.

Decision logic:

```text
ANY RED     -> NO-GO
ANY UNKNOWN -> NO-GO
ALL GREEN   -> GO
```

If NO-GO:
1. fix gate failures,
2. rerun ladder,
3. re-evaluate gate status,
4. only then authorize Cartel Babies rerun.

---

## Freeze window (required)

Once all gates are GREEN and signoff is recorded:

```text
No new pipeline, artifact, governance, renderer,
forensics, or evaluation changes may be merged
between signoff and the Cartel Babies rerun.
```

If any such change is merged, gate status resets to UNKNOWN until revalidated.

---

## RCA-first reminder

If a validation job fails, investigate with Admin Forensics first:
- first contaminated stage
- first contaminated artifact
- weak SIPOC stage
- downstream salvage counts
- failure code/class

Do not spend Cartel Babies run budget while RCA still indicates infrastructure instability.
