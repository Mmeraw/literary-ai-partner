import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { job_id } = await req.json();

        if (!job_id) {
            return Response.json({ error: 'job_id is required' }, { status: 400 });
        }

        console.log('🔄 Processing job:', job_id);

        // Fetch job
        const jobs = await base44.asServiceRole.entities.QueryLetterJob.filter({ id: job_id });
        if (!jobs || jobs.length === 0) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        const job = jobs[0];

        // Update status to processing
        await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
            status: 'processing',
            processing_started_at: new Date().toISOString(),
            progress: 'Running preflight validation...'
        });

        const manuscriptText = job.manuscript_text;

        // PHASE 1: Matrix Preflight Validation
        await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
            progress: 'Validating manuscript requirements...'
        });

        const preflightResponse = await base44.asServiceRole.functions.invoke('matrixPreflight', {
            inputText: manuscriptText,
            requestType: 'query_package',
            userEmail: job.created_by
        });
        const preflight = preflightResponse.data;

        if (!preflight.allowed) {
            await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
                status: 'failed',
                error_message: preflight.refusalMessage?.explanation || 'Manuscript does not meet requirements',
                completed_at: new Date().toISOString()
            });

            return Response.json({ 
                error: preflight.userFacingCode,
                ...preflight.refusalMessage
            }, { status: 422 });
        }

        // Extract pitch fields
        await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
            progress: 'Analyzing manuscript structure...'
        });

        const manuscriptSample = manuscriptText.substring(0, Math.min(30000, manuscriptText.length));
        
        const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Analyze this manuscript excerpt and extract pitch fields:

MANUSCRIPT TEXT:
${manuscriptSample}

Extract: title, genre (specific), wordCount (number), logline (1-2 sentences), keyThemes, protagonist, stakes, setting, uniqueHook.

Return structured JSON.`,
            response_json_schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    genre: { type: 'string' },
                    wordCount: { type: 'number' },
                    logline: { type: 'string' },
                    keyThemes: { type: 'string' },
                    protagonist: { type: 'string' },
                    stakes: { type: 'string' },
                    setting: { type: 'string' },
                    uniqueHook: { type: 'string' }
                }
            }
        });

        const metadata = extracted;

        // Use provided values or extracted
        const finalSynopsis = job.synopsis_mode === 'manual' && job.existing_synopsis ? job.existing_synopsis : metadata.logline;
        const finalOneLinePitch = job.one_line_pitch || metadata.logline;
        const finalPitchParagraph = job.pitch_paragraph || metadata.logline;

        // Generate comparables
        await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
            progress: 'Researching comparable titles...'
        });

        let comps;
        if (job.comps_mode === 'manual' && job.manual_comps) {
            const compsLines = job.manual_comps.split('\n').filter(line => line.trim());
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

            comps = await base44.asServiceRole.integrations.Core.InvokeLLM({
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

        // Research agents with Perplexity
        await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
            progress: 'Identifying suitable literary agents...'
        });

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
                            content: `Find 3 currently active literary agents who represent ${metadata.genre} fiction. For each agent, provide: full name, agency name, recent sales or clients in this genre, and whether they're currently accepting queries. Focus on agents with recent sales (2023-2026).`
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

        const agents = await base44.asServiceRole.integrations.Core.InvokeLLM({
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

        // Generate query letter
        await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
            progress: 'Crafting query letter...'
        });

        const primaryAgent = agents.agents?.[0] || { 
            name: 'Literary Agent', 
            agency: 'Literary Agency',
            reason: 'No specific agent match found'
        };

        const queryPrompt = `Write a professional query letter for this manuscript:

Title: ${metadata.title}
Genre: ${metadata.genre}
Word Count: ${metadata.wordCount}

One-line Pitch:
${finalOneLinePitch}

Main Pitch Paragraph:
${finalPitchParagraph}

Synopsis:
${finalSynopsis}

Comparable Titles:
${comps.comparables.map(c => c.author ? `- ${c.title} by ${c.author}` : `- ${c.title}`).join('\n')}

Author Bio: ${job.bio}

Agent: ${primaryAgent.name} at ${primaryAgent.agency}

Follow industry standards: personalized opening, use the pitch paragraph as the hook, brief synopsis elements, comparables, author bio, professional closing. Keep under 400 words.`;

        const queryLetter = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: queryPrompt
        });

        // Save result
        await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
            status: 'complete',
            progress: 'Complete',
            completed_at: new Date().toISOString(),
            result: {
                query_letter: queryLetter,
                suggested_agents: agents.agents,
                metadata: {
                    title: metadata.title,
                    genre: metadata.genre,
                    word_count: metadata.wordCount,
                    comparables: comps.comparables
                }
            }
        });

        console.log('✅ Job completed:', job_id);

        return Response.json({
            job_id,
            status: 'complete',
            message: 'Query letter generated successfully'
        });

    } catch (error) {
        console.error('❌ Process job error:', error);
        
        if (job_id) {
            try {
                await base44.asServiceRole.entities.QueryLetterJob.update(job_id, {
                    status: 'failed',
                    error_message: error.message,
                    completed_at: new Date().toISOString()
                });
            } catch (updateError) {
                console.error('Failed to update job status:', updateError);
            }
        }

        Sentry.captureException(error, {
            tags: { pipeline: 'query_letter_job', job_id },
            extra: { error_message: error.message }
        });
        await Sentry.flush(2000);

        return Response.json({ 
            error: 'Processing failed',
            details: error.message
        }, { status: 500 });
    }
});