/**
 * Shared executable product-contract types for Evaluation templates.
 *
 * These types encode the Phase 5B authority chain:
 *   Template doctrine → executable product contract → UED certification → ViewModel/render parity.
 */

export type EvaluationMode =
  | 'short_form_evaluation'
  | 'long_form_evaluation'
  | 'long_form_multi_layer_evaluation';

export type ImplementationStatus = 'complete' | 'partial';

export type ProductLifecycle = 'active' | 'historical_compatibility';

export type EvaluationRoute = 'SHORT_FORM' | 'LONG_FORM';

export type EvaluationOutputMode =
  | 'standard_short_form'
  | 'legacy_long_form'
  | 'multi_layer_long_form';

export type RendererSurface = 'web' | 'pdf' | 'docx' | 'txt';

export type RendererExpansion = 'compact' | 'expanded';

export type SectionDefinition = {
  id: string;
  order: number;
  title: string;
  required: boolean;
  inclusionRule: 'always' | 'when_available' | 'where_applicable' | 'historical_compatibility';
  revisionSurfaceRole: string;
  mayContainFullOpportunities: boolean;
  mayContainRevisionCounts: boolean;
  mayContainRecommendationText: boolean;
  mayCreateNewOpportunities: false;
  mustReferenceRevisionOpportunityLedger: boolean;
  rendererExpansion: RendererExpansion;
  rendererVisibility: Record<RendererSurface, boolean>;
};

export type ViewModelFieldBinding = {
  sectionId: string;
  sectionTitle: string;
  viewModelPaths: string[];
  rendererMaySynthesize: false;
};

export type RevisionSurfaceRule = {
  sectionId: string;
  sectionTitle: string;
  ownsOpportunities: boolean;
  ownsRecommendationText: boolean;
  ownsRevisionCounts: boolean;
  mayCreateNewOpportunities: false;
  mustTraceToCanonicalLedger: boolean;
  mustTraceToCanonicaLedger: boolean;
};

export type SeverityTierDefinition = {
  label: string;
  rank: number;
  description: string;
};

export type ProductContractCertificationChain = {
  templateDoctrinePath: string;
  executableContractPath: string;
  unifiedEvaluationDocumentBuilder: 'lib/evaluation/unifiedEvaluationDocument.ts';
  uedCertificationArtifact: 'author_exposure_certification_v1';
  viewModelArtifact: 'evaluation_report_view_model_v1';
  renderParityGate: 'PHASE5_RENDER_PARITY_FAIL';
  governanceDocPath: string;
};

export type EvaluationContract = {
  mode: EvaluationMode;
  templateName: string;
  reportType: string;
  route: EvaluationRoute;
  outputMode: EvaluationOutputMode;
  productLifecycle: ProductLifecycle;
  templatePath: string;
  authorityLevel: 'executable_contract';
  implementationStatus: ImplementationStatus;
  missingExecutableRules: string[];

  requiredSections: SectionDefinition[];
  optionalSections: SectionDefinition[];
  forbiddenHeadings: readonly string[];
  forbiddenRevisionInventoryLabels: readonly string[];

  viewModelFieldBindings: ViewModelFieldBinding[];
  forbiddenRendererInputs: readonly string[];

  revisionSurfaceRules: RevisionSurfaceRule[];
  requiredOpportunityFields: string[];
  severityTiers: SeverityTierDefinition[];
  forbiddenSeverityAliases: readonly string[];
  maxTopRecommendations: number;
  maxRevisionOpportunities: number;

  rendererVisibility: {
    allSurfacesMustMatch: boolean;
    surfaces: RendererSurface[];
  };

  authorityChain: {
    goldenRecordPath: string;
    contractRegistryPath: string;
    governanceDocPath: string;
  };

  certificationChain: ProductContractCertificationChain;
};

export const REQUIRED_OPPORTUNITY_FIELDS: string[] = [
  'opportunity_id',
  'criterion',
  'severity',
  'evidence',
  'symptom',
  'cause',
  'fix_direction',
  'reader_effect',
  'mistake_proofing',
];

export const SEVERITY_TIERS: SeverityTierDefinition[] = [
  { label: 'Recommended', rank: 1, description: 'High-impact revision opportunity the author should strongly consider' },
  { label: 'Optional', rank: 2, description: 'Medium-impact opportunity that would improve the work' },
  { label: 'Consider', rank: 3, description: 'Lower-impact opportunity worth noting' },
];

export const GOVERNANCE_DOC_PATH = 'docs/governance/AUTHORITY_CHAIN.md';
export const CONTRACT_REGISTRY_PATH = 'lib/evaluation/contracts/evaluationContractRegistry.ts';
export const UED_BUILDER_PATH = 'lib/evaluation/unifiedEvaluationDocument.ts' as const;
export const ALL_SURFACES: RendererSurface[] = ['web', 'pdf', 'docx', 'txt'];

export const FORBIDDEN_RENDERER_INPUTS: readonly string[] = [
  'UnifiedEvaluationDocument',
  'LongformDreamDocument',
  'evaluation_result',
  'dreamDoc',
  'sanitizeAuthorFacingDisplayValue',
  'mistakeProofText',
  'correctScopeLanguage',
  'actionItems',
  'quickWins',
  'strategicRevisions',
];

export function sectionIdFromTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function buildCertificationChain(params: {
  templateDoctrinePath: string;
  executableContractPath: string;
}): ProductContractCertificationChain {
  return {
    templateDoctrinePath: params.templateDoctrinePath,
    executableContractPath: params.executableContractPath,
    unifiedEvaluationDocumentBuilder: UED_BUILDER_PATH,
    uedCertificationArtifact: 'author_exposure_certification_v1',
    viewModelArtifact: 'evaluation_report_view_model_v1',
    renderParityGate: 'PHASE5_RENDER_PARITY_FAIL',
    governanceDocPath: GOVERNANCE_DOC_PATH,
  };
}

export function buildRevisionSurfaceRules(sections: readonly SectionDefinition[]): RevisionSurfaceRule[] {
  return sections
    .filter((section) => section.mayContainFullOpportunities || section.mayContainRecommendationText || section.mayContainRevisionCounts)
    .map((section) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      ownsOpportunities: section.mayContainFullOpportunities,
      ownsRecommendationText: section.mayContainRecommendationText,
      ownsRevisionCounts: section.mayContainRevisionCounts,
      mayCreateNewOpportunities: false,
      mustTraceToCanonicalLedger: section.mustReferenceRevisionOpportunityLedger,
      // Preserve misspelled legacy property for existing tests/consumers.
      mustTraceToCanonicaLedger: section.mustReferenceRevisionOpportunityLedger,
    }));
}

export function buildViewModelFieldBindings(
  sections: readonly SectionDefinition[],
  sectionIdToViewModelPaths: Record<string, string[]>,
): ViewModelFieldBinding[] {
  return sections.map((section) => {
    const viewModelPaths = sectionIdToViewModelPaths[section.id];
    if (!viewModelPaths || viewModelPaths.length === 0) {
      throw new Error(`Missing ViewModel field binding for section ${section.id} (${section.title})`);
    }

    return {
      sectionId: section.id,
      sectionTitle: section.title,
      viewModelPaths,
      rendererMaySynthesize: false,
    };
  });
}

export function inferRevisionRole(title: string): string {
  if (title === 'Title Block') return 'metadata';
  if (title.includes('Pitch') || title === 'Premise') return 'pitch';
  if (title === 'Content Warnings') return 'content_advisory';
  if (title === 'Revision Opportunity Summary') return 'count_summary';
  if (title === 'Executive Summary' || title === 'Top Strengths' || title === 'Top Risks' || title === 'Top Recommendations') return 'executive_synthesis';
  if (title.includes('Score Grid')) return 'score_grid';
  if (title === 'Criterion Rationales & Surfaced Opportunities') return 'canonical_diagnostic';
  if (title === 'Narrative Synthesis') return 'narrative_synthesis';
  if (title === 'Market Shelf') return 'market_positioning';
  if (title === 'Confidence Explanation') return 'diagnostic_explanation';
  if (title === 'Author-Facing Disclaimer') return 'legal_boundary';
  if (title.includes('Revision') || title.includes('Layer-Aware')) return 'revision_surface';
  if (title.includes('Continuity') || title.includes('Cross-Layer') || title.includes('Readiness')) return 'structural_analysis';
  if (title.includes('Stack') || title.includes('Map') || title.includes('Layer') || title.includes('Ledger')) return 'layer_architecture';
  return 'content';
}

export function buildSectionDefinition(params: {
  title: string;
  order: number;
  required: boolean;
  inclusionRule: SectionDefinition['inclusionRule'];
  revisionSurfaceRole?: string;
  mayContainFullOpportunities?: boolean;
  mayContainRevisionCounts?: boolean;
  mayContainRecommendationText?: boolean;
  mustReferenceRevisionOpportunityLedger?: boolean;
  rendererExpansion?: RendererExpansion;
}): SectionDefinition {
  return {
    id: sectionIdFromTitle(params.title),
    order: params.order,
    title: params.title,
    required: params.required,
    inclusionRule: params.inclusionRule,
    revisionSurfaceRole: params.revisionSurfaceRole ?? inferRevisionRole(params.title),
    mayContainFullOpportunities: params.mayContainFullOpportunities ?? false,
    mayContainRevisionCounts: params.mayContainRevisionCounts ?? false,
    mayContainRecommendationText: params.mayContainRecommendationText ?? false,
    mayCreateNewOpportunities: false,
    mustReferenceRevisionOpportunityLedger: params.mustReferenceRevisionOpportunityLedger ?? false,
    rendererExpansion: params.rendererExpansion ?? 'expanded',
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
  };
}
