import type {
  DiffSummary,
  GovernanceContext,
  GovernanceResult,
  ProtectedSpan,
  RemovedRange,
  WaveId,
} from './types';

/**
 * Checks if any removed range overlaps with a protected span.
 */
export function violatesProtectedSpans(
  removedRanges: RemovedRange[],
  protectedSpans: ProtectedSpan[]
): boolean {
  return removedRanges.some((rem) =>
    protectedSpans.some((ps) => rem.start < ps.end && rem.end > ps.start)
  );
}

/**
 * Destruction Guard: blocks patches that remove too much text
 * or alter protected spans (character identity, class signal, tonal anchors).
 */
export function passesDestructionGuards(
  diff: DiffSummary,
  removedRanges: RemovedRange[],
  protectedSpans: ProtectedSpan[],
  maxRemovalPercent = 0.1
): { ok: boolean; reason?: string; detail?: string } {
  if (diff.charsOriginal <= 0) {
    return { ok: false, reason: 'DESTRUCTION_LIMIT_BLOCK', detail: 'Original text length is zero or invalid.' };
  }

  const removedFraction = diff.charsRemoved / diff.charsOriginal;
  if (removedFraction > maxRemovalPercent) {
    return {
      ok: false,
      reason: 'DESTRUCTION_LIMIT_BLOCK',
      detail: `Removal ${Math.round(removedFraction * 100)}% exceeds ${Math.round(maxRemovalPercent * 100)}%.`,
    };
  }

  if (violatesProtectedSpans(removedRanges, protectedSpans)) {
    return {
      ok: false,
      reason: 'DESTRUCTION_LIMIT_BLOCK',
      detail: 'Patch alters one or more protected spans.',
    };
  }

  return { ok: true };
}

/** @deprecated Use passesDestructionGuards. Alias kept for pipeline compat. */
export { passesDestructionGuards as checkDestructionGuards };
/**
 * Pipeline compatibility stub for run-revision-pipeline.ts.
 *
 * NOTE:
 * - This adapter preserves the API expected by current pipeline callers.
 * - It is intentionally permissive until the pipeline is fully wired to produce
 *   the diff/protected-span inputs required by passesDestructionGuards().
 */
export function checkDestructionGuards(
  _ctx: GovernanceContext,
  _waveId: WaveId
): GovernanceResult {
  return {
    pass: true,
    reason: 'Destruction guard compatibility stub — always passes until wired',
  };
}
