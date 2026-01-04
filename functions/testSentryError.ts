import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureCritical } from './utils/errorTracking.js';

// Sentry Error Tracking Test Function
// Version: 1.1 - Force deployment

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();

        // Create intentional test error
        const testError = new Error('TEST ERROR: Sentry integration verification - this is intentional');
        
        // Send to Sentry
        await captureCritical(testError, {
            userId: user?.email || 'anonymous',
            function: 'testSentryError',
            environment: 'production',
            testId: `test-${Date.now()}`,
            message: 'Verification test for Sentry error tracking and alerting'
        });

        return Response.json({
            success: true,
            message: 'Test error sent to Sentry successfully',
            timestamp: new Date().toISOString(),
            userId: user?.email,
            sentryDsn: Deno.env.get('SENTRY_DSN') ? 'configured' : 'missing',
            note: 'Check Sentry dashboard at https://revisiongrade.sentry.io/issues/ and your email for alert'
        });
    } catch (error) {
        console.error('Error in Sentry test:', error);
        return Response.json(
            { error: error.message, stack: error.stack },
            { status: 500 }
        );
    }
});