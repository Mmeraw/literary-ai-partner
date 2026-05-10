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
 * Execute a single replay manifest.
 *
 * NOTE: pipeline integration is staged for the next commit on this branch.
 * Tonight's scaffold validates manifest loading, manuscript loading, and
 * telemetry assertion evaluation. Pipeline runner wiring lands tomorrow.
 */
export async function runReplay(manifestPath: string): Promise<ReplayResult> {
  const start = Date.now();
  const manifest = loadManifest(manifestPath);

  // Manuscript load test (proves fixture wiring is valid)
  const _manuscript = loadManuscript(manifestPath, manifest.manuscript_path);

  // TODO (next commit): wire to processEvaluationJob via in-memory mocks
  //   - mock OpenAI/Perplexity API calls from manifest-provided fixtures
  //   - capture progressState.representation_telemetry
  //   - validate expected_failure_stage matches actual stage
  //   - evaluate all telemetry_assertions
  //
  // Tonight: return a stub result so the harness API shape is testable.

  return {
    fixture_id: manifest.fixture_id,
    pass: false,
    failure_mode_reproduced: false,
    telemetry_assertion_results: [],
    duration_ms: Date.now() - start,
    error: 'Pipeline integration pending — scaffold-only commit',
  };
}
