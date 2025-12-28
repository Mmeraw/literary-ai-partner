import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptInfo } = await req.json();

        if (!manuscriptInfo?.title || !manuscriptInfo?.logline) {
            return Response.json({ 
                success: false, 
                error: 'Title and logline are required' 
            }, { status: 400 });
        }

        // Generate all components in parallel
        const [pitchesResult, synopsesResult, bioResult, queryResult] = await Promise.all([
            // Pitches
            base44.integrations.Core.InvokeLLM({
                prompt: `Generate professional pitch variations for this manuscript:

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

THRILLER INTIMACY GUARDRAIL - Relationship Classification:
- If genre is thriller/suspense AND manuscript includes committed relationships:
  * Treat as EMOTIONAL ANCHOR, not romantic subplot
  * Use "partners (X years)" or "bond tested under fire" - NOT "lover/love interest"
  * If NO explicit sexual/romantic scenes mentioned: frame as "intimacy without spectacle" or "loyalty under duress"
  * Focus on SURVIVAL STAKES + relationship resilience, not romance plot
- Romance genre framing ONLY if manuscript explicitly centers romantic relationship development
- Presence of emotional intimacy ≠ romance classification

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

THRILLER INTIMACY GUARDRAIL - Relationship Handling:
- For thriller/suspense manuscripts with committed relationships:
  * Frame as EMOTIONAL ANCHOR under pressure, not romantic subplot
  * Use "partners" or "bond forged under duress" - avoid "romantic relationship" framing
  * If no explicit sexual/romantic content: treat as "restrained intimacy" or "loyalty tested"
  * Prioritize: (1) Survival stakes, (2) Relationship as resilience factor, (3) NO romance-genre tropes
- Do NOT infer romance genre from emotional intensity alone
- Devotion + shared trauma ≠ romance classification unless manuscript explicitly depicts romantic/sexual relationship development

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

THRILLER INTIMACY GUARDRAIL - Query Letter Framing:
- For thriller manuscripts with intimate relationships:
  * Pitch as thriller with "emotional stakes" or "bond tested" - NOT "love story" or "romantic thriller"
  * Use "partner" or "committed relationship" - avoid "lover/love interest" unless manuscript is explicitly romantic
  * If no sexual/romantic scenes described: frame as "loyalty" or "intimacy under fire"
  * Query comp strategy: thriller comps + "emotional depth," NOT romance crossover
- Emotional closeness does NOT equal romance genre unless manuscript centers romantic relationship arc

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