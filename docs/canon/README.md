# RevisionGrade Canon

`docs/canon/` is the only canon home for RevisionGrade.

## Directory roles

| Path | Role | Production ingest |
|---|---|---|
| `docs/canon/registered/` | Binding production canon | Yes |
| `docs/canon/intake/` | Unregistered candidate material | No, unless explicit `INTAKE_MODE=true` |
| `docs/canon/archive/` | Provenance / superseded material | No |

## Policy

- Production canon/RAG loading must target `docs/canon/registered/**` only by default.
- `docs/canon/intake/**` is non-binding and may only be loaded in explicit audit/dev mode.
- `docs/canon/archive/**` is provenance-only and excluded from production ingest.
- Root `/canon` is retired and must not reappear.
- No file may exist simultaneously in both `registered/` and `intake/`.

## PR0 migration rule

PR0 is structural only:
- no doctrine rewriting
- no semantic changes
- no WAVE or Gate 15 reinterpretation
- no evaluation prompt, recommendation generator, or Pass 3 synthesis changes

## Canon layer model (enforced by PR-0)

- `intake/`
	- drafts/proposals only
	- never authoritative

- `registered/control/`
	- registries/indexes/matrices only
	- no long prose

- `registered/volumes/`
	- authoritative canon/specification only
	- exactly one owner per domain

CI guard:
`.github/workflows/canon-authority.yml`
runs:
`scripts/verify-canon-authority.sh`

Expected PR-0 behavior:
- warnings are expected (including missing `canon_status` frontmatter on registered files)
- only missing `docs/canon/AUTHORITY.md` is a hard fail in PR-0

Escalation:
- PR-0 = warnings/reporting only for legacy debt
- PR-1 = inventory/classification
- PR-2 = frontmatter normalization
- PR-3 = hard-fail enforcement once remediation baseline exists
