/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import ReviseCockpitClientWorkflowV1 from '@/components/revision/ReviseCockpitClientWorkflowV1';
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from '@/lib/revision/workbenchQueue';

function makeStrategyCardViewModel(): WorkbenchOpportunity['strategyCardViewModel'] {
  return {
    scaffold: {
      cardNumber: 'Passage · NARRATIVE_DRIVE',
      cardType: 'Strategy Card',
      trustedPathStatus: 'Unavailable — author review required',
      reasonCopyPasteIsUnsafe: 'insufficient_before_after_context',
      ledgerReference: 'Revelation resolves as summary',
      evidenceAnchor: 'She set the letter down and said nothing for a long time.',
      conservativeApproach: 'Apply the recommended repair at the smallest safe scope: keep the change confined to the passage.',
      moderateApproach: 'Apply the recommended repair: Replace the quoted passage with a visible physical response.',
      boldApproach: 'Apply the recommended repair with broader scope: reframe the structural context entirely.',
      authorDecisionRequired: 'Choose whether the revelation stays internal or becomes embodied.',
    },
    illustrativeExamples: [
      { key: 'A', label: 'Recommended repair', text: 'She set the letter down and did not look at it again.' },
      { key: 'B', label: 'Rhythm variant', text: 'After placing the letter flat, she reached for her coat.' },
      { key: 'C', label: 'Bolder rendering shift', text: 'The letter lay face down while she kept both hands on the table.' },
    ],
  };
}

function makeStrategyOpportunity(overrides: Partial<WorkbenchOpportunity> = {}): WorkbenchOpportunity {
  const id = overrides.id ?? 'opp-strategy-1';
  const anchor = 'passage:15';
  const evidence = 'She set the letter down and said nothing for a long time.';
  const symptom = 'In the quoted passage “She set the letter down and said nothing for a long time,” the revelation resolves as summary instead of action.';
  const cause = 'This occurs when the narrator summarizes Mara’s reaction rather than rendering the physical consequence beat by beat.';
  const fixDirection = 'Replace the quoted passage “She set the letter down and said nothing for a long time” so Mara chooses a visible physical response before the narration names the emotion.';
  const readerEffect = 'This lets readers track Mara’s decision through embodied action, so the revelation keeps narrative momentum instead of flattening into summary.';
  const mistakeProofing = 'Do not introduce new information; the replacement must emerge from what the scene has already established.';

  const candidateA = 'She set the letter down and did not look at it again. Her hands moved to the edge of the table and stayed there.';
  const candidateB = 'After placing the letter flat on the table, Mara reached for her coat before either of them could ask what had changed.';
  const candidateC = 'The letter lay face down near the lamp while Mara kept both hands on the table and refused to pick it up.';

  return {
    id,
    severity: 'must',
    scope: 'Passage',
    mode: 'direct-rewrite',
    source: 'evaluation',
    criterion: 'NARRATIVE_DRIVE',
    leverage: 'Evaluation Result V2',
    crumb: 'NARRATIVE_DRIVE · passage:15',
    title: 'The revelation resolves as summary instead of action',
    issueStatement: 'The revelation resolves as summary instead of action',
    meta: 'NARRATIVE_DRIVE · passage:15',
    confidence: 'high confidence',
    anchor,
    quoteHighlight: evidence,
    quoteRest: '',
    symptom,
    cause,
    fixDirection,
    readerEffect,
    mistakeProofing,
    diagnostic: {
      symptom,
      cause,
      fixStrategy: fixDirection,
      readerImpact: readerEffect,
      evidence: { quotedExcerpt: evidence, locationLabel: anchor },
      operationTargeting: 'Passage · passage:15',
      mistakeProofing,
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: null,
    cardType: 'revision_strategy',
    trustedPathStatus: 'unavailable_author_review_required',
    contextQuality: 'limited',
    preflightStatus: 'limited_context',
    preflightReasons: ['limited_context_due_to_degraded_canon'],
    groundingStatus: 'supported',
    executabilityReasons: ['insufficient_before_after_context'],
    hydrationFailureReasons: [],
    resBlockerReasons: ['limited_context_due_to_degraded_canon'],
    options: [
      { key: 'A', mechanism: 'Recommended repair', candidateText: candidateA, text: candidateA, rationale: 'Primary repair path from the evaluation.' },
      { key: 'B', mechanism: 'Rhythm variant', candidateText: candidateB, text: candidateB, rationale: 'Secondary variant for author-controlled cadence.' },
      { key: 'C', mechanism: 'Bolder rendering shift', candidateText: candidateC, text: candidateC, rationale: 'Alternative variant for stronger emphasis.' },
    ],
    ...overrides,
  };
}

function makePayload(overrides: Partial<WorkbenchQueuePayload> = {}): WorkbenchQueuePayload {
  return {
    ok: true,
    error: null,
    manuscriptId: '6074',
    evaluationJobId: 'job-strategy',
    manuscriptTitle: 'Let the River Decide',
    modeContract: null,
    opportunities: [],
    needsTargeting: [],
    withheldUnsupported: [],
    readinessTotals: { ready_for_revise: 0, needs_targeting: 0, withheld_unsupported: 0 },
    totals: {},
    scopes: {},
    criteria: {},
    ...overrides,
  };
}

describe('ReviseCockpitClientWorkflowV1', () => {
  it('renders needsTargeting strategy cards instead of an empty state', () => {
    const opportunity = makeStrategyOpportunity();
    const payload = makePayload({
      needsTargeting: [opportunity],
      readinessTotals: { ready_for_revise: 0, needs_targeting: 1, withheld_unsupported: 0 },
    });

    render(<ReviseCockpitClientWorkflowV1 payload={payload} />);

    expect(screen.queryByText(/No revision queue available/i)).toBeNull();
    expect(screen.queryByText(/none are ready to revise yet/i)).toBeNull();
    expect(screen.getByText('Needs Targeting')).toBeTruthy();
    expect(screen.getByText(/She set the letter down and did not look at it again/)).toBeTruthy();
  });

  it('disables Accept A/B/C for strategy cards while allowing review actions', () => {
    const opportunity = makeStrategyOpportunity();
    const payload = makePayload({
      needsTargeting: [opportunity],
      readinessTotals: { ready_for_revise: 0, needs_targeting: 1, withheld_unsupported: 0 },
    });

    render(<ReviseCockpitClientWorkflowV1 payload={payload} />);

    const acceptA = screen.getByRole('button', { name: /Accept A/i });
    const acceptB = screen.getByRole('button', { name: /Accept B/i });
    const acceptC = screen.getByRole('button', { name: /Accept C/i });
    expect(acceptA.disabled).toBe(true);
    expect(acceptB.disabled).toBe(true);
    expect(acceptC.disabled).toBe(true);

    expect(screen.getByRole('button', { name: /Keep Original/i }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: /Defer/i }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: /Reject All/i }).disabled).toBe(false);
  });

  it('renders a StrategyCard with illustrative examples and no Accept buttons', () => {
    const opportunity = makeStrategyOpportunity({ strategyCardViewModel: makeStrategyCardViewModel() });
    const payload = makePayload({
      needsTargeting: [opportunity],
      readinessTotals: { ready_for_revise: 0, needs_targeting: 1, withheld_unsupported: 0 },
    });

    render(<ReviseCockpitClientWorkflowV1 payload={payload} />);

    expect(screen.getByText(/Repair Strategy/i)).toBeTruthy();
    expect(screen.getByText(/Replace the quoted passage with a visible physical response/i)).toBeTruthy();
    expect(screen.getByText(/A — Recommended repair/i)).toBeTruthy();
    expect(screen.getByText(/B — Rhythm variant/i)).toBeTruthy();
    expect(screen.getByText(/C — Bolder rendering shift/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept A/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Accept B/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Accept C/i })).toBeNull();
  });

  it('renders a held summary when every opportunity is withheld', () => {
    const opportunity = makeStrategyOpportunity({
      id: 'opp-withheld-1',
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      preflightStatus: 'blocked',
      contextQuality: 'blocked',
      preflightReasons: ['canon_conflict'],
      executabilityReasons: ['canon_unclear'],
    });
    const payload = makePayload({
      opportunities: [],
      needsTargeting: [],
      withheldUnsupported: [opportunity],
      readinessTotals: { ready_for_revise: 0, needs_targeting: 0, withheld_unsupported: 1 },
    });

    render(<ReviseCockpitClientWorkflowV1 payload={payload} />);

    expect(screen.getByText(/1 revision opportunity found, but none are ready to revise yet/i)).toBeTruthy();
    expect(screen.queryByText(/No revision queue available/i)).toBeNull();
  });

  it('enables Accept A/B/C for copy-paste rewrite TrustedPath-eligible cards', () => {
    const opportunity = makeStrategyOpportunity({
      id: 'opp-copy-1',
      cardType: 'copy_paste_rewrite',
      trustedPathStatus: 'eligible',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      preflightReasons: [],
      executabilityReasons: [],
      resBlockerReasons: [],
    });
    const payload = makePayload({
      opportunities: [opportunity],
      readinessTotals: { ready_for_revise: 1, needs_targeting: 0, withheld_unsupported: 0 },
    });

    render(<ReviseCockpitClientWorkflowV1 payload={payload} />);

    const acceptA = screen.getByRole('button', { name: /Accept A/i });
    const acceptB = screen.getByRole('button', { name: /Accept B/i });
    const acceptC = screen.getByRole('button', { name: /Accept C/i });
    expect(acceptA.disabled).toBe(false);
    expect(acceptB.disabled).toBe(false);
    expect(acceptC.disabled).toBe(false);
  });
});
