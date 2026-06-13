# Governance Production-Ready Proof Packet — 2026-06-13

## Scope

This packet verifies the governed Evaluation → UED → Revise → RCG07 → Agent Readiness → Creator Approval → Storygate chain after implementation of durable Agent Readiness and Storygate persistence.

## Readiness Summary

| Area | Status |
| --- | --- |
| Evaluation → UED | Ready |
| Revise → RCG07 | Ready |
| Agent Readiness package persistence | Ready |
| Creator approval persistence | Ready |
| Storygate submission/access workflow | Ready |
| Migration proof | Passed |
| Real DB proof | Passed |
| Full tests | Passed |
| TypeScript | Passed |
| Lint | Passed |
| Production build | Passed with deployment-valid timeout config |

## Required Deployment Setting

Deployment environments must satisfy:

```text
EVAL_OPENAI_TIMEOUT_MS >= EVAL_PASS_TIMEOUT_MS
```

The local shell initially had `EVAL_OPENAI_TIMEOUT_MS=30000` and `EVAL_PASS_TIMEOUT_MS=720000`; the production config gate correctly blocked the build. The production build passed after rerunning with non-secret deployment-valid timeout values:

```text
EVAL_OPENAI_TIMEOUT_MS=720000 EVAL_PASS_TIMEOUT_MS=720000 npm run build
```

## Migration Validation

Validated with local Supabase CLI and Docker-backed Postgres:

```text
npx supabase db start
npx supabase db reset
```

Result:

```text
Applying migration 20260613000000_agent_readiness_storygate_persistence.sql...
Seeding data from supabase/seed.sql...
Restarting containers...
Finished supabase db reset on branch main.
```

The migration chain applied the durable persistence migration for:

- `agent_readiness_sections`
- `agent_readiness_author_review_decisions`
- `agent_readiness_packages`
- `agent_readiness_package_exports`
- `agent_readiness_creator_approvals`
- `storygate_submissions`
- `storygate_project_listings`
- `storygate_access_requests`
- `storygate_access_grants`
- `storygate_access_audit_events`

## Real Database Integration Proof

Executed against the local Supabase Postgres container, not mocks. The transaction created and verified:

- authenticated creator user
- authenticated requester user
- manuscript
- completed `evaluation_jobs` row with canonical `status = 'complete'`
- `unified_evaluation_document_v1`
- `revision_completion_record_v1`
- `rcg07_completion_certification_v1`
- six approved Agent Readiness sections
- `agent_readiness_package_v1`
- approved `creator_approval_v1`
- `storygate_submission_request_v1`
- private `project_listing_v1`
- access request
- access grant
- access revocation
- four structured audit events

Final proof query:

```text
evaluation_status | governed_artifacts | approved_sections | package_records | creator_approvals | submissions | request_decision | revoked_grants | audit_events
------------------+--------------------+-------------------+-----------------+-------------------+-------------+------------------+----------------+-------------
complete          | 3                  | 6                 | 1               | 1                 | 1           | approved         | 1              | 4
```

The transaction ended with `ROLLBACK`, leaving the local database clean.

## Validator / Persistence Consistency

Verified that Storygate persistence does not duplicate or fork the Storygate validator contract:

- `lib/storygate/storygatePersistence.ts` calls `validateStorygateSubmission()` directly.
- `lib/storygate/storygateSubmissionValidator.ts` imports canonical package fields and threshold from `lib/storygate/storygateRegistry.ts`.
- `STORYGATE_ADMISSION_THRESHOLD` is canonical `9.0`.
- `STORYGATE_REQUIRED_PACKAGE_FIELDS` is the shared required field source.
- Creator approval is evaluated through `evaluateCreatorApprovalGate()`.

Additional public-copy guardrail: stale Storygate-adjacent `8.0` threshold text was found and corrected to canonical `9.0`.

## Full Test Run

Single complete test run:

```text
npm test
```

Result:

```text
Test Suites: 12 skipped, 409 passed, 409 of 421 total
Tests:       52 skipped, 4101 passed, 4153 total
Snapshots:   0 total
Time:        165.045 s
Ran all test suites.
```

## TypeScript

```text
npx tsc --noEmit
```

Result: passed with no TypeScript errors.

## Lint

```text
npm run lint
```

Result: passed.

Only warning emitted:

```text
[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of eslint.config.js is not specified and it doesn't parse as CommonJS.
```

This is non-fatal and pre-existing.

## Production Build / Vercel-Style Compile Proof

Initial build correctly failed due to invalid timeout config:

```text
EVAL_OPENAI_TIMEOUT_MS (30000) must be >= EVAL_PASS_TIMEOUT_MS (720000)
```

Build passed with deployment-valid non-secret timeout values:

```text
EVAL_OPENAI_TIMEOUT_MS=720000 EVAL_PASS_TIMEOUT_MS=720000 npm run build
```

Result highlights:

```text
Public copy scope guard passed (31 files scanned).
Storygate CSS guard passed (4 industry TSX files checked).
useSearchParams/Suspense guard passed (94 page files checked).
== RESULT: PASS ==
✅ Production configuration is valid
✓ Compiled successfully in 94s
✓ Checking validity of types
✓ Generating static pages (116/116)
✓ Finalizing page optimization
```

The production route manifest included the new governed routes:

- `/api/agent-readiness/download`
- `/api/agent-readiness/generate`
- `/api/agent-readiness/generate-all`
- `/api/agent-readiness/packages/approve`
- `/api/agent-readiness/sections/approve`
- `/api/storygate/access`
- `/api/storygate/submissions`

## Merge Guidance

Architecture/governance readiness is production-ready, subject to CI repeating these checks in GitHub Actions and deployment environments setting compatible timeout values:

```text
EVAL_OPENAI_TIMEOUT_MS >= EVAL_PASS_TIMEOUT_MS
```

Recommended before merge/deploy:

1. Attach this packet to the PR body or PR comment.
2. Confirm GitHub Actions reruns:
   - `npm test`
   - `npx tsc --noEmit`
   - `npm run lint`
   - production build or Vercel preview build
3. Merge only after CI independently reproduces the passing results.
