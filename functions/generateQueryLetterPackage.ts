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
${synopsis_mode === 'auto' ? '4. Brief 2-paragraph synopsis' : ''}
${!one_line_pitch ? '5. One-line elevator pitch' : ''}
${!pitch_paragraph ? '6. Query-letter pitch paragraph (compelling hook paragraph for agent)' : ''}

Manuscript excerpt:
${manuscriptSample}

Return JSON.`;

        const metadata = await base44.integrations.Core.InvokeLLM({
            prompt: metadataPrompt,
            response_json_schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    genre: { type: 'string' },
                    word_count: { type: 'number' },
                    synopsis: { type: 'string' },
                    one_line_pitch: { type: 'string' },
                    pitch_paragraph: { type: 'string' }
                }
            }
        });

        // Use user-provided values or generated ones
        const finalSynopsis = synopsis_mode === 'manual' && existing_synopsis ? existing_synopsis : metadata.synopsis;
        const finalOneLinePitch = one_line_pitch || metadata.one_line_pitch;
        const finalPitchParagraph = pitch_paragraph || metadata.pitch_paragraph;

        // Step 2: Generate or use provided comparable titles
        let comps;
        if (comps_mode === 'manual' && manual_comps) {
            const compsLines = manual_comps.split('\n').filter(line => line.trim());
            comps = { 
                comparables: compsLines.map(line => ({ 
                    title: line.trim(), 
                    author: '', 
                    reason: '' 
                })) 
            };
        } else {
            const compsPrompt = `Based on this ${metadata.genre} manuscript titled "${metadata.title}":

Synopsis: ${finalSynopsis}

Suggest 3-5 recent comparable titles that would strengthen a query letter. Include title, author, and brief reason for comparison.

Return JSON array: [{ title, author, reason }]`;

            comps = await base44.integrations.Core.InvokeLLM({
                prompt: compsPrompt,
                add_context_from_internet: true,
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
        }

        // Step 3: Suggest literary agents
        const agentsPrompt = `Suggest 3 literary agents who would be ideal for this ${metadata.genre} manuscript:

Title: ${metadata.title}
Synopsis: ${finalSynopsis}

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

One-line Pitch:
${finalOneLinePitch}

Main Pitch Paragraph:
${finalPitchParagraph}

Synopsis:
${finalSynopsis}

Comparable Titles:
${comps.comparables.map(c => c.author ? `- ${c.title} by ${c.author}` : `- ${c.title}`).join('\n')}

Author Bio: ${bio}

Agent: ${primaryAgent.name} at ${primaryAgent.agency}

Follow industry standards: personalized opening, use the pitch paragraph as the hook, brief synopsis elements, comparables, author bio, professional closing. Keep under 400 words.`;

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