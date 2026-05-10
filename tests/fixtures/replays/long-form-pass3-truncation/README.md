# Long-form Pass 3 truncation fixture

Reproduces the failure mode where long-form jobs exceed `max_output_tokens`
during Pass 3 synthesis due to high `representation_compression_ratio`,
triggering `finishReason: 'length'`.

## Status

Scaffold only. Manuscript content and full pipeline integration pending in
subsequent commits on `feat/reliability-hardening-replay-harness`.

## Replay

```bash
npm test -- tests/replays/__tests__/harness.test.ts --runInBand
```
