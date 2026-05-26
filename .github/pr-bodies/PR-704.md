## Summary

Adds an optional `Source Type` selector to the Agent Readiness Author Bio page so authors can label Author Profile Sources without making the workflow feel like homework.

## Why

Author-bio generation is credential-sensitive. RevisionGrade should preserve provenance where the author is willing to provide it, but sophisticated users should not be forced through busywork before uploading or pasting source material.

The default option is intentionally dignified:

**Let RevisionGrade infer source type**

This avoids `Choose not to answer`, `Skip`, `Unknown`, or other language that makes the form feel incomplete.

## Changes

- Adds an `AuthorProfileSourceType` union for source provenance labels.
- Adds a `Source Type` selector near the Author Profile Sources field.
- Defaults the selector to `Let RevisionGrade infer source type`.
- Adds helper copy: `Optional. Labeling the source helps RevisionGrade preserve credential accuracy, but you may leave this to the system.`
- Adds source type options:
  - Author Bio
  - Résumé / CV
  - LinkedIn Profile
  - Author Website
  - Publication Credits
  - Awards / Recognition
  - Education
  - Professional Background
  - Subject-Matter Expertise
  - Let RevisionGrade infer source type
  - Other
- Changes upload button copy from `Upload Sources` to `Upload Source` for cleaner single-file language.
- Uses selected source type in uploaded text headings.
- Uses `Author Profile Source` as the upload heading when the default infer option is selected, avoiding `Unknown` language.
- Resets generated/approved/confirmed state when either the source text or selected source type changes.

## Scope

Client-side Author Bio UX only.

No backend upload storage, database persistence, file retention, generation API behavior, Agent Readiness runtime contracts, evaluation, scoring, Storygate, Revise, or TrustedPath changes.

## Acceptance Criteria

- `/agent-readiness/bio` shows a `Source Type` selector near Author Profile Sources.
- Default option is `Let RevisionGrade infer source type`.
- User can upload sources without selecting a specific type.
- User can select a source type when they want provenance.
- Uploaded source headings include selected source type and filename.
- Default/inferred uploads use dignified language such as `Author Profile Source`, not `Unknown`.
- No UI copy says `Choose not to answer`.
- No UI copy implies hidden LinkedIn scraping or third-party ingestion.
- Accuracy confirmation remains required before approval.
- Generated/approved/confirmed state resets when source text or selected source type changes.

## Related issue

Closes #702

## Notes

This is the next small UX hardening layer after PR #694. It keeps the Author Bio page governed but low-friction.