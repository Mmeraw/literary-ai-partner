/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';

import ReviseCockpitClientWorkflowV2 from '@/components/revision/ReviseCockpitClientWorkflowV2';
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from '@/lib/revision/workbenchQueue';

// Text deliberately contains the words the old client wrapper used to rewrite
// ("the room" -> "the clearing", "everyone" -> "the others"). The wrapper must
// now leave author/editorial content completely untouched.
const UNMUTATED_CANDIDATE_A =
  'Mara stepped back into the room, and everyone waited for her to speak.';
const UNMUTATED_CANDIDATE_B =
  'The room stilled as everyone turned toward the doorway where Mara stood.';
const UNMUTATED_CANDIDATE_C =
  'She crossed the room slowly, aware that everyone was watching her every move.';

function makeReadyOpportunity(): WorkbenchOpportunity {
  return {
    id: 'ready-mutation-guard-1',
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
      evidence: {
        quotedExcerpt: 'Mara shut the door. Everyone in the room went quiet.',
        locationLabel: 'chapter:3',
      },
      operationTargeting: 'replace_selected_passage · chapter:3',
      mistakeProofing: 'Preserve the original event order.',
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: 'Candidate prose is source anchored.',
    options: [
      { key: 'A', mechanism: 'Recommended repair', candidateText: UNMUTATED_CANDIDATE_A, text: UNMUTATED_CANDIDATE_A, rationale: 'Adds a minimal emotional bridge.' },
      { key: 'B', mechanism: 'Rhythm variant', candidateText: UNMUTATED_CANDIDATE_B, text: UNMUTATED_CANDIDATE_B, rationale: 'Keeps the original rhythm.' },
      { key: 'C', mechanism: 'Bolder rendering shift', candidateText: UNMUTATED_CANDIDATE_C, text: UNMUTATED_CANDIDATE_C, rationale: 'Adds a stronger emotional image.' },
    ],
  };
}

function makePayload(): WorkbenchQueuePayload {
  return {
    ok: true,
    error: null,
    manuscriptId: '6074',
    evaluationJobId: 'e5ced7ac-117f-4d13-8cd0-3957c15dc189',
    manuscriptTitle: 'Cartel Babies',
    opportunities: [makeReadyOpportunity()],
    needsTargeting: [],
    withheldUnsupported: [],
    readinessTotals: { ready_for_revise: 1, needs_targeting: 0, withheld_unsupported: 0 },
    totals: { must: 0, should: 1, could: 0 },
    scopes: { Line: 0, Passage: 1, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    criteria: { Pacing: 1 },
    synthesis: { admitted: 1, clustered: 0, held: 0, suppressed: 0 },
    modeContract: null,
  };
}

describe('ReviseCockpitClientWorkflowV2 content-integrity smoke', () => {
  let fetchMock: jest.Mock;
  let clipboardWriteMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    clipboardWriteMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: clipboardWriteMock } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders candidate prose verbatim without substituting words', () => {
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);

    // Author content passes through untouched — no "the room" -> "the clearing"
    // and no "everyone" -> "the others" rewriting.
    expect(screen.getByText(UNMUTATED_CANDIDATE_A)).toBeTruthy();
    expect(screen.getByText(UNMUTATED_CANDIDATE_B)).toBeTruthy();
    expect(screen.getByText(UNMUTATED_CANDIDATE_C)).toBeTruthy();

    const html = document.body.innerHTML;
    expect(html).not.toMatch(/the clearing/i);
    expect(html).not.toMatch(/the others/i);
  });

  it('does not monkeypatch window.fetch to rewrite the revision ledger body', async () => {
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);
    fetchMock.mockClear();

    const body = JSON.stringify({
      entries: [{ selectedText: 'Everyone left the room.', customText: 'the room' }],
    });
    await global.fetch('/api/revision-ledger', { method: 'POST', body });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(body);
    expect(init.body).toContain('Everyone left the room.');
    expect(init.body).not.toMatch(/the clearing|the others/i);
  });

  it('does not monkeypatch navigator.clipboard.writeText to rewrite copied text', async () => {
    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);
    clipboardWriteMock.mockClear();

    const copied = 'Everyone gathered in the room.';
    await navigator.clipboard.writeText(copied);

    expect(clipboardWriteMock).toHaveBeenCalledTimes(1);
    expect(clipboardWriteMock).toHaveBeenCalledWith(copied);
  });
});
