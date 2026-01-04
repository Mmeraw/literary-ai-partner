import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureCritical } from './utils/errorTracking.js';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();

        // Create intentional test error
        const testError = new Error('SENTRY TEST: This is an intentional error for verification');
        
        // Send to Sentry
        await captureCritical(testError, {
            userId: user?.email || 'anonymous',
            function: 'sentryTest',
            testId: `test-${Date.now()}`
        });

        return Response.json({
            success: true,
            message: 'Test error sent to Sentry',
            userId: user?.email,
            sentryConfigured: !!Deno.env.get('SENTRY_DSN')
        });
    } catch (error) {
        return Response.json(
            { error: error.message },
            { status: 500 }
        );
    }
});