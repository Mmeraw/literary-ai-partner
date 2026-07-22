# Evaluation burn-in contract

The burn-in gate measures operational reliability separately from certification coverage. A certification boundary passing does not count as an evaluation completing, and a completed evaluation does not certify an unproven boundary.

The cohort manifest is immutable evidence. It names the exact source commit, fixture-set version, source kind (`deterministic_fixture`, `staging_replay`, or `controlled_production_like`), Node/npm toolchain, target completion rate, and SHA-256 digest of every replay outcome. Changing any case or outcome creates a different cohort digest.

Run it with:

```sh
npm run evaluation:burn-in -- path/to/cohort-manifest.json path/to/report.json
```

The runner performs no provider calls and no database writes. Production-like or controlled replay infrastructure must produce the outcome records; this assessor verifies provenance and computes the gate. A run passes only when:

- completion meets the manifest target (normally `0.98`);
- the predeclared cohort contains at least 50 cases, so one failure can be represented at the 98% threshold;
- every terminal failure has a canonical code;
- every completed evaluation consumed every declared chunk;
- retries and retry exhaustion are explicitly counted;
- completed evaluations were safely exposed and failed evaluations were not exposed;
- no unsafe author exposure occurred.

The report preserves the full terminal-failure distribution. Teams must not collapse failures into a single pass rate or exclude hard cases after outcomes are known. Cohort selection and fixture-set versioning happen before execution.

This deterministic contract is suitable for CI. It is not, by itself, production proof: the manifest source provenance must identify whether outcomes came from fixtures, staging replay, or a controlled production-like cohort.
