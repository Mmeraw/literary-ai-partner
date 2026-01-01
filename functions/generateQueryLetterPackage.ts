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

        console.log('📥 Query letter generation started:', { file_url, synopsis_mode, comps_mode, genre });

        if (!file_url || !bio) {
            return Response.json({ error: 'file_url and bio are required' }, { status: 400 });
        }

        // Fetch the manuscript file
        console.log('📄 Fetching manuscript file...');
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        const fileText = new TextDecoder().decode(fileBuffer);
        console.log(`✅ File fetched: ${fileText.length} characters`);

        // Extract first 50k characters for analysis
        const manuscriptSample = fileText.substring(0, 50000);

        // Step 1: Extract metadata and synopsis
        console.log('🔍 Step 1: Extracting metadata and synopsis...');
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
        console.log('✅ Step 1 complete:', { title: metadata.title, genre: metadata.genre });

        // Use user-provided values or generated ones
        const finalSynopsis = synopsis_mode === 'manual' && existing_synopsis ? existing_synopsis : metadata.synopsis;
        const finalOneLinePitch = one_line_pitch || metadata.one_line_pitch;
        const finalPitchParagraph = pitch_paragraph || metadata.pitch_paragraph;

        // Step 2: Generate or use provided comparable titles
        console.log('📚 Step 2: Generating comparables...');
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
                    console.log(`✅ Step 2 complete: ${comps.comparables?.length || 0} comparables generated`);

                    // Step 3: Suggest literary agents using Perplexity for real-time agent research
                    console.log('🔎 Step 3: Researching literary agents...');
        const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
        
        let agentResearch = '';
        if (perplexityApiKey) {
            try {
                const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-sonar-small-128k-online',
                        messages: [{
                            role: 'user',
                            content: `Find 3 currently active literary agents who represent ${metadata.genre} fiction. For each agent, provide: full name, agency name, recent sales or clients in this genre, and whether they're currently accepting queries. Focus on agents with recent sales (2023-2025).`
                        }]
                    })
                });
                
                const perplexityData = await perplexityResponse.json();
                agentResearch = perplexityData.choices?.[0]?.message?.content || '';
            } catch (perplexityError) {
                console.error('Perplexity API error:', perplexityError);
            }
        }
        
        const agentsPrompt = `Based on this real-time agent research, suggest 3 literary agents for this ${metadata.genre} manuscript:

Title: ${metadata.title}
Synopsis: ${finalSynopsis}

${agentResearch ? `Current Agent Research:\n${agentResearch}\n\n` : ''}

For each agent, provide: name, agency, and specific reason why they'd be a good fit based on their recent sales and client list.

Return JSON array: [{ name, agency, reason }]`;

        const agents = await base44.integrations.Core.InvokeLLM({
            prompt: agentsPrompt,
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
        console.log(`✅ Step 3 complete: ${agents.agents?.length || 0} agents suggested`);

        // Step 4: Generate query letter with primary agent
        console.log('✍️ Step 4: Generating query letter...');
        const primaryAgent = agents.agents?.[0] || { 
            name: 'Literary Agent', 
            agency: 'Literary Agency',
            reason: 'No specific agent match found'
        };
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
        console.log('✅ Step 4 complete: Query letter generated');
        console.log('🎉 All steps complete - returning results');

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
        console.error('❌ Query letter generation error:', error);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Failed to generate query letter', 
            details: error.message,
            step: 'Check logs for detailed error location'
        }, { status: 500 });
    }
});