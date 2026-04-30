#!/usr/bin/env node

/**
 * Validate PR-002 authority-cap artifact contract from pasted JSON.
 *
 * Expected top-level shape:
 * {
 *   run_1_low_authority: {
 *     overview: { overall_score_0_100: number },
 *     score_adjustments: [ ... ]
 *   },
 *   run_2_boundary_optional?: {
 *     overview: { overall_score_0_100: number },
 *     score_adjustments: [ ... ]
 *   }
 * }
 */

const raw = process.env.ARTIFACT_JSON;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function expect(condition, message, errors) {
  if (!condition) errors.push(message);
}

if (!raw || !raw.trim()) {
  fail('Missing ARTIFACT_JSON input. Paste real artifact JSON into workflow input.');
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  fail(`ARTIFACT_JSON is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const errors = [];

const run1 = parsed?.run_1_low_authority;
expect(!!run1 && typeof run1 === 'object', 'run_1_low_authority object is required', errors);

if (run1 && typeof run1 === 'object') {
  const overall = run1?.overview?.overall_score_0_100;
  expect(isNumber(overall), 'run_1_low_authority.overview.overall_score_0_100 must be a number', errors);

  const adjustments = run1?.score_adjustments;
  // Check #6: array shape
  expect(Array.isArray(adjustments), 'run_1_low_authority.score_adjustments must be an array', errors);

  if (Array.isArray(adjustments)) {
    // Cap must fire in run 1
    const capAdjustment = adjustments.find((a) => a?.reason === 'AUTHORITY_CAP_APPLIED');
    expect(!!capAdjustment, 'Run 1 must include score_adjustments[].reason === "AUTHORITY_CAP_APPLIED"', errors);

    if (capAdjustment) {
      // Check #1 field names exact presence
      const requiredFields = [
        'reason',
        'composite_0_10',
        'threshold_0_10',
        'original_overall_0_100',
        'capped_overall_0_100',
        'inputs',
      ];
      for (const f of requiredFields) {
        expect(Object.prototype.hasOwnProperty.call(capAdjustment, f), `Run 1 cap adjustment missing field: ${f}`, errors);
      }

      // Check #2 types
      expect(capAdjustment.reason === 'AUTHORITY_CAP_APPLIED', 'Run 1 cap adjustment reason must be AUTHORITY_CAP_APPLIED', errors);
      expect(isNumber(capAdjustment.composite_0_10), 'Run 1 composite_0_10 must be a number', errors);
      expect(isNumber(capAdjustment.threshold_0_10), 'Run 1 threshold_0_10 must be a number', errors);
      expect(isNumber(capAdjustment.original_overall_0_100), 'Run 1 original_overall_0_100 must be a number', errors);
      expect(isNumber(capAdjustment.capped_overall_0_100), 'Run 1 capped_overall_0_100 must be a number', errors);

      // Check #3 inputs completeness
      const inputs = capAdjustment.inputs;
      expect(inputs && typeof inputs === 'object', 'Run 1 inputs must be an object', errors);
      if (inputs && typeof inputs === 'object') {
        expect(isNumber(inputs.voice), 'Run 1 inputs.voice must be a number', errors);
        expect(isNumber(inputs.proseControl), 'Run 1 inputs.proseControl must be a number', errors);
        expect(isNumber(inputs.tone), 'Run 1 inputs.tone must be a number', errors);
      }

      // Check #4 math invariant
      if (isNumber(capAdjustment.composite_0_10) && isNumber(capAdjustment.capped_overall_0_100)) {
        const expectedCap = Math.round(capAdjustment.composite_0_10 * 10);
        expect(
          capAdjustment.capped_overall_0_100 === expectedCap,
          `Run 1 math invariant failed: capped_overall_0_100=${capAdjustment.capped_overall_0_100}, expected=${expectedCap}`,
          errors,
        );
      }

      // Check #5 no-raise invariant
      if (isNumber(capAdjustment.capped_overall_0_100) && isNumber(capAdjustment.original_overall_0_100)) {
        expect(
          capAdjustment.capped_overall_0_100 < capAdjustment.original_overall_0_100,
          'Run 1 no-raise invariant failed: capped_overall_0_100 must be < original_overall_0_100',
          errors,
        );
      }

      // Sanity: threshold should stay canonical at 6
      if (isNumber(capAdjustment.threshold_0_10)) {
        expect(capAdjustment.threshold_0_10 === 6, 'Run 1 threshold_0_10 must equal 6', errors);
      }
    }
  }
}

// Check #7 boundary holds (optional run)
const run2 = parsed?.run_2_boundary_optional;
if (run2 !== undefined) {
  expect(run2 && typeof run2 === 'object', 'run_2_boundary_optional must be an object when provided', errors);
  if (run2 && typeof run2 === 'object') {
    const run2Overall = run2?.overview?.overall_score_0_100;
    expect(isNumber(run2Overall), 'run_2_boundary_optional.overview.overall_score_0_100 must be a number', errors);

    const run2Adjustments = run2?.score_adjustments;
    expect(Array.isArray(run2Adjustments), 'run_2_boundary_optional.score_adjustments must be an array', errors);
    if (Array.isArray(run2Adjustments)) {
      const hasCap = run2Adjustments.some((a) => a?.reason === 'AUTHORITY_CAP_APPLIED');
      expect(!hasCap, 'Run 2 boundary must not include AUTHORITY_CAP_APPLIED', errors);
    }
  }
}

if (errors.length > 0) {
  console.error('❌ Authority-cap artifact contract validation failed:');
  for (const e of errors) {
    console.error(`- ${e}`);
  }
  process.exit(1);
}

console.log('✅ Authority-cap artifact contract validation passed.');
console.log('- Run 1 low-authority cap contract is valid.');
if (run2 !== undefined) {
  console.log('- Run 2 boundary contract is valid (no cap fired).');
} else {
  console.log('- Run 2 boundary not provided (optional).');
}
