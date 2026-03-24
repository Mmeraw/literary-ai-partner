# Operating Rule: Revision Path Authority

> **No model output may modify manuscript text unless it has passed through the governed revision orchestrator.**

## Scope

This rule applies to ALL revision activity, including:

- Direct rewrite calls
- Assistant-generated scene replacements
- Patch proposals
- WAVE execution

## Enforcement

All revision activity must pass through these gates in order:

1. **Pass Evaluation** (13 criteria + WAVE system)
2. **Sufficiency Gate** (if scene already passes function/theme/tone/structure, return NO_CHANGE_REQUIRED)
3. **Wave Eligibility** (fail-closed; any rejected wave blocks all waves)
4. **Destruction Guards** (max 10% removal; protected spans inviolable)
5. **Patch Validation** (no layer leakage, no environmental agency, no moral interpretation)
6. **Governance Logging** (every decision persisted to governance_logs)

## Invariants

These must ALWAYS hold true:

- A perfect scene produces **NO_CHANGE_REQUIRED**
- A vignette can **never** be escalated
- A human scene can **never** gain Realm voice
- Diagnostic mode can **never** output rewritten prose

## Bypass

Any bypass invalidates the output. No raw model calls may exist outside the orchestrator path.

---

*This is the institutional authority for RevisionGrade's revision pipeline. Changing this document requires a migration plan and version bump.*
