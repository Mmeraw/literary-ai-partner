# PR Template — Typed-Scope Governance

**Status:** LOCKED — design approved, ready for implementation
**Owner:** Mike Meraw (`@Mmeraw`)
**Date:** 2026-05-13
**Supersedes:** The single-template approach codified by PR #470 (mistake-proof PR template, 3 layers). This brief extends that work; it does not undo it. The strict evaluation-pipeline assertions remain in force — they just no longer apply to PRs that are not evaluation-pipeline PRs.
**Resolves:** Latency-template enforcer over-applied to docs, UI, infra, and migration PRs. Concrete case: PR #473 (`docs(governance): lock map-reduce evaluation pipeline brief + CODEOWNERS`) blocked by the validator demanding Pass 1/2/3 selection and `pass1_ms` / `total_ms` metrics for a CODEOWNERS addition.

---

## 1. Problem Statement (one sentence)

The `enforce-latency-template` workflow assumed every PR is an evaluation-pipeline PR and demands Pass-selection, latency tables, and quality-gate disclosure on PRs that have nothing to do with the evaluation pipeline — producing false-blocks on docs/governance, UI, infra, and migration PRs while providing zero quality signal on those changes.

## 2. PR Type Taxonomy (the four shapes)

| Type | Diff signature (changed paths) | Evidence required | Validator |
| --- | --- | --- | --- |
| **evaluation** | Any file under `lib/evaluation/**`, `app/api/(workers\|evaluations)/**`, `tests/sipoc/**`, or `prompts/**` | Pass selection (1/2/3), `pass{N}_ms` + `total_ms` metrics, baseline + 2 post-change runs, quality-gate disclosure (`QG_*` / Quality Gate), Pass 3 PRs additionally require `criteria_count_by_state` | Current strict assertions (unchanged) |
| **ui** | Any file under `app/(admin\|dashboard\|evaluations\|auth\|account)/**`, `components/**`, or root `app/**/page.tsx` / `app/**/layout.tsx`, **and** no evaluation paths touched | Visual Evidence (before/after screenshot links or "N/A — first render"), Accessibility (a11y notes or "N/A — no interactive surface added"), Browser Targets (default: Chrome/Safari/Firefox latest), No-Pipeline-Impact assertion | UI validator |
| **infra** | Any file under `.github/**`, `vercel.json`, `package.json` / `package-lock.json` (deps only), `tsconfig*.json`, `next.config.*`, `eslint.config.*`, `tailwind.config.*`, **and** no evaluation paths touched | CI/Infra Scope, Rollback Plan, Affected Workflows (named), No-Pipeline-Impact assertion | Infra validator |
| **docs** | Any file under `docs/**`, root `*.md`, **and** no other paths touched | Summary, Scope, No-Pipeline-Impact assertion | Docs validator |
| **migration** | Any file under `supabase/migrations/**`, **and** no evaluation paths touched | Schema Diff (summary of what tables/columns/indexes are added/modified), Rollback Plan (down-migration or operator steps), Data Backfill (yes/no + plan), No-Pipeline-Impact assertion | Migration validator |
| **mixed** | Diff spans multiple non-evaluation buckets above (e.g. docs + infra) | Union of the relevant sections, no Pass-selection required | Mixed validator (logical AND of each touched type's requirements) |
| **evaluation+other** | Any evaluation path touched alongside non-evaluation paths | Full evaluation requirements (the evaluation validator wins — adding a doc change does not buy an exemption) | Evaluation validator (strict) |

### 2.1 Dispatch rule (deterministic, no human judgment)

1. List changed files via `pulls.listFiles`.
2. If **any** file matches an `evaluation` path → run **evaluation validator** (strict). Stop.
3. Else, compute the set of touched buckets (`ui`, `infra`, `docs`, `migration`).
4. If the set has exactly one element → run that type's validator.
5. If the set has more than one element → run **mixed validator** (assert each touched type's required sections are present).
6. If the set is empty (e.g. only a file in a path not yet classified) → run the **evaluation validator** as a safety default (fail-closed). Flag in the workflow log so the taxonomy can be updated.

**Important:** "Touched" means *any* changed file in the bucket, not "every changed file". The fail-closed default protects against silent classification gaps.

## 3. Template Layout

GitHub multi-template support is via `.github/PULL_REQUEST_TEMPLATE/` (directory). Each file becomes a selectable template via the `?template=<filename>` query param.

```
.github/
  PULL_REQUEST_TEMPLATE/
    evaluation.md          # Current strict template (verbatim move from current pull_request_template.md)
    ui.md                  # Visual Evidence + Accessibility + Browser Targets + No-Pipeline-Impact
    infra.md               # CI/Infra Scope + Rollback Plan + Affected Workflows + No-Pipeline-Impact
    docs.md                # Summary + Scope + No-Pipeline-Impact
    migration.md           # Schema Diff + Rollback Plan + Data Backfill + No-Pipeline-Impact
  pull_request_template.md # Chooser stub: lists the 5 templates with ?template= links
```

The chooser stub keeps the default-template flow working. Authors can use the chooser or pick a template by URL.

### 3.1 The marker

Every typed template ends with an HTML comment marker, e.g.

```html
<!-- pr-type: ui -->
```

The validator uses **both** the marker and the diff for dispatch. If they disagree (e.g. marker says `ui` but diff touches `lib/evaluation/`), the diff wins — the marker is a hint, the diff is truth. Mismatch is logged as a warning in the workflow run but does not fail.

## 4. The Common Floor (every PR type)

All five typed templates share three sections — these are non-negotiable for any change going into `main`:

1. `## Summary` — what changed in 1–3 sentences
2. `## Scope` — what code paths / surfaces this PR touches and what it does NOT touch
3. `## Risks & Anomalies` — what could go wrong and how it's mitigated

The "not reducing intelligence" final-rule line is **kept only for the evaluation type**, because that line was written for the evaluation pipeline specifically. UI/infra/docs/migration PRs don't make that assertion.

## 5. Implementation Plan — single PR

**PR-T1 — `feat(ci): typed PR templates + diff-driven validator dispatch`**

Files added:
- `.github/PULL_REQUEST_TEMPLATE/evaluation.md` (verbatim move of current `pull_request_template.md`)
- `.github/PULL_REQUEST_TEMPLATE/ui.md`
- `.github/PULL_REQUEST_TEMPLATE/infra.md`
- `.github/PULL_REQUEST_TEMPLATE/docs.md`
- `.github/PULL_REQUEST_TEMPLATE/migration.md`
- `docs/PR_TEMPLATE_TYPED_SCOPE_GOVERNANCE.md` (this brief)

Files modified:
- `.github/pull_request_template.md` (becomes a chooser stub)
- `.github/workflows/latency-pr-enforcement.yml` (becomes diff-driven dispatcher with 5 validator branches)
- `.github/CODEOWNERS` (adds the 5 templates, the workflow, and this brief to `@Mmeraw`'s lock)

## 6. Validator Assertions Per Type

### 6.1 evaluation (unchanged — verbatim from current workflow)
- `## Summary` `## Scope` `## Contract Integrity` `## Behavioral Quality` `## Latency Evidence` `## Risks & Anomalies` sections
- `Baseline (Pre-change)` + `Post-change Runs`
- `Run 1` + `Run 2`
- `[x] Pass 1` or `[x] Pass 2` or `[x] Pass 3`
- `pass\d?_?ms` or `passX_ms` regex hit
- `total_ms` literal
- If Pass 3: `criteria_count_by_state` literal
- `QG_` or `quality gate` or `Quality Gate` literal
- `not reducing intelligence` literal

### 6.2 ui
- `## Summary` `## Scope` `## Visual Evidence` `## Accessibility` `## Browser Targets` `## Risks & Anomalies` sections
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: ui -->` marker (warning if missing, not blocking)

### 6.3 infra
- `## Summary` `## Scope` `## CI/Infra Scope` `## Rollback Plan` `## Affected Workflows` `## Risks & Anomalies` sections
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: infra -->` marker (warning if missing)

### 6.4 docs
- `## Summary` `## Scope` `## Risks & Anomalies` sections
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: docs -->` marker (warning if missing)

### 6.5 migration
- `## Summary` `## Scope` `## Schema Diff` `## Rollback Plan` `## Data Backfill` `## Risks & Anomalies` sections
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: migration -->` marker (warning if missing)

### 6.6 mixed
- All sections required by each touched type (logical AND, deduplicated by section name)
- All `No-Pipeline-Impact:` lines required (logical AND)
- No marker required (mixed PRs may be unmarked)

## 7. Self-Validation (the meta-rule)

The PR that ships this brief is itself an `infra` PR (it touches `.github/**` and `docs/**`, but the docs file is governance about the infra change, so the dominant type is infra). It MUST use the new `infra` template and pass the new validator on its own first push. If it cannot self-validate, the design is wrong and the PR is recalled.

## 8. Decision Log

- **Why diff-driven, not header-driven?** Headers can be wrong; diffs cannot. The marker is a hint for humans (and for the chooser UI), the diff is the source of truth.
- **Why fail-closed on unclassified paths?** Silent under-enforcement is exactly the failure mode the original mistake-proof template was designed to prevent. Better to false-positive once and update the taxonomy than to silently let a class of PR through.
- **Why mixed validator, not "highest-priority type wins"?** A docs+infra PR genuinely has both shapes of evidence to provide. Reducing it to one bucket loses information.
- **Why keep evaluation strict for evaluation+other?** Adding a doc change to an evaluation PR should not buy a pass on the latency evidence — that's the same gaming pattern PR #465/#470 closed.
- **Why a separate brief instead of inlining into MAP_REDUCE_PIPELINE_GOVERNANCE_BRIEF.md?** Different concerns. The map-reduce brief is about the pipeline architecture. This brief is about how PRs to that pipeline (and the rest of the repo) are governed. Keeping them separate lets each one be edited independently under CODEOWNERS.

## 9. Out of Scope (explicitly)

- Changing the branch-protection ruleset 15734162. The 5 required checks stay as-is. This work only changes what the latency-template check enforces inside its own evaluation.
- Splitting the latency-template check into multiple check names. It remains a single check; what it asserts is now diff-driven internally.
- Changing CODEOWNERS scope beyond the new templates + workflow + this brief.
- Issue/PR template wizard customization beyond what GitHub supports natively.

---

**Sign-off line for the lock PR body:**
> This brief is the canonical PR-type taxonomy and validator-dispatch contract as of 2026-05-13. Changes to the type taxonomy, the dispatch rule, or the per-type assertions require a new governance brief and a CODEOWNERS-approved replacement of this file.
