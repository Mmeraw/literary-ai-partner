export type Pass3aMapReduceProgress = {
  expected_map_chunks?: number;
  completed_map_chunks?: number;
  failed_map_chunks?: number;
  map_status?: 'not_started' | 'running' | 'done' | 'failed';
  reduce_status?: 'not_started' | 'waiting' | 'ready' | 'running' | 'done' | 'failed' | 'skipped';
};

export type Pass3aReduceReadiness = {
  ok: boolean;
  code: string;
  reason: string;
  reduce_status: 'waiting' | 'ready' | 'blocked';
};

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

export function derivePass3aReduceReadiness(
  progress: Pass3aMapReduceProgress = {},
): Pass3aReduceReadiness {
  const expected = progress.expected_map_chunks;
  const completed = progress.completed_map_chunks ?? 0;
  const failed = progress.failed_map_chunks ?? 0;

  if (!isPositiveInteger(expected)) {
    return {
      ok: false,
      code: 'PASS3A_MAP_EXPECTED_COUNT_MISSING',
      reason: 'Pass 3A REDUCE requires a positive expected MAP chunk count.',
      reduce_status: 'blocked',
    };
  }

  if (failed > 0 || progress.map_status === 'failed') {
    return {
      ok: false,
      code: 'PASS3A_MAP_FAILED_BLOCKING',
      reason: 'Pass 3A REDUCE cannot run because one or more MAP chunks failed.',
      reduce_status: 'blocked',
    };
  }

  if (completed < expected) {
    return {
      ok: false,
      code: 'PASS3A_MAP_INCOMPLETE',
      reason: `Pass 3A REDUCE is waiting for MAP completion: ${completed}/${expected} chunks complete.`,
      reduce_status: 'waiting',
    };
  }

  if (completed > expected) {
    return {
      ok: false,
      code: 'PASS3A_MAP_COUNT_OVERFLOW',
      reason: `Pass 3A MAP completion count exceeds expected count: ${completed}/${expected}.`,
      reduce_status: 'blocked',
    };
  }

  return {
    ok: true,
    code: 'PASS3A_REDUCE_READY',
    reason: 'All Pass 3A MAP chunks are complete; REDUCE may start.',
    reduce_status: 'ready',
  };
}
