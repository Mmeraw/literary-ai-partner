# ADR-007: Dynamic imports required for Next.js production bundles

Context:
Next.js App Router production builds output ESM bundles.
CommonJS require() inside server routes caused runtime chunk
evaluation failure and HTML 500 responses.

Decision:
All lazy-loaded modules must use:
  await import("./module")

require() is forbidden in server runtime paths.

Consequence:
Prevents module-load crashes that bypass route try/catch logic.
Validated by Job System CI run #550.
