/**
 * Global Defensive Error Handling System
 * 
 * Standardized response validation and error handling for all RevisionGrade API calls.
 * This ensures no silent failures and consistent user feedback.
 */

import { toast } from 'sonner';

/**
 * Validates a function/API response and extracts data safely
 * 
 * @param {*} response - Raw response from base44.functions.invoke()
 * @param {string} operationName - User-friendly operation name for error messages
 * @param {Array<string>} requiredFields - Fields that must exist in the response
 * @returns {Object} Validated response data
 * @throws {Error} If validation fails
 */
export function validateResponse(response, operationName, requiredFields = []) {
    console.log(`[${operationName}] Response received:`, response);

    // Check if response exists and is an object
    if (!response || typeof response !== 'object') {
        console.error(`[${operationName}] Invalid response format:`, response);
        throw new Error(`Invalid response format received from ${operationName}`);
    }

    // Check for required fields
    const missingFields = requiredFields.filter(field => !response[field]);
    if (missingFields.length > 0) {
        console.error(`[${operationName}] Missing required fields:`, missingFields, 'Full response:', response);
        throw new Error(`Missing required data: ${missingFields.join(', ')}`);
    }

    console.log(`[${operationName}] Validation passed`);
    return response;
}

/**
 * Standard error handler with user-friendly messages
 * 
 * @param {Error} error - The error object
 * @param {string} operationName - User-friendly operation name
 * @param {Object} options - Additional options
 */
export function handleError(error, operationName, options = {}) {
    console.error(`[${operationName}] Error:`, error);

    const errorMessage = error.message || 'Unknown error occurred';
    const userMessage = options.customMessage || 
        `Failed to ${operationName.toLowerCase()}. ${errorMessage}`;

    toast.error(userMessage, {
        description: options.retry ? 'Please try again or contact support if the issue persists.' : undefined,
        duration: 5000
    });

    // Optional: Send to monitoring/analytics
    if (options.trackError && window.base44?.entities?.Analytics) {
        try {
            window.base44.entities.Analytics.create({
                page: options.page || 'Unknown',
                path: window.location.pathname,
                event_type: 'error_occurred',
                metadata: {
                    operation: operationName,
                    error: errorMessage,
                    stack: error.stack?.substring(0, 500)
                }
            });
        } catch (analyticsError) {
            console.error('Failed to log error to analytics:', analyticsError);
        }
    }
}

/**
 * Wrapper for API calls with built-in validation and error handling
 * 
 * Usage:
 * const result = await safeApiCall(
 *   () => base44.functions.invoke('generateSynopsis', { manuscript_id }),
 *   'Generate Synopsis',
 *   ['synopsis'],
 *   { page: 'Synopsis', trackError: true }
 * );
 * 
 * @param {Function} apiCall - The async API call to execute
 * @param {string} operationName - User-friendly operation name
 * @param {Array<string>} requiredFields - Required response fields
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Validated response data
 * @throws {Error} If API call fails or validation fails
 */
export async function safeApiCall(apiCall, operationName, requiredFields = [], options = {}) {
    try {
        const response = await apiCall();
        return validateResponse(response, operationName, requiredFields);
    } catch (error) {
        handleError(error, operationName, { ...options, retry: true });
        throw error; // Re-throw so calling code can handle loading states
    }
}

/**
 * Loading state wrapper for buttons with automatic error handling
 * 
 * Usage in React component:
 * const [loading, setLoading] = useState(false);
 * 
 * <Button onClick={() => withLoadingState(
 *   setLoading,
 *   async () => {
 *     const result = await safeApiCall(...);
 *     setData(result);
 *   },
 *   'Generate Content'
 * )}>
 *   {loading ? <Loader2 className="animate-spin" /> : 'Generate'}
 * </Button>
 */
export async function withLoadingState(setLoading, asyncOperation, operationName) {
    setLoading(true);
    try {
        await asyncOperation();
    } catch (error) {
        // Error already handled by safeApiCall, just ensure loading stops
    } finally {
        setLoading(false);
    }
}

/**
 * Check if response has any placeholder fields
 * Useful for warning users about incomplete generation
 */
export function hasPlaceholders(data) {
    const dataString = JSON.stringify(data);
    return (
        dataString.includes('[Author Name]') ||
        dataString.includes('[Title]') ||
        dataString.includes('[Genre]') ||
        dataString.includes('[Word Count]') ||
        dataString.includes('[comparable') ||
        dataString.includes('TK]') ||
        dataString.includes('[TODO')
    );
}