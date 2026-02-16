# ADR-007: Dynamic imports required for Next.js production bundles

**Status:** Accepted  
**Date:** 2026-02-16  
**Validated by:** Job System CI run #550 (commit b5fe864)

## Context

Next.js App Router production builds output ESM bundles.  
CommonJS `require()` inside server routes caused runtime chunk  
evaluation failure and HTML 500 responses.

The failure was silent at the route level — it bypassed `try/catch`  
because the error occurred during module evaluation, not during  
handler execution.

## Decision

All lazy-loaded modules must use:

```ts
const mod = await import("./module");
```

`require()` is **forbidden** in server runtime paths (`app/`, `lib/`).

## Consequence

- Prevents module-load crashes that bypass route `try/catch` logic.
- CI guard (`scripts/no-require-server-runtime.sh`) enforces this at PR time.
- Any reintroduction of `require()` in `app/` or `lib/` will fail CI immediately.

## References

- Fix commits: `cf31fc0`, `97f91ff`, `b5fe864`
- CI guard: `.github/workflows/job-system-ci.yml` → "Enforce ESM runtime rules"
