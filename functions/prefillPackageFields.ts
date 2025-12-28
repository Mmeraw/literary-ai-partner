import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscript_id } = await req.json();

        if (!manuscript_id) {
            return Response.json({ error: 'Missing manuscript_id' }, { status: 400 });
        }

        // Get manuscript
        const manuscript = await base44.asServiceRole.entities.Manuscript.get(manuscript_id);
        if (!manuscript) {
            return Response.json({ error: 'Manuscript not found' }, { status: 404 });
        }

        // Use first 50,000 words for analysis (to avoid token limits)
        const words = manuscript.full_text.split(/\s+/);
        const textSample = words.slice(0, 50000).join(' ');

        const prompt = `Analyze this manuscript and extract key information for submission materials.

MANUSCRIPT TITLE: ${manuscript.title}
WORD COUNT: ${manuscript.word_count}

MANUSCRIPT TEXT (first 50k words):
${textSample}

Generate the following fields for a complete submission package:

1. **Genre**: Identify the primary genre(s) (e.g., "Literary Fiction", "Psychological Thriller", "Historical Fantasy")
2. **Logline**: A compelling one-sentence logline that captures the core conflict and stakes
3. **Key Themes**: 3-5 major themes explored in the work (comma-separated)
4. **Protagonist**: Brief description of the main character(s)
5. **Stakes**: What's at risk if the protagonist fails?
6. **Setting**: Where and when does the story take place?
7. **Unique Hook**: What makes this story different from others in its genre? What's the unique angle or twist?
8. **Author Name**: Extract if mentioned, otherwise return empty string
9. **Author Bio Seed**: Draft a professional author bio based on any biographical information in the text (writing style, themes, etc.). Keep it professional and submission-ready.
10. **Publishing Credits**: Extract any mentioned publications or writing experience (return empty if none found)

Return ONLY valid JSON, no additional text.`;

        const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    genre: { type: "string" },
                    logline: { type: "string" },
                    keyThemes: { type: "string" },
                    protagonist: { type: "string" },
                    stakes: { type: "string" },
                    setting: { type: "string" },
                    uniqueHook: { type: "string" },
                    authorName: { type: "string" },
                    authorBio: { type: "string" },
                    publishingCredits: { type: "string" }
                }
            }
        });

        return Response.json({
            success: true,
            fields: {
                title: manuscript.title,
                wordCount: manuscript.word_count.toString(),
                ...response
            }
        });

    } catch (error) {
        console.error('Prefill error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});