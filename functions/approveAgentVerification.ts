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
 * DTO Allowlist (AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0)
 * Only these fields returned to non-admin users
 */
function toAuthorDTO(industryUser) {
    return {
        id: industryUser.id,
        full_name: industryUser.full_name,
        company: industryUser.company,
        role_type: industryUser.role_type,
        verification_status: industryUser.verification_status,
        bio: industryUser.bio
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

        // Transition: PENDING → VERIFIED
        const updated = await base44.asServiceRole.entities.IndustryUser.update(industryUser.id, {
            verification_status: 'VERIFIED',
            verification_date: new Date().toISOString(),
            verified_by: user.email
        });

        return Response.json({
            approved: toAuthorDTO(updated),
            verified_at: updated.verification_date,
            verified_by: user.email
        });

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