/**
 * MATRIX PREFLIGHT VALIDATION SERVICE
 * Standalone function for Phase 1 input-scope validation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

function getInputScale(wordCount) {
    if (wordCount >= 50 && wordCount < 250) return "paragraph";
    if (wordCount >= 250 && wordCount < 2000) return "scene";
    if (wordCount >= 2000 && wordCount < 8000) return "chapter";
    if (wordCount >= 8000 && wordCount < 40000) return "multi_chapter";
    if (wordCount >= 40000) return "full_manuscript";
    return null;
}

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

function isRequestAllowed(requestType, inputScale, wordCount) {
    if (requestType === REQUEST_TYPE.QUERY_PACKAGE || requestType === REQUEST_TYPE.AGENT_PACKAGE) {
        return inputScale === "full_manuscript";
    }
    
    const requirements = {
        [REQUEST_TYPE.QUICK_EVALUATION]: "paragraph",
        [REQUEST_TYPE.FULL_MANUSCRIPT_EVALUATION]: "full_manuscript",
        [REQUEST_TYPE.SYNOPSIS]: "chapter",
        [REQUEST_TYPE.QUERY_LETTER]: "full_manuscript",
        [REQUEST_TYPE.PITCH]: "full_manuscript",
        [REQUEST_TYPE.FILM_ADAPTATION]: "full_manuscript",
        [REQUEST_TYPE.COMPARABLES]: "full_manuscript",
        [REQUEST_TYPE.BIOGRAPHY]: null
    };
    
    const minScale = requirements[requestType];
    if (minScale === null) return true;
    
    const scaleOrder = ["paragraph", "scene", "chapter", "multi_chapter", "full_manuscript"];
    const currentIndex = scaleOrder.indexOf(inputScale);
    const minIndex = scaleOrder.indexOf(minScale);
    
    return currentIndex >= minIndex;
}

function getAllowedOutputs(inputScale) {
    const allowedMap = {
        paragraph: ["Topic identification", "Surface-level notes", "Genre hint", "Single-moment analysis"],
        scene: ["Scene-level analysis", "Immediate tension", "Moment critique", "Limited character observation", "Voice sample notes"],
        chapter: ["Chapter structural signals", "Pacing within chapter", "Character presence", "Partial arc hints", "WAVE flags"],
        multi_chapter: ["Partial manuscript analysis", "Emerging patterns", "Structural tendencies", "Provisional thematic notes", "Conservative market hints"],
        full_manuscript: ["All evaluation outputs", "Synopsis", "Pitch/logline", "Query letter", "Agent package", "Market positioning", "Full structural analysis"]
    };
    return allowedMap[inputScale] || [];
}

function getBlockedOutputs(requestType, inputScale) {
    const blocked = [];
    
    if (requestType === REQUEST_TYPE.SYNOPSIS && !["full_manuscript", "multi_chapter", "chapter"].includes(inputScale)) {
        blocked.push({ name: "Synopsis", reason: "requires plot structure" });
    }
    
    if ([REQUEST_TYPE.QUERY_LETTER, REQUEST_TYPE.QUERY_PACKAGE].includes(requestType) && inputScale !== "full_manuscript") {
        blocked.push({ name: "Query Letter", reason: "requires complete manuscript" });
    }
    
    if (requestType === REQUEST_TYPE.PITCH && !["full_manuscript", "multi_chapter"].includes(inputScale)) {
        blocked.push({ name: "Pitch/Logline", reason: "requires complete narrative arc" });
    }
    
    if (requestType === REQUEST_TYPE.AGENT_PACKAGE && inputScale !== "full_manuscript") {
        blocked.push({ name: "Agent Package", reason: "requires all components at full manuscript scale" });
    }
    
    if (["paragraph", "scene"].includes(inputScale)) {
        blocked.push({ name: "Character arcs", reason: "requires narrative development" });
        blocked.push({ name: "Thematic coherence", reason: "requires complete structure" });
        blocked.push({ name: "Market positioning", reason: "requires full narrative context" });
    }
    
    return blocked;
}

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

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { 
            inputText,
            manuscriptId,
            requestType,
            userEmail 
        } = await req.json();

        const timestamp = new Date().toISOString();
        
        let text = inputText;
        let wordCount = 0;
        
        // Server-side retrieval if manuscriptId provided
        if (manuscriptId && !text) {
            try {
                const manuscript = await base44.asServiceRole.entities.Manuscript.get(manuscriptId);
                text = manuscript.full_text;
            } catch (err) {
                console.error('[matrixPreflight] Failed to retrieve manuscript:', err);
                return Response.json({
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
                });
            }
        }
        
        if (!text) {
            return Response.json({
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
            });
        }
        
        // Calculate word count
        wordCount = text.split(/\s+/).filter(w => w.trim()).length;
        
        // Determine input scale
        const inputScale = getInputScale(wordCount);
        
        if (!inputScale) {
            return Response.json({
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
            });
        }
        
        // Get max confidence
        const maxConfidence = getMaxConfidence(inputScale);
        
        // Check if request is allowed
        const allowed = isRequestAllowed(requestType, inputScale, wordCount);
        
        if (!allowed) {
            const refusalMessage = {
                title: "❌ INSUFFICIENT INPUT",
                currentInput: `${inputScale.charAt(0).toUpperCase() + inputScale.slice(1)} (${wordCount} words)`,
                minimumRequired: getMinimumRequired(requestType),
                allowedOutputs: getAllowedOutputs(inputScale),
                blockedOutputs: getBlockedOutputs(requestType, inputScale)
            };
            
            return Response.json({
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
            });
        }
        
        // Request is allowed
        return Response.json({
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
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});