/**
 * Chunk Bridge — Rolling Summary Context for Phase 1A
 *
 * Provides semantic continuity between chunks during Phase 1A extraction.
 * After each chunk is processed, a brief "what just happened" summary is
 * generated and prepended to subsequent chunk prompts.
 *
 * This prevents:
 *   - Scoring blindness (chunk 45 doesn't know Billy died in chunk 38)
 *   - Evidence clustering (scorer can reference late-book events because
 *     it knows what happened before)
 *   - Context loss at chunk boundaries (more than raw text overlap provides)
 *
 * Architecture:
 *   - After processing chunk N, extract key events from the chunk output
 *   - Build a compressed rolling summary of all prior chunks
 *   - Prepend to chunk N+1's prompt as "PRIOR CONTEXT"
 *   - Cap at ~1500 tokens to avoid bloating each chunk call
 */

import type { Pass1aChunkOutput } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export type ChunkSummaryEntry = {
  chunk_index: number;
  summary: string;
};

export type ChunkBridgeState = {
  summaries: ChunkSummaryEntry[];
};

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters for the rolling bridge context block */
const MAX_BRIDGE_CHARS = 4000;

/** Maximum number of prior chunk summaries to include */
const MAX_PRIOR_SUMMARIES = 20;

/** Target characters per chunk summary */
const TARGET_SUMMARY_CHARS = 200;

// ── Summary Extraction ───────────────────────────────────────────────────────

/**
 * Extract a brief summary from a completed Pass 1A chunk output.
 * Uses character appearances, key events, and object mentions to
 * build a compressed "what happened in this chunk" description.
 */
export function extractChunkSummary(
  chunkIndex: number,
  chunkOutput: Pass1aChunkOutput,
): ChunkSummaryEntry {
  const parts: string[] = [];

  // Characters present in this chunk
  const characters = chunkOutput.characters ?? [];
  if (characters.length > 0) {
    const charNames = characters
      .slice(0, 6)
      .map((c) => c.canonical_name || 'unnamed')
      .filter((name) => name !== 'unnamed');
    if (charNames.length > 0) {
      parts.push(`Characters: ${charNames.join(', ')}`);
    }

    // Key events from evidence anchors
    const anchors: string[] = [];
    for (const char of characters.slice(0, 4)) {
      if (Array.isArray(char.evidence_anchors)) {
        for (const anchor of char.evidence_anchors.slice(0, 2)) {
          const text = typeof anchor === 'object' && anchor !== null && 'excerpt' in anchor
            ? String((anchor as Record<string, unknown>).excerpt)
            : '';
          if (text && text.length > 10) {
            anchors.push(text.slice(0, 80));
          }
        }
      }
    }
    if (anchors.length > 0) {
      parts.push(`Events: ${anchors.slice(0, 3).join('; ')}`);
    }

    // Symbolic objects from characters
    const allObjects: string[] = [];
    for (const char of characters.slice(0, 6)) {
      if (Array.isArray(char.symbolic_objects)) {
        for (const obj of char.symbolic_objects.slice(0, 2)) {
          const name = typeof obj === 'string' ? obj : (obj as Record<string, unknown>)?.name;
          if (typeof name === 'string' && name.length > 0 && !allObjects.includes(name)) {
            allObjects.push(name);
          }
        }
      }
    }
    if (allObjects.length > 0) {
      parts.push(`Objects: ${allObjects.slice(0, 4).join(', ')}`);
    }
  }

  const summary = parts.join('. ').slice(0, TARGET_SUMMARY_CHARS) || `Chunk ${chunkIndex} processed`;

  return { chunk_index: chunkIndex, summary };
}

// ── Bridge Builder ───────────────────────────────────────────────────────────

/**
 * Build the rolling prior context block for a given chunk index.
 * Returns the text to prepend to the chunk's prompt.
 */
export function buildChunkBridgeContext(state: ChunkBridgeState, currentChunkIndex: number): string {
  if (state.summaries.length === 0) return '';

  // Only include summaries for chunks BEFORE the current one
  const priorSummaries = state.summaries
    .filter((s) => s.chunk_index < currentChunkIndex)
    .sort((a, b) => a.chunk_index - b.chunk_index);

  if (priorSummaries.length === 0) return '';

  const lines: string[] = [];
  lines.push('── PRIOR CONTEXT (what happened in earlier sections) ──');
  lines.push('');

  // If too many summaries, keep the most recent ones + first few for opening context
  let selected: ChunkSummaryEntry[];
  if (priorSummaries.length <= MAX_PRIOR_SUMMARIES) {
    selected = priorSummaries;
  } else {
    // Keep first 3 (opening context) + last N (recent context)
    const opening = priorSummaries.slice(0, 3);
    const recent = priorSummaries.slice(-(MAX_PRIOR_SUMMARIES - 4));
    selected = [...opening, { chunk_index: -1, summary: '...' }, ...recent];
  }

  for (const entry of selected) {
    if (entry.chunk_index === -1) {
      lines.push('  [earlier sections omitted for brevity]');
    } else {
      lines.push(`  [Section ${entry.chunk_index + 1}]: ${entry.summary}`);
    }
  }

  // Enforce character limit
  let block = lines.join('\n');
  if (block.length > MAX_BRIDGE_CHARS) {
    block = block.slice(0, MAX_BRIDGE_CHARS - 50) + '\n  [...truncated for token budget]';
  }

  return block;
}

/**
 * Create an empty bridge state.
 */
export function createChunkBridgeState(): ChunkBridgeState {
  return { summaries: [] };
}

/**
 * Add a chunk summary to the bridge state (mutates in place for performance).
 */
export function addChunkToBridge(state: ChunkBridgeState, entry: ChunkSummaryEntry): void {
  state.summaries.push(entry);
}
