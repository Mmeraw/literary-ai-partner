# Issue #1425 Implementation Checklist

- [ ] Locate the canonical Pass 2 aggregation boundary.
- [ ] Define immutable source-manifest types and canonical serialization.
- [ ] Capture origin chunk IDs and hashes at aggregation.
- [ ] Preserve manifest through cache, retry, replay, handoff, and re-kick.
- [ ] Replace missing-lineage-only fallback with one unified reconciler.
- [ ] Enforce deterministic ordering and idempotence.
- [ ] Permit only unambiguous one-to-one materialization recovery.
- [ ] Validate explicit consolidation and governed suppression.
- [ ] Enforce exactly one outcome per canonical source.
- [ ] Add precise internal subcodes while retaining the public failure code.
- [ ] Add schema/migration or canonical-artifact storage for durable ledger.
- [ ] Persist canonical result and ledger atomically.
- [ ] Add production-shape 30-chunk/13-criterion fixtures.
- [ ] Add replay, re-kick, ambiguity, duplicate, and rollback tests.
- [ ] Run focused tests, neighboring suites, TypeScript, lint, registry/governance checks, and full CI.
