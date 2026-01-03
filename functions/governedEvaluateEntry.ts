import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Governed Evaluation Entry Wrapper
 * 
 * Authority: FUNCTION_INDEX.md > Evaluate > Canon Documents
 * 
 * Loads governance bundle and executes QA checklist before evaluation.
 * 
 * Returns: { passed: boolean, checklist_results: object, error?: string }
 */

async function loadCanonDocument(filename) {
    try {
        const response = await fetch(`${Deno.env.get('BASE44_API_URL') || 'https://api.base44.com'}/files/${filename}`);
        if (!response.ok) {
            console.warn(`[governedEvaluateEntry] Failed to load ${filename}: ${response.status}`);
            return null;
        }
        return await response.text();
    } catch (error) {
        console.warn(`[governedEvaluateEntry] Error loading ${filename}:`, error.message);
        return null;
    }
}

function executeQAChecklist(params) {
    const checks = [];
    
    // Check 1: Text not empty
    checks.push({
        check_name: "text_not_empty",
        passed: params.text && params.text.trim().length > 0,
        details: params.text ? `Text length: ${params.text.length} chars` : "Text is empty"
    });
    
    // Check 2: Word count in acceptable range (min 50 words, max 250,000)
    const plainText = params.text ? params.text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ') : '';
    const wordCount = plainText.split(/\s+/).filter(w => w).length;
    checks.push({
        check_name: "word_count_in_range",
        passed: wordCount >= 50 && wordCount <= 250000,
        details: `Word count: ${wordCount} (valid range: 50-250,000)`
    });
    
    // Check 3: Valid evaluation mode
    const validModes = ['standard', 'transgressive', 'trauma_memoir'];
    checks.push({
        check_name: "valid_evaluation_mode",
        passed: !params.evaluationMode || validModes.includes(params.evaluationMode),
        details: `Mode: ${params.evaluationMode || 'standard'}`
    });
    
    // Check 4: Valid language variant
    const validVariants = ['en-US', 'en-UK', 'en-CA', 'en-AU'];
    checks.push({
        check_name: "valid_language_variant",
        passed: !params.languageVariant || validVariants.includes(params.languageVariant),
        details: `Variant: ${params.languageVariant || 'en-US'}`
    });
    
    // Check 5: Valid voice preservation level
    const validVoiceLevels = ['maximum', 'balanced', 'polish'];
    checks.push({
        check_name: "valid_voice_preservation",
        passed: !params.voicePreservation || validVoiceLevels.includes(params.voicePreservation),
        details: `Voice: ${params.voicePreservation || 'balanced'}`
    });
    
    // Check 6: Title provided (optional but recommended)
    checks.push({
        check_name: "title_provided",
        passed: params.title && params.title.trim().length > 0,
        details: params.title ? `Title: ${params.title}` : "No title provided (optional)"
    });
    
    const allPassed = checks.every(check => check.passed);
    
    return {
        passed: allPassed,
        checks: checks,
        failed_checks: checks.filter(c => !c.passed).map(c => c.check_name)
    };
}

export async function governedEvaluateEntry(req, params) {
    const startTime = Date.now();
    
    console.log('[governedEvaluateEntry] Loading governance bundle...');
    
    // Load canon documents (non-blocking - log warnings but don't fail)
    const [entryCanon, governanceAddendum, qaChecklist] = await Promise.all([
        loadCanonDocument('EVALUATE_ENTRY_CANON.md'),
        loadCanonDocument('EVALUATE_GOVERNANCE_ADDENDUM.md'),
        loadCanonDocument('EVALUATE_QA_CHECKLIST.md')
    ]);
    
    console.log('[governedEvaluateEntry] Canon documents loaded:', {
        entry_canon: entryCanon ? 'loaded' : 'failed',
        governance_addendum: governanceAddendum ? 'loaded' : 'failed',
        qa_checklist: qaChecklist ? 'loaded' : 'failed'
    });
    
    // Execute QA checklist
    const checklistResults = executeQAChecklist(params);
    
    console.log('[governedEvaluateEntry] QA Checklist executed:', {
        passed: checklistResults.passed,
        failed_checks: checklistResults.failed_checks
    });
    
    // If checklist fails, return error
    if (!checklistResults.passed) {
        const failedDetails = checklistResults.checks
            .filter(c => !c.passed)
            .map(c => `${c.check_name}: ${c.details}`)
            .join('; ');
        
        return {
            passed: false,
            checklist_results: checklistResults,
            error: `QA Checklist failed: ${failedDetails}`,
            elapsed_ms: Date.now() - startTime
        };
    }
    
    // Success - return results
    return {
        passed: true,
        checklist_results: checklistResults,
        canon_documents_loaded: {
            entry_canon: !!entryCanon,
            governance_addendum: !!governanceAddendum,
            qa_checklist: !!qaChecklist
        },
        elapsed_ms: Date.now() - startTime
    };
}

// Deno serve wrapper for testing
Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const result = await governedEvaluateEntry(req, body);
        return Response.json(result);
    } catch (error) {
        return Response.json({ 
            passed: false, 
            error: error.message 
        }, { status: 400 });
    }
});