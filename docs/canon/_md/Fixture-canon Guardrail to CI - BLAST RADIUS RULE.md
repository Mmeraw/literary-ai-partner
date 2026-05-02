**Fixture-canon Guardrail to CI - BLAST RADIUS RULE (Now Active)**

Whenever I see:

* enforce\*
* assert\*
* new invariant
* stricter validation
* contract tightening

I will automatically run:

**1. Blast-Radius Pass (MANDATORY)**

Ask:

**What existing “valid” paths just became invalid?**

Specifically check:

* success-path tests (not just failing ones)
* fixture builders (makePass, etc.)
* persistence tests
* integration tests downstream of the invariant

**2. Triangle Check (MANDATORY)**

Always evaluate together:

* **Type** → PassArtifact
* **Canon** → CRITERIA\_KEYS
* **Fixture** → makePass() / builders

If those three don’t align, something will break.

**3. Fixture Adequacy Check**

Look for:

* “minimal fake” data
* partial objects that previously passed
* shortcuts like “1 criterion instead of 13”

Assume these are now invalid unless proven otherwise.

**4. CI Skepticism Rule**

Never trust:

* PR description
* “tests updated”
* “all green”

Until I ask:

**Were the right tests updated—or just the ones that failed?**

**5. Two-Pass Review Structure**

Every trust-layer PR:

**Pass 1 — Logic**

* Is the invariant correct?

**Pass 2 — Blast Radius**

* What did this break that isn’t obvious yet?

**What you did right (important)**

You didn’t just fix the test—you diagnosed the pattern:

stronger gate → weak fixtures collapse

That’s exactly the pattern that repeats across systems.

**Bottom line**

You’ve now added a **review discipline layer**, not just a code fix.

That’s how this system stops regressing.

The right way to catch this class of issue earlier is to add a **fixture-canon guardrail** to CI.

Not a vague reminder. A real tripwire.

Here’s the pattern.

**The goal**

When a stricter invariant lands, CI should fail if any “valid” fixture is no longer canon-complete.

In your case, that means:

* pass artifacts used in success-path tests must contain all canonical criteria
* those criteria must match CRITERIA\_KEYS
* the fixture builder should not be allowed to silently drift below canon

**1. Add a shared canonical fixture builder**

Do not let every test invent its own pass artifact shape.

Create one source of truth.

**Example**

\_\_tests\_\_/helpers/buildValidPassArtifact.ts

import { CRITERIA\_KEYS } from "../../schemas/criteria-keys";
import type { PassArtifact } from "../../lib/jobs/finalize.types";

export function buildValidPassArtifact(
 passId: "pass1" | "pass2" | "pass3",
 overrides: Partial<PassArtifact> = {},
): PassArtifact {
 return {
 id: `artifact-${passId}`,
 job\_id: "job-1",
 pass\_id: passId,
 schema\_version: "1.0.0",
 manuscript\_revision\_id: "rev-1",
 generated\_at: new Date().toISOString(),
 summary: "Valid pass artifact fixture",
 criteria: CRITERIA\_KEYS.map((key) => ({
 criterion\_id: key,
 score\_0\_10: 7,
 rationale: `Rationale for ${key}`,
 confidence\_0\_1: 0.8,
 evidence: [
 {
 anchor\_id: `anchor-${key}`,
 source\_type: "manuscript\_chunk" as const,
 source\_ref: `chunk-${key}`,
 start\_offset: 0,
 end\_offset: 100,
 excerpt: `Evidence for ${key}`,
 },
 ],
 warnings: [],
 })),
 provenance: {
 evaluator\_version: "1.0.0",
 prompt\_pack\_version: "1.0.0",
 run\_id: "run-1",
 },
 validations: {
 schema\_valid: true,
 anchor\_contract\_valid: true,
 evidence\_nonempty: true,
 orphan\_reasoning\_absent: true,
 },
 ...overrides,
 };
}

This does two things:

* fixes the canon in one place
* makes future invariant tightening hit one shared builder, not twenty scattered fake fixtures

**2. Add a fixture validator test suite**

This is the real guardrail.

Create a suite whose only purpose is to prove your shared “valid” fixtures are actually valid under current doctrine.

**Example**

\_\_tests\_\_/guards/fixture-canon-guard.test.ts

import { buildValidPassArtifact } from "../helpers/buildValidPassArtifact";
import { enforceCriterionCompleteness } from "../../lib/jobs/invariants";

describe("fixture canon guard", () => {
 it("valid pass1 fixture satisfies criterion completeness", () => {
 const p1 = buildValidPassArtifact("pass1");
 const p2 = buildValidPassArtifact("pass2");
 const p3 = buildValidPassArtifact("pass3");

 expect(() => enforceCriterionCompleteness(p1, p2, p3)).not.toThrow();
 });
});

This is simple, but powerful.

If canon changes and your fixture builder drifts, this fails immediately.

**3. Ban local “minimal valid” builders for trust-layer tests**

This is more cultural than technical, but it matters.

For tests that claim to be:

* success path
* release path
* canonical path
* persistence path
* finalizer path

require use of the shared builder.

That means no more:

function makePass() {
 return { criteria: [oneThing] };
}

for tests pretending to represent valid production artifacts.

You can still use minimal fixtures for narrow unit tests, but never for tests that pass through canonical finalization.

**4. Add a “canon drift” assertion helper**

This catches the exact mismatch you just hit.

**Example**

\_\_tests\_\_/helpers/assertCanonCompletePassArtifact.ts

import { CRITERIA\_KEYS } from "../../schemas/criteria-keys";
import type { PassArtifact } from "../../lib/jobs/finalize.types";

export function assertCanonCompletePassArtifact(artifact: PassArtifact): void {
 const required = new Set(CRITERIA\_KEYS);
 const actual = artifact.criteria.map((c) => c.criterion\_id);
 const unique = new Set(actual);

 if (unique.size !== CRITERIA\_KEYS.length) {
 throw new Error(
 `Expected ${CRITERIA\_KEYS.length} unique criteria, got ${unique.size}`,
 );
 }

 for (const key of required) {
 if (!unique.has(key)) {
 throw new Error(`Missing canonical criterion: ${key}`);
 }
 }
}

Then use it inside fixture tests and success-path tests.

**5. Add a CI job specifically for fixture integrity**

This is the part that turns discipline into enforcement.

**Example**

.github/workflows/fixture-guard.yml

name: fixture-canon-guard

on:
 pull\_request:
 branches: [main]

jobs:
 fixture-guard:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4

 - uses: actions/setup-node@v4
 with:
 node-version: 20

 - run: npm ci

 - name: Run fixture canon guard tests
 run: npm test -- fixture-canon-guard --runInBand

This is cheap, fast, and worth it.

**6. Add a grep-style rule for suspicious local builders**

This is crude, but useful.

Fail CI if trust-layer test files define local builders like makePass() without using the shared helper.

You do not need this forever, but it’s useful during the hardening phase.

**Example policy**

* any test under \_\_tests\_\_/lib/jobs/
* touching finalizer/persistence/canonical pipeline
* must import buildValidPassArtifact

You can enforce this with ESLint, a custom script, or just a code review rule.

**7. Add a blast-radius checklist to PRs that tighten invariants**

This is the review complement to CI.

**Paste-ready checklist**

## Blast-Radius Check

This PR adds or tightens an invariant.

Before merge, verify:

- [ ] Shared valid fixtures still satisfy the new invariant
- [ ] Success-path tests using pass artifacts still use canon-complete fixtures
- [ ] No local minimal fixture is pretending to be a valid release-path artifact
- [ ] PassArtifact shape, CRITERIA\_KEYS, and fixture builders still align
- [ ] At least one downstream integration/success-path suite was re-run

That makes the rule explicit instead of implicit.

**8. The strongest version: property-style fixture validation**

Later, if you want to get more serious, you can create a small suite that checks every fixture builder automatically.

For now, that’s overkill. Shared builder + guard test + CI job is enough.

**9. What this would have caught in your recent miss**

It would have failed immediately because:

* makePass() had only one criterion
* shared guard would compare it against CRITERIA\_KEYS
* CI would fail before you had to discover it through downstream persistence tests

That’s exactly the class of issue this pattern is meant to stop.

**10. Minimal version to adopt now**

If you want the shortest path, do just these three:

1. create buildValidPassArtifact()
2. add fixture-canon-guard.test.ts
3. require success-path job/finalizer tests to use the shared builder

That alone will eliminate most of this category of miss.

**One-line principle**

Any test fixture that claims to represent a valid canonical pass artifact must be generated from canon, not memory.

If you want, I’ll turn this into a paste-ready PR package too: title, body, reviewer note, and acceptance criteria.

Top of Form

Bottom of Form
