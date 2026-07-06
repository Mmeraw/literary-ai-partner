import {
  FORBIDDEN_RENDERER_INPUTS,
  buildViewModelFieldBindings,
  type SectionDefinition,
  type ViewModelFieldBinding,
} from '@/lib/evaluation/contracts/evaluationProductContract';

const SECTION_VIEW_MODEL_PATHS: Record<string, string[]> = {
  title_block: ['titleBlock'],
  one_paragraph_pitch: ['oneParagraphPitch'],
  one_sentence_pitch: ['oneSentencePitch'],
  premise: ['premise'],
  content_warnings: ['contentWarnings'],
  revision_opportunity_summary: ['revisionOpportunitySummary'],
  executive_summary: ['executiveSummary'],
  top_strengths: ['topStrengths'],
  top_risks: ['topRisks'],
  top_recommendations: ['topRecommendations'],
  '13_criteria_score_grid': ['criteriaScoreGrid'],
  criterion_rationales_surfaced_opportunities: ['criterionDetails'],
  narrative_synthesis: [
    'longFormMultiLayerEvaluation.executiveVerdict',
    'longFormMultiLayerEvaluation.scores',
  ],
  market_shelf: ['longFormMultiLayerEvaluation.marketShelf'],
  layer_aware_revision_sequencing: [
    'modeSpecific.layerAwareRevisionSequencing',
    'longFormMultiLayerEvaluation.revisionPlan',
  ],
  long_form_continuity_and_coverage_proof: [
    'modeSpecific.manuscriptScaleContinuityFindings',
    'modeSpecific.continuityCoverageProof',
  ],
  readiness_releasability_posture: [
    'modeSpecific.readinessReleasabilityPosture',
    'longFormMultiLayerEvaluation.releasability',
  ],
  confidence_explanation: ['confidenceExplanation'],
  author_facing_disclaimer: ['disclaimer'],
  structural_stack: ['longFormMultiLayerEvaluation.structuralStack'],
  arc_map: ['longFormMultiLayerEvaluation.arcMap'],
  layer_by_layer_analysis: ['longFormMultiLayerEvaluation.layerAnalyses'],
  cross_layer_integration: ['longFormMultiLayerEvaluation.crossLayerIntegration'],
  review_gate_readiness_surface: [
    'modeSpecific.reviewGateReadinessSurface',
    'longFormMultiLayerEvaluation.acceptanceChecks',
  ],
  governed_ledgers_or_compact_governed_ledger_addenda: ['modeSpecific.governedLedgerAddenda'],
};

export function buildLongFormMultiLayerViewModelFieldBindings(
  sections: readonly SectionDefinition[],
): ViewModelFieldBinding[] {
  return buildViewModelFieldBindings(sections, SECTION_VIEW_MODEL_PATHS);
}

export function getLongFormMultiLayerForbiddenRendererInputs(): readonly string[] {
  return FORBIDDEN_RENDERER_INPUTS;
}
