# npm audit note

## tar (via supabase)
- Vuln: tar <=7.5.3 via supabase@2.72.8 (GHSA-r6q2-hw4h-h46w).
- Reason: supabase@2.72.8 pins tar@7.5.3; npm audit --force suggests downgrading supabase to 0.5.0 (breaking).
- Impact: advisory references macOS APFS; our CI/dev runs on Linux.
- Action: accept until supabase releases tar>=7.5.4+; re-check monthly.

## next (HTTP deserialization DoS)
- Vulns: GHSA-h25m-26qc-wcjf (high, RSC deserialization DoS), GHSA-5f7q-jpqc-wp7h (moderate, PPR DoS), GHSA-9g9p-9gw9-jx7f (moderate, Image Optimizer DoS)
- Affected versions: 10.0.0 - 15.6.0-canary.60
- Current: next@15.x.x (pinned via package.json)
- Impact: DoS vectors in self-hosted RSC server; not applicable to serverless deployment model
- Action: upgrade next to next version with fixes; tracked separately as tech debt

## eslint (ReDoS vulnerability)
- Vuln: Multiple ReDoS (Regular Expression Denial of Service) vulnerabilities
- Affected: eslint <9.17.0
- Current: eslint@9.x.x (dev dependency only)
- Impact: ReDoS vectors only exploitable during development linting, not in production runtime
- Reason: Dev-only dependency; runtime not affected; waiting for ecosystem compatibility before upgrading
- Action: monitor for stable release with full plugin compatibility; re-check monthly

