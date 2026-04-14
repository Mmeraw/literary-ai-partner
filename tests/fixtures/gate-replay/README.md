# Gate Replay Fixtures

Pinned fixtures for deterministic `gate:replay` CI enforcement.

## Current fixtures

- `ch11b_pass/` — expected-pass fixture sourced from the Chapter 11b production-faithful rerun artifact pack on 2026-04-14.
  - Required files:
    - `pass1_parsed.json`
    - `pass2_parsed.json`
    - `pipeline_result.json` (uses `synthesis` for replay parity with production pipeline output)

## Intent

These fixtures are test assets, not ad-hoc run output directories. Keep names stable and update intentionally via review.
