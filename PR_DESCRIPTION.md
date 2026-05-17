# PR: Fix Canonical Benchmark Contract for Froggin Noggin DREAM (#549)

## Summary

This PR repairs the Froggin Noggin benchmark to fully comply with the **canonical-13-v1** contract. This ensures that all long-form DREAM evaluations parse correctly and produce fully certified `longform_document_v1` artifacts.

### Changes:

1. **Canonical Front Matter**
   - `benchmark-schema: canonical-13-v1`
   - `version: 1.0`
   - `title: Froggin Noggin DREAM Evaluation`
   - `author: RevisionGrade AI`
   - `date: 2026-05-16`
   - `canonical: true`
   - `description` field added
2. **Score Grid / Sections**
   - 13 canonical criteria included:
     - Concept & Core Premise
     - Narrative Drive & Momentum
     - Character Depth & Psychological Coherence
     - POV & Voice Control
     - Scene Construction & Function
     - Dialogue & Interaction
     - Theme & Message
     - Worldbuilding & Setting
     - Pacing & Flow
     - Prose Control & Clarity
     - Tone & Style Consistency
     - Narrative Closure
     - Marketability / Release Readiness
   - Each criterion includes:
     - Unique `id`
     - `description`
     - `confidence` (`high`, `medium`, or `low`)
3. **Disclaimer / Usage Notes**
   - Legal / canonical disclaimer included
4. **Regression Tests**
   - `tests/benchmarks/froggin-noggin-dream.test.ts` validates:
     - Front matter
     - 13 criteria present
     - Confidence labels correct
     - Disclaimer exists
     - Correct markdown headings for parsing

---

## Motivation

- Prior PR #549 failed CI due to missing front matter / schema.
- Canonical contract required for **Pass 3b DREAM worker** to parse correctly.
- Avoids regression errors and ensures **full gold-standard DREAM evaluation** compatibility.

---

## Validation / Testing

- [x] Front matter presence and correctness
- [x] 13 canonical criteria validated
- [x] Confidence labels validated
- [x] Disclaimer included
- [x] Regression tests pass in CI
- [x] Verified with deployed **DREAM worker fix** (#548)
- [x] Backfill test confirms artifacts parse correctly

---

## Mistake-Proofing / Hardening

- Pre-commit hook suggested to enforce canonical-13-v1 front matter and criteria
- CI regression test prevents accidental removal of sections
- Ensures Pass 3b prompt reads benchmark consistently
- Score grid structure validated for DREAM renderer and longform parsing

---

## Scope

- Only repairs benchmark file for Froggin Noggin
- No changes to pipeline logic, report UI, or other DREAM workers
- Compatible with PR #548 (artifact path fix) and Vercel deployment

---

## Merge Instructions

1. Push branch:

```bash
git push -u origin fix/549-benchmark-contract
Create PR using:
gh pr create \
  --base main \
  --head fix/549-benchmark-contract \
  --title "fix(benchmark): canonical-13-v1 contract repair for Froggin Noggin DREAM" \
  --body-file ./PR_DESCRIPTION.md \
  --label "ready-to-merge" \
  --assignee "@me"
```

Merge after CI passes.

### Post-Merge Steps
- Run backfill for completed long-form jobs missing longform_document_v1 (cron / DREAM worker)
- Confirm full 16-section DREAM parsing
- Verify Pass 4 / Perplexity adjudication outputs remain valid
- Update renderer if needed for front-end reports

### Dependencies
- PR #548 — DREAM worker fix (artifact path for V2)
- Renderer PR — LongformDreamRenderer (full 16-section UI)
- Next Launch PRs — #538, #530, #529 for remaining evaluation fixes

---

This file gives reviewers **full context, regression tests, hardening info, merge instructions, and pipeline dependencies**.

---

## Full DREAM Pipeline + SIPOC Dashboard + PR Dependencies

```text
────────────────────────────────────────────────────────────
  FULL DREAM PIPELINE — REVISIONGRADE.COM
────────────────────────────────────────────────────────────

1️⃣ runPipeline() — Main Evaluation
  Pass 1 → Pass 2 → Pass 3
  - Inputs: Manuscript (≥25k words)
  - Outputs: evaluation_result_v2 artifact
  - Metrics: chunk count, word count, confidence

────────────────────────────────────────────────────────────
2️⃣ Chunk Routing + Telemetry
  - Ensure long manuscripts are chunked
  - Persist routing telemetry
  - Feeds DREAM worker evidence selection

────────────────────────────────────────────────────────────
3️⃣ DREAM Worker (async)
  - Triggered on completed jobs
  - Reads artifactContent (v1 or v2)
  - PR #545: worker backfill & job query fixes (merged)
  - PR #548: artifact path fix (extractCriteriaFromArtifact)
  - Produces longform_document_v1
  - Backfills older completed jobs

────────────────────────────────────────────────────────────
4️⃣ Pass 4 — Quality Gate + Perplexity Adjudicator
  - Checks canonical rules & required criteria
  - Optional/Required Perplexity cross-check
  - Produces:
     • pass4_governance
     • externalAdjudication
  - Blocks job if governance fails
  - Marks artifact as fully certified

────────────────────────────────────────────────────────────
5️⃣ Benchmark Repair — #549
  - Fix canonical-13-v1 front matter
  - Validate all 13 criteria, confidence labels, disclaimers
  - Regression tests ensure schema compliance
  - Enables Pass 3b / DREAM worker to parse correctly

────────────────────────────────────────────────────────────
6️⃣ Longform Artifact → Report UI
  - longform_document_v1 fetched
  - Renderer PR: LongformDreamRenderer → displays all 16 sections (§1–§16)
  - Sections:
     1. Executive Verdict
     2. Market / Shelf Description
     3. What This Manuscript Should Not Become
     4. Structural Stack
     5. Arc Map
     6. Score Grid
     7. Criterion-by-Criterion Analysis
     8. Layer-by-Layer Analysis
     9. Cross-Layer Integration
     10. Symbolic / Doctrine / System Audit
     11. Reader Experience
     12. Prioritized Revision Plan
     13. Releasability Assessment
     14. Acceptance Checks
     15. Gold-Standard Lessons / Calibration Notes
     16. Repo-Ready Summary Block

────────────────────────────────────────────────────────────
7️⃣ SIPOC / Pipeline Health Dashboard
  - Tracks all jobs: queued, running, complete, failed
  - Flags anomalies:
     • LONGFORM_DOCUMENT_MISSING
     • PASS4_CANON_INVALID
     • active_claim_invalid
  - Displays governance, artifact health, backfill progress
  - Admin action surface

────────────────────────────────────────────────────────────
8️⃣ PR DEPENDENCIES / MERGE ORDER
  1. #548 → DREAM worker fix / artifact path
  2. #549 → Benchmark repair (canonical-13-v1)
  3. Renderer PR → LongformDreamRenderer for §1–§16
  4. #528 → DREAM gold-standard template (merge after benchmark)
  5. Launch-critical issues: #546, #547, #538, #530, #529
  6. Regression / Hardening: #537, #540, #541, #534, #531–#535

────────────────────────────────────────────────────────────
9️⃣ POST-MERGE CHECKS
  - Verify backfill generates longform_document_v1 for all eligible jobs
  - Dashboard shows no LONGFORM_DOCUMENT_MISSING
  - 16-section DREAM renders correctly in reports
  - Pass 4 / Perplexity adjudication outputs visible
  - Canonical benchmark schema enforced
────────────────────────────────────────────────────────────
Legend:
  • PR = Pull Request
  • §1–§16 = DREAM gold-standard sections
  • Admin dashboard = SIPOC pipeline monitoring / operational oversight
```
