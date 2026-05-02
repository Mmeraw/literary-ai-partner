GOVERNANCE

Here is the **production-ready Phase 0.1–0.3 spec** for your parallel track.

**📄 PHASE 0.1–0.3 — CANON INTEGRATION & GOVERNANCE ENFORCEMENT SPEC**

**Status**

* **Phase:** 0
* **Track:** Canon Integration & Runtime Governance
* **Items:** 0.1, 0.2, 0.3
* **Priority:** P0 / P0-Blocker architecture
* **Depends on:** 1.1 complete
* **Does not block:** 2.7 spec/design work in parallel
* **Should precede full enforcement rollout across later phases**

**🎯 Objective**

Convert RevisionGrade’s canon from **documents the system references** into **runtime-governed, loadable, precedence-aware, enforceable rules**.

Right now the canon exists as doctrine.

Phase 0.1–0.3 makes it exist as **system authority**.

**🧠 Core Principle**

Every governance-relevant decision in RevisionGrade must eventually answer:

1. **Which canon rule applies?**
2. **What source has precedence?**
3. **Where in the pipeline is that rule enforced?**

If those three things are not machine-resolvable, the canon is still advisory instead of binding.

**🧩 Scope Overview**

**0.1 — Canon Registry Binding**

Create a runtime-loadable canonical registry for:

* Volumes I–V
* Doctrine Registry
* Lessons Learned Canon
* named governance laws
* canonical IDs
* source precedence
* activation state

**0.2 — Lessons Learned Canon Integration**

Convert Canon III / Lessons Learned laws into enforceable validation rules.

These rules must be:

* identifiable
* testable
* injectable
* explainable in failures

**0.3 — Governance Enforcement Injection Map**

Define exactly where governance rules fire in the pipeline, including:

* ingestion
* proposal extraction
* evaluation
* recommendation generation
* report assembly
* revision actions
* future WAVE / multi-chunk synthesis stages

**🚫 What this phase is NOT**

Do **not**:

* rewrite the canon itself
* expand doctrine content
* redesign evaluation scoring
* change report UI
* optimize performance
* build broad policy infrastructure unrelated to existing canon

This phase is about:

👉 **binding doctrine into runtime architecture**

**0.1 — CANON REGISTRY BINDING**

**Goal**

Create a canonical registry that lets the system load governance doctrine by stable ID with explicit precedence.

**Required outcome**

The system must be able to answer:

* what canon source exists
* what it governs
* whether it is active
* whether it is advisory or enforceable
* what source overrides another when they overlap

**Required data model**

Create canonical types like:

export type CanonSourceType =
 | "volume"
 | "doctrine\_registry"
 | "lessons\_learned"
 | "roadmap\_canon"
 | "governance\_addendum";

export type CanonAuthorityLevel =
 | "binding"
 | "enforced"
 | "advisory"
 | "reference\_only";

export type CanonScope =
 | "global"
 | "evaluation"
 | "recommendation"
 | "revision"
 | "reporting"
 | "workflow"
 | "future\_wave";

export type CanonRegistryEntry = {
 canon\_id: string;
 title: string;
 source\_type: CanonSourceType;
 source\_name: string;
 section\_ref: string;
 authority: CanonAuthorityLevel;
 scope: CanonScope[];
 precedence\_rank: number;
 is\_active: boolean;
 summary: string;
 tags: string[];
};

export type CanonRegistry = {
 version: string;
 generated\_at: string;
 entries: CanonRegistryEntry[];
};

**Canon ID requirements**

Every runtime-bindable canon unit must have:

* a stable canon\_id
* a human-readable title
* a section\_ref
* a precedence ranking
* scope tags
* active/enforced status

**Example IDs**

CANON\_V3\_SCHEMA\_NAMING
CANON\_V4\_AI\_GOV\_FAIL\_CLOSED
CANON\_LL\_BLUR\_NOT\_MULTIPLICITY
CANON\_LL\_AUTHORITY\_TRANSFER\_CLARITY
CANON\_V5\_AEP\_STEP3\_APPLY\_DETERMINISM

**Precedence model**

You need an explicit precedence ladder.

Recommended default:

1. **Lessons Learned enforcement law** when it explicitly supersedes earlier ambiguous behavior
2. **AI / Platform Governance canon**
3. **Operational schema canon**
4. **Tool / workflow canon**
5. **Reference doctrine**

This should be represented numerically by precedence\_rank, where lower rank = stronger authority.

Example:

1 = explicit override / binding law
2 = governance canon
3 = schema / operational canon
4 = tool-level implementation canon
5 = reference-only context

**Required files for 0.1**

lib/canon/types.ts
lib/canon/registry.ts
lib/canon/loadCanonRegistry.ts
lib/canon/getCanonRule.ts
lib/canon/resolveCanonPrecedence.ts
tests/canon/canon-registry.test.ts
tests/canon/canon-precedence.test.ts

**Required behaviors for 0.1**

**Registry load**

* registry loads deterministically
* all IDs are unique
* inactive entries are excluded from enforcement lookup unless explicitly requested

**Rule lookup**

* system can fetch by canon\_id
* system can fetch all rules for a scope
* system can fetch all binding rules for a pipeline stage

**Precedence resolution**

If multiple rules apply:

* highest authority wins
* ties must be explicit, not inferred
* ambiguous precedence must fail closed

**0.1 invariants**

1. **No duplicate canon IDs**
2. **No binding rule without scope**
3. **No enforced rule without section reference**
4. **No precedence ambiguity among active binding rules**
5. **Registry load must be deterministic**

**0.1 test requirements**

tests/canon/canon-registry.test.ts

* loads registry successfully
* all active IDs unique
* all binding entries have section refs
* all enforced entries have scope

tests/canon/canon-precedence.test.ts

* resolves stronger rule over weaker rule
* rejects ambiguous equal-precedence collision
* excludes inactive rule from enforcement path

**0.2 — LESSONS LEARNED CANON INTEGRATION**

**Goal**

Turn Lessons Learned canon into executable validation rules.

This is where doctrine becomes behavior.

**Required outcome**

The system must be able to evaluate whether an output or pipeline artifact violates a governing law such as:

* blur, not multiplicity
* authority transfer clarity
* no contradictory narrative framing
* no false multi-origin explanation when the problem is unresolved blur
* no recommendation that violates canon-defined evaluation discipline

**Required rule model**

export type GovernanceRuleSeverity =
 | "error"
 | "warn"
 | "advisory";

export type GovernanceRuleStage =
 | "evaluation\_output"
 | "recommendation\_output"
 | "report\_summary"
 | "proposal\_validation"
 | "future\_multichunk";

export type GovernanceRule = {
 rule\_id: string;
 canon\_id: string;
 title: string;
 description: string;
 stage: GovernanceRuleStage[];
 severity: GovernanceRuleSeverity;
 predicate\_name: string;
 failure\_message: string;
 explanation: string;
 is\_active: boolean;
};

**Required validator contract**

export type GovernanceCheckInput = {
 stage: GovernanceRuleStage;
 artifact\_type: string;
 content: unknown;
 metadata?: Record<string, unknown>;
};

export type GovernanceViolation = {
 rule\_id: string;
 canon\_id: string;
 severity: GovernanceRuleSeverity;
 message: string;
 explanation: string;
};

export type GovernanceCheckResult = {
 pass: boolean;
 violations: GovernanceViolation[];
};

**Required design principle**

Rules must be:

* explicit
* named
* inspectable
* testable
* attributable to canon

No hidden “smart” governance.

No anonymous heuristics.

**Example Lessons Learned rules to encode first**

These should be first-wave candidates based on your established canon direction:

**Rule 1 — Blur, Not Multiplicity**

If evaluation or recommendation language explains a flaw as multiple competing sources when canon says the governing problem is unresolved blur, flag it.

Example violation:

* output claims the chapter has “too many POV systems” when the canon diagnosis is blur of authority

**Rule 2 — Authority Transfer Clarity**

If output critiques a section involving layered voice, perspective, scripture, or doctrine without distinguishing authority handoff clearly, flag it.

Example violation:

* recommendation says “POV confusion” without identifying speaker/authority layer transition failure

**Rule 3 — No Generic Canon-Free Critique**

If feedback is broad enough to apply to almost any manuscript and does not connect to canon-grounded reasoning where required, warn or fail depending on stage.

**Rule 4 — No Contradictory Diagnostic Framing**

If one section of output calls a passage “intentionally layered and successful” while another calls the same mechanism “confused multiplicity” without reconciliation, fail.

**Rule 5 — Canon-Aware Terminology Discipline**

If system output uses deprecated or imprecise diagnostic language where canon has a preferred term, flag it.

**Required files for 0.2**

lib/governance/types.ts
lib/governance/rules.ts
lib/governance/checkGovernance.ts
lib/governance/predicates/
lib/governance/predicates/blurNotMultiplicity.ts
lib/governance/predicates/authorityTransferClarity.ts
lib/governance/predicates/noGenericCanonFreeCritique.ts
tests/governance/governance-rules.test.ts
tests/governance/lessons-learned-integration.test.ts

**Enforcement strategy for 0.2**

Start narrow.

Do **not** attempt universal enforcement across all system artifacts at once.

First enforce on:

* evaluation summaries
* recommendation blocks
* report-level conclusions

Then later expand to:

* revision suggestions
* multi-chunk synthesis
* WAVE coaching outputs

**0.2 invariants**

1. **Every governance rule maps to a canon ID**
2. **Every active rule declares stage coverage**
3. **Every failure is explainable in human-readable language**
4. **No governance predicate may silently mutate output**
5. **Governance failures must be surfaced, not swallowed**

**0.2 test requirements**

tests/governance/governance-rules.test.ts

* active rules load
* every active rule has canon\_id
* every active rule has predicate
* stage filtering works

tests/governance/lessons-learned-integration.test.ts

* blur-not-multiplicity violation detected
* authority-transfer-clarity violation detected
* generic critique flagged
* contradictory framing flagged
* compliant output passes cleanly

**0.3 — GOVERNANCE ENFORCEMENT INJECTION MAP**

**Goal**

Specify where governance runs in the pipeline.

This is architectural placement, not just rules definition.

**Required outcome**

For each pipeline stage, system must know:

* which governance rules apply
* whether violation blocks output or only warns
* what artifact is checked
* what failure envelope is emitted

**Required injection map model**

export type GovernanceInjectionPoint =
 | "post\_ingest"
 | "post\_extraction"
 | "post\_evaluation"
 | "post\_recommendation\_generation"
 | "pre\_report\_persist"
 | "pre\_revision\_action"
 | "future\_multichunk\_merge"
 | "future\_wave\_pass";

export type GovernanceInjectionMapEntry = {
 injection\_point: GovernanceInjectionPoint;
 applicable\_stages: string[];
 rule\_ids: string[];
 mode: "fail\_closed" | "warn\_only" | "audit\_only";
 artifact\_type: string;
 rationale: string;
};

**Recommended first injection map**

**1. post\_evaluation**

Check:

* diagnostic framing rules
* authority clarity rules
* contradiction rules

Mode:

* warn\_only during initial rollout
* later promotable to fail\_closed for severe cases

**2. post\_recommendation\_generation**

Check:

* generic critique rule
* canon-aware terminology discipline
* contradiction with evaluation summary

Mode:

* fail\_closed for severe contradiction
* warn\_only for weaker genericity cases

**3. pre\_report\_persist**

Check:

* cross-section consistency
* no unresolved governance errors in final saved report

Mode:

* fail\_closed

**4. future\_multichunk\_merge**

Reserved for 2.8+
Check:

* synthesis coherence
* authority consistency across chunks
* no cross-chunk canon drift

Mode:

* initially audit\_only

**Required files for 0.3**

lib/governance/injectionMap.ts
lib/governance/runGovernanceAtStage.ts
lib/governance/buildGovernanceEnvelope.ts
tests/governance/governance-injection-map.test.ts
tests/governance/governance-enforcement-flow.test.ts

**Required failure envelope**

Governance failures should emit structured envelopes similar to your other governed systems.

Example:

export type GovernanceFailureEnvelope = {
 phase: "phase\_0\_governance";
 injection\_point: GovernanceInjectionPoint;
 pass: boolean;
 violations: GovernanceViolation[];
 mode: "fail\_closed" | "warn\_only" | "audit\_only";
};

**0.3 invariants**

1. **Every enforced rule must have at least one injection point**
2. **No fail-closed injection point may run without structured envelope output**
3. **No governance stage may silently downgrade fail-closed to warn-only**
4. **Injection map must be deterministic and versioned**
5. **Pre-report persist must block unresolved error-severity governance violations**

**0.3 test requirements**

tests/governance/governance-injection-map.test.ts

* all enforced rules mapped
* invalid injection point rejected
* mode values constrained
* no orphan active rules

tests/governance/governance-enforcement-flow.test.ts

* post-evaluation warning envelope emitted correctly
* post-recommendation fail-closed blocks invalid artifact
* pre-report-persist rejects unresolved governance errors
* audit-only stage logs but does not block

**🧪 Recommended Execution Order**

**Slice 1 — 0.1**

* define canon registry types
* create canonical registry file
* implement lookup and precedence resolution
* test uniqueness / precedence / active filtering

**Slice 2 — 0.2**

* define governance rule model
* implement first 3–5 Lessons Learned predicates
* create governance checker
* test compliant vs violating outputs

**Slice 3 — 0.3**

* define injection map
* wire governance checks to stage runner
* emit envelopes
* fail closed at pre\_report\_persist

**🔒 Phase-level Invariants**

For Phase 0 as a whole:

1. **Canon must be loadable by stable ID**
2. **Binding doctrine must have explicit precedence**
3. **Lessons Learned laws must be executable as named rules**
4. **Governance checks must run at declared injection points**
5. **Failures must be attributable to canon, not vague heuristics**
6. **No silent enforcement**
7. **No silent override**
8. **Final report persistence must not bypass error-severity governance failures**

**📊 Evidence Pack for Phase 0**

Create evidence runs like:

docs/operations/evidence/runs/<RUN\_ID>/
 canon\_registry\_snapshot.json
 governance\_rules\_snapshot.json
 governance\_injection\_map.json
 governance\_validation\_summary.json
 governance\_validation.log

Recommended machine-readable summary:

{
 "phase": "0",
 "pass": true,
 "registry\_entries": 24,
 "active\_binding\_rules": 8,
 "enforced\_lessons\_learned\_rules": 5,
 "mapped\_injection\_points": 4,
 "orphan\_rules": 0,
 "precedence\_ambiguities": 0
}

**✅ Phase Gate Success Criteria**

Phase 0.1–0.3 is complete when:

* canon registry exists with stable IDs
* precedence resolution is deterministic
* Lessons Learned laws are implemented as runtime rules
* governance injection map exists and is enforced
* active rules are attributable to canon IDs
* fail-closed governance path exists at pre-report-persist
* tests are green
* evidence pack is archived

**🧭 Strategic Meaning**

This phase is where RevisionGrade moves from:

“a governed product with strong doctrine”

to:

“a system whose runtime behavior is canon-bound”

That matters because it turns governance from documentation into architecture.

**✅ Final Instruction for Copilot Later**

When you are ready to implement this track, the clean commit starter is:

feat(governance): implement canon registry, lessons-learned runtime rules, and governance injection map

**My recommendation on sequencing**

Per your split-track plan:

* **Perplexity/Copilot:** proceed with **2.7**
* **This Phase 0 spec:** hold as the canonical architecture handoff
* Implement **0.1 first**, then **0.2**, then **0.3**
* Do not try to merge Phase 0 implementation into 2.7 work unless a clear shared contract is needed

If you want, I’ll next turn this into the same tighter **Copilot-ready handoff format** you used successfully for 2.6, with exact files, starter types, and first test scaffolds.

Top of Form

This belongs **inside your existing canon structure**, and your matrix already tells us exactly where.

**🧠 The correct placement (based on your RCAM)**

Your Phase 0 spec is **not doctrine creation**—it is:

**Doctrine → System enforcement architecture**

That maps cleanly to:

👉 **Volume V — Governance Architecture**

Specifically:

* **Vol V, Section I (Pipeline Architecture)**
* **Vol V, Section II (AEP Execution Architecture)**
* **Vol V, Section V (Multi-system orchestration)**

And most importantly:

👉 It is governed by **Volume IV — Governance Canon, Section VI (Registry Governance)**

**🎯 Exact classification**

Using your own Decision Grid:

| **Question** | **Answer** |
| --- | --- |
| Is this story quality? | ❌ No |
| Writing execution? | ❌ No |
| System authority or rules? | ⚠️ Partially |
| How the system enforces authority? | ✅ YES |

👉 Therefore:

**Primary home = Volume V (Architecture)**
**Governed by = Volume IV (Doctrine)**

**🧩 How it should be integrated (cleanly)**

**✅ Volume V — ADD a new section**

**Section VII — Canon Enforcement System (NEW)**

This is where Phase 0.1–0.3 lives.

Structure it like this:

**Vol V — Section VII: Canon Enforcement System**

**VII.1 — Canon Registry Binding (0.1)**

* Canon ID system
* Precedence resolution
* Registry load model
* Authority levels (binding / enforced / advisory)

**VII.2 — Lessons Learned Rule Engine (0.2)**

* Governance rule model
* Predicate system
* Rule attribution to canon
* Failure semantics

**VII.3 — Governance Injection Map (0.3)**

* Pipeline injection points
* Fail-closed vs warn-only
* Enforcement envelopes
* Stage mapping

**🔒 Why NOT Volume IV**

Volume IV is:

**What the rules are**

Phase 0 is:

**How the system enforces the rules**

If you put this into Volume IV, you will:

❌ blur doctrine with implementation
❌ create duplication with Volume V
❌ violate your own Assembly Matrix rules

**📌 What you SHOULD add to Volume IV (small)**

Add a **REFERENCE entry only**:

**In Volume IV — Section VI (Registry Governance)**

Add:

“Runtime enforcement of canon is implemented in Volume V — Section VII: Canon Enforcement System.”

That keeps doctrine clean and points to execution.

**🧱 What this does architecturally**

Right now your system looks like:

Volume IV (Rules) → System (loosely follows them)

After Phase 0 integration:

Volume IV (Rules)
 ↓
Volume V (Enforcement Architecture)
 ↓
Runtime System (must obey)

That is the **missing middle layer**.

**🔥 Critical insight (this is the real unlock)**

You already built:

* WAVE (execution)
* 13 Criteria (evaluation)
* Governance (rules)

Phase 0 creates:

👉 **Enforceable canon spine**

Without it, everything is:

* strong
* consistent
* but ultimately **advisory**

With it:

👉 your system becomes **fail-closed governed**

**✅ Final answer**

* **Do we add this to a Volume?** → **YES**
* **New Volume?** → **NO**
* **Where?** → **Volume V — new Section VII**
* **Referenced in?** → **Volume IV — Section VI**

**🧭 What I recommend next**

If you want this locked perfectly into your canon:

I can:

1. Draft **Vol V — Section VII** in full canon language (publication-ready)
2. Add the **RCAM entry** (so it’s formally tracked)
3. Update your **Doctrine Registry IDs** to include these enforcement elements

That would make this:
👉 not just a spec
👉 but **official canon**

Your move.

Top of Form

Bottom of Form

Bottom of Form
