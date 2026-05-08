---
canon_status: meta
domain: canon-inventory-classification-baseline
runtime_binding: false
---

# PR-1 Inventory/Classification Baseline (Issue #368)

## Scope lock (from #368)

This baseline is intentionally constrained to:

- finalize repo-wide canon-like inventory baseline
- validate classification report structure
- validate ownership-neutral status labels

Out of scope in PR-1:

- no content moves
- no content rewrites
- no ownership promotion decisions

## Source substrate

PR-1 baseline uses the existing PR-0 inventory artifacts without rewriting them:

- `docs/operations/audits/repo-file-inventory.csv`
- `docs/operations/audits/repo-file-inventory.md`

## Baseline universe and residual

- Universe definition: all markdown files represented in `docs/operations/audits/repo-file-inventory.csv`.
- CSV row count (`N`): 546
- Sum of non-empty `proposed_status` labels (`M`): 546
- Residual unlabeled rows (`N - M`): 0

This confirms baseline classification coverage is complete for the current inventory substrate.

## Report structure contract (CSV columns)

The baseline report structure for PR-1 is the existing CSV schema:

1. `path`
2. `filename`
3. `folder`
4. `extension`
5. `word_count`
6. `line_count`
7. `md5`
8. `contains_authority_language`
9. `contains_runtime_language`
10. `likely_category`
11. `proposed_status`
12. `duplicate_filename_group`
13. `exact_duplicate_group`

## Ownership-neutral status labels (baseline)

Current observed `proposed_status` labels in the substrate (counts from CSV):

- `historical`: 354
- `draft`: 125
- `evidence`: 31
- `secondary`: 27
- `runbook`: 9

These labels are descriptive only in PR-1 and do **not** imply canonical ownership promotion.

Known follow-up gap:

- PR-1 intentionally does not introduce an authority-promotion label. Any authority-candidate transition remains deferred to later remediation work (PR-2 and follow-on policy decisions).

## Category distribution snapshot

Observed `likely_category` distribution in the substrate:

- `root-or-other`: 194
- `docs-general`: 160
- `canon-intake`: 94
- `evidence`: 31
- `planning`: 18
- `canon-volumes`: 17
- `audit`: 13
- `canon-control`: 10
- `runbook`: 9

## PR-1 acceptance checklist

- [x] Baseline artifact paths are explicitly anchored.
- [x] Classification structure is documented by concrete CSV columns.
- [x] Ownership-neutral status label set is documented from observed data.
- [x] No move/rewrite/promotion action is performed in this PR.

## Evidence command snippets

```text
python3 - <<'PY'
import csv
from collections import Counter
p='docs/operations/audits/repo-file-inventory.csv'
with open(p,newline='',encoding='utf-8') as f:
    r=csv.DictReader(f)
    c=Counter((row.get('proposed_status') or '').strip() for row in r)
for k,v in sorted(c.items()):
    print(k,v)
PY
```

```text
python3 - <<'PY'
import csv
from collections import Counter
p='docs/operations/audits/repo-file-inventory.csv'
with open(p,newline='',encoding='utf-8') as f:
    r=csv.DictReader(f)
    c=Counter((row.get('likely_category') or '').strip() for row in r)
for k,v in sorted(c.items(), key=lambda kv:(-kv[1], kv[0])):
    print(k,v)
PY
```
