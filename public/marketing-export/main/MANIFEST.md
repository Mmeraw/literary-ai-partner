# MANIFEST — Main Homepage Export (`/`)

## Expected final files after raw drop

- `index.html`
- `style.css`
- `landing.css`
- `landing.js`
- `README.md`

## Validation checklist

- Relative paths in `index.html` resolve to local files in this folder.
- No content/design rewrites during ingestion.
- Files are preserved byte-for-byte from export.

## Route plan (future integration phase)

- `public/marketing-export/main/*` is preservation source only.
- Production route mapping to `/` is a separate PR.
