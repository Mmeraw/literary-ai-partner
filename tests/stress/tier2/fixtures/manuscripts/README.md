# Tier 2 Manuscript Fixtures

## `long-form-50k.txt`

- **Source:** Project Gutenberg eBook #76, *Adventures of Huckleberry
  Finn* by Mark Twain. URL: https://www.gutenberg.org/ebooks/76
- **License:** Public domain in the United States (Project Gutenberg
  License — no restrictions on reuse).
- **Excerpt:** Chapters 1–20 (ends just before Chapter XXI). Project
  Gutenberg boilerplate header and footer removed.
- **Word count:** ~52,800 words (within the 50k–55k acceptance window).
- **Why this excerpt:** A clean chapter boundary keeps the cut feeling
  intentional; well-formed long-form prose triggers `route=long_form`
  (threshold = 25k words) and produces ~30+ chunks, matching the
  structural shape of the prod failure on 2026-05-13.

## Replacement / refresh

If a future change requires a different excerpt:

1. Pick another public-domain text (Project Gutenberg is the canonical
   source). The fixture must land between 50,000 and 55,000 words.
2. Strip the Gutenberg header (`*** START OF ...`) and footer
   (`*** END OF ...`).
3. Add a short title block at the top citing the source URL + license.
4. Update this README to reflect the new excerpt.
