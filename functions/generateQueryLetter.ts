import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptTitle, genre, wordCount, synopsis, bio, agentName } = await req.json();

        if (!manuscriptTitle || !synopsis) {
            return Response.json({ error: 'Title and synopsis are required' }, { status: 400 });
        }

        const queryPrompt = `Write a professional query letter for this manuscript:

Title: ${manuscriptTitle}
Genre: ${genre || 'Not specified'}
Word Count: ${wordCount || 'Not specified'}
Synopsis: ${synopsis}
Author Bio: ${bio || 'Not provided'}
${agentName ? `Agent Name: ${agentName}` : 'Agent: [Agent Name]'}

Follow industry standards: personalized opening, compelling hook, brief synopsis, author bio, professional closing. Keep under 400 words.`;

        const queryLetter = await base44.integrations.Core.InvokeLLM({
            prompt: queryPrompt
        });

        return Response.json({ query_letter: queryLetter });

    } catch (error) {
        console.error('Query letter generation error:', error);
        return Response.json({ 
            error: 'Failed to generate query letter', 
            details: error.message 
        }, { status: 500 });
    }
});