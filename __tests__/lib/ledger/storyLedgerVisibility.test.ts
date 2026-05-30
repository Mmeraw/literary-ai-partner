import {
  filterStoryLayersForViewer,
  isStoryLedgerAdmin,
  STORY_LAYER_ORDER,
  type LedgerQualityReportContent,
  type StoryLayerContent,
} from '../../../lib/ledger/storyLedgerVisibility';

function buildStoryLayerFixture(): Record<string, Record<string, unknown>> {
  return {
    canonical_identity_layer: { visibility_decision: { status: 'valid' }, characters: ['A'] },
    relationship_network_layer: { characters: ['A', 'B'] },
    object_symbol_layer: { visibility_decision: { status: 'quarantined' }, objects: ['sigil'] },
    source_integrity_layer: { visibility_decision: { status: 'degraded_but_usable' }, notes: ['draft'] },
  };
}

describe('storyLedgerVisibility', () => {
  it('treats the canonical admin email as admin, case-insensitively', () => {
    expect(isStoryLedgerAdmin({ email: 'tsavobc@hotmail.com' })).toBe(true);
    expect(isStoryLedgerAdmin({ email: 'TSAVOBC@HOTMAIL.COM' })).toBe(true);
    expect(isStoryLedgerAdmin({ email: 'author@example.com' })).toBe(false);
  });

  it('lets the admin viewer see every populated story layer', () => {
    const layers = buildStoryLayerFixture();
    const content: StoryLayerContent = {
      layer_completion_summary: {
        total_layers: STORY_LAYER_ORDER.length,
        populated_layers: 4,
        empty_layers: [],
        degraded_layers: [],
      },
    };
    const qualityReport: LedgerQualityReportContent = {
      quality_report: {
        gate_ready_status: 'reviewable',
        grouped_warning_summary: {
          object_symbol_layer: ['symbol tracking needs a second look'],
        },
      },
    };

    const result = filterStoryLayersForViewer(layers, content, qualityReport, true);

    expect(result.storyLayers).toEqual(layers);
    expect(result.visibleLayerKeys).toEqual([
      'canonical_identity_layer',
      'relationship_network_layer',
      'object_symbol_layer',
      'source_integrity_layer',
    ]);
    expect(result.withheldLayerKeys).toEqual([]);
    expect(result.layerCompletionSummary?.total_layers).toBe(STORY_LAYER_ORDER.length);
    expect(result.layerCompletionSummary?.populated_layers).toBe(4);
  });

  it('hides non-passing layers from regular viewers on the server', () => {
    const layers = buildStoryLayerFixture();
    const content: StoryLayerContent = {
      layer_completion_summary: {
        total_layers: STORY_LAYER_ORDER.length,
        populated_layers: 4,
        empty_layers: ['cast_role_tier_layer'],
        degraded_layers: ['source_integrity_layer'],
      },
    };
    const qualityReport: LedgerQualityReportContent = {
      quality_report: {
        gate_ready_status: 'blocked',
        grouped_warning_summary: {
          object_symbol_layer: ['symbol tracking needs a second look'],
          source_integrity_layer: ['source integrity is degraded'],
        },
      },
    };

    const result = filterStoryLayersForViewer(layers, content, qualityReport, false);

    expect(result.storyLayers).toEqual({
      canonical_identity_layer: { visibility_decision: { status: 'valid' }, characters: ['A'] },
      relationship_network_layer: { characters: ['A', 'B'] },
    });
    expect(result.visibleLayerKeys).toEqual(['canonical_identity_layer', 'relationship_network_layer']);
    expect(result.withheldLayerKeys).toEqual(['object_symbol_layer', 'source_integrity_layer']);
    expect(result.layerCompletionSummary).toEqual({
      total_layers: 2,
      populated_layers: 2,
      empty_layers: [],
      degraded_layers: [],
    });
  });

  it('returns a withheld empty-state when no layers pass the gate', () => {
    const layers: Record<string, Record<string, unknown>> = {
      canonical_identity_layer: { visibility_decision: { status: 'quarantined' } },
      object_symbol_layer: { visibility_decision: { status: 'failed' } },
    };
    const qualityReport: LedgerQualityReportContent = {
      quality_report: {
        gate_ready_status: 'blocked',
        grouped_warning_summary: {
          canonical_identity_layer: ['quarantined'],
          object_symbol_layer: ['failed'],
        },
      },
    };

    const result = filterStoryLayersForViewer(layers, null, qualityReport, false);

    expect(result.storyLayers).toBeNull();
    expect(result.visibleLayerKeys).toEqual([]);
    expect(result.withheldLayerKeys).toEqual(['canonical_identity_layer', 'object_symbol_layer']);
    expect(result.layerCompletionSummary).toEqual({
      total_layers: 0,
      populated_layers: 0,
      empty_layers: [],
      degraded_layers: [],
    });
  });

  it('lets the admin account view degraded dependent layers without converting them to clean', () => {
    const layers: Record<string, Record<string, unknown>> = {
      canonical_identity_layer: {
        health: { truth_status: 'degraded', status: 'degraded_but_usable' },
      },
      relationship_network_layer: {
        health: {
          truth_status: 'degraded',
          status: 'degraded_but_usable',
          visible_to_user: false,
          visible_to_admin: true,
        },
        dependency_warning: {
          layer: 'relationship_network_layer',
          inherited_status: 'degraded',
          failure_class: 'DEPENDENT_LAYER_FAILED_IDENTITY_INHERITANCE',
        },
        relationship_pairs: [{ character_a: 'A', character_b: 'B' }],
      },
    };

    const qualityReport: LedgerQualityReportContent = {
      quality_report: {
        gate_ready_status: 'repair_required',
        grouped_warning_summary: {
          canonical_identity_layer: ['Canonical Identity is degraded'],
          relationship_network_layer: ['Inherited Canonical Identity risk'],
        },
      },
    };

    const authorResult = filterStoryLayersForViewer(layers, null, qualityReport, false);
    expect(authorResult.storyLayers).toBeNull();
    expect(authorResult.withheldLayerKeys).toEqual([
      'canonical_identity_layer',
      'relationship_network_layer',
    ]);

    const adminResult = filterStoryLayersForViewer(layers, null, qualityReport, true);
    expect(adminResult.visibleLayerKeys).toEqual([
      'canonical_identity_layer',
      'relationship_network_layer',
    ]);
    expect(adminResult.storyLayers?.relationship_network_layer.health).toMatchObject({
      truth_status: 'degraded',
      status: 'degraded_but_usable',
    });
    expect(layers.relationship_network_layer.health).toMatchObject({
      truth_status: 'degraded',
      status: 'degraded_but_usable',
    });
  });
});
