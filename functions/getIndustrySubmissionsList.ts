/**
 * PHASE 3 FUNCTION #6: getIndustrySubmissionsList
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0.md
 * State Transition: NONE (read-only)
 * 
 * Release-Blocking Tests:
 * 1. Industry-only gate (AUTHOR/ADMIN denied with 403)
 * 2. Read-only guarantee (no mutations)
 * 3. Pagination support (limit/offset)
 * 4. Allowlist DTO (safe fields only)
 * 5. Safe error shape ({ code, message, requestId })
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CANON_VERSION = 'AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Submission Allowlist DTO (INDUSTRY_SUBMISSION_DTO_v1.0.0)
 * Only these fields visible to industry users browsing submissions
 */
function toIndustrySubmissionDTO(submission) {
    return {
        id: submission.id,
        title: submission.project_title,
        format: submission.format,
        genre: submission.genre,
        primaryPath: submission.primaryPath,
        evaluationScore: submission.evaluationScore,
        projectStage: submission.project_stage,
        submittedAt: submission.created_date,
        status: submission.status
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

        // INDUSTRY-ONLY GATE: Only verified industry users can access submission lists
        if (user.role !== 'INDUSTRY_USER') {
            return errorResponse(
                'INDUSTRY_ACCESS_REQUIRED',
                'Only verified industry users can access submission lists',
                requestId,
                403
            );
        }

        const { limit, offset, filter } = await req.json().catch(() => ({}));

        // Pagination parameters
        const pageSize = Math.min(limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
        const skip = offset || 0;

        // READ-ONLY: Query submissions (no writes, no mutations)
        // Only fetch submissions that are eligible for industry review
        const filterCriteria = {
            screeningStatus: 'ELIGIBLE',
            status: 'pending_review',
            ...(filter || {})
        };

        const submissions = await base44.asServiceRole.entities.StorygateSubmission.filter(
            filterCriteria,
            '-created_date', // Sort by newest first
            pageSize,
            skip
        );

        // Get total count for pagination metadata
        const allSubmissions = await base44.asServiceRole.entities.StorygateSubmission.filter(
            filterCriteria
        );
        const totalCount = allSubmissions.length;

        // Map to allowlist DTO
        const submissionDTOs = submissions.map(toIndustrySubmissionDTO);

        return Response.json({
            submissions: submissionDTOs,
            pagination: {
                limit: pageSize,
                offset: skip,
                total: totalCount,
                hasMore: skip + pageSize < totalCount
            }
        });

    } catch (error) {
        console.error('getIndustrySubmissionsList error:', error);
        return errorResponse(
            'INTERNAL_ERROR',
            'Failed to retrieve submissions list',
            requestId,
            500
        );
    }
});