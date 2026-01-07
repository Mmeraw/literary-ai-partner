import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptInfo, voiceIntensity = 'house', manuscript_id } = await req.json();

        if (!manuscriptInfo?.title || !manuscriptInfo?.logline) {
            return Response.json({ 
                success: false, 
                error: 'Title and logline are required' 
            }, { status: 400 });
        }

        // MATRIX PREFLIGHT (Governance Layer)
        const sourceText = manuscriptInfo.text_sample || manuscriptInfo.full_text || '';
        const inputWordCount = sourceText.split(/\s+/).length;

        let preflightResult = null;
        try {
            const preflightResponse = await base44.functions.invoke('matrixPreflight', {
                operation: 'generateQueryPitches',
                inputText: sourceText,
                manuscriptId: manuscript_id,
                userIntent: { voiceIntensity }
            });
            preflightResult = preflightResponse.data;
        } catch (preflightError) {
            console.error('matrixPreflight error:', preflightError);
            return Response.json({
                success: false,
                error: 'Preflight validation failed',
                details: preflightError.message
            }, { status: 500 });
        }

        // HARD GATE: Block if preflight failed
        if (!preflightResult.allowed) {
            return Response.json({
                success: false,
                status: 'error',
                code: 'SCOPE_VIOLATION',
                message: 'Request blocked by governance policy.',
                result: null,
                warnings: [],
                audit: {
                    endpoint: 'generateQueryPitches',
                    governanceStatus: 'hard_blocked',
                    llmInvoked: false,
                    policyVersion: 'EVAL_METHOD_v1.0.0'
                },
                details: {
                    blockedBy: 'matrixPreflight',
                    gateBlocked: true,
                    endpoint: 'generateQueryPitches',
                    policyVersion: 'EVAL_METHOD_v1.0.0',
                    reason: preflightResult.refusalMessage,
                    thresholds: {
                        minWords: preflightResult.minWordsAllowed
                    },
                    observed: {
                        words: inputWordCount
                    },
                    maxAllowed: {},
                    matrixCompliance: preflightResult.matrixcompliance
                }
            }, { status: 400 });
        }

        // VOICE ANCHOR: Apply thematic schema if source text is available
        let thematicSchema = {};
        let voiceAnchored = {};
        
        const sourceText = manuscriptInfo.text_sample || manuscriptInfo.full_text || '';
        
        if (sourceText.length > 100) {
            console.log('🎭 Applying Voice Anchor layer...');
            
            const voiceAnchorResult = await base44.functions.invoke('applyVoiceAnchorAndSchemaToPitch', {
                extractedText: sourceText,
                formatType: 'pitch_variations',
                projectVoiceProfile: null,
                voiceIntensity
            });

            const voiceData = voiceAnchorResult.data || voiceAnchorResult;
            
            if (!voiceData.success || !voiceData.meta?.passedVoiceGate) {
                const failureReason = voiceData.meta?.bannedPhraseHits?.join(', ') || 
                                      (!voiceData.meta?.lawMentioned ? 'missing law/ritual structure' : 'missing specificity requirements');
                return Response.json({ 
                    success: false, 
                    error: `Voice Gate failed (${voiceIntensity}): ${failureReason}. Try lowering intensity or provide more concrete source text.`,
                    meta: voiceData.meta
                }, { status: 422 });
            }

            thematicSchema = voiceData.thematicSchema || {};
            voiceAnchored = voiceData.pitch || {};
            console.log('✅ Thematic schema applied:', thematicSchema);
        } else {
            console.log('ℹ️ No source text provided, generating from manual fields only');
        }

        // Build comprehensive context for the LLM
        const contextPrompt = `
You are an expert literary agent and pitch consultant. Generate multiple professional pitch variations for a manuscript.

${Object.keys(thematicSchema).length > 0 ? `THEMATIC FOUNDATION (use as backbone):
${JSON.stringify(thematicSchema, null, 2)}

VOICE-ANCHORED ELEMENTS (preserve this depth):
${JSON.stringify(voiceAnchored, null, 2)}

` : ''}MANUSCRIPT INFORMATION:
- Title: ${manuscriptInfo.title}
- Genre: ${manuscriptInfo.genre || 'Not specified'}
- Word Count: ${manuscriptInfo.wordCount || 'Not specified'}
- Current Logline: ${manuscriptInfo.logline}
- Key Themes: ${manuscriptInfo.keyThemes || 'Not specified'}
- Protagonist: ${manuscriptInfo.protagonist || 'Not specified'}
- Stakes: ${manuscriptInfo.stakes || 'Not specified'}
- Setting: ${manuscriptInfo.setting || 'Not specified'}
- Unique Hook: ${manuscriptInfo.uniqueHook || 'Not specified'}

GENERATE THE FOLLOWING PITCH VARIATIONS:

1. ONE-SENTENCE SPECIFIC (for query letters & agent submissions):
   - Must clearly show the unique premise
   - Include protagonist, core conflict, and stakes
   - Make marketability immediately clear
   - Example pattern: "As Kingdom Lake's amphibian empire faces extinction, Crown Hyla defies tradition by interbreeding with a land-traversing warrior, unknowingly setting off a chain of events..."

2. ONE-SENTENCE GENERAL (for networking & broad pitches):
   - Keep it universal without naming specific species/races
   - Focus on themes: power, transformation, survival
   - Example pattern: "When an oppressed species discovers an ancient power that could alter its fate, it must decide whether to embrace transformation and rebellion..."

3. CONVERSATIONAL ELEVATOR (2-3 sentences, <45 seconds spoken):
   - Natural, engaging tone
   - Hook → conflict → stakes
   - Easy to remember and deliver verbally
   - Example pattern: "It's about an ancient species facing extinction who discover they can evolve—but it means war. The story follows their matriarch as she makes an impossible choice between saving her people or preserving what they've always been."

4. STRUCTURED ELEVATOR (60 seconds):
   - Clear three-act structure
   - Setup → Complication → Resolution/Hook
   - More detailed than conversational
   - Include genre positioning

5. HOLLYWOOD LOGLINE (film-pitch style):
   - [PROTAGONIST] + [PREDICAMENT] + [OBJECTIVE] + [OPPONENT/OBSTACLE]
   - High-concept, visual
   - Example: "When a dying amphibian queen discovers her species can evolve through forbidden interbreeding, she must lead a rebellion against both human invaders and her own traditionalist subjects—or watch her civilization vanish forever."

6. PARAGRAPH PITCH (for query letters):
   - 3-5 sentences
   - Establishes world, protagonist, conflict, stakes
   - Includes thematic resonance
   - Shows market positioning

Return ONLY a JSON object with these exact keys:
{
  "oneSentenceSpecific": "...",
  "oneSentenceGeneral": "...",
  "conversational": "...",
  "elevator": "...",
  "hollywood": "...",
  "paragraph": "..."
}

CRITICAL GUIDELINES:
- Use the manuscript's actual details and themes
- Match the tone and genre appropriately
- Ensure each variation serves its specific use case
- Keep language precise, active, and compelling
- Avoid clichés and generic phrases
`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: contextPrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    oneSentenceSpecific: { type: "string" },
                    oneSentenceGeneral: { type: "string" },
                    conversational: { type: "string" },
                    elevator: { type: "string" },
                    hollywood: { type: "string" },
                    paragraph: { type: "string" }
                },
                required: ["oneSentenceSpecific", "oneSentenceGeneral", "conversational", "elevator", "hollywood", "paragraph"]
            }
        });

        return Response.json({
            success: true,
            status: 'ok',
            code: null,
            message: null,
            result: {
                pitches: response
            },
            warnings: [],
            audit: {
                endpoint: 'generateQueryPitches',
                governanceStatus: 'allowed',
                llmInvoked: true,
                policyVersion: 'EVAL_METHOD_v1.0.0',
                matrixCompliance: preflightResult.matrixcompliance,
                confidence: preflightResult.confidence,
                inputWordCount: inputWordCount
            }
        });

    } catch (error) {
        console.error('Pitch generation error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});