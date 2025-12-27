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
            return Response.json({ error: 'Manuscript ID required' }, { status: 400 });
        }

        // Get manuscript and chapters
        const [manuscript] = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscript_id });
        const chapters = await base44.asServiceRole.entities.Chapter.filter({ manuscript_id }, 'order');

        if (!manuscript || chapters.length === 0) {
            return Response.json({ error: 'Manuscript or chapters not found' }, { status: 404 });
        }

        // Update status to show we've started
        await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
            evaluation_progress: {
                total_chapters: chapters.length,
                completed_chapters: 0,
                current_step: 'Starting spine evaluation in batches...'
            }
        });

        // 1. Evaluate Spine in batches (12 agent criteria)
        const BATCH_SIZE = 8; // Process 8 chapters at a time
        const batchEvaluations = [];

        for (let i = 0; i < chapters.length; i += BATCH_SIZE) {
            const batch = chapters.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(chapters.length / BATCH_SIZE);

            await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                evaluation_progress: {
                    total_chapters: chapters.length,
                    completed_chapters: i,
                    current_step: `Analyzing spine batch ${batchNum}/${totalBatches} (chapters ${i + 1}-${Math.min(i + BATCH_SIZE, chapters.length)})...`
                }
            });

            const batchText = batch.map(ch => `CHAPTER ${ch.order}: ${ch.title}\n${ch.text}`).join('\n\n---\n\n');

            const batchPrompt = `You are a senior literary agent evaluating part of a manuscript. Analyze these chapters against the 12 criteria, rating each 1-10:

        1. The Hook (Opening Impact)
        2. Voice & Narrative Style
        3. Characters & Development
        4. Conflict & Tension Architecture
        5. Thematic Resonance
        6. Pacing & Structural Flow
        7. Dialogue & Subtext
        8. Worldbuilding & Immersion
        9. Stakes & Emotional Investment
        10. Line-Level Polish
        11. Marketability & Genre Fit
        12. Would Agent Request Full Manuscript

        MANUSCRIPT: ${manuscript.title}
        CHAPTERS ${i + 1}-${Math.min(i + BATCH_SIZE, chapters.length)} of ${chapters.length}

        ${batchText}

        For each criterion provide: score (1-10), strengths (array), weaknesses (array), notes.
        Also provide: overallScore (1-10), verdict, strengths (array), weaknesses (array).`;

            const batchEval = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: batchPrompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        overallScore: { type: "number" },
                        verdict: { type: "string" },
                        strengths: { type: "array", items: { type: "string" } },
                        weaknesses: { type: "array", items: { type: "string" } },
                        criteria: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    score: { type: "number" },
                                    strengths: { type: "array", items: { type: "string" } },
                                    weaknesses: { type: "array", items: { type: "string" } },
                                    notes: { type: "string" }
                                },
                                required: ["name", "score", "strengths", "weaknesses", "notes"]
                            }
                        }
                    },
                    required: ["overallScore", "verdict", "strengths", "weaknesses", "criteria"]
                }
            });

            batchEvaluations.push(batchEval);
        }

        // Synthesize all batch evaluations into final spine score
        await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
            evaluation_progress: {
                total_chapters: chapters.length,
                completed_chapters: chapters.length,
                current_step: 'Synthesizing spine analysis...'
            }
        });

        const synthesisPrompt = `You are a senior literary agent. Multiple evaluations have been done on different sections of the manuscript "${manuscript.title}". Synthesize these into ONE comprehensive spine evaluation with the 12 criteria.

        BATCH EVALUATIONS:
        ${JSON.stringify(batchEvaluations, null, 2)}

        Create a final unified evaluation. Average scores across batches, combine strengths/weaknesses, and provide an overall verdict for the complete manuscript.`;

        const spineEvaluation = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: synthesisPrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    overallScore: { type: "number" },
                    verdict: { type: "string" },
                    majorStrengths: { type: "array", items: { type: "string" } },
                    criticalWeaknesses: { type: "array", items: { type: "string" } },
                    criteria: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                score: { type: "number" },
                                strengths: { type: "array", items: { type: "string" } },
                                weaknesses: { type: "array", items: { type: "string" } },
                                notes: { type: "string" }
                            },
                            required: ["name", "score", "strengths", "weaknesses", "notes"]
                        }
                    }
                },
                required: ["overallScore", "verdict", "majorStrengths", "criticalWeaknesses", "criteria"]
            }
        });

        // Update manuscript with spine evaluation
        await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
            spine_score: spineEvaluation.overallScore,
            spine_evaluation: spineEvaluation,
            status: 'evaluating_chapters',
            evaluation_progress: {
                total_chapters: chapters.length,
                completed_chapters: 0,
                current_step: 'Spine evaluation complete'
            }
        });

        // 2. Evaluate each chapter (12 criteria + WAVE)
        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            
            // Update progress
            await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                evaluation_progress: {
                    total_chapters: chapters.length,
                    completed_chapters: i,
                    current_step: `Evaluating Chapter ${i + 1}: ${chapter.title}`
                }
            });
            // Agent-level evaluation
            const agentAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `You are a senior literary agent evaluating a manuscript chapter. Analyze this chapter against exactly these 12 criteria, rating each 1-10:

1. The Hook
2. Voice & Narrative Style
3. Characters & Introductions
4. Conflict & Tension
5. Thematic Resonance
6. Pacing & Structural Flow
7. Dialogue & Subtext
8. Worldbuilding & Immersion
9. Stakes & Emotional Investment
10. Line-Level Polish
11. Marketability & Genre Fit
12. Would Agent Keep Reading

CHAPTER: ${chapter.title}

TEXT:
${chapter.text}

For each criterion provide: score (1-10), strengths (array), weaknesses (array), notes (detailed commentary).
Provide overall score (1-10) and verdict.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        overallScore: { type: "number" },
                        verdict: { type: "string" },
                        criteria: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    score: { type: "number" },
                                    strengths: { type: "array", items: { type: "string" } },
                                    weaknesses: { type: "array", items: { type: "string" } },
                                    notes: { type: "string" }
                                },
                                required: ["name", "score", "strengths", "weaknesses", "notes"]
                            }
                        }
                    },
                    required: ["overallScore", "verdict", "criteria"]
                }
            });

            // WAVE Revision System evaluation
            const waveAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `You are an elite developmental editor applying the WAVE Revision System. Scan this chapter for line-level craft issues across these categories:

WAVE CHECKS:
- Sentence Craft: varied length/structure, rhythm, clarity, passive voice, weak verbs
- Sensory Details: show vs tell, concrete imagery, sensory balance
- Dialogue: subtext, tags vs beats, realism, character voice distinction
- Scene Momentum: micro-pacing, tension beats, scene structure
- Character Interiority: thought patterns, emotional specificity, POV consistency
- Pacing Flow: paragraph variety, transition smoothness, info dumping
- Technical Precision: grammar, punctuation, word choice, repetition patterns

CHAPTER: ${chapter.title}

TEXT:
${chapter.text}

For each WAVE issue found, provide: category, severity (Low/Medium/High), description, example_quote (actual text), fix_suggestion.
Provide: waveScore (1-10), criticalIssues (array), strengthAreas (array).`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        waveScore: { type: "number" },
                        criticalIssues: { type: "array", items: { type: "string" } },
                        strengthAreas: { type: "array", items: { type: "string" } },
                        waveHits: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    category: { type: "string" },
                                    severity: { type: "string" },
                                    description: { type: "string" },
                                    example_quote: { type: "string" },
                                    fix_suggestion: { type: "string" }
                                },
                                required: ["category", "severity", "description", "example_quote", "fix_suggestion"]
                            }
                        }
                    },
                    required: ["waveScore", "criticalIssues", "strengthAreas", "waveHits"]
                }
            });

            // Combined score: 50% agent + 50% WAVE
            const combinedScore = (agentAnalysis.overallScore * 0.5) + (waveAnalysis.waveScore * 0.5);

            // Update chapter
            await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                evaluation_score: combinedScore,
                evaluation_result: {
                    ...agentAnalysis,
                    waveAnalysis: waveAnalysis,
                    combinedScore: combinedScore,
                    agentScore: agentAnalysis.overallScore,
                    waveScore: waveAnalysis.waveScore
                },
                status: 'evaluated'
            });
        }

        // Mark manuscript as ready
        await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
            status: 'ready',
            evaluation_progress: {
                total_chapters: chapters.length,
                completed_chapters: chapters.length,
                current_step: 'Evaluation complete'
            }
        });

        return Response.json({ 
            success: true,
            spine_score: spineEvaluation.overallScore
        });

    } catch (error) {
        console.error('Evaluation error:', error);
        
        // Try to update manuscript status to show error
        try {
            const { manuscript_id } = await req.json();
            if (manuscript_id) {
                const base44 = createClientFromRequest(req);
                await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                    status: 'uploaded',
                    evaluation_progress: {
                        total_chapters: 0,
                        completed_chapters: 0,
                        current_step: `Error: ${error.message}`
                    }
                });
            }
        } catch (updateError) {
            console.error('Failed to update error status:', updateError);
        }
        
        return Response.json({ error: error.message }, { status: 500 });
    }
});