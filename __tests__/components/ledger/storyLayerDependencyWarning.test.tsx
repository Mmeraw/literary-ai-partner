/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StoryLayerRenderer } from '../../../components/ledger/StoryLedgerLayers';

describe('StoryLayerRenderer dependency warnings', () => {
  it('shows an inherited identity-risk warning without presenting the layer as clean', () => {
    render(
      <StoryLayerRenderer
        layerKey="relationship_network_layer"
        data={{
          relationship_pairs: [],
          health: {
            truth_status: 'degraded',
            status: 'degraded_but_usable',
            reason:
              'This layer depends on Canonical Identity, which has unresolved identity risk. Review with caution: character names, relationships, objects, locations, or threats may inherit identity errors.',
            visible_to_user: false,
            visible_to_admin: true,
          },
          dependency_warning: {
            layer: 'relationship_network_layer',
            depends_on: 'canonical_identity_layer',
            inherited_status: 'degraded',
            failure_class: 'DEPENDENT_LAYER_FAILED_IDENTITY_INHERITANCE',
            secondary_failure_class: 'DEPENDENT_LAYER_CLEAN_STATUS_BYPASS',
            risk_codes: ['SAME_NAME_AMBIGUITY'],
            message:
              'This layer depends on Canonical Identity, which has unresolved identity risk. Review with caution: character names, relationships, objects, locations, or threats may inherit identity errors. Active identity risk: same-name ambiguity.',
            blocks_clean_status: true,
            admin_visibility_exception:
              'The RevisionGrade admin account (tsavobc@hotmail.com) may view degraded or blocked dependent layers for QA/debugging, but those layers remain degraded or blocked and do not become clean canon.',
          },
        }}
      />,
    );

    expect(screen.getByText(/Degraded by Canonical Identity/i)).toBeTruthy();
    expect(screen.getByText(/Review with caution/i)).toBeTruthy();
    expect(screen.queryByText(/clean/i)).toBeNull();
  });
});
