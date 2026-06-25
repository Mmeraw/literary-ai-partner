# Agent Readiness Package v1 Contract

Status: Phase 6 governance contract v1  
Audience: Storygate Studio, revision agents, continuity agents, scene-rewrite agents, manuscript-planning agents, Revise Workbench, evaluation pipeline  
Runtime role: certified handoff artifact for downstream agents.

## Purpose

The Agent Readiness Package prevents downstream agents from reading raw chunks, stale seed artifacts, partial evaluation outputs, or renderer-specific projections as truth.

Agents must consume a certified package built from governed artifacts:

```text
Certified UED
  + Accepted Story Ledger
  + Revision Opportunity Ledger
  + Revise Workbench Decisions
  + Phase 4B Final External Audit
  + Phase 5 Author Exposure Certification
  ↓
agent_readiness_package_v1
```

## Hard rule

No downstream agent should act directly on raw evaluation fragments when a certified package is available.

## Required artifact

```text
agent_readiness_package_v1
```

Minimum fields:

```yaml
artifact_type: agent_readiness_package_v1
schema_version: 1
job_id: string
manuscript_id: string | number
manuscript_version_id: string | null
source_artifacts:
  unified_evaluation_document_v1: string | null
  accepted_story_ledger_v1: string | null
  revision_opportunity_ledger_v1: string | null
  revise_queue_items_v1: string | null
  final_external_audit_v1: string | null
  author_exposure_certification_v1: string | null
certification:
  status: ready | degraded | blocked
  blocking_reason_codes: string[]
  warning_reason_codes: string[]
package_sections:
  story_architecture: object
  character_architecture: object
  relationship_map: object
  symbol_and_object_systems: object
  timeline_and_world_state: object
  voice_and_pov_rules: object
  revision_priorities: object[]
  accepted_repairs: object[]
  unresolved_risks: object[]
  market_positioning: object
  agent_operating_rules: string[]
created_at: string
is_resume_safe: boolean
```

## Required inputs

### Required for `ready`

- `unified_evaluation_document_v1`
- `accepted_story_ledger_v1` or verified Story Ledger substitute
- `revision_opportunity_ledger_v1`
- `final_external_audit_v1` with `pass` or tolerated `warn`
- `author_exposure_certification_v1` certified

### Required for Revise-enabled readiness

- `revise_queue_items_v1`
- Workbench decision ledger where decisions exist
- accepted / rejected / deferred repair states

## Status semantics

- `ready`: safe for downstream agents.
- `degraded`: usable only with explicit warnings and bounded missing inputs.
- `blocked`: agents must not use this package.

## Blocking conditions

Block the package if:

- Phase 4B final external audit is `block`;
- author exposure certification is blocked;
- UED is missing;
- Story Ledger authority is missing without a verified substitute;
- revision opportunities are unsupported or generic;
- package contains renderer-only or UI-derived truth instead of certified artifacts;
- package includes unresolved contradictions without warning labels.

## Agent operating rules

Every package must instruct agents:

1. Manuscript evidence and accepted Story Ledger outrank generated suggestions.
2. Do not invent canon.
3. Do not rewrite against author corrections.
4. Preserve POV, voice, timeline, world state, relationship state, and symbol lifecycle.
5. Treat Revise candidate repairs as proposals until accepted.
6. Preserve unresolved risks as risks, not facts.
7. Do not use benchmark prose as manuscript evidence.
8. Do not bypass Phase 4B / Phase 5 certification.

## Runtime role

Agent Readiness Package v1 is the bridge from RevisionGrade into Storygate Studio. It is not a report renderer. It is a certified planning and execution substrate for agents.
