/**
 * Replay manifest schema — versioned for forward compatibility.
 * See RELIABILITY_HARDENING_GOVERNANCE_BRIEF.md for contract.
 */

export const REPLAY_MANIFEST_SCHEMA_VERSION = 1 as const;

export type ReplayFailureMode =
  | 'long_form_pass3_truncation'
  | 'dark_criteria_long_form'
  | 'chunk_materialization_mismatch';

export interface ReplayTelemetryAssertion {
  /** Telemetry field name (dot-notation supported, e.g., "criteria_count_by_state.soft_divergence") */
  field: string;
  /** Comparison operator */
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'is_array' | 'is_record';
  /** Expected value (omitted for type-only checks like is_array) */
  value?: unknown;
}

export interface ReplayExpectedOutcome {
  /** Whether the run is expected to fail closed at a specific stage */
  expected_failure_stage: 'phase1' | 'phase2' | 'pass3' | null;
  /** Optional error code expected when failure_stage is set */
  expected_error_code?: string;
  /** Telemetry assertions that must hold post-run */
  telemetry_assertions: ReplayTelemetryAssertion[];
}

export interface ReplayManifest {
  schema_version: typeof REPLAY_MANIFEST_SCHEMA_VERSION;
  /** Stable identifier for this fixture across CI runs */
  fixture_id: string;
  /** Human-readable description */
  description: string;
  /** Named failure mode this fixture reproduces */
  failure_mode: ReplayFailureMode;
  /** Path (relative to repo root) to the manuscript fixture file */
  manuscript_path: string;
  /** Routing override: forces long_form or short_form regardless of word count */
  route_override?: 'long_form' | 'short_form';
  /** Expected outcome and telemetry assertions */
  expected: ReplayExpectedOutcome;
  /** Notes for maintainers */
  notes?: string;
}

export interface ReplayResult {
  fixture_id: string;
  pass: boolean;
  failure_mode_reproduced: boolean;
  telemetry_assertion_results: Array<{
    assertion: ReplayTelemetryAssertion;
    passed: boolean;
    actual?: unknown;
    error?: string;
  }>;
  duration_ms: number;
  error?: string;
}

export interface ReplayHarnessTelemetry {
  replay_harness_run_count: number;
  replay_harness_pass_count: number;
  replay_harness_fail_count: number;
  per_fixture_status: Array<{
    fixture_id: string;
    status: 'pass' | 'fail';
    duration_ms: number;
  }>;
}
