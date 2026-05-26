## Summary

Refines the Evaluate submission workbench into a clearer three-path flow: **Saved Document**, **Upload File**, and **Paste Text**.

## Why

The Evaluate page had the right ingredients, but the source-selection experience still blended saved documents, upload controls, and pasted text into one busy surface. This PR makes the user choose one clear source before beginning evaluation, which better matches the premium editorial-submission experience.

## Changes

- Adds a tabbed source selector with three options:
  - Saved Document
  - Upload File
  - Paste Text
- Shows only the active source-input surface at one time.
- Adds a Selected Writing summary card that confirms what will be evaluated.
- Keeps the existing Estimated Mode card and word-count-based mode guidance.
- Moves upload into its own focused file-upload panel.
- Keeps saved-document selection separate from pasted text.
- Keeps pasted text as a direct evaluation source without replacing saved dashboard manuscripts.
- Keeps dangerous/permanent delete behavior out of the primary submission flow.
- Preserves the premium CTA: `Begin Editorial Evaluation`.

## Scope

Evaluate-page client UX only.

No backend job creation changes, no manuscript upload API changes, no database schema changes, no evaluation pipeline changes, no scoring changes, no report changes, no dashboard changes, no Revise/TrustedPath/Storygate/Agent Readiness runtime changes.

## Acceptance Criteria

- `/evaluate` presents Saved Document / Upload File / Paste Text source tabs.
- Only one input method is visible at a time.
- Selecting a saved document clears pasted text.
- Pasting text clears saved-document selection.
- Uploading a file saves/selects the uploaded manuscript and shows it as the selected source.
- Selected Writing summary clearly states what will be evaluated.
- Estimated Mode still updates from the selected/uploaded/pasted word count.
- CTA remains `Begin Editorial Evaluation`.
- User-facing permanent delete controls are not shown in the main submission path.

## Notes

This is a UX refinement over the existing Evaluate form. It does not change the `/api/jobs` payload contract or the `/api/manuscripts` upload path.