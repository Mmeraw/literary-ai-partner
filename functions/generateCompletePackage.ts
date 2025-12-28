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
                prompt: `Generate three synopsis lengths for this manuscript:

Title: ${manuscriptInfo.title}
Genre: ${manuscriptInfo.genre || 'Not specified'}
Logline: ${manuscriptInfo.logline}
Key Details: ${manuscriptInfo.keyThemes || ''} ${manuscriptInfo.protagonist || ''} ${manuscriptInfo.stakes || ''}

Create:
1. Query Synopsis (250-300 words) - hook-focused, marketable
2. Standard Synopsis (500-750 words) - full arc, key beats
3. Extended Synopsis (1000-1500 words) - comprehensive, character depth

IMPORTANT: Use italics for the manuscript title (e.g., *${manuscriptInfo.title}*), not quotes.

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
                prompt: `Generate a professional author bio for query letters:

Author: ${manuscriptInfo.authorName || user.full_name}
Background: ${manuscriptInfo.authorBio || 'Not specified'}
Credits: ${manuscriptInfo.publishingCredits || 'Debut author'}
Current Work: ${manuscriptInfo.title} (${manuscriptInfo.genre || 'fiction'})

Create a 75-100 word professional bio for literary agent submissions.
Focus on: credentials, relevant experience, why qualified to write this story.

IMPORTANT: Use italics for the manuscript title (e.g., *${manuscriptInfo.title}*), not quotes.

Return plain text, no JSON.`,
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