/**
 * Centralized error tracking and alerting
 * Integrates with Sentry for production error monitoring
 */

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');

// Initialize Sentry client (lightweight for Deno)
let sentryInitialized = false;

async function initSentry() {
    if (sentryInitialized || !SENTRY_DSN) return;
    
    // Sentry will be initialized when DSN is available
    sentryInitialized = true;
}

/**
 * Capture and report an error to Sentry
 * @param {Error} error - The error object
 * @param {Object} context - Additional context (user, function, etc.)
 * @param {string} severity - 'error', 'warning', 'info'
 */
export async function captureError(error, context = {}, severity = 'error') {
    // Always log to console for immediate visibility
    console.error(`[${severity.toUpperCase()}]`, error.message, context);
    
    if (!SENTRY_DSN) {
        console.warn('Sentry DSN not configured - error logged to console only');
        return;
    }

    await initSentry();

    try {
        // Parse DSN components
        const dsnMatch = SENTRY_DSN.match(/https:\/\/([^@]+)@([^\/]+)\/(\d+)/);
        if (!dsnMatch) {
            console.error('Invalid Sentry DSN format');
            return;
        }

        const [, publicKey, host, projectId] = dsnMatch;

        // Send to Sentry via HTTP API
        const event = {
            message: error.message,
            level: severity,
            exception: {
                values: [{
                    type: error.name || 'Error',
                    value: error.message,
                    stacktrace: {
                        frames: parseStackTrace(error.stack)
                    }
                }]
            },
            extra: context,
            timestamp: new Date().toISOString(),
            environment: Deno.env.get('BASE44_ENV') || 'production',
            platform: 'node'
        };

        const sentryUrl = `https://${host}/api/${projectId}/store/`;
        const authHeader = `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=custom/1.0.0`;

        await fetch(sentryUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': authHeader
            },
            body: JSON.stringify(event)
        });
    } catch (sentryError) {
        console.error('Failed to send error to Sentry:', sentryError);
    }
}

/**
 * Capture a critical error that requires immediate attention
 */
export async function captureCritical(error, context = {}) {
    return captureError(error, { ...context, critical: true }, 'error');
}

/**
 * Capture a warning (non-blocking issue)
 */
export async function captureWarning(message, context = {}) {
    return captureError(new Error(message), context, 'warning');
}

/**
 * Wrap a function with error tracking
 */
export function withErrorTracking(fn, context = {}) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            await captureError(error, {
                ...context,
                functionName: fn.name,
                args: JSON.stringify(args).slice(0, 1000) // Truncate large args
            });
            throw error; // Re-throw after capturing
        }
    };
}

// Helper functions
function parseStackTrace(stack) {
    if (!stack) return [];
    
    return stack.split('\n')
        .slice(1) // Skip error message line
        .map(line => {
            const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
            if (match) {
                return {
                    function: match[1],
                    filename: match[2],
                    lineno: parseInt(match[3]),
                    colno: parseInt(match[4])
                };
            }
            return null;
        })
        .filter(Boolean);
}