# MANIFEST — Main Homepage Export (`/`)

## Current preservation state

- `index.html` present
- Companion static assets pending raw-file drop from Perplexity/ChatGPT bundle

## Expected final files

- `index.html`
- `style.css`
- `landing.css`
- `landing.js`
- `README.md`

## Preservation contract

- Preserve raw export files byte-for-byte.
- Do not invent/reconstruct full page content from screenshots.
- Verify relative CSS/JS paths in `index.html` resolve locally.
- Keep this phase source-control + preservation only.

## Explicit non-goals (this phase)

- No component refactor
- No Tailwind migration
- No `app/page.tsx` integration yet
- No runtime/backend/pipeline changes
