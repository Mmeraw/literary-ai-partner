# docs/canon/ — Raw Canon Intake

Source material from Google Drive folder "RevisionGrade Core Canon" (~94 docs).

## Structure
- `_raw/` — Original .docx/.xlsx (gitignored; source-of-record in Drive)
- `_md/`  — markitdown-converted Markdown (committed, diffable, reviewable)

## Status: UNREGISTERED
None of this content is binding canon until it receives a Canon ID in
`docs/doctrine/DOCTRINE_REGISTRY.md` and is assigned to a Volume/Section
per Doctrine Registry v2.1 rules.

## Triage workflow
1. Review each `.md` in `_md/`
2. If it maps to existing doctrine/governance → move + register
3. If still draft → leave here
4. If obsolete → move to `archive/`

## Regenerate
```bash
cd docs/canon/_raw
for f in *.docx; do markitdown "$f" > "../_md/${f%.docx}.md"; done
```
