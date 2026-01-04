import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureCritical } from './utils/errorTracking.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Create intentional test error
        const testError = new Error('SENTRY TEST: Intentional error for verification');
        
        // Send to Sentry
        await captureCritical(testError, {
            userId: user?.email || 'anonymous',
            function: 'testSentryError',
            testId: `test-${Date.now()}`,
            timestamp: new Date().toISOString()
        });

        return Response.json({
            success: true,
            message: 'Test error sent to Sentry successfully',
            userId: user?.email || 'anonymous',
            sentryConfigured: !!Deno.env.get('SENTRY_DSN'),
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