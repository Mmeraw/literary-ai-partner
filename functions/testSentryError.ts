import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureCritical } from './utils/errorTracking.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Simulate a catastrophic multi-stage failure
        const manuscriptId = "ms_7f4a9c2e_novel_draft_final_v8";
        const chapterId = "ch_142_climax_scene";
        const operationChain = ["fetch_manuscript", "validate_spine", "run_13_criteria", "generate_synopsis", "validate_output"];
        
        // Create nested error chain (realistic production scenario)
        const rootCause = new Error('Database connection timeout after 30000ms');
        rootCause.name = 'DatabaseTimeoutError';
        rootCause.code = 'ETIMEDOUT';
        
        const dbError = new Error('Failed to fetch manuscript chapters: Connection pool exhausted');
        dbError.name = 'DatabaseError';
        dbError.cause = rootCause;
        dbError.query = 'SELECT * FROM chapters WHERE manuscript_id = $1 ORDER BY chapter_number';
        dbError.params = [manuscriptId];
        
        const validationError = new Error('WAVE validation cascade failure: 37 violations detected across 12 chapters');
        validationError.name = 'WAVEValidationError';
        validationError.cause = dbError;
        validationError.violations = [
            'WAVE-SYN-01: POV supremacy violated in chapters 3, 7, 14',
            'WAVE-SYN-02: Character elevation threshold exceeded (minor character promoted)',
            'WAVE-SYN-04: Meta-layer containment breach in chapter epilogue',
            'Spine score below threshold: 4.2/10 (minimum: 7.0)',
            '13 Criteria incomplete: Only 8/13 criteria scored',
            'Missing protagonist objective in Act II'
        ];
        
        const synopsisError = new Error('CRITICAL: Synopsis generation aborted - multiple precondition failures');
        synopsisError.name = 'SynopsisGenerationCriticalError';
        synopsisError.cause = validationError;
        
        // Send comprehensive error context to Sentry
        await captureCritical(synopsisError, {
            // User context
            userId: user?.email || 'anonymous',
            userRole: user?.role || 'unknown',
            
            // Error chain
            errorChain: [
                { level: 1, error: 'DatabaseTimeoutError', message: rootCause.message },
                { level: 2, error: 'DatabaseError', message: dbError.message },
                { level: 3, error: 'WAVEValidationError', message: validationError.message },
                { level: 4, error: 'SynopsisGenerationCriticalError', message: synopsisError.message }
            ],
            
            // Operation context
            function: 'testSentryError',
            operation: 'synopsis_generation',
            operationChain: operationChain,
            failedAt: 'validate_spine',
            operationProgress: '40%',
            
            // Manuscript context
            manuscriptId: manuscriptId,
            chapterId: chapterId,
            manuscriptMetadata: {
                title: 'The Weight of Silence',
                genre: 'Literary Fiction',
                wordCount: 87450,
                chapterCount: 24,
                lastModified: '2026-01-03T14:23:41Z',
                status: 'evaluating'
            },
            
            // Evaluation state
            evaluationState: {
                spine_score: 4.2,
                spine_status: 'COMPLETE',
                spine_flags: ['weak_causality', 'unclear_objective', 'passive_climax'],
                wave_flags_status: 'INCOMPLETE',
                wave_violations_count: 37,
                thirteen_criteria_status: 'INCOMPLETE',
                thirteen_criteria_complete: 8,
                thirteen_criteria_total: 13,
                missing_criteria: ['Escalation', 'Consequence', 'Authority', 'Reader Orientation', 'Emotional Throughline']
            },
            
            // Database context
            database: {
                connection_pool_size: 25,
                active_connections: 25,
                queued_requests: 143,
                timeout_ms: 30000,
                last_successful_query: '2026-01-04T09:42:18Z',
                failed_queries_last_hour: 18
            },
            
            // System state
            systemState: {
                memory_usage_mb: 1847,
                cpu_usage_percent: 78,
                active_evaluations: 12,
                queued_evaluations: 34,
                uptime_hours: 72.4
            },
            
            // Request metadata
            request: {
                method: req.method,
                url: req.url,
                headers: {
                    'user-agent': req.headers.get('user-agent'),
                    'content-type': req.headers.get('content-type'),
                    'x-request-id': crypto.randomUUID()
                },
                timestamp: new Date().toISOString()
            },
            
            // Environment
            environment: Deno.env.get('BASE44_ENV') || 'production',
            testId: `catastrophic-test-${Date.now()}`,
            severity: 'CRITICAL',
            requiresImmediate: true,
            impactedUsers: 12,
            estimatedResolution: 'Requires database scaling + WAVE validation optimization'
        });

        return Response.json({
            success: true,
            message: 'CATASTROPHIC test error sent to Sentry with full context chain',
            userId: user?.email || 'anonymous',
            sentryConfigured: !!Deno.env.get('SENTRY_DSN'),
            errorSummary: {
                type: 'SynopsisGenerationCriticalError',
                severity: 'CRITICAL',
                manuscriptId,
                chapterId,
                errorChainDepth: 4,
                waveViolations: 37,
                databaseTimeout: true,
                requiresImmediate: true
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