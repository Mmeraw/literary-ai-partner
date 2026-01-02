import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptInfo, voiceIntensity = 'house' } = await req.json();

        if (!manuscriptInfo?.title || !manuscriptInfo?.logline) {
            return Response.json({ 
                success: false, 
                error: 'Title and logline are required' 
            }, { status: 400 });
        }

        // VOICE ANCHOR: Apply thematic schema if source text is available
        let thematicSchema = {};
        let voiceAnchored = {};
        
        const sourceText = manuscriptInfo.text_sample || manuscriptInfo.full_text || '';
        
        if (sourceText.length > 100) {
            console.log('🎭 Applying Voice Anchor layer to complete package...');
            
            const voiceAnchorResult = await base44.functions.invoke('applyVoiceAnchorAndSchemaToPitch', {
                extractedText: sourceText,
                formatType: 'complete_package',
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
            console.log('✅ Thematic schema applied to complete package:', thematicSchema);
        } else {
            console.log('ℹ️ No source text provided, generating from manual fields only');
        }

        // Generate all components in parallel
        const [pitchesResult, synopsesResult, bioResult, queryResult] = await Promise.all([
            // Pitches
            base44.integrations.Core.InvokeLLM({
                prompt: `Generate professional pitch variations for this manuscript.

${Object.keys(thematicSchema).length > 0 ? `THEMATIC FOUNDATION (use as backbone):
${JSON.stringify(thematicSchema, null, 2)}

VOICE-ANCHORED ELEMENTS (preserve this depth):
${JSON.stringify(voiceAnchored, null, 2)}

` : ''}

Title: ${manuscriptInfo.title}
Genre: ${manuscriptInfo.genre || 'Not specified'}
Logline: ${manuscriptInfo.logline}
Themes: ${manuscriptInfo.keyThemes || 'Not specified'}
Protagonist: ${manuscriptInfo.protagonist || 'Not specified'}
Stakes: ${manuscriptInfo.stakes || 'Not specified'}
Setting: ${manuscriptInfo.setting || 'Not specified'}
Unique Hook: ${manuscriptInfo.uniqueHook || 'Not specified'}

CRITICAL ACCURACY RULES:
1. Use ONLY the information provided above - do NOT invent plot details
2. If logline/protagonist info indicates specific POV or narrative structure, preserve it exactly
3. Do NOT reverse protagonist/antagonist relationships
4. Do NOT substitute generic stakes (e.g., "human trafficking") for specific manuscript details
5. Honor the manuscript's actual setting and conflict (e.g., "meth camp" not "trafficking ring")

CANON LOCK - Relationship Extraction (HARD RULE):
- Extract relationship type ONLY from manuscript facts - NEVER infer romantic framing
- BANNED TERMS unless manuscript explicitly depicts romance: "lover", "love of his life", "romantic relationship", "love story"
- REQUIRED TERMS for non-romantic bonds: "partner", "bond tested", "loyalty", "brotherhood", "family by choice"
- If manuscript shows: Grindr meet → mentorship → survival bond = "partnership forged under duress" NOT romance
- Genre classification: Meth camp survival = "psychological survival thriller" NOT "LGBTQ romance"
- VALIDATION CHECK: If output contains "lover/romantic" → REJECT unless manuscript shows explicit romantic development
- Emotional intimacy + shared trauma = LOYALTY/BROTHERHOOD, not romance (default assumption)

Create these pitch variations:
1. One-Sentence Specific (agent submissions)
2. One-Sentence General (networking)
3. Conversational (2-3 sentences, <45 sec)
4. Structured Elevator (60 sec)
5. Hollywood Logline - MUST include time urgency/threat element (e.g., "before [threat] destroys...")

IMPORTANT: Use italics for the manuscript title throughout (e.g., *${manuscriptInfo.title}*), not quotes.

Return JSON with keys: oneSentenceSpecific, oneSentenceGeneral, conversational, elevator, hollywood`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        oneSentenceSpecific: { type: "string" },
                        oneSentenceGeneral: { type: "string" },
                        conversational: { type: "string" },
                        elevator: { type: "string" },
                        hollywood: { type: "string" }
                    }
                }
            }),

            // Synopses
            base44.integrations.Core.InvokeLLM({
                prompt: `Generate three PROFESSIONAL SYNOPSIS formats for agent submission:

Title: ${manuscriptInfo.title}
Genre: ${manuscriptInfo.genre || 'Not specified'}
Logline: ${manuscriptInfo.logline}
Key Details: ${manuscriptInfo.keyThemes || ''} ${manuscriptInfo.protagonist || ''} ${manuscriptInfo.stakes || ''}

CRITICAL ACCURACY RULES:
1. Use ONLY the provided information - do NOT invent plot structure
2. If logline indicates specific POV (e.g., "Canadian abducted"), preserve that POV - do NOT flip to another character
3. Do NOT reverse protagonist/supporting character roles
4. Honor manuscript's actual setting/conflict (e.g., specific location, specific threat type)
5. If multiple characters, identify the NARRATOR/PRIMARY POV from the logline

CANON LOCK - Relationship Framing (HARD RULE):
- Extract relationship description ONLY from source text - NO romantic inference
- BANNED: "lover", "love interest", "romantic subplot", "save the love of his life"
- REQUIRED: "partner", "bond", "loyalty tested", "brotherhood", "family forged through survival"
- DEFAULT ASSUMPTION for thrillers: Deep bonds = LOYALTY/BROTHERHOOD unless manuscript explicitly depicts romantic/sexual relationship arc
- Survival context (e.g., meth camp, cartel captivity) = frame as "partners tested under fire" NOT romance
- VALIDATION: Flag any "romance" language → verify manuscript evidence → if absent, use "loyalty/brotherhood" framing
- Genre priority: (1) Survival/thriller stakes, (2) Bond as emotional anchor, (3) NO romance tropes

CRITICAL SYNOPSIS RULES (ALL LENGTHS):
- Present tense, third person
- TRUE SYNOPSIS format - NOT promotional blurb
- Include concrete plot turns and escalation
- NO rhetorical questions (BANNED)
- NO "blurb-speak" adjectives
- Focus on WHAT HAPPENS, not emotional atmosphere
- Use italics for title: *${manuscriptInfo.title}*

Create:
1. Query Synopsis (250-300 words) - 3-5 key plot turns, reveals major beats
2. Standard Synopsis (500-750 words) - 5-8 plot turns, REVEALS ENDING
3. Extended Synopsis (1000-1500 words) - comprehensive plot, all major beats, FULL ENDING

Return JSON with keys: query, standard, extended`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        query: { type: "string" },
                        standard: { type: "string" },
                        extended: { type: "string" }
                    }
                }
            }),

            // Author Bio
            base44.integrations.Core.InvokeLLM({
                prompt: `Generate a professional author bio (100-150 words) for literary agent submissions:

Author Name (USE EXACTLY): ${manuscriptInfo.authorName || user.full_name || '[Author Name]'}
Background: ${manuscriptInfo.authorBio || 'No background provided'}
Publishing Credits: ${manuscriptInfo.publishingCredits || 'None listed'}

CRITICAL BIO RULES - "NO-INVENTION POLICY":
1. Use ONLY the exact author name provided above - NEVER invent pen names
2. If no background provided, keep bio short and neutral (2-3 sentences max)
3. ONLY include verifiable facts from the background field
4. NEVER add generic filler like "passionate about writing," "diverse influences," "fresh voice"
5. Third person only
6. If insufficient data, output: "[Author Name] is a writer. Full manuscript available."

Focus on: location (if provided), professional background (if provided), writing credentials (if provided), relevant lived experience (if provided).

Return only the bio text, plain text format.`,
                response_json_schema: null
            }),

            // Query Letter
            base44.integrations.Core.InvokeLLM({
                prompt: `Generate a professional query letter in EMAIL FORMAT (no postal addresses) for this manuscript:

Title: ${manuscriptInfo.title}
Genre: ${manuscriptInfo.genre || 'Fiction'}
Word Count: ${manuscriptInfo.wordCount || '[Word Count]'}
Logline: ${manuscriptInfo.logline}
Author Name (USE EXACTLY): ${manuscriptInfo.authorName || user.full_name || '[Author Name]'}
Author Bio: ${manuscriptInfo.authorBio || 'No bio provided'}

CRITICAL ACCURACY RULES:
1. Use ONLY the logline provided - do NOT invent alternative plot structure
2. If logline indicates specific POV, preserve it - do NOT switch to another character's perspective
3. Honor manuscript's actual setting/stakes from the logline
4. Do NOT genericize specific details (e.g., keep "meth camp" not "trafficking ring")

CANON LOCK - Query Letter (HARD RULE):
- BANNED TERMS: "lover", "love of his life", "romantic thriller", "love story"
- REQUIRED TERMS: "partner", "bond tested", "loyalty under fire", "brotherhood forged"
- Genre positioning: "Psychological survival thriller" (meth camp/cartel setting) NOT "LGBTQ romance"
- Comp strategy: THE CARTEL + SICARIO (thriller comps) NOT romance crossover
- Relationship framing: "partnership tested by survival" or "family by choice under duress"
- DEFAULT: If no explicit romance in manuscript → frame as thriller with emotional stakes, NEVER as romance
- VALIDATION: Any "romance" framing must be justified by manuscript showing romantic/sexual relationship development

CRITICAL FORMAT REQUIREMENTS:
1. EMAIL/QueryManager format ONLY - NO postal address blocks
2. Start with: "Dear [Agent Name]," (personalization placeholder)
3. Opening hook (1-2 sentences about the book)
4. Story pitch (1 compact paragraph) - MUST match logline's POV and plot structure
5. Author credentials (1-2 sentences, ONLY if bio provided, else omit)
6. REQUIRED CLOSING: "Full manuscript available. ${manuscriptInfo.wordCount || '[Word Count]'} words. Comp titles: [comparable title] meets [comparable title]. May I send you the full manuscript?"
7. Sign with EXACT author name: ${manuscriptInfo.authorName || user.full_name || '[Author Name]'}

STYLE RULES:
- Use italics for title: *${manuscriptInfo.title}*
- NO rhetorical questions
- NO "blurb-speak" adjectives (gripping, haunting, compelling)
- Concrete plot details, not abstract phrases
- Present tense for story pitch

Return only the query letter text.`,
                response_json_schema: null
            })
        ]);

        return Response.json({
            success: true,
            package: {
                pitches: pitchesResult,
                synopses: synopsesResult,
                authorBio: bioResult,
                queryLetter: queryResult
            }
        });

    } catch (error) {
        console.error('Complete package generation error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});