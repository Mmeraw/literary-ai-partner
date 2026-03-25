# npm audit Governance

## Current Status
⚠️ **4 known transitive advisories allowlisted** — `npm audit` reports high vulns in flatted, minimatch, socket.io-parser, underscore (as of 2026-03-24). See below for justification.

## Previously Approved Advisories (Now Resolved)

### tar (via supabase)
- **Status**: RESOLVED ✅
- Vuln: tar <=7.5.3 via supabase@2.72.8 (GHSA-r6q2-hw4h-h46w)
- Resolution: Updated dependencies; now clean

### axios
- **Status**: RESOLVED ✅ 
- Vuln: axios <=1.13.4 (GHSA-43fc-jf86-j433) — DoS via __proto__ key in mergeConfig
- Resolution: Fixed via `npm audit fix` on 2026-02-12

### next (HTTP deserialization DoS)
- **Status**: RESOLVED ✅
- Vulns: Multiple RSC/PPR DoS vectors (GHSA-h25m-26qc-wcjf, GHSA-5f7q-jpqc-wp7h, GHSA-9g9p-9gw9-jx7f)
- Resolution: Updated dependencies; now clean

### eslint (ReDoS vulnerability)
- **Status**: RESOLVED ✅
- Vuln: Multiple ReDoS vulnerabilities
- Resolution: Updated to eslint@9.17.0+; now clean

## Policy

All high and critical npm audit vulnerabilities must be either:
1. **Fixed** via `npm audit fix` or package updates, OR
2. **Documented** in this file with justification for why the vulnerability is accepted

The CI workflows (`ci.yml`, `ci-staging-tests.yml`, `job-system-ci.yml`) enforce this policy:
- If `npm audit --audit-level=high` passes (0 vulnerabilities), the check passes ✅
- If vulnerabilities remain, they must be documented here and in the allowed list

## CI Enforcement
- File required by: `.github/workflows/ci.yml`, `.github/workflows/ci-staging-tests.yml`, `.github/workflows/job-system-ci.yml`
- Validates that known advisories are intentional and documented for audit purposes
- Related governance: `AI_GOVERNANCE.md`, `scripts/check-gpg-disabled.js`


## Current Known Advisories (as of 2026-03-24)

### flatted
- **Status**: KNOWN — transitive dependency
- Vuln: Prototype pollution via crafted JSON
- Accepted: Low risk in server-side context; no user-controlled input path

### minimatch
- **Status**: KNOWN — transitive dependency
- Vuln: ReDoS via crafted glob patterns
- Accepted: Not exposed to user-controlled glob input

### socket.io-parser
- **Status**: KNOWN — transitive dependency
- Vuln: Insufficient input validation
- Accepted: socket.io not used in production paths

### underscore
- **Status**: KNOWN — transitive dependency
- Vuln: Arbitrary code execution via template
- Accepted: underscore template not used with user input
