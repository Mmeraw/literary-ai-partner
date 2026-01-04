/**
 * Retry and timeout utilities for external API calls
 * Standard: 30s timeout, 3 retries with exponential backoff (2s, 4s, 8s)
 */

import { captureWarning } from './errorTracking.js';

/**
 * Execute a function with timeout
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds (default 30s)
 * @returns {Promise} Result or throws TimeoutError
 */
export async function withTimeout(fn, timeoutMs = 30000) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([fn(), timeoutPromise]);
}

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry configuration
 * @returns {Promise} Result or throws after all retries exhausted
 */
export async function withRetry(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 2000,
        maxDelay = 8000,
        backoffMultiplier = 2,
        shouldRetry = (error) => true, // Can customize per error type
        context = {}
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry if it's the last attempt or if shouldRetry returns false
            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }

            // Log retry attempt
            await captureWarning(`Retry attempt ${attempt + 1}/${maxRetries}`, {
                ...context,
                error: error.message,
                nextRetryIn: `${delay}ms`
            });

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));

            // Increase delay for next retry (exponential backoff)
            delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
    }

    throw lastError;
}

/**
 * Combine timeout and retry for external API calls
 * Standard configuration: 30s timeout, 3 retries with exponential backoff
 */
export async function withTimeoutAndRetry(fn, options = {}) {
    const {
        timeout = 30000,
        maxRetries = 3,
        context = {}
    } = options;

    return withRetry(
        () => withTimeout(fn, timeout),
        {
            maxRetries,
            context,
            shouldRetry: (error) => {
                // Retry on timeout or network errors, not on validation errors
                return error.message.includes('timeout') || 
                       error.message.includes('ECONNREFUSED') ||
                       error.message.includes('ENOTFOUND') ||
                       error.code === 'ETIMEDOUT';
            }
        }
    );
}

/**
 * Check if error is retryable (for custom logic)
 */
export function isRetryableError(error) {
    if (!error) return false;
    
    const retryablePatterns = [
        'timeout',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'rate limit',
        '429',
        '500',
        '502',
        '503',
        '504'
    ];

    const errorString = error.message?.toLowerCase() || '';
    const statusCode = error.status || error.statusCode;

    return retryablePatterns.some(pattern => 
        errorString.includes(pattern.toLowerCase())
    ) || [429, 500, 502, 503, 504].includes(statusCode);
}