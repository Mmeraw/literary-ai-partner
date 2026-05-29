## PR Metadata

- **PR title:** `fix(identity): PR3 — canonical identity hygiene guards`
- **Branch name:** `fix/pr3-canonical-identity-hygiene`
- **Primary commit message:** `fix(identity): add canonical identity name hygiene guards`
- **Optional second commit message:** `test(identity): prove invalid name-state tokens and same-name disambiguation`

## Summary

Adds deterministic identity-name hygiene so pronouns, generic descriptors, forms of address, and relationship descriptors cannot become canonical/legal name-state fields, while preserving same-name disambiguation evidence for cases like Pip / Philip Pirrip versus Young Pip, Joe and Biddy’s son.

## Scope

In scope:
- Canonical identity token hygiene filtering
- Same-name non-conflation hardening
- Fallback reducer parity for identity hygiene filtering
- Focused proof tests for invalid-token blocking and disambiguation

Out of scope:
- Magwitch alias/revelation merge
- Relationship canonical-ID keying
- Dependency blocking (PR4)
- Source Integrity aggregation/dashboard expansion
- Review Gate provenance
- Timeline/threat architecture repair
- PR #805 pronoun collective-reference behavior

No-Pipeline-Impact: N/A — deterministic Pass1A identity hygiene and status-proof updates within existing evaluation flow.

## Branch Freshness (Never Behind)

Branch-Behind-Base: 0

## Failure Classes

- `IDENTITY_NAMESTATE_INVALID_TOKEN`
- `IDENTITY_SAME_NAME_CONFLATION`

## Required Proof

This PR must prove:

1. Invalid pronouns are blocked from legal/name-state fields:
   - `he`, `him`, `she`, `her`, `they`, `them`, `I`, `me`
2. Generic descriptors are blocked from legal names:
   - `the boy`, `the man`, `the convict`, `the stranger`
3. Forms of address are blocked from legal names:
   - `sir`, `madam`, `old chap`, `dear boy`
4. Descriptors are preserved safely when useful (descriptor/disambiguation/notes fields).
5. Same-name disambiguation is preserved:
   - `Pip / Philip Pirrip` remains separate from `Young Pip, Joe and Biddy’s son`.
6. Fallback reducer applies the same filtering rules as the primary reducer path.

### Routing nuance (must remain true)

Relationship descriptors such as `the convict` or `Joe and Biddy's son` must not become canonical/legal names, but may be preserved as descriptor/disambiguation evidence for later reveal handling.

## Scope Guard

This PR does **not** implement:

- alias/revelation merge
- relationship canonical-ID keying
- dependency blocking
- Source Integrity aggregation
- Review Gate provenance
- timeline/threat repair
- PR #805 pronoun collective-reference behavior

## Evaluation Process Change Declaration

Process Change: no

Pass Selection:
- [x] Pass 1
- [ ] Pass 2
- [ ] Pass 3

## Contract Integrity

- Canonical identity hygiene is enforced deterministically in reducer/fallback code paths, not prompt-only.
- Failure-class scope is limited to:
   - `IDENTITY_NAMESTATE_INVALID_TOKEN`
   - `IDENTITY_SAME_NAME_CONFLATION`
- Dependent-layer blocking semantics are intentionally deferred to PR4.

## Behavioral Quality

- Invalid tokens are blocked from canonical/legal/name-state fields.
- Descriptor/disambiguation evidence remains usable when explicitly provided.
- Same-name visible-token ambiguity no longer forces canonical merge.
- Fallback reducer now applies the same hygiene rules as primary reducer path.

## Latency Evidence

Baseline (Pre-change)

| Run | pass1_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | 2215 | 18352 | Focused PR3 suite (`4/4` suites, `9/9` tests) |

Post-change Runs

| Run | pass1_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | 2215 | 18352 | Focused PR3 suite (`4/4` suites, `9/9` tests) |
| Run 2 | 9063 | 33326 | Focused PR3 suite (`4/4` suites, `9/9` tests) |

Quality gate / anomaly disclosure:
- No new functional regressions observed in focused PR3 suites after the coverage-map type fix.
- Local environment lacks `tsx` binary, so full `npm run build` exited at `config:validate`; this is environment/tooling, not a new code-level regression in PR3 scope.

Final principle:
- This PR is not reducing intelligence; it enforces correctness and trust boundaries while preserving downstream semantic repair work for later scoped PRs.

## Merge Bar

> **PR3 must prove identity pollution cannot enter name/legal-state fields, not claim it solved the whole Story Ledger.**

## Targeted Test Commands

- `NODE_PATH=/workspaces/literary-ai-partner/node_modules /workspaces/literary-ai-partner/node_modules/.bin/jest __tests__/lib/evaluation/pipeline/characterReducer.identity-groups.test.ts __tests__/lib/evaluation/pipeline/identityNameHygiene.test.ts --runInBand`
- `NODE_PATH=/workspaces/literary-ai-partner/node_modules /workspaces/literary-ai-partner/node_modules/.bin/jest __tests__/lib/evaluation/pipeline/identityReducerFallback.test.ts --runInBand`
- `NODE_PATH=/workspaces/literary-ai-partner/node_modules /workspaces/literary-ai-partner/node_modules/.bin/jest __tests__/lib/evaluation/pipeline/characterReducer*.test.ts --runInBand`

## Focused Passing Result

- `characterReducer.identity-groups.test.ts` ✅
- `identityNameHygiene.test.ts` ✅
- `identityReducerFallback.test.ts` ✅
- `characterReducer.awakening-taxonomy.test.ts` ✅

## Risks & Anomalies

- CI template gate requires strict PR-body sections; this body now includes all required evaluation-template headings/fields.
- #817 currently reports independent CI failures; merge order discipline should still land prerequisite PRs before #820.
- #820 CI re-runs are in progress after the type-mismatch fix (`resolveCanonical` map type alignment in coverage logic).

## Next Stack Item

After PR3, the next clean stack item is **PR4 — dependency blocking**.
