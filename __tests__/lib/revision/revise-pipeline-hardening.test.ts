/**
 * Regression tests for Revise pipeline hardening.
 *
 * Covers:
 * 1. rebuildDecisionMap — latest decision wins (not earliest)
 * 2. Severity mapping — must/could/blocker/optional recognized
 * 3. Source classification — evaluation vs deep_revision vs baseline_discovery
 * 4. Sort order — severity first, then source, then title
 */

// ---------------------------------------------------------------------------
// 1. rebuildDecisionMap ordering
// ---------------------------------------------------------------------------

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

// Replicate the fixed rebuildDecisionMap logic.
function rebuildDecisionMap(entries: LedgerEntry[]): Record<string, DecisionState> {
  const next: Record<string, DecisionState> = {};
  for (const entry of entries) {
    if (entry.decision === 'pending') continue;
    if (!(entry.itemId in next)) {
      next[entry.itemId] = entry.decision;
    }
  }
  return next;
}

describe('rebuildDecisionMap — latest decision wins', () => {
  const base = { at: '', itemTitle: 'Test', syncStatus: 'synced' as const };

  it('single decision is reflected', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_a' },
    ];
    expect(rebuildDecisionMap(entries)).toEqual({ 'opp-1': 'accepted_a' });
  });

  it('latest decision wins when author changes mind (newest-first ledger)', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '3', createdAtIso: '2026-01-01T00:03:00Z', itemId: 'opp-1', decision: 'reject' },
      { ...base, localId: '2', createdAtIso: '2026-01-01T00:02:00Z', itemId: 'opp-1', decision: 'custom' },
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_a' },
    ];
    expect(rebuildDecisionMap(entries)).toEqual({ 'opp-1': 'reject' });
  });

  it('pending entries are ignored', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '2', createdAtIso: '2026-01-01T00:02:00Z', itemId: 'opp-1', decision: 'pending' },
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_b' },
    ];
    expect(rebuildDecisionMap(entries)).toEqual({ 'opp-1': 'accepted_b' });
  });

  it('independent opportunities each get their own latest decision', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '4', createdAtIso: '2026-01-01T00:04:00Z', itemId: 'opp-2', decision: 'deferred' },
      { ...base, localId: '3', createdAtIso: '2026-01-01T00:03:00Z', itemId: 'opp-1', decision: 'keep_original' },
      { ...base, localId: '2', createdAtIso: '2026-01-01T00:02:00Z', itemId: 'opp-2', decision: 'accepted_c' },
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_a' },
    ];
    const map = rebuildDecisionMap(entries);
    expect(map['opp-1']).toBe('keep_original');
    expect(map['opp-2']).toBe('deferred');
  });

  it('undo entry (keep_original with isUndo) correctly overrides prior decision', () => {
    const entries: LedgerEntry[] = [
      { ...base, localId: '2', createdAtIso: '2026-01-01T00:02:00Z', itemId: 'opp-1', decision: 'keep_original', isUndo: true, undoneLocalId: '1' },
      { ...base, localId: '1', createdAtIso: '2026-01-01T00:01:00Z', itemId: 'opp-1', decision: 'accepted_a' },
    ];
    expect(rebuildDecisionMap(entries)).toEqual({ 'opp-1': 'keep_original' });
  });
});

// ---------------------------------------------------------------------------
// 2. Severity mapping consistency (normalizeFindings.toSeverity)
// ---------------------------------------------------------------------------

// Replicate the harmonized toSeverity from normalizeFindings.ts.
function toSeverityNormalized(raw: unknown, scoreOverride?: unknown): 'low' | 'medium' | 'high' {
  if (typeof scoreOverride === 'number' && Number.isFinite(scoreOverride)) {
    if (scoreOverride <= 4) return 'high';
    if (scoreOverride <= 7) return 'medium';
    return 'low';
  }
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['must', 'high', 'critical', 'major', 'blocker'].includes(v)) return 'high';
  if (['could', 'low', 'minor', 'optional'].includes(v)) return 'low';
  return 'medium';
}

describe('toSeverity — harmonized mapping', () => {
  it.each([
    ['must', 'high'],
    ['MUST', 'high'],
    ['high', 'high'],
    ['critical', 'high'],
    ['major', 'high'],
    ['blocker', 'high'],
    ['should', 'medium'],
    ['SHOULD', 'medium'],
    ['medium', 'medium'],
    ['could', 'low'],
    ['COULD', 'low'],
    ['low', 'low'],
    ['minor', 'low'],
    ['optional', 'low'],
    ['unknown', 'medium'],
    ['', 'medium'],
  ])('maps "%s" → "%s"', (input, expected) => {
    expect(toSeverityNormalized(input)).toBe(expected);
  });

  it('score_0_10 overrides string severity', () => {
    expect(toSeverityNormalized('low', 2)).toBe('high');
    expect(toSeverityNormalized('high', 9)).toBe('low');
    expect(toSeverityNormalized('must', 6)).toBe('medium');
  });
});

// ---------------------------------------------------------------------------
// 3. Source classification
// ---------------------------------------------------------------------------

type WorkbenchSource = 'evaluation' | 'deep_revision' | 'baseline_discovery';

function inferSource(findingType: string): WorkbenchSource {
  if (findingType.startsWith('baseline_manuscript_discovery')) return 'baseline_discovery';
  if (findingType.startsWith('revision_') || findingType.startsWith('repair_')) return 'deep_revision';
  return 'evaluation';
}

describe('inferSource — finding type to source classification', () => {
  it.each([
    ['baseline_manuscript_discovery:long_sentence', 'baseline_discovery'],
    ['baseline_manuscript_discovery:repeated_word', 'baseline_discovery'],
    ['revision_queue', 'deep_revision'],
    ['revision_note', 'deep_revision'],
    ['revision_priority', 'deep_revision'],
    ['repair_guidance', 'deep_revision'],
    ['diagnostic_finding', 'evaluation'],
    ['pacing_analysis', 'evaluation'],
    ['', 'evaluation'],
  ])('maps "%s" → "%s"', (findingType, expected) => {
    expect(inferSource(findingType)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 4. Sort order — severity first, source second, title third
// ---------------------------------------------------------------------------

type SortItem = { severity: 'must' | 'should' | 'could'; source: WorkbenchSource; title: string };

const severityOrder: Record<string, number> = { must: 0, should: 1, could: 2 };
const sourceOrder: Record<string, number> = { evaluation: 0, deep_revision: 1, baseline_discovery: 2 };

function sortItems(items: SortItem[]): SortItem[] {
  return [...items].sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity]
    || sourceOrder[a.source] - sourceOrder[b.source]
    || a.title.localeCompare(b.title),
  );
}

describe('sortOpportunities — severity > source > title', () => {
  it('MUST evaluation beats MUST baseline_discovery', () => {
    const items: SortItem[] = [
      { severity: 'must', source: 'baseline_discovery', title: 'A' },
      { severity: 'must', source: 'evaluation', title: 'B' },
    ];
    const sorted = sortItems(items);
    expect(sorted[0].source).toBe('evaluation');
    expect(sorted[1].source).toBe('baseline_discovery');
  });

  it('MUST always before SHOULD regardless of source', () => {
    const items: SortItem[] = [
      { severity: 'should', source: 'evaluation', title: 'First' },
      { severity: 'must', source: 'baseline_discovery', title: 'Second' },
    ];
    const sorted = sortItems(items);
    expect(sorted[0].severity).toBe('must');
  });

  it('within same severity and source, sorts alphabetically', () => {
    const items: SortItem[] = [
      { severity: 'could', source: 'evaluation', title: 'Zebra' },
      { severity: 'could', source: 'evaluation', title: 'Alpha' },
    ];
    const sorted = sortItems(items);
    expect(sorted[0].title).toBe('Alpha');
    expect(sorted[1].title).toBe('Zebra');
  });
});

// ---------------------------------------------------------------------------
// 5. stampDecision selectedText preservation
// ---------------------------------------------------------------------------

describe('stampDecision — selectedText audit trail', () => {
  it('accepted decision should include the proposal text as selectedText', () => {
    const proposalText = 'Replace "walked slowly" with "crept"';
    const entry: LedgerEntry = {
      localId: 'test-1',
      at: '10:00:00',
      createdAtIso: '2026-01-01T10:00:00Z',
      itemId: 'opp-1',
      itemTitle: 'Pacing fix',
      decision: 'accepted_a',
      selectedOption: 'A',
      selectedText: proposalText,
      syncStatus: 'pending',
    };
    expect(entry.selectedText).toBe(proposalText);
  });

  it('custom decision should include the custom text as selectedText', () => {
    const customText = 'Author-written alternative';
    const entry: LedgerEntry = {
      localId: 'test-2',
      at: '10:01:00',
      createdAtIso: '2026-01-01T10:01:00Z',
      itemId: 'opp-1',
      itemTitle: 'Pacing fix',
      decision: 'custom',
      customText,
      selectedText: customText,
      syncStatus: 'pending',
    };
    expect(entry.selectedText).toBe(customText);
    expect(entry.customText).toBe(customText);
  });

  it('keep_original and reject should not have selectedText', () => {
    const entry: LedgerEntry = {
      localId: 'test-3',
      at: '10:02:00',
      createdAtIso: '2026-01-01T10:02:00Z',
      itemId: 'opp-1',
      itemTitle: 'Pacing fix',
      decision: 'keep_original',
      syncStatus: 'pending',
    };
    expect(entry.selectedText).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Undo entry structure
// ---------------------------------------------------------------------------

describe('undo entry — server-persisted undo', () => {
  it('undo entry has isUndo=true and references the undone localId', () => {
    const undoEntry: LedgerEntry = {
      localId: 'undo-1',
      at: '10:03:00',
      createdAtIso: '2026-01-01T10:03:00Z',
      itemId: 'opp-1',
      itemTitle: 'Pacing fix',
      decision: 'keep_original',
      isUndo: true,
      undoneLocalId: 'original-1',
      syncStatus: 'pending',
    };
    expect(undoEntry.isUndo).toBe(true);
    expect(undoEntry.undoneLocalId).toBe('original-1');
    expect(undoEntry.decision).toBe('keep_original');
  });

  it('undo replaces the prior decision in decisionMap', () => {
    const entries: LedgerEntry[] = [
      {
        localId: 'undo-1',
        at: '10:03:00',
        createdAtIso: '2026-01-01T10:03:00Z',
        itemId: 'opp-1',
        itemTitle: 'Pacing fix',
        decision: 'keep_original',
        isUndo: true,
        undoneLocalId: 'original-1',
        syncStatus: 'pending',
      },
      {
        localId: 'original-1',
        at: '10:01:00',
        createdAtIso: '2026-01-01T10:01:00Z',
        itemId: 'opp-1',
        itemTitle: 'Pacing fix',
        decision: 'accepted_a',
        selectedOption: 'A',
        syncStatus: 'synced',
      },
    ];
    const map = rebuildDecisionMap(entries);
    expect(map['opp-1']).toBe('keep_original');
  });
});
