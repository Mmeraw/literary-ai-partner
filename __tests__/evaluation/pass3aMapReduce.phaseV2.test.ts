import { derivePass3aReduceReadiness } from '../../lib/evaluation/phase-architecture-v2/pass3aMapReduce';

describe('Phase Architecture v2 — Pass 3A MAP/REDUCE readiness', () => {
  it('blocks REDUCE without expected MAP chunk count', () => {
    const result = derivePass3aReduceReadiness({ completed_map_chunks: 0 });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PASS3A_MAP_EXPECTED_COUNT_MISSING');
    expect(result.reduce_status).toBe('blocked');
  });

  it('blocks REDUCE when a MAP chunk failed', () => {
    const result = derivePass3aReduceReadiness({
      expected_map_chunks: 10,
      completed_map_chunks: 9,
      failed_map_chunks: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PASS3A_MAP_FAILED_BLOCKING');
    expect(result.reduce_status).toBe('blocked');
  });

  it('waits when MAP chunks are incomplete', () => {
    const result = derivePass3aReduceReadiness({
      expected_map_chunks: 10,
      completed_map_chunks: 9,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PASS3A_MAP_INCOMPLETE');
    expect(result.reduce_status).toBe('waiting');
  });

  it('blocks impossible MAP count overflow', () => {
    const result = derivePass3aReduceReadiness({
      expected_map_chunks: 10,
      completed_map_chunks: 11,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PASS3A_MAP_COUNT_OVERFLOW');
    expect(result.reduce_status).toBe('blocked');
  });

  it('allows REDUCE only when all expected MAP chunks are complete', () => {
    const result = derivePass3aReduceReadiness({
      expected_map_chunks: 10,
      completed_map_chunks: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('PASS3A_REDUCE_READY');
    expect(result.reduce_status).toBe('ready');
  });
});
