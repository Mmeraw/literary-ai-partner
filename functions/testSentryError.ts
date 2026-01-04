import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureCritical } from './utils/errorTracking.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Simulate a realistic error scenario
        const manuscriptId = "test_manuscript_12345";
        const attemptedOperation = "spine_evaluation";
        
        const testError = new Error('SENTRY TEST: Synopsis generation failed - missing spine evaluation');
        testError.name = 'SynopsisGenerationError';
        
        // Send to Sentry with comprehensive context
        await captureCritical(testError, {
            userId: user?.email || 'anonymous',
            function: 'testSentryError',
            operation: attemptedOperation,
            manuscriptId: manuscriptId,
            errorType: 'ERR_SYNOPSIS_PRECONDITION_MISSING_SPINE',
            spine_score: 4.2,
            spine_status: 'INCOMPLETE',
            wave_flags_status: 'COMPLETE',
            thirteen_criteria_status: 'COMPLETE',
            timestamp: new Date().toISOString(),
            testId: `test-${Date.now()}`,
            environment: Deno.env.get('BASE44_ENV') || 'production',
            request_metadata: {
                method: req.method,
                url: req.url,
                user_agent: req.headers.get('user-agent')
            }
        });

        return Response.json({
            success: true,
            message: 'Realistic test error sent to Sentry successfully',
            userId: user?.email || 'anonymous',
            sentryConfigured: !!Deno.env.get('SENTRY_DSN'),
            errorContext: {
                errorType: 'ERR_SYNOPSIS_PRECONDITION_MISSING_SPINE',
                manuscriptId,
                operation: attemptedOperation
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return Response.json(
            { 
                success: false,
                error: error.message,
                stack: error.stack 
            },
            { status: 500 }
        );
    }
});