import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

Deno.serve(async (req) => {
    let payload = null;
    let file_url = null;
    let bio = null;
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // CRITICAL: Parse and log payload BEFORE any external operations
        const rawPayload = await req.json();
        console.log('📦 RAW PAYLOAD RECEIVED:', JSON.stringify(rawPayload, null, 2));
        console.log('📦 Raw payload type:', typeof rawPayload);
        console.log('📦 Raw payload keys:', Object.keys(rawPayload || {}));
        
        // Handle potential SDK wrapping (check if payload is wrapped in body/data/params)
        payload = rawPayload?.body || rawPayload?.data || rawPayload?.params || rawPayload;
        console.log('📦 UNWRAPPED PAYLOAD:', JSON.stringify(payload, null, 2));
        console.log('📦 Payload keys:', Object.keys(payload || {}));
        console.log('📦 Payload types:', Object.keys(payload || {}).map(k => `${k}: ${typeof payload[k]}`).join(', '));
        
        const { 
            file_url: extracted_file_url, 
            bio: extracted_bio, 
            synopsis_mode = 'auto',
            existing_synopsis, 
            one_line_pitch,
            pitch_paragraph,
            comps_mode = 'auto',
            manual_comps,
            genre,
            voiceIntensity = 'house'
        } = payload || {};
        
        file_url = extracted_file_url;
        bio = extracted_bio;

        console.log('📥 EXTRACTED VALUES:', { 
            file_url, 
            file_url_type: typeof file_url,
            file_url_value: file_url,
            synopsis_mode, 
            comps_mode, 
            genre, 
            voiceIntensity,
            has_bio: !!bio,
            bio_length: bio?.length
        });

        // Validate required fields BEFORE any fetch operations
        if (!file_url) {
            console.error('❌ Missing file_url');
            return Response.json({ 
                error: 'file_url is required',
                received: {
                    file_url: file_url || 'MISSING'
                }
            }, { status: 400 });
        }
        
        // Default bio if not provided
        if (!bio || bio.trim().length === 0) {
            console.log('⚠️ No bio provided, using AUTO generation');
            bio = 'No bio provided - RevisionGrade will generate from manuscript context.';
        }
        
        // Reject test/invalid URLs
        if (file_url.includes('example.com') || file_url.includes('test.txt')) {
            console.error('❌ Test or invalid URL rejected:', file_url);
            return Response.json({ 
                error: 'Invalid file URL',
                details: 'Test URLs and example.com domains are not allowed. Please upload a real manuscript file.',
                received_url: file_url
            }, { status: 400 });
        }
        
        // PHASE 1: Fetch manuscript text for preflight validation
        console.log('🔍 Starting manuscript fetch for preflight check...');
        console.log('🔍 file_url:', file_url);
        
        let manuscriptText = '';
        
        try {
            // Extract filename from URL (handle query params and paths)
            const urlPath = file_url.split('?')[0]; // Remove query params
            const fileName = urlPath.split('/').pop().toLowerCase(); // Get last segment
            console.log('🔍 fileName:', fileName);
            console.log('🔍 full URL:', file_url);
            
            const isWordDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc');
            const isTxt = fileName.endsWith('.txt');
            const isPdf = fileName.endsWith('.pdf');
            const isRtf = fileName.endsWith('.rtf');
            
            console.log('🔍 File type detected:', { isWordDoc, isTxt, isPdf, isRtf });
            
            if (!isWordDoc && !isTxt && !isPdf && !isRtf) {
                return Response.json({ 
                    error: 'Unsupported file format',
                    details: 'Please upload DOC, DOCX, TXT, PDF, or RTF files.',
                    received_filename: fileName
                }, { status: 400 });
            }
            
            // Use InvokeLLM for ALL file types - bypasses CORS completely
            const fileType = isWordDoc ? 'DOCX/DOC' : isPdf ? 'PDF' : isRtf ? 'RTF' : 'TXT';
            console.log('🔍 Extracting', fileType, 'from:', file_url);
            
            const extracted = await base44.integrations.Core.InvokeLLM({
                prompt: "Extract all text from this document. Return ONLY the complete raw text, no markdown formatting, no explanations. Just the text exactly as it appears.",
                file_urls: [file_url]
            });
            
            // Handle both string and object responses from InvokeLLM
            manuscriptText = (typeof extracted === 'string' ? extracted : (extracted?.response || extracted?.text || '')).toString().trim();
            console.log('✅ File extracted:', manuscriptText.length, 'characters');
            
        } catch (fetchError) {
            console.error('❌ File fetch/processing error:', fetchError);
            console.error('Error details:', {
                message: fetchError.message,
                stack: fetchError.stack,
                file_url
            });
            
            return Response.json({
                error: 'Failed to fetch or process manuscript file',
                details: fetchError.message,
                file_url,
                step: 'file_fetch'
            }, { status: 500 });
        }
        
        // PHASE 1: Matrix Preflight Validation (MUST execute before LLM)
        const preflightResponse = await base44.asServiceRole.functions.invoke('matrixPreflight', {
            inputText: manuscriptText,
            requestType: 'query_package',
            userEmail: user.email
        });
        const preflight = preflightResponse.data;
        
        if (!preflight.allowed) {
            // Create audit log for blocked request
            try {
                await base44.asServiceRole.entities.EvaluationAuditEvent.create({
                    event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    request_id: `blocked_query_${Date.now()}`,
                    timestamp_utc: new Date().toISOString(),
                    detected_format: 'manuscript',
                    routed_pipeline: 'query_package',
                    user_email: user.email,
                    evaluation_mode: 'standard',
                    validators_run: ['matrix_preflight'],
                    validators_failed: ['matrix_preflight'],
                    failure_codes: [preflight.blockReason],
                    ...preflight.audit,
                    matrix_compliance: false,
                    llm_invoked: false
                });
            } catch (auditError) {
                console.error('[Phase 1] Audit log failed (non-critical):', auditError);
            }
            
            // Log to Sentry
            Sentry.captureMessage('Matrix Preflight Blocked Query Package Request', {
                level: 'warning',
                tags: { matrix_violation: true, request_type: 'query_package' },
                extra: {
                    wordCount: preflight.wordCount,
                    inputScale: preflight.inputScale,
                    blockReason: preflight.blockReason,
                    userEmail: user.email
                }
            });
            
            return Response.json({ 
                error: preflight.userFacingCode,
                ...preflight.refusalMessage
            }, { status: 422 });
        }
        
        console.log('[Phase 1 Preflight]', {
            allowed: true,
            wordCount: preflight.wordCount,
            inputScale: preflight.inputScale,
            maxConfidence: preflight.maxConfidence
        });

        // Step 1: Extract pitch fields (file already fetched for preflight)
        console.log('🔄 Step 1: Extracting pitch fields...');
        const manuscriptSample = manuscriptText.substring(0, Math.min(50000, manuscriptText.length));
        console.log(`✅ File processed: ${manuscriptSample.length} characters`);
        
        // Extract pitch fields with LLM
        console.log('🔍 Extracting pitch fields...');
        const extractionPrompt = `Analyze this manuscript excerpt and extract pitch fields:

MANUSCRIPT TEXT:
${manuscriptSample}

Extract: title, genre (specific), wordCount (number), logline (1-2 sentences), keyThemes, protagonist, stakes, setting, uniqueHook.

Return structured JSON.`;

        const extracted = await base44.integrations.Core.InvokeLLM({
            prompt: extractionPrompt,
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
        console.log('✅ Step 1 complete - Pitch fields extracted:', { title: metadata.title, genre: metadata.genre });

        // Use user-provided values or extracted ones
        const finalSynopsis = synopsis_mode === 'manual' && existing_synopsis ? existing_synopsis : metadata.logline;
        const finalOneLinePitch = one_line_pitch || metadata.logline;
        const finalPitchParagraph = pitch_paragraph || metadata.logline;

        // Step 2: Generate or use provided comparables
        console.log('📚 Step 2: Processing comparables...');
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
        
        // Create audit log for successful query package generation
        try {
            await base44.asServiceRole.entities.EvaluationAuditEvent.create({
                event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                request_id: `query_success_${Date.now()}`,
                timestamp_utc: new Date().toISOString(),
                detected_format: 'manuscript',
                routed_pipeline: 'query_package',
                user_email: user.email,
                evaluation_mode: 'standard',
                validators_run: ['matrix_preflight'],
                validators_failed: [],
                failure_codes: [],
                ...preflight.audit,
                matrix_preflight_allowed: true,
                matrix_compliance: true,
                llm_invoked: true,
                llm_invocation_reason: 'preflight_passed'
            });
        } catch (auditError) {
            console.error('[Phase 1] Audit log failed (non-critical):', auditError);
        }

        return Response.json({
            query_letter: queryLetter,
            suggested_agents: agents.agents,
            metadata: {
                title: metadata.title,
                genre: metadata.genre,
                word_count: metadata.wordCount || metadata.word_count,
                comparables: comps.comparables,
                voiceGatePassed: metadata.meta?.passedVoiceGate,
                thematicSchema: metadata.thematicSchema,
                matrix_preflight: {
                    wordCount: preflight.wordCount,
                    inputScale: preflight.inputScale,
                    maxConfidenceAllowed: preflight.maxConfidence
                }
            }
        });

    } catch (error) {
        console.error('❌ Query letter generation error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error response:', error.response?.data);
        console.error('Payload received:', JSON.stringify(payload, null, 2));
        console.error('file_url extracted:', file_url);
        
        // Capture to Sentry with detailed step-by-step context
        Sentry.captureException(error, {
            tags: {
                pipeline: 'query_letter_package',
                feature: 'output_generation'
            },
            extra: {
                function: 'generateQueryLetterPackage',
                operation: 'query_letter_package_generation',
                error_message: error.message,
                error_stack: error.stack,
                error_response: error.response?.data,
                payload_received: payload,
                file_url_extracted: file_url,
                timestamp: new Date().toISOString()
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ 
            error: 'Failed to generate query letter', 
            details: error.message,
            error_type: error.constructor.name,
            response_data: error.response?.data,
            payload_received: payload,
            file_url_extracted: file_url,
            step: 'Check logs for detailed error location'
        }, { status: 500 });
    }
});