import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { captureError, captureCritical } from './utils/errorTracking.js';
import { withTimeoutAndRetry } from './utils/retryLogic.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { title, text, styleMode } = await req.json();

        if (!title || !text) {
            return Response.json({ error: 'Title and text required' }, { status: 400 });
        }

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

        // Story Evaluation (Agents, Editors, Script Readers)
        const agentAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `You are a professional evaluator (agent, editor, or script reader) assessing a manuscript. 

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

Analyze this text against exactly these 12 criteria, rating each 1-10:

1. The Hook - First pages pull reader in with intrigue, tension, unique voice
2. Voice & Narrative Style - Distinct, engaging voice matching tone with fresh prose  
3. Characters & Introductions - Visceral character feel showing personality and motivations
4. Conflict & Tension - Strong driving tension with escalating conflicts
5. Thematic Resonance - Deep themes woven naturally without being preachy
6. Pacing & Structural Flow - Momentum in every chapter, tight purposeful scenes
7. Dialogue & Subtext - Authentic dialogue revealing more than stated
8. Worldbuilding & Immersion - World revealed organically with sensory details
9. Stakes & Emotional Investment - Clear stakes with reader emotional connection
10. Line-Level Polish - Tight evocative prose with proper rhythm
11. Marketability & Genre Fit - Fresh, original, fits genre, marketable
12. Would Agent Keep Reading - High tension/intrigue making agent request full manuscript

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
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    score: { type: "number", description: "1-10" },
                                    strengths: { type: "array", items: { type: "string" } },
                                    weaknesses: { type: "array", items: { type: "string" } },
                                    agentNotes: { type: "string" }
                                },
                                required: ["name", "score", "strengths", "weaknesses", "agentNotes"]
                            }
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

        // Sort wave hits by severity
        const sortedWaveHits = (waveAnalysis.waveHits || []).sort((a, b) => {
            const severityOrder = { High: 0, Medium: 1, Low: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

        const evaluationResult = {
            overallScore: agentAnalysis.overallScore || 5,
            agentVerdict: agentAnalysis.agentVerdict || "Evaluation complete",
            manuscriptTier: manuscriptTier,
            agentSnapshot: agentSnapshot,
            criteria: agentAnalysis.criteria || [],
            revisionRequests: agentAnalysis.revisionRequests || [],
            waveHits: sortedWaveHits,
            waveGuidance: waveAnalysis.waveGuidance || { priorityWaves: [], nextActions: [] },
            styleMode: styleMode,
            thoughtTagSuggestions: thoughtTagSuggestions,
            overusedWordHits: overusedWordHits
        };

        // Save to database
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
        } catch (saveError) {
            console.error('Save error (non-critical):', saveError);
        }

        // Store evaluation signals for progress tracking
        if (submissionId) {
            try {
                await base44.asServiceRole.functions.invoke('storeEvaluationSignals', {
                    submissionId: submissionId,
                    evaluationResult,
                    contentType: 'scene',
                    isRevision: false
                });
            } catch (signalError) {
                console.error('Failed to store evaluation signals (non-critical):', signalError);
            }
        }

        return Response.json({
            success: true,
            evaluation: evaluationResult,
            submissionId: submissionId
        });

    } catch (error) {
        console.error('Quick evaluation error:', error);
        
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