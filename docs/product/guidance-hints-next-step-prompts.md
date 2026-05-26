# RevisionGrade Guidance Hints & Next-Step Prompts

Status: draft / post-core-workflow polish

This document captures the guidance-hint doctrine for RevisionGrade so the launch workflow can remain self-explaining even if user videos are not ready at launch.

## Why this exists

RevisionGrade should not depend on explainer videos for a user to understand the workflow.

The product should teach the author in context:

- what a page is for;
- what a score, state, or queue category means;
- what action to take next;
- why the system is asking for a decision;
- where the author is in the Evaluate → Revise → Recheck → Dashboard loop.

Guidance hints are a final polish layer. They should be added after the core workflow is stable so the copy explains the real product instead of chasing moving UI.

## Doctrine

Use guidance hints for two purposes only:

1. Explain what something means.
2. Tell the author what to do next.

Do not use hints for marketing filler, generic encouragement, or decorative SaaS tooltips.

Internal name: **Guidance Hints**

Public tone: serious, editorial, brief, and action-oriented.

Core rule:

> Explain the system. Guide the next action. Never distract from the manuscript.

## Priority surfaces

### Dashboard

Purpose: orient the author to progress tracking.

Possible copy:

**Your progress dashboard**

Track each evaluation, revision cycle, and recheck in one place. RevisionGrade shows whether your manuscript is moving toward readiness over time.

Next-step prompt:

**Recommended next step:** Open your latest report, then begin Revise if you are ready to act on the diagnosis.

Dashboard hints should reinforce that the dashboard is included with paid audits and is not an upsell.

### Evaluate page

Purpose: clarify what happens after manuscript selection/upload/paste.

Possible copy:

Upload or select a manuscript to begin. RevisionGrade reads the work, scores it against story criteria, and identifies the strongest opportunities for revision.

Long-form note:

Longer manuscripts may take more time because the system reads more context and checks continuity across the manuscript.

### Evaluation report

Purpose: bridge diagnosis to action.

Possible copy:

**The report is diagnosis. Revise is action.**

Your evaluation identifies strengths, risks, and revision priorities. The Revise Workbench converts those findings into a prioritized repair queue.

Button language:

- Prefer: **Open Revise Workbench**
- Avoid: **Go to Revise** when the destination is manuscript-specific, because the global Revise route may be a product/marketing landing page.

### Revise Workbench

Purpose: explain severity, scope, mode, and author decision state.

Top-of-page hint:

**Start with MUST repairs.**

RevisionGrade surfaces revision opportunities, then sorts the first actionable batch by editorial priority. MUST items are readiness blockers. SHOULD items are high-value repairs. COULD items are optional refinements.

Deferral hint:

**Defer does not downgrade the issue.**

Deferring means you chose not to act right now. The item keeps its original severity.

Repair Brief hint:

**This is a repair brief, not a sentence swap.**

Larger scene, chapter, structural, or manuscript-level issues require a repair plan before prose changes.

Revision Ledger hint:

**Your choices are recorded here.**

Accepted proposals, custom rewrites, rejected options, kept originals, and deferred items appear in the Revision Ledger for later review and recheck history.

### Pricing / Revise Passes / Revision Credits

Purpose: reduce cost anxiety without making the author calculate everything.

Possible copy:

**Why repair capacity varies**

Simple repairs use little or no repair capacity. Larger repairs use more because they require deeper manuscript context, voice protection, and continuity validation.

Credit clarification:

**Revision Credits are not one credit per edit.**

A punctuation cleanup and a chapter-level cohesion repair do not require the same amount of work.

### Empty states

Purpose: tell the author what is missing and what to do next.

No evaluations:

**No evaluations yet.**

Run your first evaluation to start building your manuscript readiness history.

No revision decisions:

**No revision decisions yet.**

Once you accept, reject, defer, keep original, or customize a repair, your choices will appear here.

No revision opportunities:

**No revision opportunities available yet.**

This evaluation did not persist revision opportunities. Re-run the evaluation or generate a Revise queue for this manuscript.

## UI patterns

Use three patterns only:

### Inline helper text

Always visible. Use for workflow-critical guidance.

Example:

Start with MUST repairs before lower-level polish.

### Info popovers

Use for definitions only.

Example:

MUST: A readiness blocker that should be resolved before submission-focused polish.

### Next-step callouts

Use when the user needs a clear action.

Example:

Next: Open the Revise Workbench to turn this diagnosis into a prioritized repair queue.

## Non-goals

This draft PR should not implement hints yet.

Do not add:

- product tours;
- video dependencies;
- modal-heavy onboarding;
- generic tooltips on every label;
- pricing/credit calculations inside Revise;
- unsupported feature claims.

## Implementation timing

Guidance hints should be added after these core surfaces are stable:

1. Dashboard / progress ledger
2. Revise Workbench UI
3. Real manuscript-generated revision opportunities
4. Persisted Revision Ledger decisions
5. Dashboard charts fed by Revise decisions and rechecks

After those stabilize, create an implementation PR:

`ui/add-guidance-hints-next-step-prompts`

## Acceptance criteria for future implementation

- Dashboard explains progress tracking and next action.
- Evaluation report clearly bridges to manuscript-specific Revise Workbench.
- Revise Workbench explains MUST / SHOULD / COULD, scope, mode, and deferral.
- Revision Ledger empty state explains author decision history.
- Pricing explains why repair capacity varies without exposing internal infrastructure.
- Empty states are instructive, not blank.
- No user videos are required to complete the core workflow.
- Hints are brief enough to avoid visual clutter.

## Product reminder

The product itself should teach the user.

Videos can come later, after real users reveal the questions they repeatedly ask.
