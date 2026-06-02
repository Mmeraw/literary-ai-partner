/**
 * Kick-Forward Architecture Tests
 *
 * Tests the degraded-pass philosophy:
 * - Corrupt artifacts always pass (with corruption measure)
 * - Missing required artifacts hard-stop
 * - Time-gated auto-unblock clears retryable blocks after threshold
 */

import { assessLedgerCorruption } from '@/lib/evaluation/review-gate/ledgerCorruptionAssessor';
import { shouldTimeGatedUnblock } from '@/lib/evaluation/phase-architecture-v2/phaseInputGuards';

describe('Ledger Corruption Assessor', () => {
  it('scores a pristine ledger at 0.0', () => {
    const layers: Record<string, unknown> = {};
    const layerNames = [
      'canonical_identity_layer',
      'cast_role_tier_layer',
      'identity_pronoun_layer',
      'location_timeline_worldstate_layer',
      'object_symbol_layer',
      'pov_structure_layer',
      'relationship_network_layer',
      'source_integrity_layer',
      'threat_antagonist_ending_layer',
    ];
    for (const name of layerNames) {
      layers[name] = {
        health: { status: 'healthy', truth_status: 'verified' },
        schema_version: '1',
        some_data: [1, 2, 3],
      };
    }

    const result = assessLedgerCorruption(layers);
    expect(result.corruption_score).toBe(0);
    expect(result.layers_healthy).toBe(9);
    expect(result.layers_present).toBe(9);
    expect(result.missing_layers).toHaveLength(0);
    expect(result.usable).toBe(true);
  });

  it('scores a fully missing ledger at 1.0', () => {
    const result = assessLedgerCorruption(null);
    expect(result.corruption_score).toBe(1);
    expect(result.layers_present).toBe(0);
    expect(result.usable).toBe(false);
    expect(result.missing_layers).toHaveLength(9);
  });

  it('marks ledger usable when 5+ layers present', () => {
    const layers: Record<string, unknown> = {
      canonical_identity_layer: { health: { status: 'degraded_but_usable', warning_codes: ['X'] }, data: {} },
      cast_role_tier_layer: { health: { status: 'degraded_but_usable', warning_codes: [] }, data: {} },
      identity_pronoun_layer: { health: { status: 'healthy' }, data: {} },
      pov_structure_layer: { health: { status: 'healthy' }, data: {} },
      object_symbol_layer: { health: { status: 'healthy' }, data: {} },
    };

    const result = assessLedgerCorruption(layers);
    expect(result.usable).toBe(true);
    expect(result.layers_present).toBe(5);
    expect(result.missing_layers).toContain('relationship_network_layer');
    expect(result.corruption_score).toBeGreaterThan(0);
    expect(result.corruption_score).toBeLessThan(1);
  });

  it('marks ledger unusable when fewer than 5 layers present', () => {
    const layers: Record<string, unknown> = {
      canonical_identity_layer: { health: { status: 'healthy' }, data: {} },
      cast_role_tier_layer: { health: { status: 'healthy' }, data: {} },
    };

    const result = assessLedgerCorruption(layers);
    expect(result.usable).toBe(false);
    expect(result.layers_present).toBe(2);
  });

  it('scores degraded_but_usable layers proportionally to warning count', () => {
    const makeLayer = (warningCount: number) => ({
      health: {
        status: 'degraded_but_usable',
        warning_codes: Array(warningCount).fill('WARN'),
      },
      schema_version: '1',
      data: [1, 2],
    });

    const layerNames = [
      'canonical_identity_layer',
      'cast_role_tier_layer',
      'identity_pronoun_layer',
      'location_timeline_worldstate_layer',
      'object_symbol_layer',
      'pov_structure_layer',
      'relationship_network_layer',
      'source_integrity_layer',
      'threat_antagonist_ending_layer',
    ];

    // Few warnings = lower corruption
    const fewWarnings: Record<string, unknown> = {};
    for (const name of layerNames) fewWarnings[name] = makeLayer(1);
    const resultFew = assessLedgerCorruption(fewWarnings);

    // Many warnings = higher corruption
    const manyWarnings: Record<string, unknown> = {};
    for (const name of layerNames) manyWarnings[name] = makeLayer(4);
    const resultMany = assessLedgerCorruption(manyWarnings);

    expect(resultMany.corruption_score).toBeGreaterThan(resultFew.corruption_score);
    expect(resultFew.usable).toBe(true);
    expect(resultMany.usable).toBe(true);
  });
});

describe('Time-Gated Auto-Unblock', () => {
  it('returns should_unblock=false when no block_code', () => {
    const result = shouldTimeGatedUnblock({});
    expect(result.should_unblock).toBe(false);
    expect(result.block_code).toBeNull();
  });

  it('returns should_unblock=false for non-retryable blocks', () => {
    const result = shouldTimeGatedUnblock({
      block_code: 'CONTENT_HARD_FAIL',
      phase1a_completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    });
    expect(result.should_unblock).toBe(false);
    expect(result.block_code).toBe('CONTENT_HARD_FAIL');
  });

  it('returns should_unblock=true when retryable block exceeds threshold', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = shouldTimeGatedUnblock({
      block_code: 'PASS3A_REDUCER_FAILED',
      phase1a_completed_at: thirtyMinAgo,
    });
    expect(result.should_unblock).toBe(true);
    expect(result.block_age_ms).toBeGreaterThan(10 * 60 * 1000);
  });

  it('returns should_unblock=false when retryable block is under threshold', () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const result = shouldTimeGatedUnblock({
      block_code: 'PASS3A_REDUCER_FAILED',
      phase1a_completed_at: twoMinAgo,
    });
    expect(result.should_unblock).toBe(false);
    expect(result.block_age_ms).toBeLessThan(10 * 60 * 1000);
  });

  it('uses phase_log timestamp over phase1a_completed_at', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const result = shouldTimeGatedUnblock({
      block_code: 'REVIEW_GATE_QUALITY_TECHNICAL_BLOCK',
      phase1a_completed_at: twentyMinAgo,
      phase_log: [
        { at: fiveMinAgo, event: 'review_gate_blocked' },
      ],
    });

    // Should use the phase_log timestamp (5 min) which is under threshold
    expect(result.should_unblock).toBe(false);
    expect(result.block_age_ms).toBeLessThan(10 * 60 * 1000);
  });

  it('respects custom threshold override', () => {
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const result = shouldTimeGatedUnblock(
      {
        block_code: 'PASS3A_NOT_READY',
        phase1a_completed_at: threeMinAgo,
      },
      2 * 60 * 1000, // 2 min threshold
    );
    expect(result.should_unblock).toBe(true);
  });

  it('handles REVIEW_GATE_TECHNICAL_KICK_FORWARD as retryable', () => {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const result = shouldTimeGatedUnblock({
      block_code: 'REVIEW_GATE_TECHNICAL_KICK_FORWARD',
      phase1a_completed_at: fifteenMinAgo,
    });
    expect(result.should_unblock).toBe(true);
  });
});
