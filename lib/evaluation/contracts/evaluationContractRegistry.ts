/**
 * Evaluation Contract Registry
 *
 * Single canonical API for evaluation mode contracts.
 * Wraps existing section contracts (shortFormSectionContract, longFormSectionContract,
 * longFormMultiLayerSectionContract) and exposes a unified interface.
 *
 * Authority Chain:
 *   Level 1: Golden Records (templates) → define what the product IS
 *   Level 2: This registry (executable authority) → machine-readable implementation
 *   Level 3: UED / ViewModel / gates → must obey this registry
 *   Level 4: Renderers → formatting only, no business logic
 *
 * Usage:
 *   import { getEvaluationContract } from '@/lib/evaluation/contracts/evaluationContractRegistry';
 *   const contract = getEvaluationContract('short_form_evaluation');
 */

import {
  getShortFormSections,
  getForbiddenShortFormSections,
  getForbiddenRevisionInventoryLabels,
  getForbiddenSeverityAliases,
  type ShortFormSection,
} from '@/lib/evaluation/shortFormSectionContract';

import {
  getForbiddenLongFormSections,
  getRequiredLongFormHeadingSequence,
} from '@/lib/evaluation/longFormSectionContract';

import {
  getForbiddenLongFormMultiLayerSections,
  getRequiredMultiLayerHeadingSequence,
} from '@/lib/evaluation/longFormMultiLayerSectionContract';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type EvaluationMode =
  | 'short_form_evaluation'
  | 'long_form_evaluation'
  | 'long_form_multi_layer_evaluation';

export type ImplementationStatus = 'complete' | 'partial';

export type SectionDefinition = {
  id: string;
  order: number;
  title: string;
  required: boolean;
  revisionSurfaceRole: string;
  mayContainFullOpportunities: boolean;
  mayContainRecommendationText: boolean;
  mustReferenceRevisionOpportunityLedger: boolean;
  rendererVisibility: {
    web: boolean;
    pdf: boolean;
    docx: boolean;
    txt: boolean;
  };
};

export type RevisionSurfaceRule = {
  sectionId: string;
  sectionTitle: string;
  ownsOpportunities: boolean;
  ownsRecommendationText: boolean;
  ownsRevisionCounts: boolean;
  mustTraceToCanonicaLedger: boolean;
};

export type SeverityTierDefinition = {
  label: string;
  rank: number;
  description: string;
};

export type EvaluationContract = {
  mode: EvaluationMode;
  templatePath: string;
  authorityLevel: 'executable_contract';
  implementationStatus: ImplementationStatus;
  missingExecutableRules: string[];

  requiredSections: SectionDefinition[];
  optionalSections: SectionDefinition[];
  forbiddenHeadings: readonly string[];
  forbiddenRevisionInventoryLabels: readonly string[];

  revisionSurfaceRules: RevisionSurfaceRule[];
  requiredOpportunityFields: string[];
  severityTiers: SeverityTierDefinition[];
  forbiddenSeverityAliases: readonly string[];

  rendererVisibility: {
    allSurfacesMustMatch: boolean;
    surfaces: ('web' | 'pdf' | 'docx' | 'txt')[];
  };

  authorityChain: {
    goldenRecordPath: string;
    contractRegistryPath: string;
    governanceDocPath: string;
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Shared Constants
// ────────────────────────────────────────────────────────────────────────────

const REQUIRED_OPPORTUNITY_FIELDS: string[] = [
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

const SEVERITY_TIERS: SeverityTierDefinition[] = [
  { label: 'Recommended', rank: 1, description: 'High-impact revision opportunity the author should strongly consider' },
  { label: 'Optional', rank: 2, description: 'Medium-impact opportunity that would improve the work' },
  { label: 'Consider', rank: 3, description: 'Lower-impact opportunity worth noting' },
];

const GOVERNANCE_DOC_PATH = 'docs/governance/AUTHORITY_CHAIN.md';

const ALL_SURFACES: ('web' | 'pdf' | 'docx' | 'txt')[] = ['web', 'pdf', 'docx', 'txt'];

// ────────────────────────────────────────────────────────────────────────────
// Short-Form Contract (complete)
// ────────────────────────────────────────────────────────────────────────────

function buildShortFormContract(): EvaluationContract {
  const sections = getShortFormSections() as ShortFormSection[];

  const sectionDefs: SectionDefinition[] = sections.map(s => ({
    id: s.id,
    order: s.order,
    title: s.title,
    required: s.required,
    revisionSurfaceRole: s.revisionSurfaceRole,
    mayContainFullOpportunities: s.mayContainFullOpportunities,
    mayContainRecommendationText: s.mayContainRecommendationText,
    mustReferenceRevisionOpportunityLedger: s.mustReferenceRevisionOpportunityLedger,
    rendererVisibility: { ...s.rendererVisibility },
  }));

  const revisionSurfaceRules: RevisionSurfaceRule[] = sections
    .filter(s => s.mayContainFullOpportunities || s.mayContainRecommendationText || s.mayContainRevisionCounts)
    .map(s => ({
      sectionId: s.id,
      sectionTitle: s.title,
      ownsOpportunities: s.mayContainFullOpportunities,
      ownsRecommendationText: s.mayContainRecommendationText,
      ownsRevisionCounts: s.mayContainRevisionCounts,
      mustTraceToCanonicaLedger: s.mustReferenceRevisionOpportunityLedger,
    }));

  return {
    mode: 'short_form_evaluation',
    templatePath: 'docs/templates/evaluation/short-form-evaluation-template.md',
    authorityLevel: 'executable_contract',
    implementationStatus: 'complete',
    missingExecutableRules: [],

    requiredSections: sectionDefs.filter(s => s.required),
    optionalSections: sectionDefs.filter(s => !s.required),
    forbiddenHeadings: getForbiddenShortFormSections(),
    forbiddenRevisionInventoryLabels: getForbiddenRevisionInventoryLabels(),

    revisionSurfaceRules,
    requiredOpportunityFields: REQUIRED_OPPORTUNITY_FIELDS,
    severityTiers: SEVERITY_TIERS,
    forbiddenSeverityAliases: getForbiddenSeverityAliases(),

    rendererVisibility: {
      allSurfacesMustMatch: true,
      surfaces: ALL_SURFACES,
    },

    authorityChain: {
      goldenRecordPath: 'docs/templates/evaluation/short-form-evaluation-template.md',
      contractRegistryPath: 'lib/evaluation/contracts/evaluationContractRegistry.ts',
      governanceDocPath: GOVERNANCE_DOC_PATH,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Long-Form Contract (partial — heading rules only, no full section defs)
// ────────────────────────────────────────────────────────────────────────────

function buildLongFormContract(): EvaluationContract {
  const requiredHeadings = getRequiredLongFormHeadingSequence();

  const requiredSections: SectionDefinition[] = requiredHeadings.map((title, i) => ({
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    order: i + 1,
    title,
    required: true,
    revisionSurfaceRole: inferRevisionRole(title),
    mayContainFullOpportunities: title === 'Criterion Rationales & Surfaced Opportunities',
    mayContainRecommendationText: title === 'Top Recommendations' || title === 'Criterion Rationales & Surfaced Opportunities' || title === 'Revision Priority Plan',
    mustReferenceRevisionOpportunityLedger: title === 'Top Recommendations' || title === 'Criterion Rationales & Surfaced Opportunities' || title === 'Revision Priority Plan',
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
  }));

  const revisionSurfaceRules: RevisionSurfaceRule[] = requiredSections
    .filter(s => s.mayContainFullOpportunities || s.mayContainRecommendationText)
    .map(s => ({
      sectionId: s.id,
      sectionTitle: s.title,
      ownsOpportunities: s.mayContainFullOpportunities,
      ownsRecommendationText: s.mayContainRecommendationText,
      ownsRevisionCounts: s.title === 'Revision Opportunity Summary',
      mustTraceToCanonicaLedger: s.mustReferenceRevisionOpportunityLedger,
    }));

  return {
    mode: 'long_form_evaluation',
    templatePath: 'docs/templates/evaluation/long-form-evaluation-template.md',
    authorityLevel: 'executable_contract',
    implementationStatus: 'partial',
    missingExecutableRules: [
      'Full section role definitions (revisionSurfaceRole per section)',
      'Optional section inclusion rules (conditional sections)',
      'Renderer visibility per-section granularity',
      'Manuscript-Scale Continuity Findings content rules',
      'Revision Priority Plan opportunity rendering contract',
    ],

    requiredSections,
    optionalSections: [],
    forbiddenHeadings: getForbiddenLongFormSections(),
    forbiddenRevisionInventoryLabels: getForbiddenRevisionInventoryLabels(),

    revisionSurfaceRules,
    requiredOpportunityFields: REQUIRED_OPPORTUNITY_FIELDS,
    severityTiers: SEVERITY_TIERS,
    forbiddenSeverityAliases: getForbiddenSeverityAliases(),

    rendererVisibility: {
      allSurfacesMustMatch: true,
      surfaces: ALL_SURFACES,
    },

    authorityChain: {
      goldenRecordPath: 'docs/templates/evaluation/long-form-evaluation-template.md',
      contractRegistryPath: 'lib/evaluation/contracts/evaluationContractRegistry.ts',
      governanceDocPath: GOVERNANCE_DOC_PATH,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Long-Form Multi-Layer Contract (partial — heading rules only)
// ────────────────────────────────────────────────────────────────────────────

function buildMultiLayerContract(): EvaluationContract {
  const requiredHeadings = getRequiredMultiLayerHeadingSequence();

  const requiredSections: SectionDefinition[] = requiredHeadings.map((title, i) => ({
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    order: i + 1,
    title,
    required: true,
    revisionSurfaceRole: inferRevisionRole(title),
    mayContainFullOpportunities: title === 'Criterion Rationales & Surfaced Opportunities',
    mayContainRecommendationText:
      title === 'Top Recommendations' ||
      title === 'Criterion Rationales & Surfaced Opportunities' ||
      title === 'Layer-Aware Revision Sequencing',
    mustReferenceRevisionOpportunityLedger:
      title === 'Top Recommendations' ||
      title === 'Criterion Rationales & Surfaced Opportunities' ||
      title === 'Layer-Aware Revision Sequencing',
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
  }));

  const revisionSurfaceRules: RevisionSurfaceRule[] = requiredSections
    .filter(s => s.mayContainFullOpportunities || s.mayContainRecommendationText)
    .map(s => ({
      sectionId: s.id,
      sectionTitle: s.title,
      ownsOpportunities: s.mayContainFullOpportunities,
      ownsRecommendationText: s.mayContainRecommendationText,
      ownsRevisionCounts: s.title === 'Revision Opportunity Summary',
      mustTraceToCanonicaLedger: s.mustReferenceRevisionOpportunityLedger,
    }));

  return {
    mode: 'long_form_multi_layer_evaluation',
    templatePath: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
    authorityLevel: 'executable_contract',
    implementationStatus: 'partial',
    missingExecutableRules: [
      'Full section role definitions (revisionSurfaceRole per section)',
      'Optional section inclusion rules (Review Gate Readiness Surface is conditional)',
      'Renderer visibility per-section granularity',
      'Cross-Layer Synthesis content rules',
      'Layer-Aware Revision Sequencing opportunity rendering contract',
      'Readiness / Releasability Posture severity escalation rules',
    ],

    requiredSections,
    optionalSections: [],
    forbiddenHeadings: getForbiddenLongFormMultiLayerSections(),
    forbiddenRevisionInventoryLabels: getForbiddenRevisionInventoryLabels(),

    revisionSurfaceRules,
    requiredOpportunityFields: REQUIRED_OPPORTUNITY_FIELDS,
    severityTiers: SEVERITY_TIERS,
    forbiddenSeverityAliases: getForbiddenSeverityAliases(),

    rendererVisibility: {
      allSurfacesMustMatch: true,
      surfaces: ALL_SURFACES,
    },

    authorityChain: {
      goldenRecordPath: 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
      contractRegistryPath: 'lib/evaluation/contracts/evaluationContractRegistry.ts',
      governanceDocPath: GOVERNANCE_DOC_PATH,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Registry API
// ────────────────────────────────────────────────────────────────────────────

const CONTRACT_CACHE = new Map<EvaluationMode, EvaluationContract>();

/**
 * Get the evaluation contract for a given mode.
 *
 * This is the single canonical entry point for all contract queries.
 * Consumers should use this instead of importing individual section contract modules.
 */
export function getEvaluationContract(mode: EvaluationMode): EvaluationContract {
  const cached = CONTRACT_CACHE.get(mode);
  if (cached) return cached;

  let contract: EvaluationContract;
  switch (mode) {
    case 'short_form_evaluation':
      contract = buildShortFormContract();
      break;
    case 'long_form_evaluation':
      contract = buildLongFormContract();
      break;
    case 'long_form_multi_layer_evaluation':
      contract = buildMultiLayerContract();
      break;
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unknown evaluation mode: ${_exhaustive}`);
    }
  }

  CONTRACT_CACHE.set(mode, contract);
  return contract;
}

/**
 * Get all supported evaluation modes.
 */
export function getSupportedEvaluationModes(): EvaluationMode[] {
  return ['short_form_evaluation', 'long_form_evaluation', 'long_form_multi_layer_evaluation'];
}

/**
 * Check if a mode has a complete contract implementation.
 */
export function isContractComplete(mode: EvaluationMode): boolean {
  return getEvaluationContract(mode).implementationStatus === 'complete';
}

/**
 * Get the required opportunity fields that all surfaced opportunities must have.
 * Shared across all modes.
 */
export function getRequiredOpportunityFields(): readonly string[] {
  return REQUIRED_OPPORTUNITY_FIELDS;
}

/**
 * Get the canonical severity tiers. Shared across all modes.
 */
export function getSeverityTiers(): readonly SeverityTierDefinition[] {
  return SEVERITY_TIERS;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function inferRevisionRole(title: string): string {
  if (title === 'Title Block') return 'metadata';
  if (title.includes('Pitch') || title === 'Premise') return 'pitch';
  if (title === 'Content Warnings') return 'content_advisory';
  if (title === 'Revision Opportunity Summary') return 'count_summary';
  if (title === 'Executive Summary' || title === 'Top Strengths' || title === 'Top Risks' || title === 'Top Recommendations') return 'executive_synthesis';
  if (title.includes('Score Grid')) return 'score_grid';
  if (title === 'Criterion Rationales & Surfaced Opportunities') return 'canonical_diagnostic';
  if (title === 'Confidence Explanation') return 'diagnostic_explanation';
  if (title === 'Author-Facing Disclaimer') return 'legal_boundary';
  if (title.includes('Revision') || title.includes('Layer-Aware')) return 'revision_surface';
  if (title.includes('Continuity') || title.includes('Cross-Layer') || title.includes('Readiness')) return 'structural_analysis';
  return 'content';
}
