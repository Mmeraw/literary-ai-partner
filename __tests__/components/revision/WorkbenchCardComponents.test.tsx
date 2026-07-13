/** @jest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CopyPasteRewriteCard from '@/components/revision/CopyPasteRewriteCard';
import WithheldSummary from '@/components/revision/WithheldSummary';
import WorkbenchCardSurface from '@/components/revision/WorkbenchCardSurface';
import {
  copyPastePresentationFixture,
  strategyPresentationFixture,
  withheldPresentationFixture,
  workbenchPresentationGoldenMaster,
} from '@/components/revision/workbenchPresentationFixtures';

describe('Workbench presentation golden masters', () => {
  it('contains exactly one copy-paste, one strategy, and one withheld archetype', () => {
    expect(workbenchPresentationGoldenMaster.map((card) => card.cardType)).toEqual([
      'copy_paste_rewrite',
      'revision_strategy',
      'withheld',
    ]);
  });

  it('renders exactly three executable A/B/C candidates with a distinct recommended A state', () => {
    const onAccept = jest.fn();
    render(
      <CopyPasteRewriteCard
        viewModel={copyPastePresentationFixture}
        selectedKey="B"
        onAccept={onAccept}
      />,
    );

    expect(screen.getByText(/Copy-paste rewrite/i)).toBeTruthy();
    expect(screen.getByText(/Trusted Path eligible/i)).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /Select option B/i }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('button', { name: /Accept [ABC]/i })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /Accept B/i }));
    expect(onAccept).toHaveBeenCalledWith('B');
  });

  it('keeps strategy presentation hierarchical and free of A/B/C acceptance controls', () => {
    render(<WorkbenchCardSurface viewModel={strategyPresentationFixture} />);

    expect(screen.getByTestId('revision-strategy-surface')).toBeTruthy();
    expect(screen.getByText(/Redistribute the historical explanation/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept [ABC]/i })).toBeNull();
    expect(screen.queryByText(/A —|B —|C —/)).toBeNull();
  });

  it('renders withheld items without candidate, generate, accept, or Trusted Path controls', () => {
    render(<WithheldSummary viewModel={withheldPresentationFixture} />);

    expect(screen.getByText(/Held item/i)).toBeTruthy();
    expect(screen.getByText(/Why this was held/i)).toBeTruthy();
    expect(screen.getByText(/How to recover it/i)).toBeTruthy();
    expect(screen.queryByText(/Option A/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Accept/i })).toBeNull();
    expect(screen.queryByText(/Trusted Path eligible/i)).toBeNull();
  });
});
