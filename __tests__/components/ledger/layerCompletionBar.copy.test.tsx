/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { LayerCompletionBar } from '../../../components/ledger/StoryLedgerLayers';

describe('LayerCompletionBar copy', () => {
  it('uses Generation Coverage language', () => {
    render(
      <LayerCompletionBar
        summary={{
          total_layers: 9,
          populated_layers: 9,
          empty_layers: [],
          degraded_layers: [],
        }}
      />,
    );

    expect(screen.getByText(/Generation Coverage/i)).toBeTruthy();
    expect(screen.queryByText(/Layer Completion/i)).toBeNull();
    expect(screen.queryByText(/All layers populated/i)).toBeNull();
    expect(screen.getByText(/Generated layers detected/i)).toBeTruthy();
  });
});
