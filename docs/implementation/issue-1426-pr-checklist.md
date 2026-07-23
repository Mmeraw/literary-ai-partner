# Issue #1426 Implementation Checklist

- [ ] Trace `PASS2_OUTPUT_INCOMPLETE` from provider response through decoding, parsing, validation, and orchestration.
- [ ] Record root-cause classification without weakening fail-closed behavior.
- [ ] Classify missing required criteria as selectively retryable.
- [ ] Preserve verified chunk outputs, IDs, hashes, and cache provenance.
- [ ] Retry only malformed chunk IDs.
- [ ] Require a complete 13-criterion repair payload.
- [ ] Validate repaired output through the ordinary canonical path.
- [ ] Replace malformed contribution rather than appending it.
- [ ] Enforce exactly 30 unique chunk contributions after recovery.
- [ ] Reject duplicate, missing, overwritten, or hash-drifted contributions.
- [ ] Preserve named diagnosis and detailed evidence on retry exhaustion.
- [ ] Add 29-valid-plus-1-malformed production-shape fixture.
- [ ] Add invocation-set, hash-stability, replay-zero-work, and exhaustion tests.
- [ ] Run focused tests, neighboring suites, TypeScript, lint, governance checks, and full CI.
