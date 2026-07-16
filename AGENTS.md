# Repository Agent Instructions

These instructions apply to Devin, Perplexity, GitHub Copilot/Codex, and any other AI agent modifying this repository.

## Opportunity-related work

Before changing evaluation recommendations, revision opportunities, WAVE findings, opportunity ledgers, UED assembly, quality gates, diagnostics, or renderers, read:

- `docs/governance/OPPORTUNITY_DISCOVERY_POLICY.md`
- `lib/evaluation/policy/opportunityDiscoveryPolicy.ts`

The governing rule is:

> Revision opportunities are discoveries, not quotas.

Agents MUST NOT introduce or preserve a recommendation-count rule that conflicts with the canonical policy module. In particular:

- do not require two recommendations for a 9/10 criterion;
- do not require any recommendation for a 10/10 criterion;
- do not treat 50 Short-Form or 100 Long-Form opportunities as fill targets;
- do not backfill generic recommendations to satisfy a count;
- do not permit WAVE or cross-WAVE opportunities in Short Form;
- do not duplicate a strategic lever across criteria merely to increase coverage;
- do not render titles or metadata as manuscript-body evidence;
- do not allow symptom and cause to be restatements of one another.

All prompts, validators, WAVE producers, ledgers, diagnostics, and renderers MUST consume the canonical TypeScript policy instead of embedding independent score/count tables.

When legacy code or documentation conflicts with the canonical policy, the agent MUST identify and remove the conflict, add regression coverage, and state the migration explicitly in the pull request.
