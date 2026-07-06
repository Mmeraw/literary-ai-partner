/** Executable Long-Form Multi-Layer Evaluation product contract. */

import {
  getForbiddenLongFormMultiLayerSections,
} from '@/lib/evaluation/longFormMultiLayerSectionContract';
import {
  getForbiddenRevisionInventoryLabels,
  getForbiddenSeverityAliases,
} from '@/lib/evaluation/shortFormSectionContract';
import {
  ALL_SURFACES,
  CONTRACT_REGISTRY_PATH,
  GOVERNANCE_DOC_PATH,
  REQUIRED_OPPORTUNITY_FIELDS,
  SEVERITY_TIERS,
  buildCertificationChain,
  buildRevisionSurfaceRules,
  buildSectionDefinition,
  type EvaluationContract,
  type SectionDefinition,
} from '@/lib/evaluation/contracts/evaluationProductContract';
import {
  buildLongFormMultiLayerViewModelFieldBindings,
  getLongFormMultiLayerForbiddenRendererInputs,
} from '@/lib/evaluation/contracts/longFormMultiLayerViewModelBindings';

const TEMPLATE_PATH = 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md';
const EXECUTABLE_CONTRACT_PATH = 'lib/evaluation/contracts/longFormMultiLayerContract.ts';

const ALWAYS_PRODUCED_SECTION_TITLES = [
  'Title Block',
  'One-Paragraph Pitch',
  'One-Sentence Pitch',
  'Premise',
  'Content Warnings',
  'Revision Opportunity Summary',
  'Executive Summary',
  'Top Strengths',
  'Top Risks',
  'Top Recommendations',
  '13 Criteria Score Grid',
  'Criterion Rationales & Surfaced Opportunities',
  'Narrative Synthesis',
  'Market Shelf',
  'Layer-Aware Revision Sequencing',
  'Long-Form Continuity and Coverage Proof',
  'Readiness / Releasability Posture',
  'Confidence Explanation',
  'Author-Facing Disclaimer',
] as const;

const WHERE_APPLICABLE_SECTION_TITLES = [
  'Structural Stack',
  'Arc Map',
  'Layer-by-Layer Analysis',
  'Cross-Layer Integration',
  'Review Gate readiness surface',
  'Governed ledgers or compact governed-ledger addenda',
] as const;

function revisionFlags(title: string): Pick<SectionDefinition,
  'mayContainFullOpportunities' |
  'mayContainRevisionCounts' |
  'mayContainRecommendationText' |
  'mustReferenceRevisionOpportunityLedger' |
  'rendererExpansion'
> {
  const ownsCanonicalOpportunities = title === 'Criterion Rationales & Surfaced Opportunities';
  const summarizesOrSequencesOpportunities =
    title === 'Top Recommendations' ||
    title === 'Layer-Aware Revision Sequencing' ||
    title === 'Review Gate readiness surface';

  return {
    mayContainFullOpportunities: ownsCanonicalOpportunities,
    mayContainRevisionCounts: title === 'Revision Opportunity Summary',
    mayContainRecommendationText: ownsCanonicalOpportunities || summarizesOrSequencesOpportunities,
    mustReferenceRevisionOpportunityLedger: ownsCanonicalOpportunities || summarizesOrSequencesOpportunities,
    rendererExpansion:
      title === 'Criterion Rationales & Surfaced Opportunities' || title === 'Layer-Aware Revision Sequencing'
        ? 'expanded'
        : 'compact',
  };
}

function buildAlwaysProducedSection(title: string, index: number): SectionDefinition {
  return buildSectionDefinition({
    title,
    order: index + 1,
    required: title !== 'Premise',
    inclusionRule: title === 'Premise' ? 'when_available' : 'always',
    ...revisionFlags(title),
  });
}

function buildWhereApplicableSection(title: string, index: number): SectionDefinition {
  return buildSectionDefinition({
    title,
    order: ALWAYS_PRODUCED_SECTION_TITLES.length + index + 1,
    required: false,
    inclusionRule: 'where_applicable',
    ...revisionFlags(title),
  });
}

export function buildLongFormMultiLayerContract(): EvaluationContract {
  const sectionDefs = [
    ...ALWAYS_PRODUCED_SECTION_TITLES.map(buildAlwaysProducedSection),
    ...WHERE_APPLICABLE_SECTION_TITLES.map(buildWhereApplicableSection),
  ];

  return {
    mode: 'long_form_multi_layer_evaluation',
    templateName: 'Long-Form Multi-Layer Evaluation Template',
    reportType: 'Long-Form Multi-Layer Evaluation',
    route: 'LONG_FORM',
    outputMode: 'multi_layer_long_form',
    productLifecycle: 'active',
    templatePath: TEMPLATE_PATH,
    authorityLevel: 'executable_contract',
    implementationStatus: 'complete',
    missingExecutableRules: [],

    requiredSections: sectionDefs.filter((section) => section.required),
    optionalSections: sectionDefs.filter((section) => !section.required),
    forbiddenHeadings: getForbiddenLongFormMultiLayerSections(),
    forbiddenRevisionInventoryLabels: getForbiddenRevisionInventoryLabels(),

    viewModelFieldBindings: buildLongFormMultiLayerViewModelFieldBindings(sectionDefs),
    forbiddenRendererInputs: getLongFormMultiLayerForbiddenRendererInputs(),

    revisionSurfaceRules: buildRevisionSurfaceRules(sectionDefs),
    requiredOpportunityFields: REQUIRED_OPPORTUNITY_FIELDS,
    severityTiers: SEVERITY_TIERS,
    forbiddenSeverityAliases: getForbiddenSeverityAliases(),
    maxTopRecommendations: 5,
    maxRevisionOpportunities: 100,

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
