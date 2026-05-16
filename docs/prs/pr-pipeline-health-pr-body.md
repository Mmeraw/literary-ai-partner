## Summary

Formalizes `/admin/pipeline-health` as an admin-only support-ops cockpit, not a generic metrics dashboard.

Adds two docs:
- `docs/admin/PIPELINE_HEALTH_SUPPORT_COCKPIT_SPEC.md`
- `docs/admin/PIPELINE_HEALTH_PR_PLAN.md`

These docs lock:
- the primary support workflow
- canonical SIPOC vs dashboard projection rule
- truth/unavailable-data rule
- required read surfaces
- required UI sections
- acceptance fixtures
- staged implementation plan

## Scope

Docs only.

No runtime code changes.
No API route changes.
No SQL migrations.
No UI implementation changes.
No SIPOC canon rewrite.

## Risks & Anomalies

Low risk. This PR only formalizes implementation authority before dashboard work begins.

The main risk avoided is future agent drift: building a pretty static dashboard without search-first support workflow, step-contract drilldown, auditability, or truthful unavailable states.

No-Pipeline-Impact: true
