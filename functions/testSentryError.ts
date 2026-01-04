import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureCritical } from './utils/errorTracking.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Intentionally throw a test error
        const testError = new Error('TEST ERROR: Sentry integration verification - this is intentional');
        
        await captureCritical(testError, {
            userId: user?.email || 'anonymous',
            function: 'testSentryError',
            environment: 'production',
            testId: `test-${Date.now()}`,
            message: 'Verification test for Sentry error tracking and alerting'
        });

        return Response.json({
            success: true,
            message: 'Test error sent to Sentry',
            timestamp: new Date().toISOString(),
            userId: user?.email,
            note: 'Check Sentry dashboard at https://revisiongrade.sentry.io/issues/ and your email for alert'
        });
    } catch (error) {
        console.error('Error in Sentry test:', error);
        return Response.json(
            { error: error.message },
            { status: 500 }
        );
    }
});