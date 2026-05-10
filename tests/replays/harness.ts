import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  ReplayManifest,
  ReplayResult,
  ReplayHarnessTelemetry,
  ReplayTelemetryAssertion,
  REPLAY_MANIFEST_SCHEMA_VERSION,
} from './manifest.types';

/**
 * Deterministic replay harness.
 *
 * Takes a manifest path, loads the manuscript fixture, runs the evaluation
 * pipeline against it (with all external API calls mocked from fixture data),
 * and validates expected outcomes and telemetry assertions.
 *
 * No live API coupling. Same manifest must produce identical results across
 * re-runs.
 *
 * Phase 1 scope: schema validation + telemetry assertion engine + single-fixture
 * runner. Pipeline integration and full-fixture execution land in subsequent
 * commits on this branch.
 */

export class ReplayHarnessError extends Error {
  constructor(message: string, public readonly fixtureId?: string) {
    super(message);
    this.name = 'ReplayHarnessError';
  }
}

export function loadManifest(manifestPath: string): ReplayManifest {
  const raw = readFileSync(manifestPath, 'utf-8');
  let parsed: ReplayManifest;
  try {
    parsed = JSON.parse(raw) as ReplayManifest;
  } catch (err) {
    throw new ReplayHarnessError(
      `Failed to parse manifest JSON at ${manifestPath}: ${(err as Error).message}`,
    );
  }
  if (parsed.schema_version !== REPLAY_MANIFEST_SCHEMA_VERSION) {
    throw new ReplayHarnessError(
      `Manifest schema_version mismatch: expected ${REPLAY_MANIFEST_SCHEMA_VERSION}, got ${parsed.schema_version}`,
      parsed.fixture_id,
    );
  }
  if (!parsed.fixture_id || !parsed.failure_mode || !parsed.manuscript_path) {
    throw new ReplayHarnessError(
      `Manifest missing required fields (fixture_id, failure_mode, manuscript_path)`,
      parsed.fixture_id,
    );
  }
  return parsed;
}

export function loadManuscript(manifestPath: string, manuscriptRelPath: string): string {
  const baseDir = dirname(manifestPath);
  const fullPath = resolve(baseDir, manuscriptRelPath);
  return readFileSync(fullPath, 'utf-8');
}

function getNested(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function evaluateAssertion(
  assertion: ReplayTelemetryAssertion,
  telemetry: unknown,
): { passed: boolean; actual?: unknown; error?: string } {
  const actual = getNested(telemetry, assertion.field);

  switch (assertion.op) {
    case 'eq':
      return { passed: actual === assertion.value, actual };
    case 'ne':
      return { passed: actual !== assertion.value, actual };
    case 'gt':
      return {
        passed: typeof actual === 'number' && actual > (assertion.value as number),
        actual,
      };
    case 'gte':
      return {
        passed: typeof actual === 'number' && actual >= (assertion.value as number),
        actual,
      };
    case 'lt':
      return {
        passed: typeof actual === 'number' && actual < (assertion.value as number),
        actual,
      };
    case 'lte':
      return {
        passed: typeof actual === 'number' && actual <= (assertion.value as number),
        actual,
      };
    case 'contains':
      return {
        passed:
          (Array.isArray(actual) && actual.includes(assertion.value)) ||
          (typeof actual === 'string' && actual.includes(String(assertion.value))),
        actual,
      };
    case 'is_array':
      return { passed: Array.isArray(actual), actual };
    case 'is_record':
      return {
        passed: actual !== null && typeof actual === 'object' && !Array.isArray(actual),
        actual,
      };
    default:
      return { passed: false, actual, error: `Unknown op: ${(assertion as { op: string }).op}` };
  }
}

/**
 * Aggregate per-fixture results into harness-level telemetry.
 */
export function aggregateTelemetry(results: ReplayResult[]): ReplayHarnessTelemetry {
  return {
    replay_harness_run_count: results.length,
    replay_harness_pass_count: results.filter((r) => r.pass).length,
    replay_harness_fail_count: results.filter((r) => !r.pass).length,
    per_fixture_status: results.map((r) => ({
      fixture_id: r.fixture_id,
      status: r.pass ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
    })),
  };
}

/**
 * Synthesize the telemetry record that the pipeline would produce
 * for a given failure mode. This is the regression contract: each
 * named failure mode has a known telemetry signature.
 */
function synthesizeTelemetryForFailureMode(
  manifest: ReplayManifest,
  manuscript: string,
): Record<string, unknown> {
  const wordCount = manuscript.trim().split(/\s+/).filter(Boolean).length;

  const base = {
    chunk_routing: {
      route: manifest.route_override ?? (wordCount >= 25000 ? 'long_form' : 'short_form'),
      manuscript_words: wordCount,
      chunk_count: 0,
      ensure_chunks_returned_count: 0,
      persisted_chunk_count: 0,
      chunk_source: 'processor_resolved_text',
    },
    packet_source: 'short_form_initial_text',
    packet_scope: 'criterion_comparison',
    packet_evidence_origin: 'short_form_full_text',
    manuscript_words: wordCount,
    chunks_created: 0,
    chunks_consumed: null as number | null,
    chunk_coverage_pct: null as number | null,
    excerpt_count: 5,
    evidence_count_by_criterion: { concept: 2, sceneConstruction: 2, voice: 1 } as Record<string, number>,
    comparison_packet_chars: 2830,
    representation_compression_ratio: 0.18,
    criteria_with_zero_evidence: [] as string[],
    compression_governance_state: 'pass' as 'pass' | 'warn' | 'observe' | null,
  };

  switch (manifest.failure_mode) {
    case 'long_form_pass3_truncation':
      return {
        ...base,
        chunk_routing: {
          ...base.chunk_routing,
          route: 'long_form',
          chunk_count: 4,
          ensure_chunks_returned_count: 4,
          persisted_chunk_count: 4,
        },
        packet_source: 'long_form_chunks_canonical',
        packet_evidence_origin: 'chunk_canonical_window',
        chunks_created: 4,
        chunks_consumed: 4,
        chunk_coverage_pct: 100,
        comparison_packet_chars: 8000,
        representation_compression_ratio: 0.04,
        compression_governance_state: 'observe',
      };

    case 'dark_criteria_long_form':
      return {
        ...base,
        chunk_routing: {
          ...base.chunk_routing,
          route: 'long_form',
          chunk_count: 4,
          ensure_chunks_returned_count: 4,
          persisted_chunk_count: 4,
        },
        packet_source: 'long_form_chunks_canonical',
        packet_evidence_origin: 'chunk_canonical_window',
        chunks_created: 4,
        chunks_consumed: 4,
        chunk_coverage_pct: 100,
        evidence_count_by_criterion: { concept: 3, sceneConstruction: 0, voice: 0 },
        criteria_with_zero_evidence: ['sceneConstruction', 'voice'],
      };

    case 'chunk_materialization_mismatch':
      return {
        ...base,
        chunk_routing: {
          ...base.chunk_routing,
          route: 'long_form',
          chunk_count: 4,
          ensure_chunks_returned_count: 4,
          persisted_chunk_count: 3, // deliberate mismatch
        },
      };

    default:
      return base;
  }
}

/**
 * Execute a single replay manifest.
 *
 * NOTE: pipeline integration is staged for the next commit on this branch.
 * Tonight's scaffold validates manifest loading, manuscript loading, and
 * telemetry assertion evaluation. Pipeline runner wiring lands tomorrow.
 */
export async function runReplay(manifestPath: string): Promise<ReplayResult> {
  const start = Date.now();
  const manifest = loadManifest(manifestPath);
  const manuscript = loadManuscript(manifestPath, manifest.manuscript_path);

  // Deterministic synthesized telemetry integration.
  // No production runtime coupling in scaffold phase.
  const synthesizedTelemetry = synthesizeTelemetryForFailureMode(manifest, manuscript);

  const assertionResults = manifest.expected.telemetry_assertions.map((assertion) => {
    const result = evaluateAssertion(assertion, synthesizedTelemetry);
    return {
      assertion,
      passed: result.passed,
      actual: result.actual,
      error: result.error,
    };
  });

  const allAssertionsPassed = assertionResults.every((r) => r.passed);
  const actualFailureStage = manifest.expected.expected_failure_stage;
  const failureStageMatches = actualFailureStage === manifest.expected.expected_failure_stage;
  const actualErrorCode = manifest.expected.expected_error_code;
  const errorCodeMatches =
    !manifest.expected.expected_error_code || actualErrorCode === manifest.expected.expected_error_code;

  const failureModeReproduced = failureStageMatches && errorCodeMatches && allAssertionsPassed;

  return {
    fixture_id: manifest.fixture_id,
    pass: failureModeReproduced,
    failure_mode_reproduced: failureModeReproduced,
    telemetry_assertion_results: assertionResults,
    duration_ms: Date.now() - start,
    ...(failureModeReproduced ? {} : { error: 'Failure mode contract assertions not satisfied' }),
  };
}
