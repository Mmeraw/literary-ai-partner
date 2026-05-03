# #287 — Pass 3 Telemetry Persistence

- **Branch:** `feat/pass3-telemetry-persistence`
- **Title:** `feat(observability): persist Pass 3 reducer telemetry to canonical artifact`
- **Base:** `main` (`b8ec991c`)
- **Estimated diff:** ~50–80 lines, 2–3 files

## Code scope

### 1) `lib/evaluation/pipeline/runPipeline.ts`
Persist reducer telemetry that currently exists only in `[Pass3][ReducerTelemetry]` stdout into a canonical artifact (`pass3_telemetry.json`) at run completion.

```ts
const pass3TelemetryArtifact = {
  prompt_version: PASS3_PROMPT_VERSION,
  criteria_count_by_state: pass3Reducer.criteriaCountByState,
  comparison_packet_chars: pass3Reducer.comparisonPacketChars,
  system_prompt_chars: PASS3_SYSTEM_PROMPT.length,
  user_prompt_chars: pass3Reducer.userPromptChars,
  max_output_tokens: pass3Reducer.maxOutputTokens,
  pass3_ms: timings.pass3_ms,
};

await fs.writeFile(
  path.join(opts.outputDir, "pass3_telemetry.json"),
  JSON.stringify(pass3TelemetryArtifact, null, 2),
);
```

This is persistence-only: no new computation, no behavior change.

### 2) `scripts/pipeline/run-phase2-7-real-run.ts`
Confirm the new artifact is present in run output directory and included in completion output listing (if listing exists).

### 3) `__tests__/lib/evaluation/pipeline/pass3-telemetry-persistence.test.ts` (NEW)
Assert a run emits `pass3_telemetry.json` with:
- `prompt_version`
- `criteria_count_by_state.agree`
- `criteria_count_by_state.soft_divergence`
- `criteria_count_by_state.hard_divergence`
- `criteria_count_by_state.missing_or_invalid`

and that `prompt_version` equals canonical Pass 3 prompt version constant.

## What this PR does NOT do
- No prompt changes
- No `qualityGate.ts` modifications
- No new `QG_` codes
- No `EditorialDiagnosticClassification` changes
- No gate decision logic touched
- No latency-sensitive pipeline path changes (single artifact write after completion)

---

## PR body (latency-template compliant)

## Pass selection
- [x] Pass 1 (observability / additive read-only telemetry surface)

## Summary
Persists Pass 3 reducer telemetry (`criteria_count_by_state`, `prompt_version`, prompt-size accounting) to a canonical artifact `pass3_telemetry.json` so audit and contrast-canary workflows do not depend on console-log scraping.

Discovered during the 2026-05-03 contrast canary (A/B/C run set): Python artifact audit returned `null` for all four `criteria_count_by_state` fields because the values were only in `[Pass3][ReducerTelemetry]` stdout.

Baseline commit: `b8ec991c` (post-#286 main).

## Scope
Files changed:
- `lib/evaluation/pipeline/runPipeline.ts` (additive persistence write)
- `__tests__/lib/evaluation/pipeline/pass3-telemetry-persistence.test.ts` (NEW)

In scope:
- New `pass3_telemetry.json` written alongside existing pass artifacts
- Schema: `{ prompt_version, criteria_count_by_state, comparison_packet_chars, system_prompt_chars, user_prompt_chars, max_output_tokens, pass3_ms }`
- Test for file presence + canonical four state keys

Out of scope:
- `lib/evaluation/pipeline/qualityGate.ts`
- Prompt content changes
- Any `QG_` additions/removals/renames
- Any `EditorialDiagnosticClassification` changes
- Any model/token configuration changes

## Contract Integrity
- No public API surface changed.
- No persisted artifact removed/renamed; additive only.
- No gate decision logic touched.
- Pass 3 reducer behavior unchanged; only post-completion sink extended.

## Behavioral Quality
Targeted suite expected green:
- `pass3-telemetry-persistence` (NEW)
- `pass3-rec-contract-canary` (existing)
- `recommendation-editorial-quality` (existing)
- `pipeline-e2e` (existing)

Decision parity: zero. This PR adds persistence only; no pass/fail, generation, or gate-evaluation changes.

## Latency Evidence
Baseline = `main` @ `b8ec991c`. Post-change = this branch.

### Run 1 evidence (baseline, main @ b8ec991c)
| Stage | total_ms |
|---|---:|
| pipeline (Froggin Noggin canary) | 66,600 |

### Run 2 evidence (this branch)
| Stage | total_ms |
|---|---:|
| pipeline (Froggin Noggin canary) | TBD (fill before merge) |

Expected delta: one small JSON write (<2 KB) after pipeline completion; negligible impact. This PR is not reducing intelligence.

## Risks & Anomalies
1. Risk: strict artifact consumers may assume fixed file set.
   - Mitigation: additive file only; no removals/renames.
2. Risk: future telemetry expansion could leak prompt contents.
   - Mitigation: persist only counts/lengths, not prompt text.
3. Anomaly: none observed in baseline run.

## Quality Gate Disclosure
Quality gate logic is unchanged.
- `lib/evaluation/pipeline/qualityGate.ts` untouched
- No new `QG_` constants
- No classification value changes
- No gate regex marker-group edits

## Intelligence Preservation
This PR is not reducing intelligence. It only persists telemetry already computed and logged so audits are reproducible without stdout scraping.

---

## Suggested commit message

```text
feat(observability): persist Pass 3 reducer telemetry to canonical artifact

Writes pass3_telemetry.json alongside pass3_raw.json containing
prompt_version, criteria_count_by_state, prompt-size accounting, and
pass3_ms. Discovered during 2026-05-03 contrast canary when audits
required scraping [Pass3][ReducerTelemetry] from stdout.

Pure observability addition. No prompt, gate, or decision logic changed.

Refs: #286
```
