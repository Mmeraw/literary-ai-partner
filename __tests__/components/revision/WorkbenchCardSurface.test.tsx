/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkbenchCardSurface from '@/components/revision/WorkbenchCardSurface';
import type { WorkbenchCardViewModel } from '@/components/revision/workbenchCardModels';

const copyPaste: WorkbenchCardViewModel = {
  opportunityId: 'opp-copy',
  cardType: 'copy_paste_rewrite',
  trustedPathStatus: 'eligible',
  severity: 'must',
  criterion: 'TONE',
  originalPassage: 'The river moved slowly.',
  evidenceLocation: 'Passage 2',
  candidates: [
    { key: 'A', label: 'Recommended repair', text: 'The river slid past the stones.' },
    { key: 'B', label: 'Rhythm variant', text: 'Past the stones, the river slid.' },
    { key: 'C', label: 'Bolder rendering shift', text: 'The river shouldered through the stones.' },
  ],
};

const strategy: WorkbenchCardViewModel = {
  opportunityId: 'opp-strategy',
  cardType: 'revision_strategy',
  trustedPathStatus: 'unavailable_author_review_required',
  severity: 'must',
  criterion: 'NARRATIVE_DRIVE',
  recommendedStrategy: 'Redistribute the historical survey across later scenes.',
  whyDirectCopyPasteUnsafe: 'The repair changes multiple scenes.',
  evidenceAnchor: 'Chapter 5, paragraph 1',
  implementationSequence: ['Keep one grounding beat.', 'Move policy context into dialogue.'],
  authorDecisionRequired: 'Choose how much history remains in the current passage.',
  safeguards: ['Preserve the airstrip and NV115 facts.'],
};

const withheld: WorkbenchCardViewModel = {
  opportunityId: 'opp-held',
  cardType: 'withheld',
  trustedPathStatus: 'impossible',
  severity: 'should',
  criterion: 'CONTINUITY',
  title: 'Continuity cannot be verified',
  holdReason: 'Canon context is blocked.',
  missingContext: ['Later-scene continuity'],
  recoveryAction: 'Request re-analysis with the missing chapter context.',
};

describe('WorkbenchCardSurface', () => {
  it('shows A/B/C and Accept only for copy-paste cards', () => {
    render(<WorkbenchCardSurface viewModel={copyPaste} />);
    expect(screen.getByRole('button', { name: 'Accept A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept B' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept C' })).toBeTruthy();
    expect(screen.queryByText(/Request Re-analysis/i)).toBeNull();
  });

  it('shows one strategy surface without A/B/C or Accept', () => {
    render(<WorkbenchCardSurface viewModel={strategy} />);
    expect(screen.getByText(/Redistribute the historical survey/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Custom Plan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Request Re-analysis/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept [ABC]/i })).toBeNull();
    expect(screen.queryByText(/A —/i)).toBeNull();
  });

  it('renders withheld as a non-interactive held summary', () => {
    render(<WorkbenchCardSurface viewModel={withheld} />);
    expect(screen.getByTestId('withheld-summary')).toBeTruthy();
    expect(screen.getByText(/Canon context is blocked/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate/i })).toBeNull();
  });
});
