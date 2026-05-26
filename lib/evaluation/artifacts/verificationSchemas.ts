import type { RuntimeArtifactEnvelope } from './artifactTypes';

export const EXTERNAL_VERIFICATION_TEXT_CAP = 500;
export const EXTERNAL_VERIFICATION_ID_CAP = 120;

const STRUCTURED_TOKEN_RE = /^[A-Z0-9_:-]+$/;

export type FactualAuditDomain =
  | 'geography'
  | 'timeline'
  | 'technical_plausibility'
  | 'historical_fact';

export type FactualAnomaliesDetectedV1 = {
  envelope: RuntimeArtifactEnvelope & {
    artifact_type: 'factual_anomalies_detected_v1';
    artifact_version: 'v1';
  };
  has_anomalies: boolean;
  anomalies: Array<{
    anomaly_id: string;
    domain: FactualAuditDomain;
    subject_matter: string;
    /** Short reference to a claim found during baseline ingest. */
    reported_claim: string;
    verified_reality: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    /** Strictly capped summary; never an essay/prose synthesis channel. */
    suggested_correction_summary: string;
  }>;
};

export type ExternalReportCrosscheckV1 = {
  envelope: RuntimeArtifactEnvelope & {
    artifact_type: 'external_report_crosscheck_v1';
    artifact_version: 'v1';
  };
  verdict: 'PASS' | 'FAIL';
  crosscheck_timestamp: string;
  violations: Array<{
    rule_id: 'forbidden_terminology' | 'ledger_contradiction' | 'structural_hallucination';
    /** Strictly capped to prevent report-text exfiltration or essay drift. */
    offending_text_snippet: string;
    /** 1-based index of the contradicted accepted_story_ledger_v1 layer. */
    contradicted_ledger_layer: number;
    /** Tokenized reason code for internal routing/logging logic. */
    reason_code: string;
    /** Strictly capped summary; never an open-ended analytical channel. */
    reason_summary: string;
  }>;
};

export function capExternalVerificationText(value: string): string {
  return value.slice(0, EXTERNAL_VERIFICATION_TEXT_CAP);
}

export function assertExternalVerificationTextCap(value: string, fieldName: string): void {
  if (value.length > EXTERNAL_VERIFICATION_TEXT_CAP) {
    throw new Error(`${fieldName} must be ${EXTERNAL_VERIFICATION_TEXT_CAP} characters or fewer`);
  }
}

export function assertExternalVerificationIdCap(value: string, fieldName: string): void {
  if (value.length > EXTERNAL_VERIFICATION_ID_CAP) {
    throw new Error(`${fieldName} must be ${EXTERNAL_VERIFICATION_ID_CAP} characters or fewer`);
  }
}

export function assertStructuredToken(value: string, fieldName: string): void {
  assertExternalVerificationIdCap(value, fieldName);
  if (!STRUCTURED_TOKEN_RE.test(value)) {
    throw new Error(`${fieldName} must be a structured token using uppercase letters, numbers, underscores, colons, or hyphens`);
  }
}

export function assertExternalReportCrosscheckBounds(artifact: ExternalReportCrosscheckV1): void {
  for (const violation of artifact.violations) {
    assertExternalVerificationTextCap(violation.offending_text_snippet, 'offending_text_snippet');
    assertExternalVerificationTextCap(violation.reason_summary, 'reason_summary');
    assertStructuredToken(violation.reason_code, 'reason_code');

    if (!Number.isInteger(violation.contradicted_ledger_layer) || violation.contradicted_ledger_layer < 1) {
      throw new Error('contradicted_ledger_layer must be a positive 1-based integer');
    }
  }
}

export function assertFactualAnomalyBounds(artifact: FactualAnomaliesDetectedV1): void {
  for (const anomaly of artifact.anomalies) {
    assertExternalVerificationIdCap(anomaly.anomaly_id, 'anomaly_id');
    assertExternalVerificationTextCap(anomaly.subject_matter, 'subject_matter');
    assertExternalVerificationTextCap(anomaly.reported_claim, 'reported_claim');
    assertExternalVerificationTextCap(anomaly.verified_reality, 'verified_reality');
    assertExternalVerificationTextCap(anomaly.suggested_correction_summary, 'suggested_correction_summary');
  }
}
