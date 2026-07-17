/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn(), forward: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/workbench-v2',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import ReviseCockpitClientWorkflowV2 from '@/components/revision/ReviseCockpitClientWorkflowV2';
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from '@/lib/revision/workbenchQueue';
import { buildClassifiedWorkbenchOpportunity, classifyWorkbenchExecutabilityDetailed } from '@/lib/revision/workbenchQueueProjection';
import type { ClassifiedWorkbenchOpportunity } from '@/lib/revision/workbenchQueueProjection';

function classify(opp: WorkbenchOpportunity): ClassifiedWorkbenchOpportunity {
  return buildClassifiedWorkbenchOpportunity(opp, classifyWorkbenchExecutabilityDetailed(opp));
}

// Build a classified opportunity directly with an explicit finalDecision, so
// smoke tests are independent of the admission-gate internals.
function makeClassified(
  overrides: Partial<WorkbenchOpportunity> = {},
  finalCardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld' = 'copy_paste_rewrite',
): ClassifiedWorkbenchOpportunity {
  const opp = makeOpportunity(overrides);
  const decision = {
    cardType: finalCardType,
    trustedPathStatus: (finalCardType === 'copy_paste_rewrite'
      ? 'eligible'
      : finalCardType === 'revision_strategy'
        ? 'unavailable_author_review_required'
        : 'impossible') as 'eligible' | 'unavailable_author_review_required' | 'impossible',
    reasons: [`smoke_${finalCardType}`] as readonly string[],
  } as any;
  const stub = { ...classifyWorkbenchExecutabilityDetailed(makeOpportunity()), finalDecision: decision, baseDecision: decision, cardType: finalCardType, trustedPathStatus: decision.trustedPathStatus, reasons: decision.reasons } as any;
  return buildClassifiedWorkbenchOpportunity({ ...opp, cardType: finalCardType, trustedPathStatus: decision.trustedPathStatus }, stub);
}

const CANDIDATE_A = 'Mara stepped back into the room, and everyone waited for her to speak.';
const CANDIDATE_B = 'The room stilled as everyone turned toward the doorway where Mara stood.';
const CANDIDATE_C = 'She crossed the room slowly, aware that everyone was watching her every move.';

function makeOpportunity(overrides: Partial<WorkbenchOpportunity> = {}): WorkbenchOpportunity {
  return {
    id: 'ready-1',
    severity: 'should',
    scope: 'Passage',
    mode: 'direct-rewrite',
    source: 'evaluation',
    criterion: 'Pacing',
    leverage: 'Pacing',
    crumb: 'Pacing · chapter:3',
    title: 'Bridge abrupt transition',
    issueStatement: 'The scene transition lands abruptly and needs one bridging beat.',
    meta: 'Pacing · chapter:3',
    confidence: 'high confidence',
    anchor: 'chapter:3',
    quoteHighlight: 'Mara shut the door. Everyone in the room went quiet.',
    quoteRest: '',
    symptom: 'The cut skips over the emotional turn.',
    cause: 'Missing transitional beat.',
    fixDirection: 'Add one grounded bridge before the time jump.',
    readerEffect: 'Keeps the reader oriented through the transition.',
    mistakeProofing: 'Preserve the original event order.',
    diagnostic: {
      symptom: 'The cut skips over the emotional turn.',
      cause: 'Missing transitional beat.',
      fixStrategy: 'Add one grounded bridge before the time jump.',
      readerImpact: 'Keeps the reader oriented through the transition.',
      evidence: { quotedExcerpt: 'Mara shut the door. Everyone in the room went quiet.', locationLabel: 'chapter:3' },
      operationTargeting: 'replace_selected_passage · chapter:3',
      mistakeProofing: 'Preserve the original event order.',
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: 'Candidate prose is source anchored.',
    evidenceLocationScope: 'Passage',
    repairScope: 'Passage',
    groundingStatus: 'supported',
    contextQuality: 'clean',
    preflightStatus: 'passed',
    cardType: 'copy_paste_rewrite',
    trustedPathStatus: 'eligible',
    options: [
      { key: 'A', mechanism: 'Recommended repair', candidateText: CANDIDATE_A, text: CANDIDATE_A, rationale: 'Adds a minimal emotional bridge.' },
      { key: 'B', mechanism: 'Rhythm variant', candidateText: CANDIDATE_B, text: CANDIDATE_B, rationale: 'Keeps the original rhythm.' },
      { key: 'C', mechanism: 'Bolder rendering shift', candidateText: CANDIDATE_C, text: CANDIDATE_C, rationale: 'Adds a stronger emotional image.' },
    ],
    ...overrides,
  } as WorkbenchOpportunity;
}

function makePayload(overrides: Partial<WorkbenchQueuePayload> = {}): WorkbenchQueuePayload {
  return {
    ok: true,
    error: null,
    manuscriptId: '6074',
    evaluationJobId: 'e5ced7ac-117f-4d13-8cd0-3957c15dc189',
    manuscriptTitle: 'Cartel Babies',
    opportunities: [makeClassified()],
    needsTargeting: [],
    withheldUnsupported: [],
    readinessTotals: { ready_for_revise: 1, needs_targeting: 0, withheld_unsupported: 0 },
    totals: { must: 0, should: 1, could: 0 },
    scopes: { Line: 0, Passage: 1, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    criteria: { Pacing: 1 },
    synthesis: { admitted: 1, clustered: 0, held: 0, suppressed: 0 },
    modeContract: null,
    ...overrides,
  };
}

describe('ReviseCockpitClientWorkflowV2', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    window.prompt = jest.fn().mockReturnValue('Author-authored revision plan.');
  });

  afterEach(() => jest.clearAllMocks());

  it('renders mandatory A/B/C copy-paste candidates verbatim with Accept actions', () => {
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);

    expect(screen.getByText(CANDIDATE_A)).toBeTruthy();
    expect(screen.getByText(CANDIDATE_B)).toBeTruthy();
    expect(screen.getByText(CANDIDATE_C)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept B' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept C' })).toBeTruthy();
  });

  it('persists an accepted candidate through the revision ledger endpoint', async () => {
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept A' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/revision-ledger', expect.objectContaining({ method: 'POST' }));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toContain('accepted_a');
    expect(init.body).toContain(CANDIDATE_A);
    expect(init.body).toContain('workflow-revise-cockpit-v2');
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved:'));
  });

  it('offers a retry action when ledger sync fails and clears it after success', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept A' }));

    const retry = await screen.findByRole('button', { name: /Retry: Bridge abrupt transition/i });
    expect(screen.getByRole('status').textContent).toContain('Save failed:');
    fireEvent.click(retry);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Retry:/i })).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Saved:');
  });

  it('distinguishes a filtered queue from a genuinely empty queue', () => {
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);

    fireEvent.change(screen.getByLabelText('Search opportunities'), { target: { value: 'not-present' } });

    expect(screen.getByText(/No open opportunities match the current search and priority filters/i)).toBeTruthy();
    expect(screen.queryByText(/No revision opportunities were found/i)).toBeNull();
  });

  it('exposes accessible queue navigation and status regions', () => {
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);

    expect(screen.getByLabelText('Revision opportunity navigation')).toBeTruthy();
    expect(screen.getByLabelText('Active revision workspace')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Active \(1\)/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('renders strategy cards without A/B/C or Accept controls', () => {
    const strategy = makeClassified({
      id: 'strategy-1',
      options: [],
    }, 'revision_strategy');
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload({ opportunities: [], needsTargeting: [strategy] })} />);

    expect(screen.getByTestId('revision-strategy-surface')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Custom Plan / Notes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept [ABC]/ })).toBeNull();
    expect(screen.queryByText(/A —|B —|C —/)).toBeNull();
  });

  it('keeps withheld cards out of the active queue and shows them in Held Items Summary', () => {
    const withheld = makeClassified({
      id: 'withheld-1',
      executabilityReasons: ['canon_unclear'],
      options: [],
    }, 'withheld');
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload({ opportunities: [], needsTargeting: [withheld], withheldUnsupported: [] })} />);

    expect(screen.getByText(/Held Items Summary/i)).toBeTruthy();
    expect(screen.getByTestId('withheld-summary')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept [ABC]/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate/i })).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Contradictory-field authority tests
  // UI must follow finalDecision.cardType, not the mirrored raw cardType field.
  // -------------------------------------------------------------------------

  it('UI authority: copy_paste item with stale raw cardType=withheld is interactive', () => {
    const stale = {
      ...makeClassified({ id: 'stale-cp' }, 'copy_paste_rewrite'),
      cardType: 'withheld' as const,          // stale mirrored field
    };
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload({ opportunities: [stale] })} />);

    // The item must appear in the interactive queue, not the held panel.
    expect(screen.queryByText(/Held Items Summary/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Active \(1\)/i })).toBeTruthy();
  });

  it('UI authority: withheld item with stale raw cardType=revision_strategy is NOT interactive', () => {
    const stale = {
      ...makeClassified({ id: 'stale-wh' }, 'withheld'),
      cardType: 'revision_strategy' as const,  // stale mirrored field
    };
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload({ opportunities: [], withheldUnsupported: [stale] })} />);

    // The item must appear in held, not in the active interactive queue.
    expect(screen.getByText(/Held Items Summary/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept A/i })).toBeNull();
  });

  it('UI authority: ledger metadata records finalDecision.cardType, not mirrored cardType', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    const stale = {
      ...makeClassified({ id: 'metadata-test' }, 'copy_paste_rewrite'),
      cardType: 'revision_strategy' as const,  // stale mirrored field
    };

    render(<ReviseCockpitClientWorkflowV2 payload={makePayload({ opportunities: [stale] })} />);
    fireEvent.click(screen.getByRole('button', { name: /Accept A/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.entries[0].metadata.cardType).toBe('copy_paste_rewrite');
    });

    (global.fetch as jest.Mock).mockRestore?.();
  });
});
