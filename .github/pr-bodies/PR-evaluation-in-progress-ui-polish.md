## Summary

Polish the in-progress evaluation page and fix manuscript title fallback for pasted/public-domain manuscripts.

## Problems fixed

- The report page can show `Untitled Manuscript` even when the pasted manuscript clearly begins with a title, e.g. `The Strange Case Of Dr. Jekyll And Mr. Hyde`.
- The in-progress card uses vague/awkward status copy (`Getting ready...`, `Updated` showing elapsed text).
- The cancel button is visually dominant too early in the flow.
- The not-ready report panel is oversized for an active in-progress job.
- The help text `Taking longer than expected?` appears as a dangling question instead of useful guidance.

## Scope

In scope:
- Evaluation report header/title fallback.
- In-progress evaluation status card copy and layout polish.
- Cancel button visual priority only; existing confirmation modal behavior remains.
- Smaller in-progress report placeholder panel.

Out of scope:
- No evaluation pipeline changes.
- No scoring changes.
- No Story Ledger semantic changes.
- No Revise Queue changes.
- No database migration.
- No job status/phase contract changes.

## Required behavior

- Placeholder titles such as `Untitled Manuscript` should not win over a detectable title in pasted manuscript text.
- If the stored manuscript title is a placeholder and the manuscript text is stored as a `data:text/plain` URL, derive a better title from the first meaningful line.
- Preserve safe fallback: `Uploaded manuscript` / `Imported Manuscript` if no title can be derived.
- Header title should wrap naturally and not truncate long titles.
- In-progress copy should use customer-safe labels, not internal pipeline terms.
- `Updated` should become `Last updated`; elapsed time should remain under `Elapsed`.
- `Taking longer than expected?` should become useful helper copy and only appear after enough polling time.
- Cancel action should remain available but be visually secondary; confirmation modal remains required.

## Validation expected

- Existing title resolver behavior remains intact.
- Pasted Stevenson/Jekyll text derives `The Strange Case Of Dr. Jekyll And Mr. Hyde` instead of `Untitled Manuscript`.
- Existing in-progress UI tests updated if needed.
- No runtime pipeline tests should be required because this is display/title fallback only.
