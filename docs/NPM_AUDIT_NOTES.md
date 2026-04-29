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

### @base44/sdk
- **Status**: KNOWN — direct SDK dependency
- Advisory chain: inherits `uuid` vulnerability (`GHSA-w5hq-g745-h8pq`) via SDK dependency graph
- Severity/CVSS: moderate (via `uuid` advisory)
- Vulnerable range: `@base44/sdk >=0.7.5` (audit-reported chain includes vulnerable uuid path)
- Blocker: direct major downgrade path offered by audit (`0.7.4`) is incompatible with current Base44 integration contract
- Time-boxed expiry: **2026-07-31**
- Follow-up issue: https://github.com/Mmeraw/literary-ai-partner/issues/254
- Accepted: required for imported Base44 iteration compatibility; monitored upstream

### postcss
- **Status**: KNOWN — build tooling dependency
- Advisory: `GHSA-qx2v-qp2m-jg93` — PostCSS XSS via unescaped `</style>` in CSS stringify output
- Severity/CVSS: moderate / 6.1
- Vulnerable range: `<8.5.10` (audit-flagged transitive path: `next/node_modules/postcss`)
- Blocker: fix path requires major Next.js dependency jump on current production branch
- Time-boxed expiry: **2026-07-31**
- Follow-up issue: https://github.com/Mmeraw/literary-ai-partner/issues/254
- Accepted: not runtime-exposed to user-controlled input in production request paths

### uuid
- **Status**: KNOWN — utility dependency / audit key
- Advisory: `GHSA-w5hq-g745-h8pq` — missing buffer bounds check in v3/v5/v6 when `buf` is provided
- Severity/CVSS: moderate / (NVD vector not provided by advisory feed; score reported as 0 in npm advisory payload)
- Vulnerable range: `<14.0.0`
- Blocker: upgrading to `uuid@14` is semver-major and requires compatibility sweep with direct + transitive consumers
- Time-boxed expiry: **2026-07-31**
- Follow-up issue: https://github.com/Mmeraw/literary-ai-partner/issues/254
- Accepted: retained while dependency chain is stabilized; no known exploit path in current usage

### xlsx
- **Status**: KNOWN — dev/report tooling dependency
- Advisories:
	- `GHSA-4r6h-8v6p-xvw6` — Prototype Pollution in sheetJS (high, CVSS 7.8, vulnerable `<0.19.3`)
	- `GHSA-5pgg-2g8v-p4x9` — ReDoS in SheetJS (high, CVSS 7.5, vulnerable `<0.20.2`)
- Blocker: no audit-provided safe upgrade path currently available (`fixAvailable: false`)
- Time-boxed expiry: **2026-07-31**
- Follow-up issue: https://github.com/Mmeraw/literary-ai-partner/issues/254
- Accepted: not used on untrusted runtime uploads in production request paths
