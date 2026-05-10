# Chunk materialization mismatch fixture

Reproduces the long-form fail-closed guard locked in #291: when
`ensure_chunks_returned_count != persisted_chunk_count`, the job must fail
at phase1 with `LONG_FORM_CHUNK_MATERIALIZATION_FAILED` and not proceed
to Pass 1.

## Why this matters

This fixture provides permanent regression protection for the substrate
activation contract from #291. Any future change that allows long-form
jobs to proceed past phase1 with chunk count mismatches will trigger
this fixture's failure assertion.

## Replay

```bash
npm test -- tests/replays/__tests__/ --runInBand
```
