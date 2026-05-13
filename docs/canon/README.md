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

---

## Regression Gates & Canonical Evaluation Artifacts

`docs/canon/ideal-eval-reports/` houses canonical evaluation reports that define acceptance bars for long-form evaluations in specific modes.

### Canonical Artifacts (Binding Acceptance Bars)

Each file in `ideal-eval-reports/` defines what a correct production evaluation **must** contain for a specific manuscript and evaluation mode. These are not samples; they are **enforceable specs**.

**Format:** `{manuscript_slug}-{scope}-[mode].md`
- Example: `froggin-noggin-first-100-pages.md`
- Includes: Full character ledger, all 13 criteria scored, structured recommendations, provenance spec, known defects
- Author-approved and locked on creation

### Regression Tests (Dimension Validation)

`tests/canon/*.test.ts` validate production outputs against canonical dimensions:

1. **character_ledger_coverage** — All named entities from Pass 2a ledger must appear in Pass 3 output (or gate: `QG_CHARACTER_LEDGER_COVERAGE`)
2. **no_ungrounded_entity_synthesis** — No entities may appear in output that aren't in Pass 2a ledger (gate: `QG_SYNTHESIS_ENTITY_UNGROUNDED`)
3. **age_timeline_grounding** — Character ages/timelines must match manuscript anchors, not genre assumptions (gate: `QG_AGE_TIMELINE_GROUNDED`)
4. **register_mode_engaged** — When `evaluation_mode ≠ Standard`, provenance must show non-default prompt variant (gate: `QG_REGISTER_MODE_ENGAGED`)
5. **transgressive_dialogue_framing** — Transgressive mode must frame content as character-coded + evaluate narrator positioning (gate: `QG_TRANSGRESSIVE_DIALOGUE_FRAMING`)

### Test Semantics: Allowed to Fail on `main`

When a canonical artifact documents defects that haven't yet been fixed, the corresponding regression test **will fail**. This is **correct behavior**.

Example: `tests/canon/long-form-transgressive-floor.test.ts` documents three defects in the current pipeline:
- Defect 1: Pass 3 compressed window loses character ledger
- Defect 2: Genre-prior hallucination ("crew" invented; "teens" miscoding 32-year-old men)
- Defect 3: Transgressive mode not routed (UI accepts, backend ignores)

Until these are fixed, the test fails. Failure = correct documentation of what's broken.

### The PR Rule for Fixes

Any PR claiming to fix one defect **must turn the corresponding regression tests green**:

```
PR: "fix(eval): thread character ledger from Pass 2a to Pass 3"
├─ Fixes Defect 1 (compressed window drop)
├─ Fixes Defect 2 (hallucination origin)
└─ Expected: character_ledger_coverage tests turn GREEN
```

If the PR claims to fix Defect 1 but the tests remain red, the defect was not actually fixed.

### Core Canon Principles

1. **Acceptance bar precedes the fix** — Canon written before architecture changes, not after (prevents reverse-engineering)
2. **Loud tests beat silent todos** — Failing test is un-ignorable documentation
3. **Defects are doctrine-level** — Canon constrains what a fix must look like, not just that one exists
4. **All dimensions auditable** — No subjective acceptance criteria; all testable
5. **Silence is a defect** — Silent fallback (e.g., Standard mode when Transgressive requested) is failure mode

Escalation:
- PR-0 = warnings/reporting only for legacy debt
- PR-1 = inventory/classification
- PR-2 = frontmatter normalization
- PR-3 = hard-fail enforcement once remediation baseline exists
