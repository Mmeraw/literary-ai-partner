# CI Node20 Action-Runtime Audit (#198)

Branch: `chore/node20-runtime-audit-198`
Base: `main` (post #200 merge, commit `bcaa9dd`)
Method: discovery-first, two-layer inventory, evidence-led
Outcome: **zero Node20 remnants found**. No code change required. Audit closes #198 with evidence.

## Layer 1 — direct workflow references

Source: `grep -RIn 'uses:' .github/workflows`

Distinct action refs on current `main`:

| # | Action ref |
|---|---|
| 1 | `actions/checkout@v5` |
| 2 | `actions/setup-node@v5` |
| 3 | `actions/upload-artifact@v6` |

Local / composite / reusable actions owned by this repo: **none**
(`find . -name action.yml -o -name action.yaml` returned no repo-owned results.)

Hardcoded `node16` / `node20` strings inside `.github/workflows/` or elsewhere in `.github/`: **none**.

## Layer 2 — runtime metadata resolution

Authoritative source: each action's `action.yml` at its pinned ref, fetched via `gh api`.

| Action | Pinned ref | `runs.using` | Node20? |
|---|---|---|---|
| actions/checkout | @v5 | node24 | No |
| actions/setup-node | @v5 | node24 | No |
| actions/upload-artifact | @v6 | node24 | No |

### Historical note on `upload-artifact` major versions

Verified at audit time against upstream `action.yml`:

| Candidate | runs.using |
|---|---|
| @v4 | node20 |
| @v5 | node20 |
| @v6 | node24 |
| @v7 | node24 |

Only @v6 and later are Node20-free. The repository is already on @v6, which is the minimal Node20-free major — the correct target under the minimal-blast-radius rule.

## Explicitly out of scope (held per #198 charter)

- Branch protection
- Checkout-depth changes
- Supabase CLI install changes (landed in #200)
- Permissions cleanup
- Trigger redesign
- Concurrency changes
- Any broad "modernize CI" edits

## Done criteria for #198

- [x] Every direct workflow action inventoried (3 / 3)
- [x] Every transitive / local / reusable action reference checked (0 local; 3 transitive resolved at pinned ref)
- [x] Every confirmed Node20 runtime upgraded or explicitly justified (0 remaining — none present on `main`)
- [x] No unrelated workflow behavior changed (this branch adds only this audit document)

## Recommendation

Close #198 upon merge of this audit document. No follow-up workflow edit is required.
