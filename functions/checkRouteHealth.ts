import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ROUTES_TO_CHECK = [
    {
        route: '/StoryGate',
        expectedTitle: 'StoryGate',
        expectedMarker: 'A secure, curated gateway',
        url: 'https://revisiongrade.com/StoryGate'
    },
    {
        route: '/StorygateStudio',
        expectedTitle: 'Storygate Studio',
        expectedMarker: 'A Selective Development Track',
        url: 'https://revisiongrade.com/StorygateStudio'
    }
];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Admin only
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const results = [];

        for (const route of ROUTES_TO_CHECK) {
            const startTime = Date.now();
            let status = 'healthy';
            let errorType = null;
            let errorDetails = null;
            let httpStatus = null;
            let actualTitle = null;
            let markerFound = false;

            try {
                const response = await fetch(route.url, {
                    headers: {
                        'User-Agent': 'RevisionGrade-HealthCheck/1.0'
                    }
                });

                httpStatus = response.status;
                const html = await response.text();
                const responseTime = Date.now() - startTime;

                // Check for blank page
                if (!html || html.trim().length < 100) {
                    status = 'error';
                    errorType = 'blank_page';
                    errorDetails = `Response body too short: ${html.length} bytes`;
                }

                // Extract title
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                actualTitle = titleMatch ? titleMatch[1].trim() : 'NO_TITLE';

                // Check title
                if (!actualTitle.includes(route.expectedTitle)) {
                    status = 'error';
                    errorType = 'wrong_title';
                    errorDetails = `Expected title containing "${route.expectedTitle}", got "${actualTitle}"`;
                }

                // Check for expected marker text
                markerFound = html.includes(route.expectedMarker);
                if (!markerFound) {
                    status = 'error';
                    errorType = 'missing_marker';
                    errorDetails = `Expected marker text "${route.expectedMarker}" not found in HTML`;
                }

                // Check response time
                if (responseTime > 5000) {
                    status = 'error';
                    errorType = 'timeout';
                    errorDetails = `Response time ${responseTime}ms exceeds 5000ms threshold`;
                }

                // Log health check result
                await base44.asServiceRole.entities.RouteHealthLog.create({
                    route: route.route,
                    status,
                    error_type: errorType,
                    expected_title: route.expectedTitle,
                    actual_title: actualTitle,
                    expected_marker: route.expectedMarker,
                    marker_found: markerFound,
                    response_time_ms: responseTime,
                    http_status: httpStatus,
                    error_details: errorDetails,
                    request_id: response.headers.get('x-request-id') || null
                });

                results.push({
                    route: route.route,
                    status,
                    errorType,
                    responseTime,
                    httpStatus,
                    actualTitle,
                    markerFound
                });

            } catch (error) {
                // Network or fetch error
                const responseTime = Date.now() - startTime;
                
                await base44.asServiceRole.entities.RouteHealthLog.create({
                    route: route.route,
                    status: 'error',
                    error_type: 'http_error',
                    expected_title: route.expectedTitle,
                    expected_marker: route.expectedMarker,
                    response_time_ms: responseTime,
                    error_details: error.message
                });

                results.push({
                    route: route.route,
                    status: 'error',
                    errorType: 'http_error',
                    errorDetails: error.message
                });
            }
        }

        // Send alert if any errors
        const hasErrors = results.some(r => r.status === 'error');
        if (hasErrors) {
            // Optional: send email alert
            try {
                const errorSummary = results
                    .filter(r => r.status === 'error')
                    .map(r => `${r.route}: ${r.errorType || 'unknown'}`)
                    .join('\n');

                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: user.email,
                    subject: '[ALERT] StoryGate Route Health Check Failed',
                    body: `Route health check detected failures:\n\n${errorSummary}\n\nCheck the StoryGate Ops Dashboard for details.`
                });
            } catch (emailError) {
                console.error('Failed to send alert email:', emailError);
            }
        }

        return Response.json({
            success: true,
            timestamp: new Date().toISOString(),
            results,
            hasErrors
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});