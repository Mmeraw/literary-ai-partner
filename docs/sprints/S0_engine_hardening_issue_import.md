# S0 Engine Hardening — Local Issue Import Packet

This packet keeps engine-hardening issue planning **in-repo** (not dependent on immediate GitHub issue creation).

## Source CSV

- `docs/sprints/S0_engine_hardening_issue_import.csv`

Columns:

- `Title`
- `Body`
- `Labels`
- `Milestone`
- `Assignee`

## Canonical sequence

Run these in order:

1. `feat(engine): hard-lock anchor contract and parity across DB, TS, and validators`
2. `feat(extraction): fail-closed on unverifiable or ambiguous anchors`
3. `test(extraction): add deterministic edge-case goldens for exact-span contract`
4. `test(apply): expand harness for >=99.5% reliability and zero wrong-location edits`

## First issue to execute (lead)

**Title**

`feat(engine): hard-lock anchor contract and parity across DB, TS, and validators`

**Body**

Define and enforce canonical anchor contract:

- start_offset: inclusive
- end_offset: exclusive
- before_context: exact preceding slice
- after_context: exact following slice

Fail-closed reject invalid anchors at ingest.
Align DB constraints, TS model, and runtime validators.
Add parity contract tests (valid row passes, invalid invariants fail).
Explicitly gate `start_offset >= end_offset` rejection across all layers.

Done when:

- No proposal enters apply path without valid anchor contract.
- DB/TS/validator parity test suite green.
- Classified non-generic failure emitted for invalid anchor writes.

## Optional local CLI helper (no issue creation)

If you just want a quick local preview of titles/bodies from CSV:

`python - <<'PY'`
`import csv`
`from pathlib import Path`
`p = Path('docs/sprints/S0_engine_hardening_issue_import.csv')`
`rows = list(csv.DictReader(p.open()))`
`for i,r in enumerate(rows,1):`
`    print(f"{i}. {r['Title']}")`
`PY`

## Quality gate reminder

For apply harness completion criteria, use:

- `>=99.5%` valid-anchor placement success (not `=99.5%`)
- wrong-location edits = `0`
