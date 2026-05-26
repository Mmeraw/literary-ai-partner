# Final Review Apply / Export Runtime

Status: runtime foundation

This layer adds the server-side apply/export path behind Final Review.

## What the runtime can do

- Export a clean TXT draft.
- Export a marked TXT review copy.
- Export a TXT revision changelog.
- Attempt to apply accepted/custom decisions into a new derived manuscript version.
- Record apply/export attempts in `final_review_apply_runs`.

## Safety rule

Final Review may not silently invent manuscript changes.

A decision can only be applied when the ledger stores enough information to make the change safely:

- `source_excerpt`: the exact text to replace in the source manuscript version;
- `selected_text`: the accepted A/B/C replacement text, or the custom author rewrite;
- source version ownership and manuscript ownership verified server-side.

If a decision does not have a source/replacement snapshot, Apply blocks and records the blocked attempt. This protects author trust and prevents accidental or fabricated revisions.

## Export behavior

- Changelog export always works from synced ledger data.
- Marked review export includes the source manuscript plus changelog.
- Clean export applies only decisions with valid source/replacement snapshots. If snapshots are missing, it exports source text with a notice rather than pretending the manuscript was revised.

## Next UI step

The workbench should persist decision snapshots when the author clicks Accept A/B/C or Custom:

- selected option text;
- source excerpt/evidence anchor;
- source location;
- option label and mechanism metadata.

Once that lands, Apply can create a derived manuscript version reliably for accepted/custom decisions.
