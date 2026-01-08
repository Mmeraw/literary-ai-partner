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
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptTitle, genre, wordCount, synopsis, bio, agentName, manuscript_id, synopsisArtifactId, evaluationRunId } = await req.json();

        if (!manuscriptTitle || !synopsis) {
            return Response.json({
                success: false,
                status: 'error',
                code: 'MISSING_INPUT',
                message: 'Title and synopsis are required',
                result: null,
                warnings: [],
                audit: {},
                details: {}
            }, { status: 400 });
        }

        // MATRIX PREFLIGHT (Governance Layer - Query Letter surface)
        const synopsisWordCount = synopsis.split(/\s+/).length;
        const provenanceMode = synopsisArtifactId ? 'artifact_backed' : evaluationRunId ? 'evaluation_backed' : 'manual_paste';

        let preflightResult = null;
        try {
            const preflightResponse = await base44.asServiceRole.functions.invoke('matrixPreflight', {
                operation: 'generateQueryLetter',
                inputText: synopsis,
                manuscriptId: manuscript_id,
                userIntent: { 
                    provenanceMode,
                    synopsisArtifactId,
                    evaluationRunId
                }
            });
            preflightResult = preflightResponse.data;
        } catch (preflightError) {
            console.error('matrixPreflight error:', preflightError);
            return Response.json({
                success: false,
                status: 'error',
                code: 'PREFLIGHT_FAILED',
                message: 'Scope validation failed',
                result: null,
                warnings: [],
                audit: {
                    endpoint: 'generateQueryLetter',
                    governanceStatus: 'error',
                    llmInvoked: false,
                    policyVersion: 'EVAL_METHOD_v1.0.0'
                },
                details: { error: preflightError.message }
            }, { status: 500 });
        }

        // HARD GATE: Block if preflight failed
        if (!preflightResult.allowed) {
            return Response.json({
                success: false,
                status: 'error',
                code: 'SCOPE_VIOLATION',
                message: 'Request blocked by governance policy.',
                result: null,
                warnings: [],
                audit: {
                    endpoint: 'generateQueryLetter',
                    governanceStatus: 'hard_blocked',
                    llmInvoked: false,
                    policyVersion: 'EVAL_METHOD_v1.0.0'
                },
                details: {
                    blockedBy: 'matrixPreflight',
                    gateBlocked: true,
                    endpoint: 'generateQueryLetter',
                    provenanceMode: provenanceMode,
                    policyVersion: 'EVAL_METHOD_v1.0.0',
                    reason: preflightResult.refusalMessage,
                    thresholds: {
                        minWords: preflightResult.minWordsAllowed
                    },
                    observed: {
                        words: synopsisWordCount
                    },
                    maxAllowed: {},
                    matrixCompliance: preflightResult.matrixcompliance
                }
            }, { status: 400 });
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

        return Response.json({
            success: true,
            status: 'ok',
            code: null,
            message: null,
            result: {
                query_letter: queryLetter
            },
            warnings: provenanceMode === 'manual_paste' ? ['Synopsis not artifact-backed - provenance unverified'] : [],
            audit: {
                endpoint: 'generateQueryLetter',
                governanceStatus: 'allowed',
                llmInvoked: true,
                policyVersion: 'EVAL_METHOD_v1.0.0',
                provenanceMode: provenanceMode,
                matrixCompliance: preflightResult.matrixcompliance,
                confidence: preflightResult.confidence,
                synopsisWordCount: synopsisWordCount
            }
        });

    } catch (error) {
        console.error('Query letter generation error:', error);
        
        // Capture to Sentry with context
        Sentry.captureException(error, {
            tags: {
                pipeline: 'query_letter',
                feature: 'output_generation'
            },
            extra: {
                function: 'generateQueryLetter',
                operation: 'query_letter_generation',
                manuscript_title: manuscriptTitle,
                genre: genre,
                word_count: wordCount,
                has_synopsis: !!synopsis,
                has_bio: !!bio,
                agent_name: agentName,
                user_email: user?.email,
                error_message: error.message,
                timestamp: new Date().toISOString()
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ 
            error: 'Failed to generate query letter', 
            details: error.message 
        }, { status: 500 });
    }
});