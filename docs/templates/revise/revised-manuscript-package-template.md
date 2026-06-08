# Revised Manuscript Package Template
**Status:** Canonical export template  
**Applies to:** Revise, TrustedPath, manuscript downloads, semi-revised manuscript exports

## Purpose
The Revised Manuscript Package must show the author exactly what was changed, what was preserved, and what still requires author attention.

RevisionGrade must never silently imply that a manuscript is fully revised when unresolved Strategy Cards, deferred cards, or author-skipped sections remain.

## Package Contents

### 1. Clean Manuscript
The Clean Manuscript is the author’s production-facing revised file.

It includes:

- TrustedPath-applied copy-paste repairs
- author-customized revisions
- accepted manual revisions
- all unchanged manuscript sections preserved exactly as submitted

It must not include:

- RevisionGrade notes
- Strategy Card warnings
- unresolved markers
- admin/debug information
- withheld card references

### 2. Marked Manuscript
The Marked Manuscript is the author-review version.

It includes:

- all applied revisions
- unchanged sections
- visible notes for unresolved Strategy Cards
- visible notes for deferred author decisions
- visible notes where TrustedPath could not safely apply a repair

Required unresolved marker:

> [REVISIONGRADE NOTE — Strategy Card Unresolved]
> This section requires your attention. TrustedPath did not modify this area because the necessary adjustments involve structural, voice, canon, metaphor, or downstream continuity concerns that require author oversight.

### 3. Revision Log
The Revision Log is the decision record for the Revise session.

It must include:

| Status | Meaning |
|---|---|
| Applied via TrustedPath | Safe copy-paste card automatically applied |
| Applied by Author | Author accepted or customized a revision |
| Deferred | Author chose not to resolve the card during this session |
| Strategy Unresolved | Card required author judgment and remains unresolved |
| Withheld / Blocked | Excluded from user-facing output; admin/support only |

## Card Export Rules

### Copy-Paste Rewrite Card
`cardType: copy_paste_rewrite`

TrustedPath eligible.

Export behavior:

- Clean Manuscript: apply selected repair
- Marked Manuscript: apply selected repair, optionally track change
- Revision Log: count as applied

### Revision Strategy Card
`cardType: revision_strategy`

TrustedPath ineligible.

Export behavior:

- Clean Manuscript: leave original manuscript text unchanged unless author manually customized it
- Marked Manuscript: leave original manuscript text visible and add unresolved note
- Revision Log: count as Strategy Unresolved or Author Applied

### Withheld Card
`cardType: withheld`

Never user-facing.

Export behavior:

- Clean Manuscript: no marker
- Marked Manuscript: no marker
- Revision Log: admin/support only

## Data Fields
Recommended export fields:

```yaml
cardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld'
trustedPathStatus: 'eligible' | 'unavailable_author_review_required' | 'impossible'
exportStatus:
  | 'applied'
  | 'author_customized'
  | 'deferred'
  | 'strategy_unresolved'
  | 'withheld'
```

## Product Language
TrustedPath has automatically applied safe, local copy-paste repairs to your manuscript. Complex revision opportunities have been preserved for author review in the Marked Manuscript. Sections requiring author judgment remain visible and clearly marked so RevisionGrade never silently presents unresolved work as complete.
