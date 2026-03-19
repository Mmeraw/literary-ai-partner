# Pack F Summary

- run date: 2026-03-19T22:19:19.646Z
- commit SHA: dcd85ca3459ce9948a2c1ebf2b07022f53cff84c
- command used: node scripts/soak/run-soak.ts --events=100000 --concurrency=10 --seed=42 --mode=stress
- requested event count: 100000
- actual event count: 100000
- concurrency: 10
- duration: 11817 ms
- pass/fail verdict: PASS

## Invariants

| invariant | value |
| --- | --- |
| requested_events | 100000 |
| total_events_processed | 100000 |
| unclassified_failures_total | 0 |
| wrong_location_edits_total | 0 |
| lost_writes_total | 0 |
| non_canonical_status_total | 0 |
| silent_fallback_total | 0 |

## Classified failures

- ANCHOR_MISS: 22222
- ANCHOR_AMBIGUOUS: 11111
- CONTEXT_MISMATCH: 11111
- OFFSET_CONFLICT: 11111
- PARSE_ERROR: 11111
- INVARIANT_VIOLATION: 11111
- APPLY_COLLISION: 11111

## Notes

- recovered transient faults: yes
- max concurrency observed: 10