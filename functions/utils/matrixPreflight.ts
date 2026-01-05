/**
 * MATRIX PREFLIGHT VALIDATION
 * Phase 1 Foundation: Truth at Runtime
 * Version: 1.0.0
 */

const REQUEST_TYPE = {
    QUICK_EVALUATION: "quick_evaluation",
    FULL_MANUSCRIPT_EVALUATION: "full_manuscript_evaluation",
    SYNOPSIS: "synopsis",
    QUERY_LETTER: "query_letter",
    QUERY_PACKAGE: "query_package",
    PITCH: "pitch",
    AGENT_PACKAGE: "agent_package",
    FILM_ADAPTATION: "film_adaptation",
    BIOGRAPHY: "biography",
    COMPARABLES: "comparables"
};

const BLOCK_REASON = {
    SCOPE_INSUFFICIENT: "SCOPE_INSUFFICIENT",
    STRUCTURE_INCOMPLETE: "STRUCTURE_INCOMPLETE",
    HALLUCINATION_RISK: "HALLUCINATION_RISK",
    VOICE_INSUFFICIENT: "VOICE_INSUFFICIENT",
    NARRATIVE_INCOMPLETE: "NARRATIVE_INCOMPLETE",
    MATRIX_VIOLATION: "MATRIX_VIOLATION"
};

/**
 * Determines input scale based on word count
 * Boundaries: lower inclusive, upper exclusive (final bucket open-ended)
 */
function getInputScale(wordCount) {
    if (wordCount >= 50 && wordCount < 250) return "paragraph";
    if (wordCount >= 250 && wordCount < 2000) return "scene";
    if (wordCount >= 2000 && wordCount < 8000) return "chapter";
    if (wordCount >= 8000 && wordCount < 40000) return "multi_chapter";
    if (wordCount >= 40000) return "full_manuscript";
    return null; // < 50 words = invalid
}

/**
 * Gets max confidence for input scale (integer 0-100)
 */
function getMaxConfidence(inputScale) {
    const confidenceMap = {
        paragraph: 40,
        scene: 65,
        chapter: 75,
        multi_chapter: 85,
        full_manuscript: 95
    };
    return confidenceMap[inputScale] || 0;
}

/**
 * Checks if request type is allowed for input scale
 */
function isRequestAllowed(requestType, inputScale, wordCount) {
    // Package endpoints require compound validation
    if (requestType === REQUEST_TYPE.QUERY_PACKAGE || requestType === REQUEST_TYPE.AGENT_PACKAGE) {
        // Packages require full manuscript (40k+ words)
        return inputScale === "full_manuscript";
    }
    
    // Single-artifact validation
    const requirements = {
        [REQUEST_TYPE.QUICK_EVALUATION]: "paragraph", // Minimum
        [REQUEST_TYPE.FULL_MANUSCRIPT_EVALUATION]: "full_manuscript",
        [REQUEST_TYPE.SYNOPSIS]: "chapter", // 2k+ words minimum
        [REQUEST_TYPE.QUERY_LETTER]: "full_manuscript",
        [REQUEST_TYPE.PITCH]: "full_manuscript",
        [REQUEST_TYPE.FILM_ADAPTATION]: "full_manuscript",
        [REQUEST_TYPE.COMPARABLES]: "full_manuscript",
        [REQUEST_TYPE.BIOGRAPHY]: null // Different validation (not length-based)
    };
    
    const minScale = requirements[requestType];
    if (minScale === null) return true; // No length requirement
    
    const scaleOrder = ["paragraph", "scene", "chapter", "multi_chapter", "full_manuscript"];
    const currentIndex = scaleOrder.indexOf(inputScale);
    const minIndex = scaleOrder.indexOf(minScale);
    
    return currentIndex >= minIndex;
}

/**
 * Gets allowed outputs for input scale
 */
function getAllowedOutputs(inputScale) {
    const allowedMap = {
        paragraph: [
            "Topic identification",
            "Surface-level notes",
            "Genre hint (surface signals only)",
            "Single-moment analysis"
        ],
        scene: [
            "Scene-level analysis",
            "Immediate tension assessment",
            "Moment-specific critique",
            "Limited character observation (behavioral only)",
            "Voice sample notes"
        ],
        chapter: [
            "Chapter structural signals",
            "Pacing within chapter",
            "Character presence in segment",
            "Partial arc hints",
            "WAVE flags (segment-specific)"
        ],
        multi_chapter: [
            "Partial manuscript analysis",
            "Emerging patterns",
            "Structural tendencies",
            "Provisional thematic notes",
            "Conservative market hints"
        ],
        full_manuscript: [
            "All evaluation outputs",
            "Synopsis (all lengths)",
            "Pitch/logline",
            "Query letter",
            "Agent package",
            "Market positioning",
            "Full structural analysis"
        ]
    };
    return allowedMap[inputScale] || [];
}

/**
 * Gets blocked outputs for request type
 */
function getBlockedOutputs(requestType, inputScale) {
    const blocked = [];
    
    if (requestType === REQUEST_TYPE.SYNOPSIS && inputScale !== "full_manuscript" && inputScale !== "multi_chapter" && inputScale !== "chapter") {
        blocked.push({ name: "Synopsis", reason: "requires plot structure" });
    }
    
    if ((requestType === REQUEST_TYPE.QUERY_LETTER || requestType === REQUEST_TYPE.QUERY_PACKAGE) && inputScale !== "full_manuscript") {
        blocked.push({ name: "Query Letter", reason: "requires complete manuscript" });
    }
    
    if (requestType === REQUEST_TYPE.PITCH && inputScale !== "full_manuscript" && inputScale !== "multi_chapter") {
        blocked.push({ name: "Pitch/Logline", reason: "requires complete narrative arc" });
    }
    
    if (requestType === REQUEST_TYPE.AGENT_PACKAGE && inputScale !== "full_manuscript") {
        blocked.push({ name: "Agent Package", reason: "requires all components at full manuscript scale" });
    }
    
    if (inputScale === "paragraph" || inputScale === "scene") {
        blocked.push({ name: "Character arcs", reason: "requires narrative development" });
        blocked.push({ name: "Thematic coherence", reason: "requires complete structure" });
        blocked.push({ name: "Market positioning", reason: "requires full narrative context" });
    }
    
    return blocked;
}

/**
 * Gets minimum required input description
 */
function getMinimumRequired(requestType) {
    const requirements = {
        [REQUEST_TYPE.SYNOPSIS]: "Chapter or full manuscript (2,000+ words)",
        [REQUEST_TYPE.QUERY_LETTER]: "Full manuscript (40,000+ words)",
        [REQUEST_TYPE.QUERY_PACKAGE]: "Full manuscript (40,000+ words)",
        [REQUEST_TYPE.PITCH]: "Full manuscript (40,000+ words)",
        [REQUEST_TYPE.AGENT_PACKAGE]: "Full manuscript (40,000+ words)",
        [REQUEST_TYPE.FILM_ADAPTATION]: "Full manuscript (40,000+ words)",
        [REQUEST_TYPE.COMPARABLES]: "Full manuscript (40,000+ words)"
    };
    return requirements[requestType] || "Unknown requirement";
}

/**
 * Main preflight validation function
 * 
 * @param {Object} params
 * @param {string} [params.inputText] - Text content to evaluate
 * @param {string} [params.manuscriptId] - Manuscript ID (if server-side retrieval needed)
 * @param {Object} [params.base44] - Base44 client for manuscript retrieval
 * @param {string} params.requestType - Type of request
 * @param {string} params.userEmail - User email for audit
 * @returns {Promise<Object>} Preflight result
 */
export async function matrixPreflight({
    inputText,
    manuscriptId,
    base44,
    requestType,
    userEmail
}) {
    const timestamp = new Date().toISOString();
    
    // Compute word count from server-stored text if manuscriptId provided
    let text = inputText;
    let wordCount = 0;
    
    if (manuscriptId && base44) {
        // Server-side retrieval prevents client-side length lies
        try {
            const manuscript = await base44.asServiceRole.entities.Manuscript.get(manuscriptId);
            text = manuscript.full_text;
        } catch (err) {
            console.error('[matrixPreflight] Failed to retrieve manuscript:', err);
            return {
                allowed: false,
                wordCount: 0,
                inputScale: null,
                maxConfidence: 0,
                blockReason: BLOCK_REASON.MATRIX_VIOLATION,
                userFacingCode: "INSUFFICIENT_INPUT",
                refusalMessage: {
                    title: "❌ INSUFFICIENT INPUT",
                    currentInput: "Invalid manuscript reference",
                    minimumRequired: getMinimumRequired(requestType),
                    allowedOutputs: [],
                    blockedOutputs: [{ name: "All outputs", reason: "manuscript not found" }]
                },
                audit: {
                    timestamp,
                    userEmail,
                    requestType,
                    inputWordCount: 0,
                    inputScale: null,
                    allowed: false,
                    blockReason: BLOCK_REASON.MATRIX_VIOLATION,
                    maxConfidenceAllowed: 0,
                    matrixVersion: "1.0.0",
                    preflightExecutedBeforeLLM: true,
                    matrix_preflight_allowed: false
                }
            };
        }
    }
    
    if (!text) {
        return {
            allowed: false,
            wordCount: 0,
            inputScale: null,
            maxConfidence: 0,
            blockReason: BLOCK_REASON.MATRIX_VIOLATION,
            userFacingCode: "INSUFFICIENT_INPUT",
            refusalMessage: {
                title: "❌ INSUFFICIENT INPUT",
                currentInput: "No text provided",
                minimumRequired: getMinimumRequired(requestType),
                allowedOutputs: [],
                blockedOutputs: [{ name: "All outputs", reason: "no input text" }]
            },
            audit: {
                timestamp,
                userEmail,
                requestType,
                inputWordCount: 0,
                inputScale: null,
                allowed: false,
                blockReason: BLOCK_REASON.MATRIX_VIOLATION,
                maxConfidenceAllowed: 0,
                matrixVersion: "1.0.0",
                preflightExecutedBeforeLLM: true,
                matrix_preflight_allowed: false
            }
        };
    }
    
    // Calculate word count
    wordCount = text.split(/\s+/).filter(w => w.trim()).length;
    
    // Determine input scale
    const inputScale = getInputScale(wordCount);
    
    if (!inputScale) {
        // < 50 words = invalid
        return {
            allowed: false,
            wordCount,
            inputScale: null,
            maxConfidence: 0,
            blockReason: BLOCK_REASON.SCOPE_INSUFFICIENT,
            userFacingCode: "INSUFFICIENT_INPUT",
            refusalMessage: {
                title: "❌ INSUFFICIENT INPUT",
                currentInput: `Too short (${wordCount} words)`,
                minimumRequired: "Minimum 50 words required",
                allowedOutputs: [],
                blockedOutputs: [{ name: "All outputs", reason: "input below minimum threshold" }]
            },
            audit: {
                timestamp,
                userEmail,
                requestType,
                inputWordCount: wordCount,
                inputScale: null,
                allowed: false,
                blockReason: BLOCK_REASON.SCOPE_INSUFFICIENT,
                maxConfidenceAllowed: 0,
                matrixVersion: "1.0.0",
                preflightExecutedBeforeLLM: true,
                matrix_preflight_allowed: false
            }
        };
    }
    
    // Get max confidence (integer 0-100)
    const maxConfidence = getMaxConfidence(inputScale);
    
    // Check if request is allowed
    const allowed = isRequestAllowed(requestType, inputScale, wordCount);
    
    if (!allowed) {
        // Generate refusal message
        const refusalMessage = {
            title: "❌ INSUFFICIENT INPUT",
            currentInput: `${inputScale.charAt(0).toUpperCase() + inputScale.slice(1)} (${wordCount} words)`,
            minimumRequired: getMinimumRequired(requestType),
            allowedOutputs: getAllowedOutputs(inputScale),
            blockedOutputs: getBlockedOutputs(requestType, inputScale)
        };
        
        return {
            allowed: false,
            wordCount,
            inputScale,
            maxConfidence,
            blockReason: BLOCK_REASON.SCOPE_INSUFFICIENT,
            userFacingCode: "INSUFFICIENT_INPUT",
            refusalMessage,
            audit: {
                timestamp,
                userEmail,
                requestType,
                inputWordCount: wordCount,
                inputScale,
                allowed: false,
                blockReason: BLOCK_REASON.SCOPE_INSUFFICIENT,
                maxConfidenceAllowed: maxConfidence,
                matrixVersion: "1.0.0",
                preflightExecutedBeforeLLM: true,
                matrix_preflight_allowed: false
            }
        };
    }
    
    // Request is allowed
    return {
        allowed: true,
        wordCount,
        inputScale,
        maxConfidence,
        audit: {
            timestamp,
            userEmail,
            requestType,
            inputWordCount: wordCount,
            inputScale,
            allowed: true,
            maxConfidenceAllowed: maxConfidence,
            matrixVersion: "1.0.0",
            preflightExecutedBeforeLLM: true,
            matrix_preflight_allowed: true
        }
    };
}

export { REQUEST_TYPE, BLOCK_REASON };