/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
import type { SyncedRevisionLedgerRow } from '@/lib/revision/ledger';

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

function asLedgerRow(entry: {
  localId: string;
  opportunityId: string;
  opportunityTitle: string;
  decision: SyncedRevisionLedgerRow['decision'];
  selectedOption?: 'A' | 'B' | 'C' | null;
  selectedText?: string | null;
  customText?: string | null;
}): SyncedRevisionLedgerRow {
  const now = new Date().toISOString();
  return {
    id: `server-${entry.localId}`,
    user_id: 'user-1',
    manuscript_id: 6074,
    evaluation_job_id: 'e5ced7ac-117f-4d13-8cd0-3957c15dc189',
    local_id: entry.localId,
    opportunity_id: entry.opportunityId,
    opportunity_title: entry.opportunityTitle,
    decision: entry.decision,
    selected_option: entry.selectedOption ?? null,
    custom_text: entry.customText ?? null,
    selected_text: entry.selectedText ?? entry.customText ?? null,
    source_excerpt: 'source excerpt',
    source_location: 'chapter:3',
    client_created_at: now,
    client_synced_at: now,
    metadata: {},
    created_at: now,
    updated_at: now,
    is_undo: false,
    undone_local_id: null,
  };
}

describe('ReviseCockpitClientWorkflowV2', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (_input: unknown, init?: { method?: string }) => {
      if (!init?.method || init.method === 'GET') {
        return { ok: true, json: async () => ({ ok: true, entries: [] }) };
      }
      return { ok: true, json: async () => ({ ok: true, entries: [] }) };
    });
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

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const [, init] = postCall as [unknown, { body: string }];
    expect(init.body).toContain('accepted_a');
    expect(init.body).toContain(CANDIDATE_A);
    expect(init.body).toContain('workflow-revise-cockpit-v2');
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved:'));
  });

  it('offers a retry action when ledger sync fails and clears it after success', async () => {
    let postAttempt = 0;
    fetchMock = jest.fn(async (_input: unknown, init?: { method?: string }) => {
      if (!init?.method || init.method === 'GET') {
        return { ok: true, json: async () => ({ ok: true, entries: [] }) };
      }
      if (init.method === 'POST') {
        postAttempt += 1;
        if (postAttempt === 1) {
          throw new Error('network unavailable');
        }
        return { ok: true, json: async () => ({ ok: true, entries: [] }) };
      }
      return { ok: false, json: async () => ({ ok: false, error: 'Unexpected method' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([, requestInit]) => !requestInit?.method || requestInit.method === 'GET'),
      ).toBe(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept A' }));

    const retry = await screen.findByRole('button', { name: /Retry: Bridge abrupt transition/i });
    expect(screen.getByRole('status').textContent).toContain('Save failed:');
    fireEvent.click(retry);

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(([, requestInit]) => requestInit?.method === 'POST');
      expect(postCalls).toHaveLength(2);
    });
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

  it('persists mixed decisions, destroys client state, reloads from backend, and keeps the same authoritative decision state', async () => {
    const first = makeOpportunity({ id: 'ready-1', title: 'Bridge abrupt transition' });
    const second = makeOpportunity({ id: 'ready-2', title: 'Resolve cadence drift', anchor: 'chapter:5' });
    const payload = makePayload({ opportunities: [first, second], readinessTotals: { ready_for_revise: 2, needs_targeting: 0, withheld_unsupported: 0 } });

    const persistedRows: SyncedRevisionLedgerRow[] = [];
    fetchMock = jest.fn(async (input: unknown, init?: { method?: string; body?: unknown }) => {
      const url = String(input);
      if (!init?.method || init.method === 'GET') {
        expect(url).toContain('/api/revision-ledger?');
        return { ok: true, json: async () => ({ ok: true, entries: persistedRows }) };
      }

      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const entry = body.entries[0] as {
          localId: string;
          opportunityId: string;
          opportunityTitle: string;
          decision: SyncedRevisionLedgerRow['decision'];
          selectedOption?: 'A' | 'B' | 'C' | null;
          selectedText?: string | null;
          customText?: string | null;
        };
        persistedRows.push(asLedgerRow({
          localId: entry.localId,
          opportunityId: entry.opportunityId,
          opportunityTitle: entry.opportunityTitle,
          decision: entry.decision,
          selectedOption: entry.selectedOption ?? null,
          selectedText: entry.selectedText ?? null,
          customText: entry.customText ?? null,
        }));
        return { ok: true, json: async () => ({ ok: true, entries: [persistedRows[persistedRows.length - 1]] }) };
      }

      return { ok: false, json: async () => ({ ok: false, error: 'Unexpected method' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const firstRender = render(<ReviseCockpitClientWorkflowV2 payload={payload} />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept B' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved: Bridge abrupt transition'));

    fireEvent.click(screen.getByRole('button', { name: 'Reject All' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved: Resolve cadence drift'));

    expect(persistedRows).toHaveLength(2);
    expect(persistedRows.map((row) => row.decision)).toEqual(['accepted_b', 'reject']);

    firstRender.unmount();

    render(<ReviseCockpitClientWorkflowV2 payload={payload} />);

    await waitFor(() => expect(screen.getByText(/Queue complete/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /Active \(0\)/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accept A' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accept B' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accept C' })).toBeNull();
  });

  it('reloads persisted authority after a 409 stale write and does not let the failed attempt decide the card', async () => {
    const serverLatest = asLedgerRow({
      localId: 'server-local-v4',
      opportunityId: 'ready-1',
      opportunityTitle: 'Bridge abrupt transition',
      decision: 'reject',
      selectedOption: null,
      selectedText: 'Rejected recommendation',
    });
    let getCount = 0;

    fetchMock = jest.fn(async (_input: unknown, init?: { method?: string; body?: unknown }) => {
      if (!init?.method || init.method === 'GET') {
        getCount += 1;
        return {
          ok: true,
          json: async () => ({ ok: true, entries: getCount === 1 ? [] : [serverLatest] }),
        };
      }

      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.entries[0].decision).toBe('accepted_a');
        return {
          ok: false,
          status: 409,
          json: async () => ({
            ok: false,
            error: 'Ledger stale write blocked: expected current localId null but found server-local-v4 for opportunity ready-1.',
          }),
        };
      }

      return { ok: false, status: 405, json: async () => ({ ok: false, error: 'Unexpected method' }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ReviseCockpitClientWorkflowV2 payload={makePayload()} />);
    await waitFor(() => expect(getCount).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Accept A' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('reloaded latest ledger state'));
    expect(screen.getByText(/1 of 1 active decisions recorded/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Active \(0\)/i })).toBeTruthy();
    const authoritativeDecisions = screen.getByLabelText('Authoritative ledger decisions');
    expect(within(authoritativeDecisions).getByText(/Bridge abrupt transition/).textContent).toContain('Bridge abrupt transition');
    expect(authoritativeDecisions.textContent).toContain('Rejected');
    expect(authoritativeDecisions.textContent).not.toContain('Accepted A');
    expect(screen.getAllByRole('button', { name: /Retry: Bridge abrupt transition/i }).length).toBeGreaterThan(0);
  });
});
