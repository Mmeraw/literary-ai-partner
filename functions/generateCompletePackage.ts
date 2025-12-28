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
5. Hollywood Logline

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

Return plain text, no JSON.`,
                response_json_schema: null
            }),

            // Query Letter
            base44.integrations.Core.InvokeLLM({
                prompt: `Generate a professional query letter for this manuscript:

Title: ${manuscriptInfo.title}
Genre: ${manuscriptInfo.genre || 'Fiction'}
Word Count: ${manuscriptInfo.wordCount || 'Complete'}
Logline: ${manuscriptInfo.logline}
Author: ${manuscriptInfo.authorName || user.full_name}

Structure:
1. Opening hook (1-2 sentences)
2. Story pitch (1 paragraph using the logline)
3. Author credentials (brief)
4. Closing

Make it professional, concise, agent-ready. Return plain text.`,
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