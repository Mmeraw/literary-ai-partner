import { evaluateReviewGateSemanticGate } from '../../../lib/evaluation/reviewGate/semanticGate';

function baseInput() {
  return {
    storyLayerContent: {
      layers: {
        canonical_identity_layer: {
          identities: [{ id: 'newton', name: 'Newton' }],
        },
      },
      layer_completion_summary: {
        total_layers: 1,
        populated_layers: 1,
        empty_layers: [],
        degraded_layers: [],
      },
    },
    qualityReportContent: {
      quality_report: {
        gate_ready_status: 'reviewable' as const,
        grouped_warning_summary: {},
        blocking_reasons: [],
      },
    },
  };
}

describe('evaluateReviewGateSemanticGate', () => {
  it('passes when quality + completion + payload checks are clean', () => {
    const result = evaluateReviewGateSemanticGate(baseInput());
    expect(result).toEqual({ ok: true, code: null, reasons: [] });
  });

  it('fails when gate_ready_status is blocked', () => {
    const input = baseInput();
    input.qualityReportContent.quality_report!.gate_ready_status = 'blocked';

    const result = evaluateReviewGateSemanticGate(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('REVIEW_GATE_SEMANTIC_BLOCKED');
      expect(result.reasons.join(' ')).toMatch(/not reviewable/i);
    }
  });

  it('fails when completion summary has empty/degraded layers', () => {
    const input = baseInput();
    input.storyLayerContent.layer_completion_summary = {
      total_layers: 9,
      populated_layers: 8,
      empty_layers: ['pov_structure_layer'],
      degraded_layers: ['canonical_identity_layer'],
    };

    const result = evaluateReviewGateSemanticGate(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.join(' ')).toMatch(/Layer completion mismatch/i);
      expect(result.reasons.join(' ')).toMatch(/Empty layers present/i);
      expect(result.reasons.join(' ')).toMatch(/Degraded layers present/i);
    }
  });

  it('fails when author-facing payload leaks chunk labels', () => {
    const input = baseInput();
    input.storyLayerContent.layers = {
      relationship_network_layer: {
        relationships: [{ from: 'Newton', to: 'Twillow', first_shared_scene: 'chunk 0' }],
      },
    };

    const result = evaluateReviewGateSemanticGate(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.join(' ')).toMatch(/chunk labels/i);
    }
  });

  it('fails when grouped warning summary is non-empty', () => {
    const input = baseInput();
    input.qualityReportContent.quality_report!.grouped_warning_summary = {
      canonical_identity_layer: ['identity contamination risk'],
    };

    const result = evaluateReviewGateSemanticGate(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.join(' ')).toMatch(/warning summary is non-empty/i);
    }
  });
});
