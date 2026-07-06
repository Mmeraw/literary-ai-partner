/** Executable Short-Form Evaluation product contract. */

import {
  getForbiddenRevisionInventoryLabels,
  getForbiddenSeverityAliases,
  getForbiddenShortFormSections,
  getShortFormSections,
  type ShortFormSection,
} from '@/lib/evaluation/shortFormSectionContract';
import {
  ALL_SURFACES,
  CONTRACT_REGISTRY_PATH,
  FORBIDDEN_RENDERER_INPUTS,
  GOVERNANCE_DOC_PATH,
  REQUIRED_OPPORTUNITY_FIELDS,
  SEVERITY_TIERS,
  buildCertificationChain,
  buildRevisionSurfaceRules,
  buildViewModelFieldBindings,
  type EvaluationContract,
  type SectionDefinition,
} from '@/lib/evaluation/contracts/evaluationProductContract';

const TEMPLATE_PATH = 'docs/templates/evaluation/short-form-evaluation-template.md';
const EXECUTABLE_CONTRACT_PATH = 'lib/evaluation/contracts/shortFormContract.ts';

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
  criteria_score_grid: ['criteriaScoreGrid'],
  criterion_rationales: ['criterionDetails'],
  confidence_explanation: ['confidenceExplanation'],
  author_facing_disclaimer: ['disclaimer'],
};

export function buildShortFormContract(): EvaluationContract {
  const sections = getShortFormSections() as ShortFormSection[];

  const sectionDefs: SectionDefinition[] = sections.map((section) => ({
    id: section.id,
    order: section.order,
    title: section.title,
    required: section.required,
    inclusionRule: section.required ? 'always' : 'when_available',
    revisionSurfaceRole: section.revisionSurfaceRole,
    mayContainFullOpportunities: section.mayContainFullOpportunities,
    mayContainRevisionCounts: section.mayContainRevisionCounts,
    mayContainRecommendationText: section.mayContainRecommendationText,
    mayCreateNewOpportunities: false,
    mustReferenceRevisionOpportunityLedger: section.mustReferenceRevisionOpportunityLedger,
    rendererExpansion: 'expanded',
    rendererVisibility: { ...section.rendererVisibility },
  }));

  return {
    mode: 'short_form_evaluation',
    templateName: 'Short-Form Evaluation Template',
    reportType: 'Short-Form Evaluation',
    route: 'SHORT_FORM',
    outputMode: 'standard_short_form',
    productLifecycle: 'active',
    templatePath: TEMPLATE_PATH,
    authorityLevel: 'executable_contract',
    implementationStatus: 'complete',
    missingExecutableRules: [],

    requiredSections: sectionDefs.filter((section) => section.required),
    optionalSections: sectionDefs.filter((section) => !section.required),
    forbiddenHeadings: getForbiddenShortFormSections(),
    forbiddenRevisionInventoryLabels: getForbiddenRevisionInventoryLabels(),

    viewModelFieldBindings: buildViewModelFieldBindings(sectionDefs, SECTION_VIEW_MODEL_PATHS),
    forbiddenRendererInputs: FORBIDDEN_RENDERER_INPUTS,

    revisionSurfaceRules: buildRevisionSurfaceRules(sectionDefs),
    requiredOpportunityFields: REQUIRED_OPPORTUNITY_FIELDS,
    severityTiers: SEVERITY_TIERS,
    forbiddenSeverityAliases: getForbiddenSeverityAliases(),
    maxTopRecommendations: 5,
    maxRevisionOpportunities: 50,

    rendererVisibility: {
      allSurfacesMustMatch: true,
      surfaces: ALL_SURFACES,
    },

    authorityChain: {
      goldenRecordPath: TEMPLATE_PATH,
      contractRegistryPath: CONTRACT_REGISTRY_PATH,
      governanceDocPath: GOVERNANCE_DOC_PATH,
    },

    certificationChain: buildCertificationChain({
      templateDoctrinePath: TEMPLATE_PATH,
      executableContractPath: EXECUTABLE_CONTRACT_PATH,
    }),
  };
}
