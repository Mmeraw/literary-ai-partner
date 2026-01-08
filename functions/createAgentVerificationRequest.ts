/**
 * PHASE 3 FUNCTION #1: createAgentVerificationRequest
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0.md
 * State Transition: UNVERIFIED → PENDING (agent-initiated, self-service)
 * 
 * Release-Blocking Tests:
 * 1. Role gate (AUTHOR → 403)
 * 2. State machine (only UNVERIFIED→PENDING)
 * 3. Allowlist DTO (toAuthorDTO only)
 * 4. Safe error shape ({ code, message, requestId })
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CANON_VERSION = 'AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0';

const ALLOWED_ROLE_TYPES = ['agent', 'producer', 'executive', 'manager'];

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

        // ROLE GATE: Authors cannot request industry verification
        if (user.role === 'author' || user.role === 'user') {
            return errorResponse(
                'ROLE_FORBIDDEN',
                'Authors cannot request industry verification',
                requestId,
                403
            );
        }

        const { full_name, company, role_type, bio, linkedin_url, imdb_url } = await req.json();

        // Validation: Required fields
        if (!full_name || !company || !role_type) {
            return errorResponse(
                'VALIDATION_FAILED',
                'Missing required fields: full_name, company, role_type',
                requestId
            );
        }

        // Validation: role_type must be in allowlist
        if (!ALLOWED_ROLE_TYPES.includes(role_type)) {
            return errorResponse(
                'VALIDATION_FAILED',
                `Invalid role_type. Must be one of: ${ALLOWED_ROLE_TYPES.join(', ')}`,
                requestId
            );
        }

        // Check for existing IndustryUser record
        const existingRecords = await base44.asServiceRole.entities.IndustryUser.filter({
            user_email: user.email
        });

        if (existingRecords.length > 0) {
            const existing = existingRecords[0];

            // STATE MACHINE: If already PENDING, idempotent return
            if (existing.verification_status === 'PENDING') {
                return Response.json({
                    success: true,
                    request: toAuthorDTO(existing),
                    note: 'Verification request already pending',
                    canonVersion: CANON_VERSION
                });
            }

            // STATE MACHINE: Cannot transition from VERIFIED or REJECTED back to PENDING
            if (['VERIFIED', 'REJECTED', 'REVOKED'].includes(existing.verification_status)) {
                return errorResponse(
                    'STATE_VIOLATION',
                    `Cannot request verification from status: ${existing.verification_status}`,
                    requestId
                );
            }

            // STATE MACHINE: UNVERIFIED → PENDING (update existing record)
            if (existing.verification_status === 'UNVERIFIED') {
                const updated = await base44.asServiceRole.entities.IndustryUser.update(existing.id, {
                    full_name,
                    company,
                    role_type,
                    bio: bio || existing.bio,
                    linkedin_url: linkedin_url || existing.linkedin_url,
                    imdb_url: imdb_url || existing.imdb_url,
                    verification_status: 'PENDING'
                });

                return Response.json({
                    success: true,
                    request: toAuthorDTO(updated),
                    submitted_at: new Date().toISOString(),
                    canonVersion: CANON_VERSION
                });
            }
        }

        // Create new IndustryUser record (initial state: PENDING)
        const newRecord = await base44.asServiceRole.entities.IndustryUser.create({
            user_email: user.email,
            full_name,
            company,
            role_type,
            bio: bio || '',
            linkedin_url: linkedin_url || '',
            imdb_url: imdb_url || '',
            verification_status: 'PENDING'
        });

        return Response.json({
            success: true,
            request: toAuthorDTO(newRecord),
            submitted_at: new Date().toISOString(),
            canonVersion: CANON_VERSION
        });

    } catch (error) {
        console.error('createAgentVerificationRequest error:', error);
        return errorResponse(
            'INTERNAL_ERROR',
            'Failed to process verification request',
            requestId,
            500
        );
    }
});