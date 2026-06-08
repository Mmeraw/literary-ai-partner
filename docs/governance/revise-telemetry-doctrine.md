# Revise Telemetry Doctrine

**Authority:** Revision Governance Volume VII  
**Scope:** Privacy-safe telemetry for revision gates, regeneration, admin diagnostics, and quality dashboards.

## Allowed Without Manuscript Permission
Telemetry may store:
- Reason codes
- Criterion
- Severity
- Revision operation
- Quality pass/fail counts
- Regeneration attempt counts
- Model version
- Prompt version
- Gate version
- Boolean status flags

## Not Allowed Without Explicit Permission
Telemetry must not store:
- Manuscript text
- Candidate text
- Anchor text
- Rationale prose
- Surrounding context
- User-authored custom revisions

## Admin Dashboard Rule
Admin dashboards should show aggregate diagnostics, not prose, unless Quality Review Permission is explicitly granted.
