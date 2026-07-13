/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';

import ReviseCockpitClientWorkflowV2 from '@/components/revision/ReviseCockpitClientWorkflowV2';
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from '@/lib/revision/workbenchQueue';

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
    opportunities: [makeOpportunity()],
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
  });

  it('renders strategy cards without A/B/C or Accept controls', () => {
    const strategy = makeOpportunity({
      id: 'strategy-1',
      cardType: 'revision_strategy',
      trustedPathStatus: 'unavailable_author_review_required',
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      options: [],
    });
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload({ opportunities: [], needsTargeting: [strategy] })} />);

    expect(screen.getByTestId('revision-strategy-surface')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Custom Plan / Notes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept [ABC]/ })).toBeNull();
    expect(screen.queryByText(/A —|B —|C —/)).toBeNull();
  });

  it('keeps withheld cards out of the active queue and shows them in Held Items Summary', () => {
    const withheld = makeOpportunity({
      id: 'withheld-1',
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      readiness: 'needs_targeting',
      groundingStatus: 'unsupported_blocked',
      contextQuality: 'blocked',
      preflightStatus: 'blocked',
      executabilityReasons: ['canon_unclear'],
      options: [],
    });
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload({ opportunities: [], needsTargeting: [withheld], withheldUnsupported: [] })} />);

    expect(screen.getByText(/Held Items Summary/i)).toBeTruthy();
    expect(screen.getByTestId('withheld-summary')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept [ABC]/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate/i })).toBeNull();
  });
});
