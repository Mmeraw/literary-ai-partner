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
- **Status**: RESOLVED / separately tracked where still transitively reported
- Resolution: framework dependencies are updated and remaining bundled findings are documented below

### eslint
- **Status**: RESOLVED ✅
- Resolution: updated dependency line

### uuid
- **Status**: RESOLVED ✅
- Vuln: `GHSA-w5hq-g745-h8pq`
- Resolution: runtime call sites migrated to `crypto.randomUUID()` and the graph resolves the corrected package

### @base44/sdk
- **Status**: RESOLVED ✅
- Resolution: updated SDK and transitive UUID chain

### xlsx
- **Status**: RESOLVED ✅
- Resolution: removed and replaced with `exceljs`

## Current Known Advisories

### js-yaml
- **Status**: KNOWN — transitive development/test tooling dependency
- Advisories: `GHSA-h67p-54hq-rp68` and `GHSA-52cp-r559-cp3m`
- Current repo state: npm audit reports vulnerable transitive `js-yaml` nodes through tooling lines, including the Istanbul/Jest coverage dependency graph.
- Accepted for this PR: #1362 does not parse untrusted YAML in a production request path and introduces no YAML endpoint, loader, or user-controlled schema path. The affected copies are used by development/test tooling.
- Required remediation: upgrade the direct/transitive dependency lines so all resolved `js-yaml` copies meet the patched range; track as a dedicated dependency-hardening change rather than silently retaining the advisory.
- Time-boxed expiry: **2026-08-15**

### @istanbuljs/load-nyc-config
- **Status**: KNOWN — dev-only coverage configuration dependency / audit key
- Advisory chain: inherits the transitive `js-yaml` advisories above through the Istanbul coverage tooling graph.
- Accepted for this PR: loaded only by test/coverage tooling; it is not bundled into the production application and #1362 adds no runtime configuration-loading surface.
- Required remediation: update the Istanbul dependency line to a release resolving the patched `js-yaml` range.
- Time-boxed expiry: **2026-08-15**

### piscina
- **Status**: KNOWN — transitive dependency
- Vuln: `GHSA-x9g3-xrwr-cwfg`
- Accepted: transitive build-toolchain dependency; not directly instantiated with user-controlled options in production request paths.

### flatted
- **Status**: KNOWN — transitive dependency
- Accepted: no user-controlled production serialization path introduced by this change.

### minimatch
- **Status**: KNOWN — transitive dependency
- Accepted: no user-controlled glob input path introduced by this change.

### socket.io-parser
- **Status**: KNOWN — transitive dependency
- Accepted: socket.io is not used in the production path changed here.

### underscore
- **Status**: KNOWN — transitive dependency
- Accepted: templates are not evaluated from user input in this change.

### brace-expansion
- **Status**: KNOWN — transitive dependency
- Accepted: no user-controlled brace/glob path.

### picomatch
- **Status**: KNOWN — transitive dependency
- Accepted: no user-controlled glob path.

### @xmldom/xmldom
- **Status**: KNOWN — transitive dependency / audit key
- Accepted: no untrusted XML path is added by this change.

### lodash
- **Status**: KNOWN — transitive dependency / audit key
- Accepted: retained while the upstream chain is stabilized and enforced by CI.

### axios
- **Status**: KNOWN — transitive dependency / audit key
- Accepted: monitored through the repository dependency policy.

### postcss
- **Status**: KNOWN — build tooling dependency
- Advisory: `GHSA-qx2v-qp2m-jg93`
- Accepted: remaining exposure is bundled build tooling, not a new production path in this PR.
- Time-boxed expiry: **2026-07-31**

### @playwright/test
- **Status**: KNOWN — dev-only browser automation harness
- Accepted: not bundled into runtime.

### playwright
- **Status**: KNOWN — transitive browser tooling
- Accepted: not bundled into runtime.

### workflow
- **Status**: KNOWN — feature-flagged dependency
- Accepted: no production runtime path changed here.

### @workflow/astro
- **Status**: KNOWN — transitive dependency
- Accepted: not used by this runtime path.

### @workflow/builders
- **Status**: KNOWN — transitive build dependency
- Accepted: not exposed to production input.

### @workflow/cli
- **Status**: KNOWN — tooling dependency
- Accepted: not exposed in production runtime.

### @workflow/core
- **Status**: KNOWN — internal SDK dependency
- Accepted: no direct user-controlled input path.

### @workflow/nest
- **Status**: KNOWN — framework adapter dependency
- Accepted: not used by this runtime path.

### @workflow/nitro
- **Status**: KNOWN — framework adapter dependency
- Accepted: not used by this runtime path.

### @workflow/nuxt
- **Status**: KNOWN — framework adapter dependency
- Accepted: not used by this runtime path.

### @workflow/rollup
- **Status**: KNOWN — build adapter dependency
- Accepted: not used in runtime handling.

### @workflow/sveltekit
- **Status**: KNOWN — framework adapter dependency
- Accepted: not used by this runtime path.

### @workflow/vite
- **Status**: KNOWN — build adapter dependency
- Accepted: not used in runtime handling.

### @workflow/world-local
- **Status**: KNOWN — internal SDK dependency
- Accepted: no direct production input path.

### @workflow/world-vercel
- **Status**: KNOWN — internal SDK dependency
- Accepted: no direct production input path.

### devalue
- **Status**: KNOWN — transitive serialization dependency
- Accepted: no user-supplied production serialization path introduced here.

### undici
- **Status**: KNOWN — transitive HTTP dependency
- Accepted: no new direct request path exposure.

### tmp
- **Status**: KNOWN — transitive tooling dependency / audit key
- Accepted: not exposed in production request paths.

### esbuild
- **Status**: KNOWN — dev-only transitive dependency
- Accepted: dev/build tool only; no production listener or user-controlled network input.
- Time-boxed expiry: **2026-09-30**

### form-data
- **Status**: KNOWN — transitive dependency / audit key
- Advisory: `GHSA-hmw2-7cc7-3qxx`
- Accepted: this PR adds no multipart construction path from untrusted field names or filenames.
- Time-boxed expiry: **2026-09-30**

### vite
- **Status**: KNOWN — dev/build tooling dependency / audit key
- Advisories: `GHSA-v6wh-96g9-6wx3`, `GHSA-fx2h-pf6j-xcff`
- Accepted: no Vite dev server is exposed by the Next/Vercel production runtime.
- Time-boxed expiry: **2026-09-30**

### ws
- **Status**: KNOWN — transitive WebSocket dependency
- Advisories: `GHSA-58qx-3vcg-4xpx`, `GHSA-96hv-2xvq-fx4p`
- Accepted: this change adds no WebSocket server or endpoint.
- Time-boxed expiry: **2026-09-30**

### tsx
- **Status**: KNOWN — dev-only script runner
- Accepted: never loaded in production request handling.
- Time-boxed expiry: **2026-09-30**

### @workflow/next
- **Status**: KNOWN — transitive workflow SDK dependency
- Accepted: feature-flagged tooling path, not a production request path in this PR.
- Time-boxed expiry: **2026-09-30**
