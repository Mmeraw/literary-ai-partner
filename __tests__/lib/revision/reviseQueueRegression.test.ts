/**
 * Revise Queue & Ledger Regression Tests
 *
 * Targets the queue lifecycle gaps that existing stress/adversarial suites
 * do not cover:
 *
 *  1. Queue cap enforcement preserves severity order
 *  2. Short-form vs long-form cap thresholds
 *  3. Dedup severity promotion (keep "must" over "should" for same anchor)
 *  4. Decision ledger rapid decision changes (flicker)
 *  5. Decision sync failure resilience
 *  6. Multi-undo chains (undo, re-decide, undo again)
 *  7. Patch lifecycle: conflict detection on stale source
 *  8. Patch lifecycle: operation type correctness
 *  9. Queue extraction from longform multi-source payloads
 * 10. Cap trimming never drops "must" in favor of "could"
 * 11. Queue cap idempotency (running buildRevisionOpportunities twice yields same result)
 * 12. Empty recommendations array per criterion
 * 13. Unicode/special characters in anchor don't break dedup
 * 14. Score boundary: 4→"must", 5→"should", 7→"should", 8→"could"
 * 15. Queue capped opportunities include no undefined fields in required columns
 */

import {
  buildRevisionOpportunitiesFromEvaluationPayload,
  getReviseQueueMaxOpportunities,
  REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD,
  REVISE_QUEUE_MAX_SHORT_FORM,
  REVISE_QUEUE_MAX_LONG_FORM,
} from '@/lib/revision/opportunityLedger';
import {
  buildCandidatePatch,
  buildPatchPreview,
  applyPatchFromPreview,
  sha256,
} from '@/lib/revision/revisePatchLifecycle';

jest.mock('@/lib/revision/logRevisionEvent', () => ({
  logRevisionEvent: jest.fn(async () => undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRec(overrides: Record<string, unknown> = {}) {
  return {
    diagnosis: 'The passage stalls at the door without conveying internal hesitation.',
    recommendation: 'Add one beat of interiority that forces a visible decision the reader can witness.',
    anchor_snippet: `Unique anchor ${Math.random().toString(36).slice(2, 10)} for this recommendation.`,
    location_ref: 'chapter:3:paragraph:7',
    priority: 'high' as const,
    confidence: 0.85,
    symptom: 'The prose states action without sensory texture.',
    cause: 'The narrator reports hesitation in summary.',
    fix_direction: 'Replace summary with one embodied beat.',
    reader_effect: 'The reader feels the gravity of the choice.',
    mistake_proofing: 'Check revision has at least one physical sensation.',
    candidate_text_a: 'His hand hovered above the receiver. The plastic was cold, and his fingers warm enough to leave prints.',
    candidate_text_b: 'He counted to three, then again, and the silence between the numbers grew heavier each time.',
    candidate_text_c: 'The phone sat on the counter and he stood beside it, close enough to hear it breathe.',
    ...overrides,
  };
}

function makePayload(criteria: Array<{ key: string; score_0_10: number; recommendations: unknown[] }>) {
  return { criteria };
}

function makeManyRecommendations(count: number, scoreBase: number) {
  const recs = [];
  for (let i = 0; i < count; i++) {
    recs.push(makeRec({
      anchor_snippet: `Unique passage ${i}: She turned the corner and the light shifted in a way that marked the ${i}th change.`,
    }));
  }
  return recs;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. QUEUE CAP ENFORCEMENT
// ══════════════════════════════════════════════════════════════════════════════

describe('Queue Cap Enforcement', () => {
  it('short-form cap is 50', () => {
    expect(getReviseQueueMaxOpportunities(4903)).toBe(REVISE_QUEUE_MAX_SHORT_FORM);
    expect(REVISE_QUEUE_MAX_SHORT_FORM).toBe(50);
  });

  it('long-form cap is 100 at word threshold', () => {
    expect(getReviseQueueMaxOpportunities(REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD)).toBe(REVISE_QUEUE_MAX_LONG_FORM);
    expect(REVISE_QUEUE_MAX_LONG_FORM).toBe(100);
  });

  it('null/undefined/NaN word count defaults to short-form cap', () => {
    expect(getReviseQueueMaxOpportunities(null)).toBe(50);
    expect(getReviseQueueMaxOpportunities(undefined)).toBe(50);
    expect(getReviseQueueMaxOpportunities(NaN)).toBe(50);
  });

  it('word count just below threshold uses short-form', () => {
    expect(getReviseQueueMaxOpportunities(REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD - 1)).toBe(50);
  });

  it('cap trims to 50 when 80 recommendations exist (short-form)', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 3, recommendations: makeManyRecommendations(40, 3) },
      { key: 'narrative_drive', score_0_10: 4, recommendations: makeManyRecommendations(40, 4) },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload, undefined, undefined, { wordCount: 5000 });
    expect(opps.length).toBeLessThanOrEqual(50);
    expect(opps.length).toBeGreaterThan(0);
  });

  it('cap preserves severity order — "must" before "should" before "could"', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 2, recommendations: makeManyRecommendations(20, 2) },       // must
      { key: 'voice', score_0_10: 6, recommendations: makeManyRecommendations(20, 6) },        // should
      { key: 'marketability', score_0_10: 9, recommendations: makeManyRecommendations(20, 9) }, // could
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload, undefined, undefined, { wordCount: 5000 });
    // After cap, all "must" should appear before any "should", all "should" before "could"
    const severities = opps.map(o => o.severity);
    let lastMustIdx = -1;
    let firstShouldIdx = severities.length;
    let lastShouldIdx = -1;
    let firstCouldIdx = severities.length;
    severities.forEach((s, i) => {
      if (s === 'must') lastMustIdx = i;
      if (s === 'should' && i < firstShouldIdx) firstShouldIdx = i;
      if (s === 'should') lastShouldIdx = i;
      if (s === 'could' && i < firstCouldIdx) firstCouldIdx = i;
    });
    if (lastMustIdx >= 0 && firstShouldIdx < severities.length) {
      expect(lastMustIdx).toBeLessThan(firstShouldIdx);
    }
    if (lastShouldIdx >= 0 && firstCouldIdx < severities.length) {
      expect(lastShouldIdx).toBeLessThan(firstCouldIdx);
    }
  });

  it('cap never drops "must" in favor of "could" when under limit', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 2, recommendations: makeManyRecommendations(10, 2) },   // must
      { key: 'voice', score_0_10: 9, recommendations: makeManyRecommendations(60, 9) },    // could
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload, undefined, undefined, { wordCount: 5000 });
    // All "must" items should survive, "could" items may be trimmed
    const mustCount = opps.filter(o => o.severity === 'must').length;
    expect(mustCount).toBeGreaterThanOrEqual(1);
    // The first items in capped output should be "must"
    const firstSeverity = opps[0]?.severity;
    expect(firstSeverity).toBe('must');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. DEDUP SEVERITY PROMOTION
// ══════════════════════════════════════════════════════════════════════════════

describe('Dedup Severity Promotion', () => {
  it('same anchor + operation across criteria keeps highest severity', () => {
    const sharedAnchor = 'She opened the door and left without looking back.';
    const payload = makePayload([
      {
        key: 'pacing',
        score_0_10: 2,  // → "must"
        recommendations: [makeRec({ anchor_snippet: sharedAnchor })],
      },
      {
        key: 'voice',
        score_0_10: 8,  // → "could"
        recommendations: [makeRec({ anchor_snippet: sharedAnchor })],
      },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    // Should dedup to one opportunity with "must" severity (highest)
    const matching = opps.filter(o => o.evidence_anchor.includes('opened the door'));
    expect(matching.length).toBe(1);
    expect(matching[0].severity).toBe('must');
  });

  it('different anchors with same criterion are NOT deduped', () => {
    const payload = makePayload([
      {
        key: 'pacing',
        score_0_10: 3,
        recommendations: [
          makeRec({ anchor_snippet: 'First passage: The train arrived at noon.' }),
          makeRec({ anchor_snippet: 'Second passage: The station was empty by dusk.' }),
        ],
      },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opps.length).toBeGreaterThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. SCORE BOUNDARY SEVERITY MAPPING
// ══════════════════════════════════════════════════════════════════════════════

describe('Score→Severity Boundary Mapping', () => {
  it('score ≤ 4 → "must"', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 4, recommendations: [makeRec()] },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opps.length).toBeGreaterThanOrEqual(1);
    expect(opps[0].severity).toBe('must');
  });

  it('score 5 → "should"', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 5, recommendations: [makeRec()] },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opps.length).toBeGreaterThanOrEqual(1);
    expect(opps[0].severity).toBe('should');
  });

  it('score 7 → "should"', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 7, recommendations: [makeRec()] },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opps.length).toBeGreaterThanOrEqual(1);
    expect(opps[0].severity).toBe('should');
  });

  it('score 8 → "could"', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 8, recommendations: [makeRec()] },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opps.length).toBeGreaterThanOrEqual(1);
    expect(opps[0].severity).toBe('could');
  });

  it('score 0 → "must"', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 0, recommendations: [makeRec()] },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opps[0].severity).toBe('must');
  });

  it('score 10 → "could"', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 10, recommendations: [makeRec()] },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opps[0].severity).toBe('could');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. DECISION LEDGER — RAPID CHANGES & EDGE CASES
// ══════════════════════════════════════════════════════════════════════════════

type DecisionState =
  | 'pending'
  | 'accepted_a'
  | 'accepted_b'
  | 'accepted_c'
  | 'custom'
  | 'keep_original'
  | 'reject'
  | 'deferred';

type LedgerEntry = {
  localId: string;
  at: string;
  createdAtIso: string;
  itemId: string;
  itemTitle: string;
  decision: DecisionState;
  selectedOption?: 'A' | 'B' | 'C';
  customText?: string;
  selectedText?: string;
  isUndo?: boolean;
  undoneLocalId?: string;
  syncStatus: 'pending' | 'synced' | 'failed';
};

// Canonical rebuildDecisionMap (newest-first ledger, undo-aware)
function rebuildDecisionMap(entries: LedgerEntry[]): Record<string, DecisionState> {
  const undoneIds = new Set<string>();
  for (const entry of entries) {
    if (entry.isUndo && entry.undoneLocalId) {
      undoneIds.add(entry.undoneLocalId);
    }
  }
  const next: Record<string, DecisionState> = {};
  for (const entry of entries) {
    if (entry.decision === 'pending') continue;
    if (entry.isUndo) continue;
    if (undoneIds.has(entry.localId)) continue;
    if (!(entry.itemId in next)) {
      next[entry.itemId] = entry.decision;
    }
  }
  return next;
}

describe('Decision Ledger — Rapid Changes & Edge Cases', () => {
  const base = { at: '', itemTitle: 'Test', syncStatus: 'synced' as const };

  it('rapid decision flicker (5 changes) resolves to newest', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '5', createdAtIso: '2026-01-01T00:05:00Z', itemId: 'opp-1', decision: 'custom', customText: 'Final custom text' },
      { ...base, localId: '4', createdAtIso: '2026-01-01T00:04:00Z', itemId: 'opp-1', decision: 'accepted_c' },
      { ...base, localId: '3', createdAtIso: '2026-01-01T00:03:00Z', itemId: 'opp-1', decision: 'keep_original' },
      { ...base, localId: '2', createdAtIso: '2026-01-01T00:02:00Z', itemId: 'opp-1', decision: 'accepted_b' },
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_a' },
    ];
    expect(rebuildDecisionMap(entries)).toEqual({ 'opp-1': 'custom' });
  });

  it('multi-undo chain: undo → re-decide → undo again leaves no decision', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '4', createdAtIso: '2026-01-01T00:04:00Z', itemId: 'opp-1', decision: 'keep_original', isUndo: true, undoneLocalId: '3' },
      { ...base, localId: '3', createdAtIso: '2026-01-01T00:03:00Z', itemId: 'opp-1', decision: 'accepted_b' },
      { ...base, localId: '2', createdAtIso: '2026-01-01T00:02:00Z', itemId: 'opp-1', decision: 'keep_original', isUndo: true, undoneLocalId: '1' },
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_a' },
    ];
    // Entry 1 is undone by entry 2, entry 3 is undone by entry 4
    // No surviving decisions
    expect(rebuildDecisionMap(entries)).toEqual({});
  });

  it('sync failure does not affect decision map (syncStatus is orthogonal)', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '2', createdAtIso: '2026-01-01T00:02:00Z', itemId: 'opp-1', decision: 'accepted_b', syncStatus: 'failed' },
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_a', syncStatus: 'synced' },
    ];
    // Even though entry 2 failed sync, it's still the latest decision
    expect(rebuildDecisionMap(entries)).toEqual({ 'opp-1': 'accepted_b' });
  });

  it('deferred decision is a valid terminal state', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'deferred' },
    ];
    expect(rebuildDecisionMap(entries)).toEqual({ 'opp-1': 'deferred' });
  });

  it('10+ opportunities each with independent decisions', () => {
    const entries: LedgerEntry[] = [];
    for (let i = 1; i <= 10; i++) {
      entries.push({
        ...base,
        localId: `${i}`,
        createdAtIso: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`,
        itemId: `opp-${i}`,
        decision: i % 2 === 0 ? 'accepted_a' : 'reject',
      });
    }
    const map = rebuildDecisionMap(entries);
    expect(Object.keys(map)).toHaveLength(10);
    expect(map['opp-2']).toBe('accepted_a');
    expect(map['opp-3']).toBe('reject');
  });

  it('undoing non-existent localId is harmless', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '2', createdAtIso: '2026-01-01T00:02:00Z', itemId: 'opp-1', decision: 'keep_original', isUndo: true, undoneLocalId: 'ghost-999' },
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_a' },
    ];
    // Undo entry is skipped (isUndo=true), ghost-999 doesn't match entry 1 → accepted_a survives
    expect(rebuildDecisionMap(entries)).toEqual({ 'opp-1': 'accepted_a' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. PATCH LIFECYCLE REGRESSION
// ══════════════════════════════════════════════════════════════════════════════

describe('Patch Lifecycle — Conflict & Operation Correctness', () => {
  it('detects stale source text after external edit', () => {
    const patch = buildCandidatePatch({
      reviseQueueItemId: 'opp-conflict-1',
      selectedSource: 'A',
      revisionOperation: 'replace_selected_passage',
      sourceTextSnapshot: 'Original text before edit.',
      sourceLocation: { chapter_index: 1, paragraph_index: 1 },
      baseManuscriptVersionId: 'mv-100',
      patchText: 'Mara stepped through the doorway without looking back.',
    });
    const preview = buildPatchPreview(patch, '2026-06-01T00:00:00.000Z');

    const result = applyPatchFromPreview({
      preview,
      decisionStatus: 'accepted_a',
      applicationStatus: 'previewed',
      currentSourceText: 'Text was changed externally by author.',
      currentSourceTextHash: sha256('Text was changed externally by author.'),
      requestedAt: '2026-06-01T00:05:00.000Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.applicationStatus).toBe('conflict_detected');
    }
  });

  it('applies cleanly when source text is unchanged', () => {
    const sourceText = 'The hallway was empty and cold.';
    const patch = buildCandidatePatch({
      reviseQueueItemId: 'opp-clean-1',
      selectedSource: 'B',
      revisionOperation: 'replace_selected_passage',
      sourceTextSnapshot: sourceText,
      sourceLocation: { chapter_index: 3, paragraph_index: 2 },
      baseManuscriptVersionId: 'mv-200',
      patchText: 'The hallway breathed frost. Ice had claimed the baseboards overnight.',
    });
    const preview = buildPatchPreview(patch, '2026-06-01T00:00:00.000Z');

    const result = applyPatchFromPreview({
      preview,
      decisionStatus: 'accepted_b',
      applicationStatus: 'previewed',
      currentSourceText: sourceText,
      currentSourceTextHash: sha256(sourceText),
      requestedAt: '2026-06-01T00:03:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appliedPatchRecord.selected_source).toBe('B');
      expect(result.appliedPatchRecord.revision_operation).toBe('replace_selected_passage');
      expect(result.manuscriptVersionAfter).not.toBe(result.manuscriptVersionBefore);
    }
  });

  it('insert_after_selected_passage preserves operation type through lifecycle', () => {
    const sourceText = 'She stood in the doorway.';
    const patch = buildCandidatePatch({
      reviseQueueItemId: 'opp-insert-1',
      selectedSource: 'C',
      revisionOperation: 'insert_after_selected_passage',
      sourceTextSnapshot: sourceText,
      sourceLocation: { chapter_index: 2, paragraph_index: 8 },
      baseManuscriptVersionId: 'mv-300',
      patchText: 'The air moved past her in a warm rush, carrying jasmine from the garden she no longer owned.',
    });
    expect(patch.revisionOperation).toBe('insert_after_selected_passage');
    const preview = buildPatchPreview(patch, '2026-06-01T00:00:00.000Z');

    const result = applyPatchFromPreview({
      preview,
      decisionStatus: 'accepted_c',
      applicationStatus: 'previewed',
      currentSourceText: sourceText,
      currentSourceTextHash: sha256(sourceText),
      requestedAt: '2026-06-01T00:02:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appliedPatchRecord.revision_operation).toBe('insert_after_selected_passage');
    }
  });

  it('sha256 is deterministic for same input', () => {
    const text = 'Deterministic hash test.';
    expect(sha256(text)).toBe(sha256(text));
    expect(sha256(text)).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. QUEUE EXTRACTION IDEMPOTENCY & UNICODE
// ══════════════════════════════════════════════════════════════════════════════

describe('Queue Extraction — Idempotency & Unicode', () => {
  it('buildRevisionOpportunities is idempotent (same payload → same count)', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 5, recommendations: makeManyRecommendations(10, 5) },
      { key: 'voice', score_0_10: 6, recommendations: makeManyRecommendations(10, 6) },
    ]);
    const first = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    const second = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(first.length).toBe(second.length);
    // Same opportunity IDs in same order
    expect(first.map(o => o.opportunity_id)).toEqual(second.map(o => o.opportunity_id));
  });

  it('unicode in anchor does not break dedup', () => {
    const unicodeAnchor = 'She whispered "こんにちは" and the room shifted beneath her feet—';
    const payload = makePayload([
      {
        key: 'pacing',
        score_0_10: 3,
        recommendations: [makeRec({ anchor_snippet: unicodeAnchor })],
      },
      {
        key: 'voice',
        score_0_10: 4,
        recommendations: [makeRec({ anchor_snippet: unicodeAnchor })],
      },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    // Same anchor → should dedup to 1
    const matching = opps.filter(o => o.evidence_anchor.includes('こんにちは'));
    expect(matching.length).toBe(1);
  });

  it('empty recommendations array per criterion produces no opportunities', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 3, recommendations: [] },
      { key: 'voice', score_0_10: 4, recommendations: [] },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opps).toEqual([]);
  });

  it('capped opportunities include no undefined required fields', () => {
    const payload = makePayload([
      { key: 'pacing', score_0_10: 4, recommendations: makeManyRecommendations(60, 4) },
    ]);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload, undefined, undefined, { wordCount: 5000 });
    for (const opp of opps) {
      expect(opp.opportunity_id).toBeDefined();
      expect(opp.criterion).toBeDefined();
      expect(opp.severity).toBeDefined();
      expect(opp.rationale).toBeDefined();
      expect(opp.evidence_anchor).toBeDefined();
      expect(opp.decision_state).toBe('open');
      expect(typeof opp.evidence_anchor).toBe('string');
      expect(opp.evidence_anchor.length).toBeGreaterThan(5);
    }
  });
});
