import { describe, it, expect } from '@jest/globals';
import { resolve } from 'node:path';
import {
  loadManifest,
  loadManuscript,
  evaluateAssertion,
  aggregateTelemetry,
  runReplay,
} from '../harness';
import { REPLAY_MANIFEST_SCHEMA_VERSION } from '../manifest.types';

const FIXTURE_PATH = resolve(
  __dirname,
  '../../fixtures/replays/long-form-pass3-truncation/manifest.json',
);
const DARK_CRITERIA_FIXTURE_PATH = resolve(
  __dirname,
  '../../fixtures/replays/dark-criteria/manifest.json',
);
const CHUNK_MISMATCH_FIXTURE_PATH = resolve(
  __dirname,
  '../../fixtures/replays/chunk-materialization-mismatch/manifest.json',
);

describe('Replay harness scaffold', () => {
  describe('loadManifest', () => {
    it('loads a valid manifest with the current schema version', () => {
      const manifest = loadManifest(FIXTURE_PATH);
      expect(manifest.schema_version).toBe(REPLAY_MANIFEST_SCHEMA_VERSION);
      expect(manifest.fixture_id).toBe('long-form-pass3-truncation-v1');
      expect(manifest.failure_mode).toBe('long_form_pass3_truncation');
    });

    it('throws ReplayHarnessError on missing path', () => {
      expect(() => loadManifest('/nonexistent/path.json')).toThrow();
    });
  });

  describe('loadManuscript', () => {
    it('loads the manuscript file relative to the manifest', () => {
      const manifest = loadManifest(FIXTURE_PATH);
      const text = loadManuscript(FIXTURE_PATH, manifest.manuscript_path);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe('evaluateAssertion', () => {
    const telemetry = {
      representation_compression_ratio: 0.04,
      compression_governance_state: 'observe',
      criteria_count_by_state: { soft_divergence: 0, hard_divergence: 0 },
      criteria_with_zero_evidence: ['craft', 'voice'],
      evidence_count_by_criterion: { concept: 2 },
    };

    it('eq: matches exact value', () => {
      expect(
        evaluateAssertion(
          { field: 'compression_governance_state', op: 'eq', value: 'observe' },
          telemetry,
        ).passed,
      ).toBe(true);
    });

    it('ne: matches non-equal value', () => {
      expect(
        evaluateAssertion(
          { field: 'compression_governance_state', op: 'ne', value: 'pass' },
          telemetry,
        ).passed,
      ).toBe(true);
    });

    it('lt/gte: numeric comparisons', () => {
      expect(
        evaluateAssertion(
          { field: 'representation_compression_ratio', op: 'lt', value: 0.05 },
          telemetry,
        ).passed,
      ).toBe(true);
      expect(
        evaluateAssertion(
          { field: 'representation_compression_ratio', op: 'gte', value: 0.04 },
          telemetry,
        ).passed,
      ).toBe(true);
    });

    it('contains: array membership', () => {
      expect(
        evaluateAssertion(
          { field: 'criteria_with_zero_evidence', op: 'contains', value: 'craft' },
          telemetry,
        ).passed,
      ).toBe(true);
    });

    it('is_array: type check', () => {
      expect(
        evaluateAssertion(
          { field: 'criteria_with_zero_evidence', op: 'is_array' },
          telemetry,
        ).passed,
      ).toBe(true);
    });

    it('is_record: type check', () => {
      expect(
        evaluateAssertion(
          { field: 'evidence_count_by_criterion', op: 'is_record' },
          telemetry,
        ).passed,
      ).toBe(true);
    });

    it('nested field access via dot notation', () => {
      expect(
        evaluateAssertion(
          {
            field: 'criteria_count_by_state.soft_divergence',
            op: 'eq',
            value: 0,
          },
          telemetry,
        ).passed,
      ).toBe(true);
    });
  });

  describe('aggregateTelemetry', () => {
    it('produces ReplayHarnessTelemetry from per-fixture results', () => {
      const results = [
        {
          fixture_id: 'a',
          pass: true,
          failure_mode_reproduced: true,
          telemetry_assertion_results: [],
          duration_ms: 100,
        },
        {
          fixture_id: 'b',
          pass: false,
          failure_mode_reproduced: false,
          telemetry_assertion_results: [],
          duration_ms: 50,
        },
      ];
      const aggregated = aggregateTelemetry(results);
      expect(aggregated.replay_harness_run_count).toBe(2);
      expect(aggregated.replay_harness_pass_count).toBe(1);
      expect(aggregated.replay_harness_fail_count).toBe(1);
      expect(aggregated.per_fixture_status).toHaveLength(2);
    });
  });

  describe('runReplay', () => {
    it('reproduces long-form pass3 truncation fixture deterministically', async () => {
      const first = await runReplay(FIXTURE_PATH);
      const second = await runReplay(FIXTURE_PATH);

      expect(first.pass).toBe(true);
      expect(first.failure_mode_reproduced).toBe(true);
      expect(first.telemetry_assertion_results.every((r) => r.passed)).toBe(true);

      expect(second.pass).toBe(true);
      expect(second.failure_mode_reproduced).toBe(true);
      expect(second.telemetry_assertion_results.every((r) => r.passed)).toBe(true);

      // Determinism check: semantic result must match on rerun.
      expect(second.pass).toBe(first.pass);
      expect(second.failure_mode_reproduced).toBe(first.failure_mode_reproduced);
      expect(second.telemetry_assertion_results.map((r) => r.passed)).toEqual(
        first.telemetry_assertion_results.map((r) => r.passed),
      );
    });

    it('reproduces dark-criteria long-form fixture', async () => {
      const result = await runReplay(DARK_CRITERIA_FIXTURE_PATH);
      expect(result.pass).toBe(true);
      expect(result.failure_mode_reproduced).toBe(true);
      expect(result.telemetry_assertion_results.every((r) => r.passed)).toBe(true);
    });

    it('reproduces chunk materialization mismatch fixture', async () => {
      const result = await runReplay(CHUNK_MISMATCH_FIXTURE_PATH);
      expect(result.pass).toBe(true);
      expect(result.failure_mode_reproduced).toBe(true);
      expect(result.telemetry_assertion_results.every((r) => r.passed)).toBe(true);
    });
  });
});
