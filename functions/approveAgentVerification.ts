/**
 * PHASE 3 FUNCTION #3: approveAgentVerification
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0.md
 * State Transition: PENDING → VERIFIED (admin-only)
 * 
 * Release-Blocking Tests:
 * 1. Non-admin denied (403)
 * 2. State machine (only PENDING→VERIFIED allowed)
 * 3. Allowlist DTO (toAuthorDTO only)
 * 4. Safe error shape ({ code, message, requestId })
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CANON_VERSION = 'AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0';

/**
 * Admin Decision DTO (ADMIN_VERIFICATION_DECISION_DTO_v1.0.0)
 * Admin-only verification decision response - never use author DTOs in admin functions
 */
function toAdminVerificationDecisionDTO(targetUserId, previousState, newState, rolesGranted, agencyOrgId, requestId, updatedAt) {
    const dto = {
        targetUserId,
        previousState,
        newState,
        rolesGranted,
        requestId,
        updatedAt
    };
    if (agencyOrgId) {
        dto.agencyOrgId = agencyOrgId;
    }
    return dto;
}

/**
 * Safe error response (no stack traces, no internal IDs)
 * Canon shape: { code, message, requestId } ONLY
 */
function errorResponse(code, message, requestId, status = 400) {
    return Response.json({
        code,
        message,
        requestId
    }, { status });
}

Deno.serve(async (req) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return errorResponse('UNAUTHORIZED', 'Authentication required', requestId, 401);
        }

        // ADMIN GATE: Only admins can approve verification requests
        if (user.role !== 'admin') {
            return errorResponse(
                'ADMIN_REQUIRED',
                'Only administrators can approve verification requests',
                requestId,
                403
            );
        }

        const { industry_user_id } = await req.json();

        // Validation: Required field
        if (!industry_user_id) {
            return errorResponse(
                'VALIDATION_FAILED',
                'Missing required field: industry_user_id',
                requestId
            );
        }

        // Fetch the IndustryUser record
        const records = await base44.asServiceRole.entities.IndustryUser.filter({
            id: industry_user_id
        });

        if (records.length === 0) {
            return errorResponse(
                'NOT_FOUND',
                'Industry user record not found',
                requestId,
                404
            );
        }

        const industryUser = records[0];

        // STATE MACHINE: Only PENDING → VERIFIED transition allowed
        if (industryUser.verification_status !== 'PENDING') {
            return errorResponse(
                'STATE_VIOLATION',
                `Cannot approve from status: ${industryUser.verification_status}. Only PENDING requests can be approved.`,
                requestId
            );
        }

        const previousState = industryUser.verification_status;
        const newState = 'VERIFIED';
        const updatedAt = new Date().toISOString();

        // Transition: PENDING → VERIFIED
        const updated = await base44.asServiceRole.entities.IndustryUser.update(industryUser.id, {
            verification_status: newState,
            verification_date: updatedAt,
            verified_by: user.email
        });

        // ROLE GRANT: Grant INDUSTRY_USER role to enable /agent/* access
        const targetUser = await base44.asServiceRole.entities.User.filter({
            email: industryUser.user_email
        });

        if (targetUser.length === 0) {
            return errorResponse(
                'USER_NOT_FOUND',
                'User account not found for industry user',
                requestId,
                404
            );
        }

        // Grant INDUSTRY_USER role (enables /agent/* access via role gate)
        await base44.asServiceRole.entities.User.update(targetUser[0].id, {
            role: 'INDUSTRY_USER'
        });

        const rolesGranted = ['INDUSTRY_USER'];

        // AUDIT LOGGING: Emit append-only audit events
        await base44.asServiceRole.entities.EvaluationAuditEvent.create({
            event_type: 'verification_approved',
            entity_type: 'IndustryUser',
            entity_id: updated.id,
            user_email: user.email,
            metadata: {
                target_user_email: industryUser.user_email,
                previous_state: previousState,
                new_state: newState,
                verified_by: user.email,
                request_id: requestId
            }
        });

        await base44.asServiceRole.entities.EvaluationAuditEvent.create({
            event_type: 'industry_access_granted',
            entity_type: 'User',
            entity_id: targetUser[0].id,
            user_email: user.email,
            metadata: {
                target_user_email: industryUser.user_email,
                roles_granted: rolesGranted,
                request_id: requestId
            }
        });

        return Response.json(
            toAdminVerificationDecisionDTO(
                industryUser.user_email,
                previousState,
                newState,
                rolesGranted,
                null, // agencyOrgId (optional, not implemented yet)
                requestId,
                updatedAt
            )
        );

    } catch (error) {
        console.error('approveAgentVerification error:', error);
        return errorResponse(
            'INTERNAL_ERROR',
            'Failed to approve verification request',
            requestId,
            500
        );
    }
});