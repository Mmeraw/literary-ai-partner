<!-- PR Template: Infrastructure / DevOps Change -->
<!-- Trust-proof validator: node scripts/validate-pr-trust-proof.mjs -->

## Summary

<!-- What infrastructure, CI, deployment, or configuration is changing? -->

## Scope

**In scope:**

- 

**Out of scope:**

- 

## Input → Action → Output

**Input:** <!-- What triggers or feeds this change? -->

**Action:** <!-- What does this PR actually do? -->

**Output:** <!-- What is the observable result? -->

## Process Change

<!-- Does this change affect runtime environments, worker concurrency, timeouts, or Vercel/Supabase configuration? -->
<!-- State: "Process Change: yes" or "Process Change: no — reason: ..." -->

Process Change: 

## Blast Radius

<!-- What breaks if this infra change is rolled back or fails mid-deploy? -->

## Rollback Plan

<!-- How is this change reverted? Is it reversible without a migration? -->

## Unauthorized Input Sources

<!-- Does this PR introduce new input sources? (provider calls, external APIs, user input paths, env vars read at runtime)
     If no: state "No unauthorized input sources are introduced." -->

## Internal Process Leakage

<!-- Does this PR expose internal phase names, artifact types, model names, prompt versions, or governance
     traces to public-facing surfaces (UI, API responses, error messages)?
     If no: state "No internal process leakage is introduced." -->

## Public-Safe Quality/Status Metrics

<!-- What quality or status signals does this PR expose publicly?
     Confirm they are safe for authors/users to see without revealing internal pipeline details. -->

## Runtime/Pipeline Expansion

<!-- Does this PR add evaluation phases, model calls, DB writes, artifact types, or new worker paths?
     If no: state "No hidden runtime or pipeline expansion." -->

## Latency Impact

<!-- What is the expected latency impact of this change?
     If no increase: state "No unnecessary latency increase." -->

## Post-Merge Sanity Sweep

<!-- Include the exact commands to verify correctness after merge. Example:
```bash
git checkout main && git pull --ff-only
npm test -- __tests__/relevant-test.test.ts --runInBand
node scripts/validate-pr-trust-proof.mjs
``` -->

## Actionlint Status

<!-- State whether GitHub Actions workflow YAML has been validated with actionlint.
     If not run locally: "Full actionlint validation remains unproven in this environment until CI proves it." -->

## Trust-Proof Checklist

- [ ] No unauthorized input sources introduced.
- [ ] No internal process leakage introduced.
- [ ] Input → Action → Output is explicit.
- [ ] Public-safe quality/status metrics are identified.
- [ ] No hidden runtime/pipeline expansion.
- [ ] No unnecessary latency increase.
- [ ] Post-merge sanity sweep instructions included.
- [ ] Actionlint status stated.
