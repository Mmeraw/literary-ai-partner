# npm audit Governance

## Current Status
⚠️ **Known transitive advisories / audit keys are documented here and enforced by CI.**

## Policy

All high and critical npm audit vulnerabilities must be either:
1. **Fixed** via `npm audit fix` or package updates, OR
2. **Documented** in this file with justification for why the vulnerability is accepted.

CI parses this file as the source of truth. Any high/critical advisory not listed under a `### package-name` heading fails.

## Previously Approved Advisories (Now Resolved)

### tar
- **Status**: RESOLVED ✅
- Vuln: tar <=7.5.3 via supabase@2.72.8 (GHSA-r6q2-hw4h-h46w)
- Resolution: Updated dependencies; now clean

### next
- **Status**: RESOLVED ✅
- Vulns: Multiple RSC/PPR DoS vectors
- Resolution: Updated dependencies; now clean

### eslint
- **Status**: RESOLVED ✅
- Vuln: Multiple ReDoS vulnerabilities
- Resolution: Updated to eslint@9.17.0+; now clean

### uuid
- **Status**: RESOLVED ✅
- Vuln: `GHSA-w5hq-g745-h8pq`
- Resolution: direct dependency removed from app code, runtime call sites migrated to `crypto.randomUUID()`, and dependency graph now resolves `uuid@14.0.0`

### @base44/sdk
- **Status**: RESOLVED ✅
- Vuln: inherited `uuid` advisory chain
- Resolution: updated to `@base44/sdk@0.8.27` and forced transitive `uuid@14.0.0`; advisory chain no longer appears in `npm audit`

### xlsx
- **Status**: RESOLVED ✅
- Vulns: `GHSA-4r6h-8v6p-xvw6`, `GHSA-5pgg-2g8v-p4x9`
- Resolution: removed `xlsx` entirely; replaced roadmap workbook export script with `exceljs`

## Current Known Advisories

### flatted
- **Status**: KNOWN — transitive dependency
- Accepted: Low risk in server-side context; no user-controlled input path

### minimatch
- **Status**: KNOWN — transitive dependency
- Accepted: Not exposed to user-controlled glob input

### socket.io-parser
- **Status**: KNOWN — transitive dependency
- Accepted: socket.io not used in production paths

### underscore
- **Status**: KNOWN — transitive dependency
- Accepted: underscore template not used with user input

### brace-expansion
- **Status**: KNOWN — transitive dependency
- Accepted: not used on user-controlled brace or glob input in production paths

### picomatch
- **Status**: KNOWN — transitive dependency
- Accepted: not exposed to user-controlled glob input in production paths

### @xmldom/xmldom
- **Status**: KNOWN — transitive dependency / audit key
- Accepted: not used on untrusted user-provided XML in production request paths

### lodash
- **Status**: KNOWN — transitive dependency / audit key
- Accepted: retained temporarily while upstream dependency chain is stabilized and tracked via CI

### axios
- **Status**: KNOWN — transitive dependency / audit key
- Accepted: pinned through overrides while upstream chain is monitored

### postcss
- **Status**: KNOWN — build tooling dependency
- Advisory: `GHSA-qx2v-qp2m-jg93` — PostCSS XSS via unescaped `</style>` in CSS stringify output
- Severity/CVSS: moderate / 6.1
- Vulnerable range: `<8.5.10` (remaining audit-flagged path is `next/node_modules/postcss`)
- Current repo state: root/tooling `postcss` is updated to `8.5.10`; only Next's bundled transitive copy remains flagged by `npm audit`
- Blocker: current published Next dependency graph still installs bundled `postcss@8.4.31` on this branch
- Time-boxed expiry: **2026-07-31**
- Follow-up issue: https://github.com/Mmeraw/literary-ai-partner/issues/254
- Accepted: not runtime-exposed to user-controlled input in production request paths

### next
- **Status**: KNOWN — framework transitive dependency
- Advisory chain: `next` remains audit-flagged only because its bundled `postcss` copy is still `<8.5.10`
- Current repo state: upgraded to `next@15.5.15`; audit still reports the remaining transitive advisory path
- Time-boxed expiry: **2026-07-31**
- Follow-up issue: https://github.com/Mmeraw/literary-ai-partner/issues/254
- Accepted: transitive-only moderate finding; monitored pending upstream dependency graph fix

### @playwright/test
- **Status**: KNOWN — dev-only dependency (browser automation harness)
- Advisory: no high/critical GHSA reported by current `npm audit` run; entry recorded preemptively so future advisories on the stress-harness pin do not surprise CI
- Accepted: dev-only browser automation; never bundled into the runtime artifact and not exposed to user-controlled input. Pin policy follows the stress-harness anti-flake rules (exact pinned version, no `^` ranges in dev deps)
- Time-boxed expiry: **2026-07-31** (revisit alongside other dev-tooling advisories)

### playwright
- **Status**: KNOWN — transitive of `@playwright/test`
- Advisory: tracked together with `@playwright/test`; advisory IDs (if any) inherit through the transitive chain
- Accepted: same rationale as `@playwright/test` — dev-only, not in production bundle, not exposed to user input
- Time-boxed expiry: **2026-07-31**

### workflow
- **Status**: KNOWN — direct dependency for workflow spike
- Accepted: feature-flagged additive spike path only; no production runtime path changed until explicit enablement

### @workflow/astro
- **Status**: KNOWN — transitive dependency
- Accepted: SDK ecosystem package not used in runtime request paths; no user-controlled input path

### @workflow/builders
- **Status**: KNOWN — transitive dependency
- Accepted: build-time/internal SDK package; not exposed to production request path

### @workflow/cli
- **Status**: KNOWN — transitive dependency
- Accepted: tooling package only; not exposed to user input in production runtime

### @workflow/core
- **Status**: KNOWN — transitive dependency
- Accepted: internal SDK package; no direct user-controlled input path

### @workflow/nest
- **Status**: KNOWN — transitive dependency
- Accepted: framework adapter package not used by this runtime path

### @workflow/nitro
- **Status**: KNOWN — transitive dependency
- Accepted: framework adapter package not used by this runtime path

### @workflow/nuxt
- **Status**: KNOWN — transitive dependency
- Accepted: framework adapter package not used by this runtime path

### @workflow/rollup
- **Status**: KNOWN — transitive dependency
- Accepted: build adapter package; not used in runtime request handling

### @workflow/sveltekit
- **Status**: KNOWN — transitive dependency
- Accepted: framework adapter package not used by this runtime path

### @workflow/vite
- **Status**: KNOWN — transitive dependency
- Accepted: build adapter package; not used in runtime request handling

### @workflow/world-local
- **Status**: KNOWN — transitive dependency
- Accepted: internal SDK package; no direct user-controlled input path

### @workflow/world-vercel
- **Status**: KNOWN — transitive dependency
- Accepted: internal SDK package; no direct user-controlled input path

### devalue
- **Status**: KNOWN — transitive dependency
- Accepted: internal serialization dependency from workflow SDK chain; not used on user-supplied payloads in request handlers

### undici
- **Status**: KNOWN — transitive dependency
- Accepted: transitive HTTP client package in dependency graph; no direct user-controlled request path exposure in this change

### tmp
- **Status**: KNOWN — transitive dependency / audit key
- Accepted: legacy transitive package in tooling chain; not exposed in production request paths and tracked via CI allowlist until upstream dependency updates

### esbuild
- **Status**: KNOWN — dev-only transitive dependency via `tsx`
- Advisory: GHSA — esbuild's development server permits arbitrary file-system reads when reached directly
- Accepted: `esbuild` is a dev/build-time tool only. It is invoked by `tsx` for TypeScript transpilation in scripts and CI, never exposed to production request paths or user-controlled network input. No production bundle depends on `esbuild` at runtime.
- Time-boxed expiry: **2026-09-30**

### form-data
- **Status**: KNOWN — transitive dependency / audit key
- Advisory: `GHSA-hmw2-7cc7-3qxx` — CRLF injection in multipart field names and filenames for `form-data >=4.0.0 <4.0.6`
- Accepted: no direct production code path in this change constructs multipart requests from untrusted field names/filenames through this transitive package; tracked pending upstream dependency resolution.
- Time-boxed expiry: **2026-09-30**

### vite
- **Status**: KNOWN — transitive build/dev tooling dependency
- Advisory chain: Vite 8 Windows-only dev-server/file-system advisories through tooling dependency graph
- Accepted: Vite is not used as the production request handler for this Next.js app; remaining exposure is build/dev tooling, not a deployed runtime endpoint in this change.
- Time-boxed expiry: **2026-09-30**

### ws
- **Status**: KNOWN — transitive WebSocket dependency
- Advisory chain: `ws` memory disclosure/DoS advisories through transitive tooling/runtime dependency graph
- Accepted: this change does not add or expose a user-controlled WebSocket server path using `ws`; tracked pending upstream dependency updates.
- Time-boxed expiry: **2026-09-30**

### tsx
- **Status**: KNOWN — dev-only script runner (transitive `esbuild` advisory)
- Advisory: inherits from `esbuild` advisory chain
- Accepted: `tsx` is used exclusively as a dev/CI script runner (`scripts/`, `npm run config:validate`, `npm run sipoc:*`, etc.). It is never loaded in production request handling and is not bundled into the runtime artifact.
- Time-boxed expiry: **2026-09-30**

### @workflow/next
- **Status**: KNOWN — transitive dependency via `workflow` SDK
- Advisory: inherits through `@workflow/builders`/`@workflow/core`/`esbuild` chain
- Accepted: same rationale as the existing `workflow`, `@workflow/builders`, and `@workflow/core` entries — the workflow SDK is a feature-flagged additive dependency not yet active in production request paths
- Time-boxed expiry: **2026-09-30**
