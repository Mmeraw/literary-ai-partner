# RevisionGrade Final Review / Apply / Export

Status: implementation scaffold

Final Review is the author-confirmed finishing path after Revise decisions have been made and synced.

## Product doctrine

Revise is not complete when the author clicks a few decisions.

Revise is complete when the author reviews the decision set, applies selected changes to a new manuscript version, and can export or re-evaluate the result.

## Required surfaces

### Final Review screen

Final Review must show:

- accepted A/B/C decisions;
- custom author rewrites;
- kept-original decisions;
- rejected decisions;
- deferred decisions;
- unresolved warning state when meaningful work remains deferred.

### Marked manuscript preview

The revised manuscript review copy should show visual markup.

Recommended visual convention:

- accepted system A/B/C revision: soft gold highlight;
- custom author rewrite: soft blue/gray highlight;
- unresolved/deferred issue: muted gray marker or warning marker;
- rejected and kept-original items: visible in sidebar, not applied to the manuscript body.

Color alone is not sufficient. The marked preview must be paired with a Revision Changelog sidebar so the author can understand why each visible change exists.

### Revision Changelog sidebar

The sidebar should explain:

- what changed;
- who/what decided it: accepted A/B/C or custom author rewrite;
- what stayed untouched: kept original;
- what is not applied: rejected or deferred;
- what remains risky before re-evaluation.

Sidebar items should eventually click-scroll to the manuscript location.

### Apply selected decisions

Apply should:

- create a new derived manuscript version;
- preserve the original manuscript version;
- apply only accepted A/B/C and custom decisions;
- not apply kept-original, rejected, or deferred decisions;
- record which ledger decisions were applied;
- expose a clear ready-for-recheck state.

### Export outputs

Final Review should support at least three outputs:

1. Clean revised manuscript
   - no color;
   - no sidebar;
   - no internal notes;
   - professional author-facing draft.

2. Marked-up review copy
   - highlights visible changes;
   - preserves author review context.

3. Revision changelog
   - original issue;
   - author decision;
   - selected option/custom text;
   - applied/not applied;
   - severity/scope when available;
   - timestamp.

## Current PR scope

This scaffold adds the first Final Review route and author-facing screen:

`/workbench/final-review?manuscriptId=...&evaluationJobId=...`

It loads synced Revision Ledger decisions, renders a marked preview, and shows a changelog sidebar.

Apply and export buttons are intentionally staged as UI affordances until the next PR wires server-side apply/export behavior.

## Non-goals for scaffold PR

- No evaluation pipeline rerun.
- No scoring changes.
- No WAVE/Golden Spine expansion.
- No pricing or credit logic.
- No Agent Readiness or Storygate runtime changes.
- No automatic application of rejected/deferred/kept-original decisions.
