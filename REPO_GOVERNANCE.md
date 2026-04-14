# Repo Governance

## Pull requests are required

All non-trivial changes must go through a Pull Request before merge.

PRs are required for:

- application code
- tests
- scripts
- migrations / SQL
- RLS / auth / security changes
- schema changes
- runtime behavior changes
- repo-wide restores, relocations, or restructures

Direct commits are acceptable only for:

- personal scratch branches
- typo-only docs edits
- local planning notes not intended for shared branches

## Scope discipline

When possible:

- separate cleanup/restores from behavior changes
- separate restores from new logic
- keep one concern per PR
- do not mix production apply actions into code PRs

## CI policy

- no merge on red CI
- CI is required for pull requests
- flaky tests must be fixed or explicitly quarantined, never ignored silently

## Database and RLS review rules

- migrations and RLS changes require explicit review
- production apply is a separate operational step from code merge
- preflight is required before apply
- post-apply verification is required after apply
- unrelated schema changes must not be combined into the same apply step
- migrations must not assume column existence without verification (for example, do not assume a `user_id` column exists unless it is verified in the canonical schema)

## Required PR sections

Each PR should include:

- What changed
- Why
- Risk level
- Validation performed
- Rollback plan
- Follow-up work
