/**
 * Evaluation Contract Registry
 *
 * Single canonical API for evaluation mode contracts.
 *
 * Authority Chain:
 *   Level 1: Template doctrine → defines what the product IS
 *   Level 2: Explicit executable product contracts → machine-readable implementation
 *   Level 3: UED / author-exposure certification / ViewModel gates → must obey contracts
 *   Level 4: Renderers → formatting only, no business logic
 */

import { buildShortFormContract } from '@/lib/evaluation/contracts/shortFormContract';
import { buildLongFormContract } from '@/lib/evaluation/contracts/longFormContract';
import { buildLongFormMultiLayerContract } from '@/lib/evaluation/contracts/longFormMultiLayerContract';
import {
  REQUIRED_OPPORTUNITY_FIELDS,
  SEVERITY_TIERS,
  type EvaluationContract,
  type EvaluationMode,
  type ImplementationStatus,
  type ProductLifecycle,
  type RevisionSurfaceRule,
  type SectionDefinition,
  type SeverityTierDefinition,
} from '@/lib/evaluation/contracts/evaluationProductContract';

export type {
  EvaluationContract,
  EvaluationMode,
  ImplementationStatus,
  ProductLifecycle,
  RevisionSurfaceRule,
  SectionDefinition,
  SeverityTierDefinition,
};

const CONTRACT_BUILDERS: Record<EvaluationMode, () => EvaluationContract> = {
  short_form_evaluation: buildShortFormContract,
  long_form_evaluation: buildLongFormContract,
  long_form_multi_layer_evaluation: buildLongFormMultiLayerContract,
};

const SUPPORTED_EVALUATION_MODES: EvaluationMode[] = [
  'short_form_evaluation',
  'long_form_evaluation',
  'long_form_multi_layer_evaluation',
];

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

  const builder = CONTRACT_BUILDERS[mode];
  if (!builder) {
    throw new Error(`Unknown evaluation mode: ${mode as string}`);
  }

  const contract = builder();
  CONTRACT_CACHE.set(mode, contract);
  return contract;
}

/** Get all supported evaluation modes, including historical artifact compatibility modes. */
export function getSupportedEvaluationModes(): EvaluationMode[] {
  return [...SUPPORTED_EVALUATION_MODES];
}

/** Get modes that may be used for new submissions. */
export function getActiveEvaluationModes(): EvaluationMode[] {
  return SUPPORTED_EVALUATION_MODES.filter((mode) => getEvaluationContract(mode).productLifecycle === 'active');
}

/** Check if a mode has a complete executable contract implementation. */
export function isContractComplete(mode: EvaluationMode): boolean {
  return getEvaluationContract(mode).implementationStatus === 'complete';
}

/** Check if a mode is active for new submissions rather than historical rendering compatibility. */
export function isActiveEvaluationMode(mode: EvaluationMode): boolean {
  return getEvaluationContract(mode).productLifecycle === 'active';
}

/**
 * Get the required opportunity fields that all surfaced opportunities must have.
 * Shared across all modes.
 */
export function getRequiredOpportunityFields(): readonly string[] {
  return REQUIRED_OPPORTUNITY_FIELDS;
}

/** Get the canonical severity tiers. Shared across all modes. */
export function getSeverityTiers(): readonly SeverityTierDefinition[] {
  return SEVERITY_TIERS;
}

/** Template metadata used by UED construction and render-parity certification. */
export function getEvaluationTemplateContractMetadata(): Record<EvaluationMode, {
  templateName: string;
  reportType: string;
  templatePath: string;
}> {
  return Object.fromEntries(
    SUPPORTED_EVALUATION_MODES.map((mode) => {
      const contract = getEvaluationContract(mode);
      return [mode, {
        templateName: contract.templateName,
        reportType: contract.reportType,
        templatePath: contract.templatePath,
      }];
    }),
  ) as Record<EvaluationMode, { templateName: string; reportType: string; templatePath: string }>;
}
