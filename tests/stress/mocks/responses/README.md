# Pre-canned LLM Response Fixtures

These JSON files document the deterministic LLM responses the stress harness
emits per fault scenario (anti-flake rule 3 of `STRESS_HARNESS_DIRECTIVE`).

The mock LLM in `tests/stress/mocks/llm.ts` returns these shapes
programmatically (typed factories) rather than parsing the JSON at runtime —
TypeScript types are the source of truth. The JSON files here are an
auditable reference so reviewers can see *exactly* what each fault scenario
produces without reading the factory code.

If a future change to the canned shape is needed, update BOTH the factory
in `llm.ts` AND the matching JSON file here. Drift is a contract bug.

## Files

- `pass-healthy.json` — baseline successful single-pass output (pass 1 or 2)
- `synth-healthy.json` — baseline successful pass 3 synthesis output
- `fault-rate-limit.json` — 429 rejection shape (L-429)
- `fault-server-error.json` — 500 rejection shape (L-500)
- `fault-hang.json` — timeout-classifier hint (L-hang-*)
- `fault-empty-string.json` — empty string (L-empty-str)
- `fault-empty-object.json` — `{}` schema-invalid (L-empty-obj)
- `fault-truncated-json.json` — JSON boundary failure (L-truncated-json)
- `fault-finish-length.json` — `finish_reason=length` (L-finish-length)
