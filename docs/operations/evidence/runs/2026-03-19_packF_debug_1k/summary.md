# Pack F Summary

- run date: 2026-03-19T22:18:53.404Z
- commit SHA: dcd85ca3459ce9948a2c1ebf2b07022f53cff84c
- command used: node scripts/soak/run-soak.ts --events=1000 --concurrency=5 --seed=42 --mode=deterministic
- requested event count: 1000
- actual event count: 1000
- concurrency: 5
- duration: 160 ms
- pass/fail verdict: PASS

## Invariants

| invariant | value |
| --- | --- |
| requested_events | 1000 |
| total_events_processed | 1000 |
| unclassified_failures_total | 0 |
| wrong_location_edits_total | 0 |
| lost_writes_total | 0 |
| non_canonical_status_total | 0 |
| silent_fallback_total | 0 |

## Classified failures

- ANCHOR_MISS: 222
- ANCHOR_AMBIGUOUS: 111
- CONTEXT_MISMATCH: 111
- OFFSET_CONFLICT: 111
- PARSE_ERROR: 111
- INVARIANT_VIOLATION: 111
- APPLY_COLLISION: 111

## Notes

- recovered transient faults: no
- max concurrency observed: 5