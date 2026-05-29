/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StoryLayerRenderer } from '../../../components/ledger/StoryLedgerLayers';

describe('IdentityPronounLayer display copy', () => {
  it('shows required caption and normalized empty-state copy when no review transitions exist', () => {
    render(
      <StoryLayerRenderer
        layerKey="identity_pronoun_layer"
        data={{
          entries: [
            {
              canonical_name: 'Pip / Philip Pirrip',
              pronouns: ['he/him/his'],
              gender_identity: 'man',
              warnings: [],
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText(
        'This layer only shows pronoun-family transitions, cross-family shifts, or identity signals that may need author confirmation. Subject/object forms such as he/him, she/her, and they/them are normalized and hidden.',
      ),
    ).toBeTruthy();

    expect(
      screen.getByText(
        'No pronoun transitions detected. Stable subject/object pronoun usage was normalized in the background and does not require review.',
      ),
    ).toBeTruthy();
  });
});
