# Repository-managed Git hooks

Install once per clone:

```bash
node scripts/install-git-hooks.mjs
```

The `pre-push` hook:

- resolves the pull request for the current branch through authenticated `gh`;
- reads the live GitHub PR labels and changed files;
- honors a valid `pr-type:<type>` label;
- otherwise classifies the changed paths with the same fail-closed precedence used by CI;
- runs `scripts/validate-pr-body.mjs` against the live GitHub PR body;
- blocks the push when validation fails, no PR exists, or `gh` is unavailable or unauthenticated.

Exceptional bootstrap bypass:

```bash
SKIP_PR_BODY_VALIDATION=1 git push
```

The bypass must be explicit for each push and should not be used to avoid correcting a failing PR body.
