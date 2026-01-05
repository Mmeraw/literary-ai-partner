/**
 * GOVERNANCE VERSION CONSTANT
 * 
 * This file defines the current governance specification version
 * that is in force for this deployment.
 * 
 * CRITICAL: This version MUST match the version in:
 * functions/MASTER_FUNCTION_GOVERNANCE_SPEC.md
 * 
 * When the spec is updated and versioned, this constant MUST be updated
 * in sync to ensure audit trail integrity.
 */

export const GOVERNANCE_VERSION = "1.0.0";

/**
 * Canon document hashes (updated when canon docs change)
 * These should match the governing canon documents for each flow
 */
export const CANON_HASHES = {
    EVALUATE_ENTRY_CANON: "EVALUATE_ENTRY_CANON_v1.2",
    WAVE_GUIDE: "WAVE_GUIDE_v2.1",
    SYNOPSIS_SPEC: "SYNOPSIS_SPEC_v1.0",
    QUERY_LETTER_SPEC: "QUERY_LETTER_SPEC_v1.0",
    SCREENPLAY_QUALITY_STANDARD: "SCREENPLAY_QUALITY_STANDARD_v1.0",
    AGENT_PACKAGE_SPEC: "AGENT_PACKAGE_SPEC_v1.0",
    PITCH_DECK_SPEC: "PITCH_DECK_SPEC_v1.0",
    COMPARABLES_SPEC: "COMPARABLES_SPEC_v1.0"
};

/**
 * Standardized refusal/validation response builder
 * 
 * Ensures all validation failures conform to the Global Refusal Schema
 * defined in MASTER_FUNCTION_GOVERNANCE_SPEC.md
 */
export function buildRefusalResponse({
    status = "blocked",
    code,
    userMessage,
    developerMessage = null,
    refusalReason,
    nextAction = "none"
}) {
    return {
        status,
        code,
        user_message: userMessage,
        developer_message: developerMessage,
        refusal_reason: refusalReason,
        next_action: nextAction
    };
}

/**
 * Build audit event base fields
 * Ensures all audit events include required governance fields
 */
export function buildAuditBase({
    eventName,
    functionId,
    canonHash,
    userEmail,
    requestId = null
}) {
    return {
        event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        request_id: requestId || `req_${Date.now()}`,
        timestamp_utc: new Date().toISOString(),
        function_id: functionId,
        canon_hash: canonHash,
        governance_version: GOVERNANCE_VERSION,
        user_email: userEmail
    };
}