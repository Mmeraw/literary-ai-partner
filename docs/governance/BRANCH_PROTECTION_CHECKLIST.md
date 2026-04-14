# Branch Protection Checklist

## Purpose

This checklist turns the repository's PR/CI governance into actual GitHub enforcement.

It is intended for manual configuration in:

- GitHub → **Settings** → **Branches** → **Add branch protection rule**

This document does **not** change runtime behavior. It is an operator checklist.

## Primary target

Start with:

- `main`

Later, apply similar rules to any long-lived sensitive branches such as:

- release branches
- production branches
- integration branches

## Recommended rule for `main`

Use a branch name pattern of:

- `main`

Enable the following settings:

### Pull request enforcement

- [ ] **Require a pull request before merging**
- [ ] **Require approvals**
- [ ] **Require conversation resolution before merging**
- [ ] **Dismiss stale pull request approvals when new commits are pushed** *(recommended)*

### Approval guidance

Suggested team rule:

- standard code/test/docs PRs: **1 approval**
- migrations / RLS / auth / security / runtime behavior PRs: **2 approvals**
- production-affecting changes: explicit final sign-off before merge

If GitHub plan/features do not support per-change-type enforcement automatically, keep the stricter cases as a documented review rule in PR practice.

### Status check enforcement

- [ ] **Require status checks to pass before merging**
- [ ] **Require branches to be up to date before merging**

Select the checks you want as required once they have run at least once on the repository.

## Suggested required checks

At minimum, require the main CI workflow checks that back repo governance.

Current repo-side governance files:

- `.github/workflows/ci.yml`
- `.github/pull_request_template.md`
- `REPO_GOVERNANCE.md`

Suggested required checks once visible in GitHub:

- [ ] `CI / ci`
- [ ] `CI / governance`

Optional, depending on operational tolerance and signal quality:

- [ ] `CI / smoke-test`

### Recommendation on `smoke-test`

Because `smoke-test` only runs on push to `main`, it is usually **not** a good candidate for a required pre-merge PR check.

Recommended posture:

- require `CI / ci`
- require `CI / governance`
- treat `smoke-test` as a post-merge or main-branch confidence check unless/until you redesign it for PR suitability

## Push and history protection

- [ ] **Restrict who can push to matching branches** *(or block direct pushes entirely, if available in your GitHub plan/settings)*
- [ ] **Allow force pushes** → **OFF**
- [ ] **Allow deletions** → **OFF**

## Merge discipline

Recommended team operating rules:

- [ ] no direct pushes to `main`
- [ ] no merge on red CI
- [ ] production apply is separate from code merge
- [ ] migrations and RLS changes require explicit review

## Post-configuration verification

After saving the rule, verify the following:

- [ ] direct push to `main` is blocked for normal contributors
- [ ] PR cannot merge without required checks
- [ ] PR cannot merge without required approval(s)
- [ ] unresolved conversations block merge if enabled
- [ ] force-push is blocked

## Current repo caveats

The governance scaffolding is intentionally conservative right now:

- the `ci` workflow runs install, build, and test, but does **not** yet run a dedicated `typecheck` script because none is currently defined in `package.json`
- the workflow also does **not** run a standalone `jobs` script because there is no single canonical `jobs` entrypoint in `package.json`

That is acceptable for now, but both should be formalized later if you want stricter CI enforcement without creating misleading no-op checks.

## Migration/RLS-specific reminder

Before approving PRs that touch schema or RLS:

- [ ] migration reviewed in PR
- [ ] preflight completed before production apply
- [ ] post-apply verification prepared
- [ ] no column assumptions made without schema verification

This rule exists because a prior RLS near-miss relied on a nonexistent `user_id` column. Databases are very literal like that.

## Minimal recommended configuration summary

If you want the shortest safe setup for `main`, use this:

- [ ] require pull request before merge
- [ ] require at least 1 approval
- [ ] require conversation resolution
- [ ] require status checks: `CI / ci`, `CI / governance`
- [ ] require branch to be up to date
- [ ] block force pushes
- [ ] block direct pushes
- [ ] block deletions
