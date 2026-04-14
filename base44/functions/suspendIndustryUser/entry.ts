/**
 * PHASE 3 FUNCTION #5: suspendIndustryUser
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0.md
 * State Transition: VERIFIED → SUSPENDED (admin-only)
 * 
 * Release-Blocking Tests:
 * 1. Non-admin denied (403)
 * 2. State machine (only VERIFIED→SUSPENDED allowed)
 * 3. Access revoked (/agent/* returns 403 post-suspension)
 * 4. Session invalidation enforced
 * 5. Admin DTO keyset exact
 * 6. Audit events emitted (verification_suspended + industry_access_revoked)
 * 7. Safe error shape ({ code, message, requestId })
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CANON_VERSION = 'AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0';

/**
 * Admin Decision DTO (ADMIN_VERIFICATION_DECISION_DTO_v1.0.0)
 * Admin-only suspension decision response
 */
function toAdminSuspensionDecisionDTO(targetUserId, previousState, newState, rolesRevoked, accessRevoked, requestId, updatedAt) {
    return {
        targetUserId,
        previousState,
        newState,
        rolesRevoked,
        accessRevoked,
        requestId,
        updatedAt
    };
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

        // ADMIN GATE: Only admins can suspend industry users
        if (user.role !== 'admin') {
            return errorResponse(
                'ADMIN_REQUIRED',
                'Only administrators can suspend industry users',
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

        // STATE MACHINE: Only VERIFIED → SUSPENDED transition allowed
        if (industryUser.verification_status !== 'VERIFIED') {
            return errorResponse(
                'STATE_VIOLATION',
                `Cannot suspend from status: ${industryUser.verification_status}. Only VERIFIED users can be suspended.`,
                requestId
            );
        }

        const previousState = industryUser.verification_status;
        const newState = 'SUSPENDED';
        const updatedAt = new Date().toISOString();

        // Transition: VERIFIED → SUSPENDED
        await base44.asServiceRole.entities.IndustryUser.update(industryUser.id, {
            verification_status: newState,
            suspended: true
        });

        // ACCESS REVOCATION: Revoke INDUSTRY_USER role to disable /agent/* access
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

        // SESSION INVALIDATION: Set revoked_at timestamp to invalidate existing sessions
        await base44.asServiceRole.entities.User.update(targetUser[0].id, {
            role: 'user', // Revoke INDUSTRY_USER role
            revoked_at: updatedAt // Invalidate existing sessions/tokens
        });

        const rolesRevoked = ['INDUSTRY_USER'];
        const accessRevoked = ['/agent/*'];

        // AUDIT LOGGING: Emit append-only audit events
        await base44.asServiceRole.entities.EvaluationAuditEvent.create({
            event_type: 'verification_suspended',
            entity_type: 'IndustryUser',
            entity_id: industryUser.id,
            user_email: user.email,
            metadata: {
                target_user_email: industryUser.user_email,
                previous_state: previousState,
                new_state: newState,
                suspended_by: user.email,
                request_id: requestId
            }
        });

        await base44.asServiceRole.entities.EvaluationAuditEvent.create({
            event_type: 'industry_access_revoked',
            entity_type: 'User',
            entity_id: targetUser[0].id,
            user_email: user.email,
            metadata: {
                target_user_email: industryUser.user_email,
                roles_revoked: rolesRevoked,
                access_revoked: accessRevoked,
                session_invalidated: true,
                request_id: requestId
            }
        });

        return Response.json(
            toAdminSuspensionDecisionDTO(
                industryUser.user_email,
                previousState,
                newState,
                rolesRevoked,
                accessRevoked,
                requestId,
                updatedAt
            )
        );

    } catch (error) {
        console.error('suspendIndustryUser error:', error);
        return errorResponse(
            'INTERNAL_ERROR',
            'Failed to suspend industry user',
            requestId,
            500
        );
    }
});