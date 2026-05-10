# Dark-criteria fixture

Reproduces the failure mode where long-form Pass 2 packet construction
produces non-empty `criteria_with_zero_evidence` for one or more criteria,
typically due to uneven evidence extraction in Pass 1.

## Why this matters

The `criteria_with_zero_evidence` SIPOC field is one of the highest-leverage
diagnostic signals (see `PR_292_EXECUTION_BRIEF.md`). This fixture proves
the replay harness can detect dark-criteria conditions deterministically
and prevent regressions in Pass 1 evidence extraction.

## Replay

```bash
npm test -- tests/replays/__tests__/ --runInBand
```
