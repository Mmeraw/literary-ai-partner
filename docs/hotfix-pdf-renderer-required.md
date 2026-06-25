# PDF renderer hotfix required

The browser report CSS fix does not affect the generated PDF download path.

Required next patch: app/api/reports/[jobId]/download/route.ts, inside renderHtmlFromViewModel:

- Replace the dark score-box with a light readiness card.
- Readiness palette:
  - MARKET READY: #EEF7EF background, #1A1A1A text, #9DC79D border
  - NEAR MARKET READY: #FFF6E8 background, #1A1A1A text, #D9A441 border
  - NOT MARKET READY: #FDEEEE background, #1A1A1A text, #C97A7A border
- Remove all evidence italics in the PDF HTML.
- Replace opportunity tables with block rows or make them fixed-safe with no clipping.
- Add overflow-wrap:anywhere and white-space:normal to opportunity values.
- Do not truncate text. Cards must grow vertically.
