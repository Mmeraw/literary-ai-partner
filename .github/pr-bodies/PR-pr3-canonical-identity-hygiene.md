## PR Metadata

- **PR title:** `fix(identity): PR3 — canonical identity hygiene guards`
- **Branch name:** `fix/pr3-canonical-identity-hygiene`
- **Primary commit message:** `fix(identity): add canonical identity name hygiene guards`
- **Optional second commit message:** `test(identity): prove invalid name-state tokens and same-name disambiguation`

## Summary

Adds deterministic identity-name hygiene so pronouns, generic descriptors, forms of address, and relationship descriptors cannot become canonical/legal name-state fields, while preserving same-name disambiguation evidence for cases like Pip / Philip Pirrip versus Young Pip, Joe and Biddy’s son.

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

## Merge Bar

> **PR3 must prove identity pollution cannot enter name/legal-state fields, not claim it solved the whole Story Ledger.**

## Targeted Test Commands

- `NODE_PATH=/workspaces/literary-ai-partner/node_modules /workspaces/literary-ai-partner/node_modules/.bin/jest __tests__/lib/evaluation/pipeline/characterReducer.identity-groups.test.ts __tests__/lib/evaluation/pipeline/identityNameHygiene.test.ts --runInBand`
- `NODE_PATH=/workspaces/literary-ai-partner/node_modules /workspaces/literary-ai-partner/node_modules/.bin/jest __tests__/lib/evaluation/pipeline/characterReducer*.test.ts --runInBand`

## Focused Passing Result

- `characterReducer.identity-groups.test.ts` ✅
- `identityNameHygiene.test.ts` ✅
- `characterReducer.awakening-taxonomy.test.ts` ✅

## Next Stack Item

After PR3, the next clean stack item is **PR4 — dependency blocking**.
