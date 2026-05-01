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
