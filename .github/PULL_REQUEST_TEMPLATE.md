<!-- Comet template-unification: enforcement-compliant default body. -->
<!-- DO NOT delete required ## headings unless your PR is migration/docs-only (auto-skipped by latency-pr-enforcement.yml). -->
<!-- Auto-heal workflow (.github/workflows/auto-heal-pr-body.yml) will restore missing REQUIRED tokens. -->

> ### Pre-flight checklist (visual reminder — not parsed)
> 1. Pick exactly one Pass below (Pass 1 / Pass 2 / Pass 3).
> 2. Fill `Run 1` and `Run 2` ms numbers in the latency table.
> 3. Set the `Quality Gate:` line to PASS or FAIL.
> 4. Fill the `Scope` section with changed files / scope description.
> 5. Fill the `Risks & Anomalies` section.
> 6. Run `npm run pr:check` locally before pushing.

<!-- REQUIRED — DO NOT REMOVE: ## Summary -->
## Summary
<!-- END REQUIRED -->

<!-- One-paragraph what + why. -->

<!-- REQUIRED — DO NOT REMOVE: ## Scope -->
## Scope
<!-- END REQUIRED -->

> ⚠️ CHECK EXACTLY ONE PASS BELOW — leaving all unchecked will fail latency-pr-enforcement

<!-- REQUIRED — DO NOT REMOVE: Pass selection -->
- [ ] Pass 1
- [ ] Pass 2
- [ ] Pass 3
<!-- END REQUIRED -->

Changed files:

-

Out of scope:

-

<!-- REQUIRED — DO NOT REMOVE: ## Contract Integrity -->
## Contract Integrity
<!-- END REQUIRED -->

-

<!-- REQUIRED — DO NOT REMOVE: ## Behavioral Quality -->
## Behavioral Quality
<!-- END REQUIRED -->

<!-- REQUIRED — DO NOT REMOVE: not reducing intelligence -->
This PR is not reducing intelligence.
<!-- END REQUIRED -->

<!-- Describe quality preservation. The sentence above is REQUIRED verbatim by enforcement. -->

<!-- REQUIRED — DO NOT REMOVE: ## Latency Evidence -->
## Latency Evidence
<!-- END REQUIRED -->

<!-- REQUIRED — DO NOT REMOVE: Baseline (Pre-change) -->
### Baseline (Pre-change)
<!-- END REQUIRED -->

<!-- Fill the row that matches your selected Pass; leave others as N/A -->

| Run | pass1_ms | pass2_ms | pass3_ms | total_ms | Notes |
|---|---:|---:|---:|---:|---|
| Run 1 | N/A | N/A | N/A | N/A | |
| Run 2 | N/A | N/A | N/A | N/A | |

<!-- REQUIRED — DO NOT REMOVE: Post-change Runs -->
### Post-change Runs
<!-- END REQUIRED -->

<!-- Fill the row that matches your selected Pass; leave others as N/A -->

<!-- REQUIRED — DO NOT REMOVE: Run 1 / Run 2 -->
| Run | pass1_ms | pass2_ms | pass3_ms | total_ms | Notes |
|---|---:|---:|---:|---:|---|
| Run 1 | N/A | N/A | N/A | N/A | |
| Run 2 | N/A | N/A | N/A | N/A | |
<!-- END REQUIRED -->

<!-- Required for Pass 3; leave as-is otherwise -->
criteria_count_by_state: N/A (Pass 1 or 2)

## Quality Gate / Anomalies

<!-- REQUIRED — DO NOT REMOVE: Quality Gate token -->
Quality Gate: <PASS|FAIL> — fill before merge
<!-- END REQUIRED -->

QG_<gate-id>: <description or "no QG_ behavior changes">

<!-- REQUIRED — DO NOT REMOVE: ## Risks & Anomalies -->
## Risks & Anomalies
<!-- END REQUIRED -->

-

## Architecture Alignment

- alignment: pre-#384 mitigation | post-#384 architecture-aligned
- mitigation_expiry:
- dependent_architecture:
- expected_revisit: yes | no
- replay_ids_at_risk:
- replay_ids_targeted:
