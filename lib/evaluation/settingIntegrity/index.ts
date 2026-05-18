/**
 * Setting Integrity Audit — Public exports
 *
 * Types only in PR-A.
 * Claim extraction worker exported from PR-A (processor).
 * External API integrations added in PR-B.
 * Report UI types added in PR-C.
 * Governance enforcement + entitlement guard exported from PR-D.
 */
export type {
  ClaimCategory,
  VerificationTier,
  ConfidenceLevel,
  VerificationStatus,
  ManuscriptSettingContext,
  WorldDetailClaim,
  SettingIntegrityAudit,
  SettingIntegrityAuditArtifactContent,
  SettingIntegrityEntitlement,
} from './types';
