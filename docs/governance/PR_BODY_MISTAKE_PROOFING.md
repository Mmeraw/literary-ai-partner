# PR Body Mistake-Proofing

The `enforce-latency-template` GitHub Action fails PRs whose bodies are missing
required tokens (sections, latency anchors, pass selection, quality gate, etc.).
This was producing repeated rework. The mistake-proofing system below shifts
each failure mode left so the gate stops blocking humans for token bookkeeping.

The enforcement workflow itself (`.github/workflows/latency-pr-enforcement.yml`)
is **not modified** — it remains the source of truth for what "compliant" means.

## The 3 layers

### Layer 1 — Template is compliant by default

`.github/PULL_REQUEST_TEMPLATE.md` already contains every required literal
token verbatim. A PR opened with the default body needs only:

- one Pass checkbox checked (all three start unchecked under a banner),
- the `Run 1` / `Run 2` numbers filled in,
- `Quality Gate:` set to PASS or FAIL,
- `Scope` and `Risks & Anomalies` filled.

Every mandatory token block is wrapped in HTML comments:

```
<!-- REQUIRED — DO NOT REMOVE: <token-name> -->
... required content ...
<!-- END REQUIRED -->
```

This lets Layer 3 detect deletions and restore them.

### Layer 2 — Local pre-push validator

`scripts/validate-pr-body.mjs` mirrors every assertion in the enforcement
workflow. Invoke any of:

```
npm run pr:check                          # current branch's PR
npm run pr:check -- --pr 457              # a specific PR
npm run pr:check -- --file body.md        # a body file
```

- The pre-push hook (`scripts/pre-push.sh`) runs the validator against the
  PR for the current branch (if one exists). Bypass with `SKIP_PR_BODY_CHECK=1`.
- `scripts/gh-pr-create-safe.sh` is a thin wrapper around
  `gh pr create --body-file` that validates the body file before delegating.

The validator honours the same exempt-scope rule as the workflow when called
with `--pr <num>` (it reads the PR's changed files via `gh pr view --json files`).
For `--file <path>` it always runs the full check.

### Layer 3 — Server-side auto-heal

`.github/workflows/auto-heal-pr-body.yml` runs on `[opened, edited, reopened]`
(it deliberately omits `synchronize` to avoid loops). It:

1. reads the PR body,
2. runs `scripts/auto-heal-pr-body.mjs` to detect missing REQUIRED tokens,
3. if anything was missing, appends a sticky `## 🛟 Compliance Footer
   (auto-added by auto-heal-pr-body)` section containing the missing literal
   tokens with `N/A — please fill` placeholders,
4. writes the patched body back via `gh pr edit --body-file` and posts a sticky
   comment via `marocchino/sticky-pull-request-comment@v2`.

The footer is **idempotent**: existing footers are stripped on each run, so
re-runs do not stack multiple footers.

`enforce-latency-template` re-triggers on the resulting `edited` event and
passes on the next attempt, unblocking the PR while still flagging the
placeholders for the author to fill in before merge.

## Operational notes

- Keep `scripts/validate-pr-body.mjs` and the workflow `script:` block in
  sync — if a new assertion lands in `.github/workflows/latency-pr-enforcement.yml`,
  add it to the validator at the same time.
- The auto-heal compliance footer is for **unblocking CI only**. Reviewers
  must still confirm the author replaced the placeholder values before merge.
- The pre-push hook is intentionally a soft guard (skippable with
  `SKIP_PR_BODY_CHECK=1`) so emergency pushes are not blocked. The server-side
  auto-heal is the hard backstop.
