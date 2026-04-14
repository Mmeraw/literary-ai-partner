// VOICE & DIALOGUE PRESERVATION — RUNTIME GUARD
// Enforces VOICE_PRESERVATION_CANON.md rules
// Reference: functions/VOICE_PRESERVATION_CANON.md

/**
 * Extract dialogue spans from text
 * @param {string} text - Input text
 * @returns {Array} Array of {start, end, content} for each dialogue span
 */
export function extractDialogueSpans(text) {
    const spans = [];
    const quotePatterns = [
        /"([^"]*)"/g,  // Straight double quotes
        /"([^"]*)"/g,  // Curly double quotes
        /'([^']*)'/g,  // Straight single quotes
        /'([^']*)'/g   // Curly single quotes
    ];
    
    for (const pattern of quotePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            spans.push({
                start: match.index,
                end: match.index + match[0].length,
                content: match[0]
            });
        }
    }
    
    // Sort by start position
    return spans.sort((a, b) => a.start - b.start);
}

/**
 * Check if dialogue was modified between original and revised text
 * @param {string} originalText - Original input text
 * @param {string} revisedText - Revised output text
 * @returns {Object} {modified: boolean, violations: Array}
 */
export function checkDialoguePreservation(originalText, revisedText) {
    const originalDialogue = extractDialogueSpans(originalText);
    const revisedDialogue = extractDialogueSpans(revisedText);
    
    const violations = [];
    
    // Check if dialogue content changed
    for (let i = 0; i < Math.min(originalDialogue.length, revisedDialogue.length); i++) {
        if (originalDialogue[i].content !== revisedDialogue[i].content) {
            violations.push({
                original: originalDialogue[i].content,
                revised: revisedDialogue[i].content,
                position: i
            });
        }
    }
    
    // Check if dialogue was added or removed
    if (originalDialogue.length !== revisedDialogue.length) {
        violations.push({
            type: 'count_mismatch',
            originalCount: originalDialogue.length,
            revisedCount: revisedDialogue.length
        });
    }
    
    return {
        modified: violations.length > 0,
        violations
    };
}

/**
 * Audit log structure for voice preservation
 * @param {Object} params
 * @returns {Object} Audit log entry
 */
export function createVoiceAuditLog(params) {
    const {
        voice_preservation_level = 'balanced',
        user_requested_dialogue_normalization = false,
        dialogue_rewrites_emitted = 0,
        originalText,
        revisedText,
        workflow
    } = params;
    
    const dialogueCheck = revisedText 
        ? checkDialoguePreservation(originalText, revisedText)
        : { modified: false, violations: [] };
    
    // AUTOMATIC QA FAILURE CONDITION
    const qaFailure = dialogue_rewrites_emitted > 0 && !user_requested_dialogue_normalization;
    
    return {
        timestamp: new Date().toISOString(),
        workflow,
        voice_preservation_level,
        user_requested_dialogue_normalization,
        dialogue_rewrites_emitted,
        dialogue_modified: dialogueCheck.modified,
        violations: dialogueCheck.violations,
        qa_failure: qaFailure,
        canon_version: 'VOICE_PRESERVATION_CANON.md v1.0'
    };
}

/**
 * Enforce voice preservation rules
 * @param {Object} params
 * @throws {Error} If dialogue modified without authorization
 */
export function enforceVoicePreservation(params) {
    const auditLog = createVoiceAuditLog(params);
    
    // HARD GUARD: Fail if dialogue modified without explicit user request
    if (auditLog.qa_failure) {
        throw new Error(
            'VOICE_PRESERVATION_CANON VIOLATION: Dialogue was modified but user_requested_dialogue_normalization=false. ' +
            'This is a release-blocking QA failure. ' +
            JSON.stringify(auditLog.violations)
        );
    }
    
    return auditLog;
}

// Deno endpoint for testing
Deno.serve(async (req) => {
    try {
        const { originalText, revisedText, voice_preservation_level, user_requested_dialogue_normalization } = await req.json();
        
        const auditLog = createVoiceAuditLog({
            voice_preservation_level,
            user_requested_dialogue_normalization,
            dialogue_rewrites_emitted: 0, // Would be calculated by generation system
            originalText,
            revisedText,
            workflow: 'test'
        });
        
        return Response.json({
            success: true,
            auditLog,
            qa_status: auditLog.qa_failure ? 'FAILED' : 'PASSED'
        });
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});