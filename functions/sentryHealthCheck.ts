import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
  debug: true,
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const testError = new Error('Sentry health check – test error');

    Sentry.captureException(testError, {
      extra: {
        test_type: 'health_check',
        user_email: user?.email ?? 'anonymous',
        timestamp: new Date().toISOString(),
      },
    });

    await Sentry.flush(2000);

    return Response.json({
      success: true,
      message: 'Test error sent to Sentry (if DSN is valid)',
      sentry_configured: !!Deno.env.get('SENTRY_DSN'),
    });
  } catch (error) {
    // This should also show up in Sentry if init worked
    Sentry.captureException(error);
    await Sentry.flush(2000);

    return Response.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
});