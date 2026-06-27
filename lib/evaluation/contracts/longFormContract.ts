/**
 * Executable legacy Long-Form Evaluation product contract.
 *
 * `long_form_evaluation` remains for historical artifact compatibility only.
 * New 25k+ submissions route to `long_form_multi_layer_evaluation` per template doctrine.
 */

import {
  getForbiddenLongFormSections,
  getRequiredLongFormHeadingSequence,
} from '@/lib/evaluation/longFormSectionContract';
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

const TEMPLATE_PATH = 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md';
const EXECUTABLE_CONTRACT_PATH = 'lib/evaluation/contracts/longFormContract.ts';

function buildLongFormSection(title: string, index: number): SectionDefinition {
  return buildSectionDefinition({
    title,
    order: index + 1,
    required: title !== 'Premise',
    inclusionRule: title === 'Premise' ? 'when_available' : 'historical_compatibility',
    mayContainFullOpportunities: title === 'Criterion Rationales & Surfaced Opportunities',
    mayContainRevisionCounts: title === 'Revision Opportunity Summary',
    mayContainRecommendationText:
      title === 'Top Recommendations' ||
      title === 'Criterion Rationales & Surfaced Opportunities' ||
      title === 'Revision Priority Plan',
    mustReferenceRevisionOpportunityLedger:
      title === 'Top Recommendations' ||
      title === 'Criterion Rationales & Surfaced Opportunities' ||
      title === 'Revision Priority Plan',
  });
}

export function buildLongFormContract(): EvaluationContract {
  const sectionDefs = getRequiredLongFormHeadingSequence().map(buildLongFormSection);

  return {
    mode: 'long_form_evaluation',
    templateName: 'Long-Form Evaluation Template',
    reportType: 'Long-Form Evaluation',
    route: 'LONG_FORM',
    outputMode: 'legacy_long_form',
    productLifecycle: 'historical_compatibility',
    templatePath: TEMPLATE_PATH,
    authorityLevel: 'executable_contract',
    implementationStatus: 'complete',
    missingExecutableRules: [],

    requiredSections: sectionDefs.filter((section) => section.required),
    optionalSections: sectionDefs.filter((section) => !section.required),
    forbiddenHeadings: getForbiddenLongFormSections(),
    forbiddenRevisionInventoryLabels: getForbiddenRevisionInventoryLabels(),

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
