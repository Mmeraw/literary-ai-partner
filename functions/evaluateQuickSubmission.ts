import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureError, captureCritical } from './utils/errorTracking.js';
import { withTimeoutAndRetry } from './utils/retryLogic.js';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { title, text, styleMode, final_work_type_used, detected_work_type, detection_confidence, user_action, user_provided_work_type } = await req.json();

        if (!title || !text) {
            return Response.json({ error: 'Title and text required' }, { status: 400 });
        }
        
        // MDM GATE: Work Type routing required (MDM Canon v1)
        if (!final_work_type_used) {
            return Response.json({ 
                error: 'EVALUATION_BLOCKED',
                gate_blocked: true,
                message: 'Work Type not confirmed. Please confirm or correct the detected Work Type before evaluation.',
                required_field: 'final_work_type_used'
            }, { status: 400 });
        }
        
        // Load criteria plan from master data
        const criteriaPlanResult = await base44.asServiceRole.functions.invoke('validateWorkTypeMatrix', {
            action: 'buildPlan',
            workTypeId: final_work_type_used
        });
        
        if (!criteriaPlanResult.data.success) {
            return Response.json({
                error: 'Failed to build criteria plan',
                details: criteriaPlanResult.data
            }, { status: 422 });
        }
        
        const criteriaPlan = criteriaPlanResult.data.criteriaPlan;

        const wordCount = text.split(/\s+/).filter(w => w).length;
        
        if (wordCount > 3000) {
            return Response.json({ 
                error: 'Preview limit reached. Use full manuscript evaluation for longer works.',
                redirect: 'Pricing'
            }, { status: 400 });
        }

        // Style mode context
        const styleModeContext = {
            neutral: "Use baseline industry expectations for mainstream commercial fiction.",
            staccato: "Allow fragments, short lines, and abrupt transitions. Prioritize rhythm and pressure. High tolerance for compression.",
            lyrical: "Allow longer sentences, metaphor-rich prose, rhythm-first writing. Enforce clarity at paragraph/scene level rather than line-by-line.",
            documentary: "Enforce precision, sequence, causality. Low metaphor tolerance. Strong clarity enforcement.",
            hybrid: "Balanced approach allowing controlled style variation within structural standards."
        };

        // Build criteria filtering based on plan (MDM Rule M4: NA hard prohibition)
        const applicableCriteria = [];
        const naCriteria = [];
        const naCriteriaSet = new Set();
        const optionalCriteria = [];
        const requiredCriteria = [];
        
        for (const [criterionId, criterionMeta] of Object.entries(criteriaPlan.criteria)) {
            if (criterionMeta.status === 'NA') {
                naCriteria.push(criterionId);
                naCriteriaSet.add(criterionId.toLowerCase());
            } else if (criterionMeta.status === 'O') {
                optionalCriteria.push(criterionId);
                applicableCriteria.push(criterionId);
            } else if (criterionMeta.status === 'R') {
                requiredCriteria.push(criterionId);
                applicableCriteria.push(criterionId);
            } else if (criterionMeta.status === 'C') {
                applicableCriteria.push(criterionId);
            }
        }
        
        console.log('[MDM Enforcement]', {
            work_type: final_work_type_used,
            matrix_version: criteriaPlan.matrixVersion,
            required_count: requiredCriteria.length,
            optional_count: optionalCriteria.length,
            na_count: naCriteria.length,
            na_criteria: naCriteria
        });
        
        // Map criterion IDs to labels for LLM prompt
        const criteriaLabels = {
            hook: 'The Hook - First pages pull reader in with intrigue, tension, unique voice',
            voice: 'Voice & Narrative Style - Distinct, engaging voice matching tone with fresh prose',
            character: 'Characters & Introductions - Visceral character feel showing personality and motivations',
            conflict: 'Conflict & Tension - Strong driving tension with escalating conflicts',
            theme: 'Thematic Resonance - Deep themes woven naturally without being preachy',
            pacing: 'Pacing & Structural Flow - Momentum in every chapter, tight purposeful scenes',
            dialogue: 'Dialogue & Subtext - Authentic dialogue revealing more than stated',
            worldbuilding: 'Worldbuilding & Immersion - World revealed organically with sensory details',
            stakes: 'Stakes & Emotional Investment - Clear stakes with reader emotional connection',
            linePolish: 'Line-Level Polish - Tight evocative prose with proper rhythm',
            marketFit: 'Marketability & Genre Fit - Fresh, original, fits genre, marketable',
            keepGoing: 'Would Agent Keep Reading - High tension/intrigue making agent request full manuscript',
            technical: 'Technical / Formatting Correctness - Proper format, structure, technical standards'
        };
        
        // Build applicable criteria list for LLM (schema-level suppression)
        const applicableCriteriaText = applicableCriteria
            .map((id, idx) => `${idx + 1}. ${criteriaLabels[id]}`)
            .join('\n');
        
        // Schema-level: only request applicable criteria in JSON schema
        const criteriaSchemaItems = {
            type: "object",
            properties: {
                name: { type: "string", enum: applicableCriteria.map(id => criteriaLabels[id]) },
                score: { type: "number", description: "1-10" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                agentNotes: { type: "string" }
            },
            required: ["name", "score", "strengths", "weaknesses", "agentNotes"]
        };
        
        // Story Evaluation (Agents, Editors, Script Readers)
        const agentAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `You are a professional evaluator (agent, editor, or script reader) assessing a manuscript. 

WORK TYPE: ${criteriaPlan.workTypeLabel} (${criteriaPlan.family})
MATRIX VERSION: ${criteriaPlan.matrixVersion}

STYLE MODE: ${styleMode.toUpperCase()}
${styleModeContext[styleMode]}

CRITICAL FRAMING RULE:
Distinguish between three manuscript tiers when scoring and commenting:
- DEVELOPMENTAL (scores 1-5): Structural issues, unclear voice, weak craft fundamentals
- REFINEMENT (scores 6-7): Solid foundation, identifiable style, needs targeted polish
- PROFESSIONAL (scores 8-10): Strong voice, confident execution, minor edge-sharpening only

When scoring 8-10, your commentary MUST acknowledge this is professional-level work.
Weaknesses at this tier = "opportunities to sharpen" NOT "failures to fix."
Example: "Voice is distinctive and confident (9/10). The restraint here is intentional—consider whether opening paragraph needs one additional destabilizing beat to immediately signal stakes."

Analyze this text against ONLY the following ${applicableCriteria.length} criteria (all others excluded by Work Type):

${applicableCriteriaText}

CRITICAL: Evaluate ONLY the criteria listed above. Do not reference, score, or comment on any other criteria.

TITLE: ${title}

TEXT:
${text}

For each criterion provide: score (1-10), strengths (array), weaknesses (array), agentNotes (detailed commentary).
Provide overall score (1-10), agentVerdict (agent-ready/promising but needs revision/needs significant work), and prioritized revision requests.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        overallScore: { type: "number", description: "1-10" },
                        agentVerdict: { type: "string" },
                        criteria: {
                            type: "array",
                            items: criteriaSchemaItems
                        },
                        revisionRequests: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    priority: { type: "string", enum: ["High", "Medium", "Low"] },
                                    instruction: { type: "string" }
                                },
                                required: ["priority", "instruction"]
                            }
                        }
                    },
                    required: ["overallScore", "agentVerdict", "criteria", "revisionRequests"]
                }
            });

        // Agent Decision Snapshot
        const agentSnapshot = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `You are a literary agent making a keep-reading decision. Analyze this manuscript excerpt and provide a decisive snapshot.

TEXT:
${text}

Provide:
1. Keep-reading likelihood (High/Medium/Low)
2. Biggest risk (one sentence - what would make you reject this)
3. Biggest strength (one sentence - what makes you keep reading)
4. Most leverage fix (one sentence - single change with highest impact)`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        keep_reading: { type: "string", enum: ["High", "Medium", "Low"] },
                        biggest_risk: { type: "string" },
                        biggest_strength: { type: "string" },
                        most_leverage_fix: { type: "string" }
                    },
                    required: ["keep_reading", "biggest_risk", "biggest_strength", "most_leverage_fix"]
                }
            });

        // Thought-tag detection (WAVE 1)
        const thoughtTagPattern = /,\s*(he|she|i)\s+(thought|wondered|realized|knew|noticed|felt)\b|\b(he|she|i)\s+(thought|wondered|realized|knew|noticed|felt)\s*(?:to\s+(?:himself|herself|myself))?\b/gi;
        const thoughtTags = [];
        let match;
        let matchCount = 0;
        
        while ((match = thoughtTagPattern.exec(text)) !== null && matchCount < 10) {
            const start = Math.max(0, match.index - 50);
            const end = Math.min(text.length, match.index + match[0].length + 100);
            const context = text.slice(start, end).trim();
            
            thoughtTags.push({
                original: match[0],
                context: context,
                index: match.index
            });
            matchCount++;
        }
        
        // Density check: if 2+ thought tags per ~300 words, flag them
        const density = thoughtTags.length / (wordCount / 300);
        const shouldFlag = density >= 2 || thoughtTags.length >= 3;

        // WAVE 62: Overused word detection (global frequency analysis)
        const overusedWords = ['thought', 'felt', 'wondered', 'realized', 'knew', 'noticed', 'very', 'really', 'suddenly', 'quickly', 'extremely', 'just', 'actually', 'basically', 'literally', 'thing', 'stuff', 'situation', 'area', 'place'];
        const wordFrequency = {};
        const words = text.toLowerCase().split(/\b/);
        
        words.forEach(word => {
            const cleanWord = word.trim();
            if (overusedWords.includes(cleanWord)) {
                wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
            }
        });
        
        // Calculate density per 1000 words
        const densityThreshold = 3; // 3+ per 1000 words = flag
        const overusedWordHits = Object.entries(wordFrequency)
            .filter(([word, count]) => (count / wordCount) * 1000 >= densityThreshold)
            .map(([word, count]) => ({
                word,
                count,
                density: ((count / wordCount) * 1000).toFixed(1)
            }))
            .sort((a, b) => b.count - a.count);

        // Generate thought-tag suggestions if flagged (WAVE 1)
        let thoughtTagSuggestions = [];
        if (shouldFlag && thoughtTags.length > 0) {
            try {
                thoughtTagSuggestions = await Promise.all(
                    thoughtTags.slice(0, 5).map(async tag => {
                        const suggestionResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                            prompt: `You are a professional manuscript editor. A redundant thought-tag was detected.

Context:
"""
${tag.context}
"""

Detected tag: "${tag.original}"

Provide 3 revision options:
1. DELETE: Remove the tag entirely (if POV is clear)
2. FREE_INDIRECT: Rewrite using free indirect discourse
3. EXTERNALIZE: Show through dialogue, action, or sensory detail (only if plausible)

Return JSON with:
- canDelete: boolean (is POV clear without the tag?)
- freeIndirect: string (free indirect version)
- externalize: { type: "dialogue" | "action" | "sensory", text: string }
- rationale: string (why this is redundant/weak - 1 sentence)`,
                            response_json_schema: {
                                type: "object",
                                properties: {
                                    canDelete: { type: "boolean" },
                                    freeIndirect: { type: "string" },
                                    externalize: {
                                        type: "object",
                                        properties: {
                                            type: { type: "string" },
                                            text: { type: "string" }
                                        }
                                    },
                                    rationale: { type: "string" }
                                }
                            }
                        });
                        
                        return {
                            original: tag.context,
                            detected: tag.original,
                            ...suggestionResponse
                        };
                    })
                );
            } catch (err) {
                console.error('Thought-tag generation error:', err);
                // Non-critical, continue without thought-tag suggestions
            }
        }

        // Wave Revision Guidance
        const waveAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `Apply the Wave Revision System to identify 5-10 specific craft issues.

STYLE MODE: ${styleMode.toUpperCase()}
${styleModeContext[styleMode]}

Adjust flagging thresholds based on style mode constraints.

CRITICAL TIERING RULE:
Assess manuscript quality tier FIRST, then adjust commentary and severity:

PROFESSIONAL-TIER INDICATORS (8-10 range):
- Distinctive, confident voice throughout
- Intentional pacing choices (restraint vs. spectacle)
- Sensory authority (inhabits world rather than describes it)
- Thematic coherence and emotional gravity

SEVERITY GATE:
If manuscript shows 3+ professional indicators (will score 8-10):
- MOST waves must be labeled "Low" or "Medium" severity
- Only reserve "High" for submission-blocking issues: POV breaks, logic errors, confusion, incoherence
- Language/line-level polish (body-parts, filters, adverbs) = "Low" severity in professional tier
- Frame all issues as "refinement opportunities" not "craft failures"

CRITICAL: Use ONLY these exact WAVE category names:
- "Body-Part Clichés"
- "Filter Verbs"
- "Generic Nouns"
- "Adverbs & Intensifiers"
- "Passive Voice"
- "Negation Overuse"
- "Telling vs Showing"
- "On-the-Nose Explanations"
- "Dialogue Tags"
- "Abstract Triples"
- "Motif Overuse"
- "Sentence Variety"
- "Specificity"

TEXT:
${text}

For each issue: wave_item (exact category name from list above), severity (High/Medium/Low), evidence_quote (exact text), fix (specific revision that addresses the actual issue).
Also identify 3-5 priority wave numbers to focus on and next actions.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        waveHits: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    wave_item: { type: "string" },
                                    severity: { type: "string", enum: ["High", "Medium", "Low"] },
                                    evidence_quote: { type: "string" },
                                    fix: { type: "string" }
                                },
                                required: ["wave_item", "severity", "evidence_quote", "fix"]
                            }
                        },
                        waveGuidance: {
                            type: "object",
                            properties: {
                                priorityWaves: { type: "array", items: { type: "number" } },
                                nextActions: { type: "array", items: { type: "string" } }
                            },
                            required: ["priorityWaves", "nextActions"]
                        }
                    },
                    required: ["waveHits", "waveGuidance"]
                }
            });

        // Classify manuscript tier
        const avgScore = agentAnalysis.criteria?.length > 0
            ? agentAnalysis.criteria.reduce((sum, c) => sum + c.score, 0) / agentAnalysis.criteria.length
            : agentAnalysis.overallScore;

        const manuscriptTier = avgScore >= 8 ? 'professional' : avgScore >= 6 ? 'refinement' : 'developmental';



        // DETERMINISTIC POST-PROCESSING SCRUB: Remove NA leakage (MDM Rule M4)
        const processedCriteria = (agentAnalysis.criteria || [])
            .map(criterion => {
                // Find criterion ID from name (exact enum match)
                const criterionId = applicableCriteria.find(id => 
                    criteriaLabels[id] === criterion.name
                ) || Object.keys(criteriaLabels).find(id => 
                    criterion.name.toLowerCase().includes(id.toLowerCase())
                );
                
                if (criterionId && criteriaPlan.criteria[criterionId]) {
                    const status = criteriaPlan.criteria[criterionId].status;
                    
                    // MDM RULE M4: NA criteria should never reach here due to schema suppression
                    // But if they do, return null to filter them out
                    if (status === 'NA') {
                        return null;
                    }
                    
                    return {
                        ...criterion,
                        status,
                        blocking_enabled: criteriaPlan.criteria[criterionId].blockingEnabled,
                        criterion_id: criterionId
                    };
                }
                
                // Unknown criterion - filter out
                return null;
            })
            .filter(c => c !== null);
        
        // Build comprehensive NA term dictionary for deterministic scrubbing
        const naTermsDictionary = new Set();

        // Add criterion IDs
        naCriteria.forEach(id => naTermsDictionary.add(id.toLowerCase()));

        // Add common references for each NA criterion
        if (naCriteriaSet.has('dialogue')) {
            ['dialogue', 'conversation', 'speaking', 'said', 'talk', 'exchange', 'verbal', 'speaking', 'discussion'].forEach(t => naTermsDictionary.add(t));
        }
        if (naCriteriaSet.has('conflict')) {
            ['conflict', 'tension', 'confrontation', 'clash', 'struggle', 'opposition', 'plot', 'event', 'interaction', 'character interaction', 'pivotal moment', 'complicat'].forEach(t => naTermsDictionary.add(t));
        }
        if (naCriteriaSet.has('worldbuilding')) {
            ['worldbuilding', 'world-building', 'world building', 'setting detail', 'world detail'].forEach(t => naTermsDictionary.add(t));
        }

        // NA Output Gate: deterministic scrubbing function
        function containsNAReference(text) {
            if (!text) return false;
            const lowerText = text.toLowerCase();

            // Check each NA term
            for (const term of naTermsDictionary) {
                if (lowerText.includes(term)) {
                    return true;
                }
            }

            return false;
        }

        // Safe replacement text for NA-contaminated fields
        const NA_SAFE_REPLACEMENTS = {
            biggest_risk_essay: "The introspective tone may not sustain reader engagement throughout the full piece.",
            biggest_risk_memoir: "The reflective structure may need stronger narrative anchors to maintain momentum.",
            most_leverage_fix_essay: "Strengthen the specificity of sensory details and deepen the thematic resonance.",
            most_leverage_fix_memoir: "Add more concrete sensory moments to ground the reflection in lived experience."
        };

        // Scrub revision requests
        const filteredRevisionRequests = (agentAnalysis.revisionRequests || []).filter(req => {
            if (containsNAReference(req.instruction)) {
                console.log(`[NA Scrub] Filtered revision request:`, req.instruction.substring(0, 100));
                return false;
            }
            return true;
        });
        
        // Scrub WAVE hits
        const scrubbedWaveHits = (waveAnalysis.waveHits || []).filter(hit => {
            if (containsNAReference(hit.wave_item) || 
                containsNAReference(hit.evidence_quote) || 
                containsNAReference(hit.fix)) {
                console.log(`[NA Scrub] Filtered WAVE hit:`, hit.wave_item);
                return false;
            }
            return true;
        });

        // Scrub agentSnapshot with comprehensive NA Output Gate
        const scrubbedAgentSnapshot = agentSnapshot ? {
            keep_reading: agentSnapshot.keep_reading,
            biggest_risk: containsNAReference(agentSnapshot.biggest_risk) 
                ? (criteriaPlan.family === 'Prose Nonfiction' 
                    ? NA_SAFE_REPLACEMENTS.biggest_risk_essay 
                    : NA_SAFE_REPLACEMENTS.biggest_risk_memoir)
                : agentSnapshot.biggest_risk,
            biggest_strength: containsNAReference(agentSnapshot.biggest_strength)
                ? "The voice and reflective tone create genuine emotional resonance."
                : agentSnapshot.biggest_strength,
            most_leverage_fix: containsNAReference(agentSnapshot.most_leverage_fix)
                ? (criteriaPlan.family === 'Prose Nonfiction'
                    ? NA_SAFE_REPLACEMENTS.most_leverage_fix_essay
                    : NA_SAFE_REPLACEMENTS.most_leverage_fix_memoir)
                : agentSnapshot.most_leverage_fix
        } : agentSnapshot;

        // Log NA scrub summary
        const naScrubbedCount = {
            revisionRequests: (agentAnalysis.revisionRequests?.length || 0) - filteredRevisionRequests.length,
            waveHits: (waveAnalysis.waveHits?.length || 0) - scrubbedWaveHits.length,
            agentSnapshot: (agentSnapshot?.biggest_risk !== scrubbedAgentSnapshot?.biggest_risk ? 1 : 0) +
                           (agentSnapshot?.most_leverage_fix !== scrubbedAgentSnapshot?.most_leverage_fix ? 1 : 0)
        };

        console.log('[MDM NA Output Gate]', {
            na_criteria: naCriteria,
            scrubbed_counts: naScrubbedCount,
            work_type: final_work_type_used
        });
        
        const evaluationResult = {
            overallScore: agentAnalysis.overallScore || 5,
            agentVerdict: agentAnalysis.agentVerdict || "Evaluation complete",
            manuscriptTier: manuscriptTier,
            agentSnapshot: scrubbedAgentSnapshot,
            criteria: processedCriteria,
            revisionRequests: filteredRevisionRequests,
            waveHits: scrubbedWaveHits,
            waveGuidance: waveAnalysis.waveGuidance || { priorityWaves: [], nextActions: [] },
            styleMode: styleMode,
            thoughtTagSuggestions: thoughtTagSuggestions,
            overusedWordHits: overusedWordHits,
            work_type_routing: {
                final_work_type_used: final_work_type_used,
                work_type_label: criteriaPlan.workTypeLabel,
                family: criteriaPlan.family,
                matrix_version: criteriaPlan.matrixVersion,
                na_criteria: naCriteria,
                required_criteria: requiredCriteria,
                na_output_gate: {
                    scrubbed_counts: naScrubbedCount,
                    enforcement_active: true
                }
            }
        };

        // Save to database with Work Type audit trail
        let submissionId = null;
        try {
            const newSubmission = await base44.asServiceRole.entities.Submission.create({
                title,
                text,
                result_json: evaluationResult,
                overall_score: evaluationResult.overallScore,
                status: 'reviewed'
            });
            submissionId = newSubmission.id;
            
            // Create audit event (MDM Canon v1 compliance)
            await base44.asServiceRole.entities.EvaluationAuditEvent.create({
                event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                request_id: submissionId,
                timestamp_utc: new Date().toISOString(),
                detected_format: 'scene',
                routed_pipeline: 'quick',
                user_email: user.email,
                evaluation_mode: 'standard',
                validators_run: ['work_type_detection', 'criteria_plan_builder'],
                validators_failed: [],
                failure_codes: [],
                submission_id: submissionId,
                detected_work_type: detected_work_type || final_work_type_used,
                detection_confidence: detection_confidence || 'unknown',
                user_action: user_action || 'confirm',
                user_provided_work_type: user_provided_work_type || null,
                final_work_type_used: final_work_type_used,
                matrix_version: criteriaPlan.matrixVersion,
                criteria_plan: criteriaPlan.criteria
            });
        } catch (saveError) {
            console.error('Save error (non-critical):', saveError);
        }

        // Store evaluation signals for progress tracking (disabled - requires admin auth)
        // if (submissionId) {
        //     try {
        //         await base44.asServiceRole.functions.invoke('storeEvaluationSignals', {
        //             submissionId: submissionId,
        //             evaluationResult,
        //             contentType: 'scene',
        //             isRevision: false
        //         });
        //     } catch (signalError) {
        //         console.error('Failed to store evaluation signals (non-critical):', signalError);
        //     }
        // }

        return Response.json({
            success: true,
            evaluation: evaluationResult,
            submissionId: submissionId
        });

    } catch (error) {
        console.error('Quick evaluation error:', error);
        
        // Capture to Sentry with context
        Sentry.captureException(error, {
            extra: {
                function: 'evaluateQuickSubmission',
                operation: 'quick_evaluation',
                title,
                word_count: text?.split(/\s+/).filter(w => w).length,
                style_mode: styleMode,
                user_email: user?.email,
                is_timeout: error.message.includes('timeout'),
                error_message: error.message,
                timestamp: new Date().toISOString()
            }
        });
        await Sentry.flush(2000);
        
        // Check if it's a timeout
        if (error.message.includes('timeout')) {
            return Response.json({ 
                error: 'Evaluation is taking longer than expected. Please try with a shorter excerpt or try again later.',
                timeout: true
            }, { status: 408 });
        }
        
        return Response.json({ error: error.message }, { status: 500 });
    }
});