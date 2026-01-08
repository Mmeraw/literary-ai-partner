/**
 * PHASE 3 FUNCTION #2: getAgentVerificationStatus
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0.md
 * Purpose: Read-only status check (no state changes)
 * 
 * Release-Blocking Tests:
 * 1. Author-safe DTO (no PII leakage)
 * 2. Industry-safe DTO (minimal fields)
 * 3. No state modification (read-only enforcement)
 * 4. Safe error shape ({ code, message, requestId })
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CANON_VERSION = 'AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0';

/**
 * Minimal DTO for verification status checks
 * Safe for both authors and industry users
 */
function toVerificationStatusDTO(industryUser) {
    return {
        verificationStatus: industryUser.verification_status,
        lastUpdated: industryUser.updated_date || industryUser.created_date,
        fullName: industryUser.full_name,
        company: industryUser.company
    };
}

/**
 * Safe error response (no stack traces, no internal IDs)
 */
function errorResponse(code, message, requestId, status = 400) {
    return Response.json({
        success: false,
        code,
        message,
        requestId,
        canonVersion: CANON_VERSION
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

        // Fetch IndustryUser record for current user
        const records = await base44.asServiceRole.entities.IndustryUser.filter({
            user_email: user.email
        });

        if (records.length === 0) {
            return Response.json({
                success: true,
                status: {
                    verificationStatus: 'UNVERIFIED',
                    note: 'No verification request on file'
                },
                canonVersion: CANON_VERSION
            });
        }

        const industryUser = records[0];

        // Return minimal DTO (read-only, no mutations)
        return Response.json({
            success: true,
            status: toVerificationStatusDTO(industryUser),
            canonVersion: CANON_VERSION
        });

    } catch (error) {
        console.error('getAgentVerificationStatus error:', error);
        return errorResponse(
            'INTERNAL_ERROR',
            'Failed to retrieve verification status',
            requestId,
            500
        );
    }
});