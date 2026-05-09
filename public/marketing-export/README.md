# Marketing Export Preservation (Canonical Static Artifacts)

This folder preserves raw frontend export artifacts **byte-for-byte** before any integration or refactor.

## Purpose

- Preserve the exact static page exports for:
  - `/` (main RevisionGrade homepage)
  - `/revise` (REVISE product page)
- Keep artifacts source-controlled and Vercel-preview-compatible.
- Prevent architecture drift by separating preservation from componentization.

## Current State

- `main/index.html` is preserved from the current export scaffold.
- `revise/index.html` is preserved as an integration placeholder until the raw REVISE static bundle is dropped in.

## Expected Drop-In Files

Place raw static bundle files into the corresponding folder without rewriting copy/design:

- `public/marketing-export/main/`
  - `index.html`
  - `style.css`
  - `landing.css`
  - `landing.js`
  - any referenced assets under `assets/` (or equivalent relative paths)

- `public/marketing-export/revise/`
  - `index.html`
  - companion CSS/JS/assets exactly as referenced by `index.html`

## Preservation Rules

1. Preserve exports first (byte-for-byte).
2. Verify relative asset paths load.
3. Verify both pages render locally and in Vercel preview.
4. Do **not** refactor into components yet.
5. Do **not** migrate to Tailwind yet.
6. Do **not** alter copy/design system during preservation phase.

## Future Route Plan (separate phase)

- `/` -> production homepage route integration
- `/revise` -> production revise route integration

This folder is the canonical source artifact checkpoint for that later integration.
