import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptText, title, genre, logline, voiceIntensity = 'house' } = await req.json();

        if (!manuscriptText || !title) {
            return Response.json({ 
                error: 'Missing required fields: manuscriptText and title' 
            }, { status: 400 });
        }

        // VOICE ANCHOR: Apply thematic schema before generating deck (MANDATORY)
        console.log('🎭 Applying Voice Anchor layer to film deck...');
        
        const voiceAnchorResult = await base44.functions.invoke('applyVoiceAnchorAndSchemaToPitch', {
            extractedText: manuscriptText.substring(0, 8000),
            formatType: 'film_pitch_deck',
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

        const thematicSchema = voiceData.thematicSchema || {};
        const voiceAnchored = voiceData.pitch || {};
        console.log('✅ Thematic schema applied to deck:', thematicSchema);

        // Generate comprehensive film pitch deck
        const prompt = `You are a Hollywood pitch consultant. Generate a comprehensive film adaptation pitch deck for the following manuscript.

${Object.keys(thematicSchema).length > 0 ? `THEMATIC FOUNDATION (use as the backbone):
${JSON.stringify(thematicSchema, null, 2)}

VOICE-ANCHORED PITCH ELEMENTS (preserve this depth):
${JSON.stringify(voiceAnchored, null, 2)}

` : ''}

MANUSCRIPT TITLE: ${title}
${genre ? `GENRE: ${genre}` : ''}
${logline ? `LOGLINE: ${logline}` : ''}

MANUSCRIPT TEXT:
${manuscriptText}

Generate a complete 12-slide film pitch deck with the following structure:

1. TITLE SLIDE: Title, tagline, genre
2. LOGLINE: One-sentence hook (Hollywood standard)
3. SYNOPSIS: 3-paragraph story overview
4. PROTAGONIST: Character arc, stakes, transformation
5. ANTAGONIST/CONFLICT: External and internal obstacles
6. WORLD & SETTING: Visual style, tone references (e.g., del Toro, Villeneuve)
7. THEMES: Core messages and resonance
8. 5-PART NARRATIVE STRUCTURE: Ordinary World, Call to Adventure, Trials, Climax, Resolution
9. VISUAL STYLE: Cinematography, color palette, mood
10. TARGET AUDIENCE: Demographics, comparable films
11. FRANCHISE POTENTIAL: Sequels, transmedia opportunities
12. BUDGET & TIMELINE: Estimated production scale

Ensure each slide has:
- Clear heading
- 2-4 bullet points or short paragraphs
- Specific, concrete details from the manuscript
- Producer-friendly language (not flowery or literary)

Focus on SCREEN VIABILITY:
- Visual storytelling opportunities
- Clear character arcs
- Strong act structure
- Marketable hook
- Production feasibility`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    slides: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                slideNumber: { type: "number" },
                                title: { type: "string" },
                                content: { type: "string" }
                            }
                        }
                    },
                    screenViabilityScore: { type: "number" },
                    viabilityNotes: { type: "string" }
                }
            }
        });

        return Response.json({
            success: true,
            pitchDeck: response,
            wordCount: manuscriptText.split(/\s+/).length
        });

    } catch (error) {
        console.error('Film pitch generation error:', error);
        return Response.json({ 
            error: error.message || 'Failed to generate film pitch deck' 
        }, { status: 500 });
    }
});