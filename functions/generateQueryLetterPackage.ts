import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            file_url, 
            bio, 
            synopsis_mode = 'auto',
            existing_synopsis, 
            one_line_pitch,
            pitch_paragraph,
            comps_mode = 'auto',
            manual_comps,
            genre 
        } = await req.json();

        if (!file_url || !bio) {
            return Response.json({ error: 'file_url and bio are required' }, { status: 400 });
        }

        // Fetch the manuscript file
        const fileResponse = await fetch(file_url);
        const fileBuffer = await fileResponse.arrayBuffer();
        const fileText = new TextDecoder().decode(fileBuffer);

        // Extract first 50k characters for analysis
        const manuscriptSample = fileText.substring(0, 50000);

        // Step 1: Extract metadata and synopsis
        const metadataPrompt = `Analyze this manuscript excerpt and provide:
1. Title (extract from document)
2. Detected genre (if not provided: ${genre || 'detect'})
3. Word count estimate
4. Brief 2-paragraph synopsis (if not provided: ${existing_synopsis || 'generate'})

Manuscript excerpt:
${manuscriptSample}

Return JSON with: { title, genre, word_count, synopsis }`;

        const metadata = await base44.integrations.Core.InvokeLLM({
            prompt: metadataPrompt,
            response_json_schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    genre: { type: 'string' },
                    word_count: { type: 'number' },
                    synopsis: { type: 'string' }
                }
            }
        });

        // Step 2: Generate comparable titles
        const compsPrompt = `Based on this ${metadata.genre} manuscript titled "${metadata.title}":

Synopsis: ${metadata.synopsis}

Suggest 3-5 recent comparable titles that would strengthen a query letter. Include title, author, and brief reason for comparison.

Return JSON array: [{ title, author, reason }]`;

        const comps = await base44.integrations.Core.InvokeLLM({
            prompt: compsPrompt,
            response_json_schema: {
                type: 'object',
                properties: {
                    comparables: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                author: { type: 'string' },
                                reason: { type: 'string' }
                            }
                        }
                    }
                }
            }
        });

        // Step 3: Suggest literary agents
        const agentsPrompt = `Suggest 3 literary agents who would be ideal for this ${metadata.genre} manuscript:

Title: ${metadata.title}
Synopsis: ${metadata.synopsis}

For each agent, provide: name, agency, and specific reason why they'd be a good fit.

Return JSON array: [{ name, agency, reason }]`;

        const agents = await base44.integrations.Core.InvokeLLM({
            prompt: agentsPrompt,
            add_context_from_internet: true,
            response_json_schema: {
                type: 'object',
                properties: {
                    agents: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                agency: { type: 'string' },
                                reason: { type: 'string' }
                            }
                        }
                    }
                }
            }
        });

        // Step 4: Generate query letter with primary agent
        const primaryAgent = agents.agents[0];
        const queryPrompt = `Write a professional query letter for this manuscript:

Title: ${metadata.title}
Genre: ${metadata.genre}
Word Count: ${metadata.word_count}
Synopsis: ${metadata.synopsis}

Comparable Titles:
${comps.comparables.map(c => `- ${c.title} by ${c.author}`).join('\n')}

Author Bio: ${bio}

Agent: ${primaryAgent.name} at ${primaryAgent.agency}

Follow industry standards: personalized opening, compelling hook, brief synopsis, comparables, author bio, professional closing. Keep under 400 words.`;

        const queryLetter = await base44.integrations.Core.InvokeLLM({
            prompt: queryPrompt
        });

        return Response.json({
            query_letter: queryLetter,
            suggested_agents: agents.agents,
            metadata: {
                title: metadata.title,
                genre: metadata.genre,
                word_count: metadata.word_count,
                comparables: comps.comparables
            }
        });

    } catch (error) {
        console.error('Query letter generation error:', error);
        return Response.json({ 
            error: 'Failed to generate query letter', 
            details: error.message 
        }, { status: 500 });
    }
});