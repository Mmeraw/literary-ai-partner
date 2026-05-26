# PR Template — Typed-Scope Governance

**Status:** LOCKED — design approved, ready for implementation
**Owner:** Mike Meraw (`@Mmeraw`)
**Date:** 2026-05-13
**Supersedes:** The single-template approach codified by PR #470 (mistake-proof PR template, 3 layers). This brief extends that work; it does not undo it. The strict evaluation-pipeline assertions remain in force — they just no longer apply to PRs that are not evaluation-pipeline PRs.
**Resolves:** Latency-template enforcer over-applied to docs, UI, infra, and migration PRs. Concrete case: PR #473 (`docs(governance): lock map-reduce evaluation pipeline brief + CODEOWNERS`) blocked by the validator demanding Pass 1/2/3 selection and `pass1_ms` / `total_ms` metrics for a CODEOWNERS addition.

---

## 1. Problem Statement (one sentence)

The `enforce-latency-template` workflow assumed every PR is an evaluation-pipeline PR and demands Pass-selection, latency tables, and quality-gate disclosure on PRs that have nothing to do with the evaluation pipeline — producing false-blocks on docs/governance, UI, infra, and migration PRs while providing zero quality signal on those changes.

## 2. PR Type Taxonomy (the six shapes)

| Type | Diff signature (changed paths) | Evidence required | Validator |
| --- | --- | --- | --- |
| **evaluation** | Any file under `lib/evaluation/**`, `lib/pipeline/**`, `lib/canon/**`, `lib/governance/**`, `lib/invariants/**`, `lib/observability/**`, `lib/monitoring/**`, `lib/reliability/**`, `lib/manuscripts/**`, `lib/llm/**`, `lib/jobs/**`, `lib/release/**`, `lib/artifacts/**`, `lib/config/**`, `app/api/(workers\|evaluations\|evaluate\|jobs\|manuscripts)/**`, `prompts/**`, evaluation-pipeline test subdirs (`tests/canon/**`, `tests/evaluation/**`, `tests/sipoc/**`, `tests/replays/**`, `tests/anchors/**`, `tests/failures/**`, `tests/fixtures/**`, `tests/protected/**`, `tests/jobs/**`, `tests/lib/evaluation/**`, `tests/lib/jobs/**`), `__tests__/**`, `workers/**`, `schemas/**`, `types/**`, `fixtures/**`, `testdata/**`, `calibration/**`, `evidence/**`, `artifacts/**`, `protected/**` | Pass selection (1/2/3), `pass{N}_ms` + `total_ms` metrics, baseline + 2 post-change runs, quality-gate disclosure (`QG_*` / Quality Gate), Pass 3 PRs additionally require `criteria_count_by_state` | Current strict assertions (unchanged) |
| **ui** | Any file under `app/(admin\|dashboard\|evaluate\|login\|signup\|output\|reports\|revise\|share\|pricing\|marketing-preview\|private-beta\|resources\|storygate\|convert\|your-writing)/**`, `components/**`, `public/**`, `lib/ui/**`, `lib/hooks/**`, or root `app/page.tsx` / `app/layout.tsx` / `app/globals.css` / `app/robots.txt`, **and** no evaluation paths touched | Visual Evidence, Accessibility, Browser Targets, **Unauthorized Input Sources**, **Internal Process Leakage**, **Input → Action → Output**, **Public-Safe Quality/Status Metrics**, **Runtime/Pipeline Expansion**, **Latency Impact**, No-Pipeline-Impact assertion | UI validator |
| **code** | Any file under `lib/(auth\|db\|admin\|security\|operations\|activity\|errors\|supabase\|revision\|reportShares)/**`, `src/**`, `entities/**`, `base44/**`, `app/api/(auth\|admin\|activity\|report-shares\|user)/**`, or root files `lib/audit.js` / `lib/governance.js` / `lib/supabase.js` / `lib/rateLimit.ts`, **and** no evaluation paths touched | Summary, Scope, Tests Updated, Risks & Anomalies, **Unauthorized Input Sources**, **Internal Process Leakage**, **Input → Action → Output**, **Public-Safe Quality/Status Metrics**, **Runtime/Pipeline Expansion**, **Latency Impact**, No-Pipeline-Impact assertion | Code validator |
| **infra** | Any file under `.github/**`, `.vscode/**`, `.githooks/**`, `scripts/**`, `ops/**`, infra-class test subdirs (`tests/stress/**`, `tests/playwright/**`, `tests/ui/**`, `tests/scripts/**`, `tests/test-helpers/**`, `tests/config/**`), `vercel.json`, `package.json` / `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`, `tsconfig*.json`, `next.config.*`, `eslint.config.*`, `tailwind.config.*`, `postcss.config.*`, `lighthouserc.yml`, `Dockerfile`, `Makefile`, **and** no evaluation paths touched | CI/Infra Scope, Rollback Plan, Affected Workflows, **Unauthorized Input Sources**, **Internal Process Leakage**, **Input → Action → Output**, **Public-Safe Quality/Status Metrics**, **Runtime/Pipeline Expansion**, **Latency Impact**, No-Pipeline-Impact assertion | Infra validator |
| **docs** | Any file under `docs/**`, `archive/**`, root `*.md`, **and** no other paths touched | Summary, Scope, Risks & Anomalies, **Unauthorized Input Sources**, **Internal Process Leakage**, **Input → Action → Output**, **Public-Safe Quality/Status Metrics**, **Runtime/Pipeline Expansion**, **Latency Impact**, No-Pipeline-Impact assertion | Docs validator |
| **migration** | Any file under `supabase/migrations/**`, **and** no evaluation paths touched | Schema Diff, Rollback Plan, Data Backfill, **Rollback Posture**, **Lock / Table-Scan Risk**, **Data Backfill Risk**, **RLS / Access Impact**, **Production Verification Query**, Risks & Anomalies, **Unauthorized Input Sources**, **Internal Process Leakage**, **Input → Action → Output**, **Public-Safe Quality/Status Metrics**, **Runtime/Pipeline Expansion**, **Latency Impact**, No-Pipeline-Impact assertion | Migration validator |
| **mixed** | Diff spans multiple non-evaluation buckets above (e.g. docs + infra, code + docs) | Union of the relevant sections, no Pass-selection required | Mixed validator (logical AND of each touched type's requirements) |
| **evaluation+other** | Any evaluation path touched alongside non-evaluation paths | Full evaluation requirements (the evaluation validator wins — adding a doc change does not buy an exemption) | Evaluation validator (strict) |

### 2.1 Dispatch rule (deterministic, no human judgment)

1. List changed files via `pulls.listFiles`.
2. If **any** file matches an `evaluation` path → run **evaluation validator** (strict). Stop.
3. Else, compute the set of touched buckets (`ui`, `code`, `infra`, `docs`, `migration`).
4. If the set has exactly one element → run that type's validator.
5. If the set has more than one element → run **mixed validator** (assert each touched type's required sections are present).
6. If the set is empty (e.g. only a file in a path not yet classified) → run the **evaluation validator** as a safety default (fail-closed). Flag in the workflow log so the taxonomy can be updated.

**Important:** "Touched" means *any* changed file in the bucket, not "every changed file". The fail-closed default protects against silent classification gaps.

### 2.2 Label override (escape hatch)

A PR label of the form `pr-type:<type>` (where `<type>` is one of `evaluation`, `ui`, `infra`, `docs`, `migration`, `code`) overrides diff-based classification entirely. The validator reads the live label list via `pulls.get` and, if a valid `pr-type:` label is set, skips the file walk and routes straight to that type's validator.

- Use when the diff sits at a taxonomy boundary the classifier gets wrong (e.g. a stress-harness PR whose `tests/stress/**` files would otherwise be misread).
- Invalid `pr-type:<x>` labels are ignored with a warning; classification falls back to the diff rule.
- Belt-and-suspenders: even when the diff already classifies correctly, adding `pr-type: infra` to an infra PR protects against classifier regressions.

## 3. Template Layout

GitHub multi-template support is via `.github/PULL_REQUEST_TEMPLATE/` (directory). Each file becomes a selectable template via the `?template=<filename>` query param.

```
.github/
  PULL_REQUEST_TEMPLATE/
    evaluation.md          # Current strict template (verbatim move from current pull_request_template.md)
    ui.md                  # Visual Evidence + Accessibility + Browser Targets + No-Pipeline-Impact
    code.md                # Summary + Scope + Tests Updated + Risks + No-Pipeline-Impact
    infra.md               # CI/Infra Scope + Rollback Plan + Affected Workflows + No-Pipeline-Impact
    docs.md                # Summary + Scope + No-Pipeline-Impact
    migration.md           # Schema Diff + Rollback Plan + Data Backfill + No-Pipeline-Impact
  pull_request_template.md # Chooser stub: lists the 6 templates with ?template= links
```

The chooser stub keeps the default-template flow working. Authors can use the chooser or pick a template by URL.

### 3.1 The marker

Every typed template ends with an HTML comment marker, e.g.

```html
<!-- pr-type: ui -->
```

The validator uses **both** the marker and the diff for dispatch. If they disagree (e.g. marker says `ui` but diff touches `lib/evaluation/`), the diff wins — the marker is a hint, the diff is truth. Mismatch is logged as a warning in the workflow run but does not fail.

## 4. The Common Floor (every PR type)

All six typed templates share three sections — these are non-negotiable for any change going into `main`:

1. `## Summary` — what changed in 1–3 sentences
2. `## Scope` — what code paths / surfaces this PR touches and what it does NOT touch
3. `## Risks & Anomalies` — what could go wrong and how it's mitigated

The "not reducing intelligence" final-rule line is **kept only for the evaluation type**, because that line was written for the evaluation pipeline specifically. UI/code/infra/docs/migration PRs don't make that assertion.

### 4.1 Evidence quality rule (non-evaluation PRs)

For `ui`, `code`, `infra`, `docs`, and `migration` PRs, required sections must be more than headings:

- Missing sections fail.
- Blank sections fail.
- Placeholder-only answers fail (for example: `TBD`, `TODO`, bare `N/A`).
- `N/A` is allowed only as `N/A — <reason>`.
- `None` is allowed when true, but it should still be explicit and truthful.

This rule is intentionally semantic enough to reject performative checkbox compliance while still allowing concise, accurate non-applicability statements.

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
- `## Summary` `## Scope` `## Visual Evidence` `## Accessibility` `## Browser Targets` `## Risks & Anomalies` sections with non-placeholder content
- Mandatory trust-proof sections:
  - `## Unauthorized Input Sources`
  - `## Internal Process Leakage`
  - `## Input → Action → Output`
  - `## Public-Safe Quality/Status Metrics`
  - `## Runtime/Pipeline Expansion`
  - `## Latency Impact`
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: ui -->` marker (warning if missing, not blocking)

### 6.3 infra
- `## Summary` `## Scope` `## CI/Infra Scope` `## Rollback Plan` `## Affected Workflows` `## Risks & Anomalies` sections with non-placeholder content
- Mandatory trust-proof sections:
  - `## Unauthorized Input Sources`
  - `## Internal Process Leakage`
  - `## Input → Action → Output`
  - `## Public-Safe Quality/Status Metrics`
  - `## Runtime/Pipeline Expansion`
  - `## Latency Impact`
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: infra -->` marker (warning if missing)

### 6.4 docs
- `## Summary` `## Scope` `## Risks & Anomalies` sections with non-placeholder content
- Mandatory trust-proof sections:
  - `## Unauthorized Input Sources`
  - `## Internal Process Leakage`
  - `## Input → Action → Output`
  - `## Public-Safe Quality/Status Metrics`
  - `## Runtime/Pipeline Expansion`
  - `## Latency Impact`
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: docs -->` marker (warning if missing)

### 6.5 migration
- `## Summary` `## Scope` `## Schema Diff` `## Rollback Plan` `## Data Backfill` `## Risks & Anomalies` sections with non-placeholder content
- Migration-specific mandatory sections:
  - `## Rollback Posture`
  - `## Lock / Table-Scan Risk`
  - `## Data Backfill Risk`
  - `## RLS / Access Impact`
  - `## Production Verification Query`
- Mandatory trust-proof sections:
  - `## Unauthorized Input Sources`
  - `## Internal Process Leakage`
  - `## Input → Action → Output`
  - `## Public-Safe Quality/Status Metrics`
  - `## Runtime/Pipeline Expansion`
  - `## Latency Impact`
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: migration -->` marker (warning if missing)

### 6.6 code
- `## Summary` `## Scope` `## Tests Updated` `## Risks & Anomalies` sections with non-placeholder content
- Mandatory trust-proof sections:
  - `## Unauthorized Input Sources`
  - `## Internal Process Leakage`
  - `## Input → Action → Output`
  - `## Public-Safe Quality/Status Metrics`
  - `## Runtime/Pipeline Expansion`
  - `## Latency Impact`
- `No-Pipeline-Impact:` literal followed by a non-empty value on the same line
- `<!-- pr-type: code -->` marker (warning if missing)

### 6.7 mixed
- All sections required by each touched type (logical AND, deduplicated by section name)
- All `No-Pipeline-Impact:` lines required (logical AND)
- No marker required (mixed PRs may be unmarked)

### 6.8 Auditable hotfix bypass (non-evaluation PRs only)

Urgent production fixes may bypass the non-evaluation semantic trust-proof checks only when **all** of the following are true:

- PR carries label `hotfix:trust-proof-bypass`
- PR body includes `Hotfix-Justification: <reason>`
- PR body includes `Hotfix-Approved-By: @Mmeraw`

This bypass is intentionally explicit and auditable. It does **not** bypass diff classification, branch freshness, or evaluation-pipeline assertions. It exists to preserve emergency response speed without normalizing silent governance exemptions.

## 7. Self-Validation (the meta-rule)

The PR that ships this brief is a `mixed` `infra+docs` PR whenever it touches both `.github/**` and `docs/**`. It MUST satisfy the union of infra and docs validator requirements on its own first push. If the PR body artifact is committed under `.github/pr-bodies/`, it remains within the `infra` bucket; if governance/docs files under `docs/**` are also touched, the mixed validator still applies. If the change cannot self-validate under the classifier's actual touched-path rules, the design is wrong and the PR is recalled.

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

## 10. Workflow Syntax Lint Enforcement (2026-05-26)

To make workflow validation independent of local machine tooling, repository CI now includes a dedicated workflow syntax lint guard:

- Workflow: `.github/workflows/workflow-lint-guard.yml`
- Tool: `actionlint`
- Triggers: pull requests and pushes to `main`
- Failure mode: fail-closed (workflow run fails on lint violations)

This closes the environment gap where local `actionlint` availability could not be assumed.

### 10.1 Required-check promotion is separate and append-only

This workflow existing in the repo is **not** the same thing as branch protection requiring it for merge. If owners decide to promote `actionlint` to a required status check, that is a separate GitHub control-plane step and must be handled conservatively:

- Update the existing branch protection / ruleset in GitHub UI (or via a full-fidelity API read-modify-write), preserving all existing required checks.
- Append `actionlint` to the current required-check set; do **not** rebuild the rules array from memory or from a partial payload.
- This governance change does not itself modify the branch-protection ruleset.

---

**Sign-off line for the lock PR body:**
> This brief is the canonical PR-type taxonomy and validator-dispatch contract as of 2026-05-13. Changes to the type taxonomy, the dispatch rule, or the per-type assertions require a new governance brief and a CODEOWNERS-approved replacement of this file.

---

## Appendix A — Extended Path Taxonomy (v2, 2026-05-18)

The classifier was extended to eliminate false-evaluation triggers from 374 unclassified repo paths. Changes are additive; no existing prefix was removed or narrowed.

### New EVAL_PREFIXES
| Prefix | Rationale |
|---|---|
| `lib/wave-modules/` | Wave scoring modules — evaluation pipeline |
| `app/api/internal/` | Internal job/revision API routes — pipeline-adjacent |
| `tests/api/` | API route integration tests |
| `tests/benchmarks/` | Latency benchmarks |
| `tests/components/` | Component tests touching evaluation surfaces |
| `tests/contract/` | Long-form pipeline contract tests |
| `tests/lib/hooks/` | Hook tests co-located with evaluation lib |
| `tests/operations/` | Soak / operational harness tests |
| `logs/` | Live-proof and run logs |
| `stress-results/` | Stress/smoke evidence artifacts |
| `manuscripts/` | Source manuscript files |
| `runs/` | Calibration run outputs |
| `supabase/functions/` | Supabase Edge Functions (evaluate endpoint) |

### New INFRA_PREFIXES
| Prefix | Rationale |
|---|---|
| `app/api/dev/` | Dev-only metrics smoke routes |
| `app/api/env-check/` | Environment diagnostic route |
| `app/api/health/` | Health-check route |
| `supabase/sql/` | Ad-hoc SQL review scripts (not migrations) |

### New INFRA_EXACT
`jest.config.js`, `jest.setup.ts`, `tsconfig.test.json`, `tsconfig.workers.json`, `next-env.d.ts`, `jsconfig.json`, `vitest.config.ts`, `vite.config.js`, `instrumentation.ts`, `middleware.ts`, `supabase/.gitignore`, `supabase/config.toml`, `supabase/seed.sql`

### New MIGRATION_PREFIXES
`migrations/` — root-level SQL migration files (complement to `supabase/migrations/`)

### New UI_EXACT
`index.html`, `components.json`

### Extension catch-all rules (isByExtension)
For files that don't match any prefix/exact set, the classifier applies extension-based rules before falling back to the `unclassified` sentinel:

| Pattern | Bucket |
|---|---|
| Root dotfiles (`.gitignore`, `.env.*`, `.eslint*`, etc.) | infra |
| Root `*.sh` | infra |
| `tests/*.sh` (flat, no subdir) | infra |
| Root `*.test.ts` / `*.test.js` | eval |
| Root `*.json` (data snapshots, criteria matrices) | eval |
| `tests/*.test.ts` (flat, no subdir) | eval |
| Root `*.sql` | migration |
| Root `*.txt` / `*.csv` | docs |
| Root extensionless files | infra |

These rules reduce the surface area that triggers false-evaluation fallback to genuinely novel path patterns only.
