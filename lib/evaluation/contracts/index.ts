/**
 * Evaluation Contract Registry — Public API
 *
 * Single entry point for all evaluation mode contracts.
 *
 * Usage:
 *   import { getEvaluationContract } from '@/lib/evaluation/contracts';
 */

export {
  getEvaluationContract,
  getSupportedEvaluationModes,
  isContractComplete,
  getRequiredOpportunityFields,
  getSeverityTiers,
  type EvaluationMode,
  type EvaluationContract,
  type SectionDefinition,
  type RevisionSurfaceRule,
  type SeverityTierDefinition,
  type ImplementationStatus,
} from './evaluationContractRegistry';
