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

CRITICAL FORMAT REQUIREMENTS:
1. EMAIL/QueryManager format ONLY - NO postal address blocks
2. Start with: "Dear [Agent Name]," (personalization placeholder)
3. Opening hook (1-2 sentences about the book)
4. Story pitch (1 compact paragraph)
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