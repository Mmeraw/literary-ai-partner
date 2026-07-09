/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';

import ReviseCockpitClientWorkflowV1 from '@/components/revision/ReviseCockpitClientWorkflowV1';
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from '@/lib/revision/workbenchQueue';

function makeReadyOpportunity(): WorkbenchOpportunity {
  return {
    id: 'ready-abc-1',
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
    quoteHighlight: 'Mara shut the door. The next morning, the house was silent.',
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
        quotedExcerpt: 'Mara shut the door. The next morning, the house was silent.',
        locationLabel: 'chapter:3',
      },
      operationTargeting: 'replace_selected_passage · chapter:3',
      mistakeProofing: 'Preserve the original event order.',
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: 'Candidate prose is source anchored.',
    options: [
      {
        key: 'A',
        mechanism: 'Recommended repair',
        candidateText: 'Mara shut the door and waited until her breathing steadied. By morning, the house was silent.',
        text: 'Mara shut the door and waited until her breathing steadied. By morning, the house was silent.',
        rationale: 'Adds a minimal emotional bridge.',
      },
      {
        key: 'B',
        mechanism: 'Rhythm variant',
        candidateText: 'Mara shut the door. She stood there until the first sharp breath passed; by morning, the house was silent.',
        text: 'Mara shut the door. She stood there until the first sharp breath passed; by morning, the house was silent.',
        rationale: 'Keeps the original rhythm while smoothing the jump.',
      },
      {
        key: 'C',
        mechanism: 'Bolder rendering shift',
        candidateText: 'Mara shut the door, but the echo stayed with her all night. By morning, the house was silent.',
        text: 'Mara shut the door, but the echo stayed with her all night. By morning, the house was silent.',
        rationale: 'Adds a stronger emotional image.',
      },
    ],
  };
}

function makePayload(): WorkbenchQueuePayload {
  const opportunity = makeReadyOpportunity();
  return {
    ok: true,
    error: null,
    manuscriptId: '6074',
    evaluationJobId: 'e5ced7ac-117f-4d13-8cd0-3957c15dc189',
    manuscriptTitle: 'Cartel Babies',
    opportunities: [opportunity],
    needsTargeting: [],
    withheldUnsupported: [],
    readinessTotals: {
      ready_for_revise: 1,
      needs_targeting: 0,
      withheld_unsupported: 0,
    },
    totals: { must: 0, should: 1, could: 0 },
    scopes: { Line: 0, Passage: 1, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    criteria: { Pacing: 1 },
    synthesis: { admitted: 1, clustered: 0, held: 0, suppressed: 0 },
    modeContract: null,
  };
}

describe('ReviseCockpitClientWorkflowV1 smoke', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders all A/B/C comparison cards and author decision controls', () => {
    render(<ReviseCockpitClientWorkflowV1 payload={makePayload()} />);

    // Canonical A/B/C labels are locked: A: Recommended, B: Rhythm Variant, C: Bolder Shift.
    // Labels render as "\u2014 Recommended" etc., so match on a substring pattern.
    expect(screen.getByText('Compare A/B/C Options')).toBeTruthy();
    expect(screen.getAllByText(/Recommended/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rhythm Variant/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bolder Shift/).length).toBeGreaterThan(0);

    expect(screen.getByText(/Mara shut the door and waited until her breathing steadied/i)).toBeTruthy();
    expect(screen.getByText(/She stood there until the first sharp breath passed/i)).toBeTruthy();
    expect(screen.getByText(/the echo stayed with her all night/i)).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Accept A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept B' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept C' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep Original' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reject All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /custom/i })).toBeTruthy();
  });
});
