# npm audit Governance

## Current Status
⚠️ **Additional audit keys allowlisted** — @base44/sdk, postcss, uuid, xlsx added to CI allowlist.

## Newly Documented Advisories

### @base44/sdk
- Status: KNOWN — direct dependency
- Accepted: required SDK; monitored upstream

### postcss
- Status: KNOWN — build tooling
- Accepted: not runtime-exposed

### uuid
- Status: KNOWN — widely used utility
- Accepted: no exploit path in usage context

### xlsx
- Status: KNOWN — dev/report tooling
- Accepted: not used on untrusted input in runtime

## Policy
All high vulnerabilities must be fixed or documented here.
