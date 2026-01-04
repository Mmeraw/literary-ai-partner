import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureCritical } from './utils/errorTracking.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Simple test error
        const testError = new Error('Sentry health check - test error');
        
        await captureCritical(testError, {
            test_type: 'health_check',
            user_email: user?.email || 'anonymous',
            timestamp: new Date().toISOString()
        });

        return Response.json({
            success: true,
            message: 'Test error sent to Sentry',
            sentry_configured: !!Deno.env.get('SENTRY_DSN')
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});