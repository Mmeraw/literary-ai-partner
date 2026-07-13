/** @jest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CopyPasteRewriteCard from '@/components/revision/CopyPasteRewriteCard';
import WithheldSummary from '@/components/revision/WithheldSummary';
import type { CopyPasteCardViewModel, WithheldCardViewModel } from '@/components/revision/workbenchCardModels';

const copyPasteCard: CopyPasteCardViewModel = {
  opportunityId: 'opp-copy-1',
  cardType: 'copy_paste_rewrite',
  trustedPathStatus: 'eligible',
  severity: 'must',
  criterion: 'NARRATIVE_DRIVE',
  originalPassage: 'The river moved below them in a long sheet of grey.',
  evidenceLocation: 'Chapter 5, paragraph 1',
  candidates: [
    { key: 'A', label: 'Recommended repair', text: 'Below them, the river carried a long sheet of grey toward the bend.' },
    { key: 'B', label: 'Rhythm variant', text: 'The river slid below them—grey, long, and unbroken to the bend.' },
    { key: 'C', label: 'Bolder rendering shift', text: 'Far below, the river dragged its grey skin around the bend.' },
  ],
};

const withheldCard: WithheldCardViewModel = {
  opportunityId: 'opp-withheld-1',
  cardType: 'withheld',
  trustedPathStatus: 'impossible',
  severity: 'must',
  criterion: 'CANON',
  title: 'The relationship reference cannot be verified',
  holdReason: 'The available evidence conflicts with the manuscript ledger.',
  missingContext: ['A confirmed relationship timeline', 'The surrounding scene transition'],
  recoveryAction: 'Confirm the relationship timeline, then request re-analysis.',
  evidenceAnchor: 'He called her by the name only his sister used.',
};

describe('Workbench card components', () => {
  it('renders exactly three executable A/B/C candidates for copy-paste cards', () => {
    const onAccept = jest.fn();
    render(<CopyPasteRewriteCard viewModel={copyPasteCard} onAccept={onAccept} />);

    expect(screen.getByText(/Copy-paste rewrite/i)).toBeTruthy();
    expect(screen.getByText(/Trusted Path eligible/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Accept [ABC]/i })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /Accept B/i }));
    expect(onAccept).toHaveBeenCalledWith('B');
  });

  it('renders withheld items without candidate, generate, accept, or Trusted Path controls', () => {
    render(<WithheldSummary viewModel={withheldCard} />);

    expect(screen.getByText(/Held item/i)).toBeTruthy();
    expect(screen.getByText(/Why this was held/i)).toBeTruthy();
    expect(screen.getByText(/How to recover it/i)).toBeTruthy();
    expect(screen.queryByText(/Option A/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Accept/i })).toBeNull();
    expect(screen.queryByText(/Trusted Path eligible/i)).toBeNull();
  });
});
