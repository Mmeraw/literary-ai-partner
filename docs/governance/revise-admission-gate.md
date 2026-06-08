# Revise Admission Gate

**Authority:** Revision Governance Volume VII  
**Scope:** Final gate before a revision opportunity becomes user-visible.

A revision opportunity may enter the user-facing queue only when all gates pass:

1. Supported evidence gate
2. Context sufficiency gate
3. Voice preservation gate
4. Canon preservation gate
5. Candidate quality gate
6. Executability gate
7. Regeneration-success gate, if regeneration was required

## Fail-Closed Rule
Any failed gate withholds the opportunity from normal users.

## User-Facing Queue Rule
User-facing queue rows must be derived only from admission-passed opportunities. Blocked, unsupported, diagnostic, and withheld rows may exist only in admin/internal views.

## TrustedPath and Final Review Rule
TrustedPath and Final Review must consume the same admission-passed set as the user-facing queue.
