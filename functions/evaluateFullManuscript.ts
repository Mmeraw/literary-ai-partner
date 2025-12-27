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

        // PHASE 1: Generate chapter summaries (structural abstraction)
        // Check which chapters already have summaries (for resume capability)
        const summarizedChapters = chapters.filter(ch => ch.status === 'summarized' && ch.summary_json);
        const chapterSummaries = summarizedChapters.map(ch => ch.summary_json);

        if (summarizedChapters.length < chapters.length) {
            await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                status: 'summarizing',
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: summarizedChapters.length,
                    chapters_wave_done: 0,
                    current_phase: 'summarize',
                    percent_complete: Math.floor((summarizedChapters.length / chapters.length) * 25),
                    current_step: `Resuming summaries... (${summarizedChapters.length}/${chapters.length} done)`,
                    last_updated: new Date().toISOString()
                }
            });
        }

        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];

            // Skip if already summarized
            if (chapter.status === 'summarized' && chapter.summary_json) {
                chapterSummaries.push(chapter.summary_json);
                continue;
            }

            try {
                await base44.asServiceRole.entities.Chapter.update(chapter.id, { status: 'summarizing' });

                await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapterSummaries.length,
                        chapters_wave_done: 0,
                        current_phase: 'summarize',
                        percent_complete: Math.floor((chapterSummaries.length / chapters.length) * 25),
                        current_step: `Summarizing Chapter ${i + 1} of ${chapters.length}...`,
                        last_updated: new Date().toISOString()
                    }
                });

                const summaryPrompt = `You are a professional developmental editor. Produce accurate structural summaries. Do not invent events. Do not rewrite prose. Output must be valid JSON matching the schema. Keep language neutral and specific.

        TASK: Create a structural chapter summary for later whole-book 'spine' evaluation.

        RULES:
        - Use only information in the chapter text. Do not invent.
        - Summary must be 200–300 words, focused on plot movement, character change, stakes, and unresolved hooks.
        - Then fill the structured fields.
        - If chapter boundaries or names are unclear, make the best inference and mark uncertainty in 'notes'.

        CHAPTER TEXT:
        ${chapter.text}`;

                const summary = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: summaryPrompt,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            chapter_index: { type: "number" },
                            chapter_title: { type: "string" },
                            summary_200_300_words: { type: "string" },
                            key_beats: { type: "array", items: { type: "string" } },
                            characters_present: { type: "array", items: { type: "string" } },
                            primary_pov: { type: "string" },
                            settings: { type: "array", items: { type: "string" } },
                            stakes_shift: { type: "string" },
                            conflict_type: { type: "string" },
                            turning_point: { type: "string" },
                            unresolved_hooks: { type: "array", items: { type: "string" } },
                            tension_level_1_5: { type: "number" },
                            arc_movement_notes: { type: "string" },
                            notes: { type: "string" }
                        },
                        required: ["chapter_index", "chapter_title", "summary_200_300_words", "key_beats"]
                    }
                });

                await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                    summary_json: summary,
                    status: 'summarized'
                });

                chapterSummaries.push(summary);

                // Update progress after successful summary
                await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapterSummaries.length,
                        chapters_wave_done: 0,
                        current_phase: 'summarize',
                        percent_complete: Math.floor((chapterSummaries.length / chapters.length) * 25),
                        current_step: `Summarized ${chapterSummaries.length}/${chapters.length} chapters`,
                        last_updated: new Date().toISOString()
                    }
                });

                } catch (error) {
                console.error(`Chapter ${i + 1} summary failed:`, error);
                await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                    status: 'failed',
                    error_message: error.message
                });

                // Update progress to show we moved past this chapter
                await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapterSummaries.length,
                        chapters_wave_done: 0,
                        current_phase: 'summarize',
                        percent_complete: Math.floor((chapterSummaries.length / chapters.length) * 25),
                        current_step: `Chapter ${i + 1} failed, continuing...`,
                        last_updated: new Date().toISOString(),
                        error_message: `Chapter ${i + 1} error: ${error.message}`
                    }
                });
                // Continue with remaining chapters
                }
                }

        // PHASE 2: Spine synthesis (all summaries at once)
        // Skip if spine already evaluated
        if (!manuscript.spine_score || !manuscript.spine_evaluation) {
            await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                status: 'spine_evaluating',
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: chapters.length,
                    chapters_wave_done: 0,
                    current_phase: 'spine',
                    percent_complete: 25,
                    current_step: 'Building Spine Evaluation...',
                    last_updated: new Date().toISOString()
                }
            });

        const spinePrompt = `You are a literary agent–style evaluator and developmental editor. Evaluate the manuscript's narrative architecture using chapter summaries. Do not invent missing scenes. Your job is to judge structural execution and story engine quality.

        TASK: Using the provided chapter summary objects (not raw prose), produce a whole-manuscript 'Spine Evaluation' and score the manuscript on 12 agent criteria (1–10).

        RULES:
        - Base your evaluation ONLY on the summaries provided.
        - Do not mention token limits or the fact that this is summarized.
        - Be specific: cite chapter indices when referencing problems or strengths (e.g., 'Ch. 7–9').
        - Scores must be integers 1–10.
        - Provide concise, actionable rationale per criterion (3–6 sentences each).

        12 AGENT CRITERIA:
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

        CHAPTER SUMMARIES:
        ${JSON.stringify(chapterSummaries, null, 2)}`;

        const spineEvaluation = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: spinePrompt,
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
                chapters_total: chapters.length,
                chapters_summarized: chapters.length,
                chapters_wave_done: 0,
                current_phase: 'wave',
                percent_complete: 40,
                current_step: 'Running chapter-by-chapter craft checks...',
                last_updated: new Date().toISOString()
            }
        });
        } else {
        // Spine already done, update status for WAVE phase
        await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
            status: 'evaluating_chapters',
            evaluation_progress: {
                chapters_total: chapters.length,
                chapters_summarized: chapters.length,
                chapters_wave_done: 0,
                current_phase: 'wave',
                percent_complete: 40,
                current_step: 'Resuming chapter craft checks...',
                last_updated: new Date().toISOString()
            }
        });
        }

        // PHASE 3: WAVE chapter craft evaluation
        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];

            // Skip if already evaluated OR failed
            if ((chapter.status === 'evaluated' && chapter.evaluation_score) || chapter.status === 'failed') {
                continue;
            }

            // If chapter stuck in 'evaluating' status, mark as failed and skip
            // (Aggressive recovery: any chapter in evaluating state when we start a new run is considered hung)
            if (chapter.status === 'evaluating') {
                console.log(`Chapter ${i + 1} was stuck in evaluating status, marking as failed and skipping`);
                await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                    status: 'failed',
                    error_message: 'Previous evaluation attempt did not complete'
                });

                // Update progress to show we skipped this chapter
                const evaluatedSoFar = chapters.filter(ch => ch.status === 'evaluated').length;
                const wavePercent = 40 + Math.floor(((i + 1) / chapters.length) * 50);
                await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapters.length,
                        chapters_wave_done: evaluatedSoFar,
                        current_phase: 'wave',
                        percent_complete: wavePercent,
                        current_step: `Skipped stuck chapter ${i + 1}, continuing...`,
                        last_updated: new Date().toISOString()
                    }
                });
                continue;
            }

            try {
                await base44.asServiceRole.entities.Chapter.update(chapter.id, { 
                    status: 'evaluating',
                    error_message: null
                });

                // Update progress
                const wavePercent = 40 + Math.floor((i / chapters.length) * 50);
                await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapters.length,
                        chapters_wave_done: i,
                        current_phase: 'wave',
                        percent_complete: wavePercent,
                        current_step: `Evaluating Chapter ${i + 1}: ${chapter.title}`,
                        last_updated: new Date().toISOString()
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
                chapter_craft_score: waveAnalysis.waveScore,
                evaluation_result: {
                    ...agentAnalysis,
                    waveAnalysis: waveAnalysis,
                    combinedScore: combinedScore,
                    agentScore: agentAnalysis.overallScore,
                    waveScore: waveAnalysis.waveScore
                },
                wave_results_json: waveAnalysis,
                status: 'evaluated'
            });

            // Update progress after successful evaluation
            const wavePercent = 40 + Math.floor(((i + 1) / chapters.length) * 50);
            await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: chapters.length,
                    chapters_wave_done: i + 1,
                    current_phase: 'wave',
                    percent_complete: wavePercent,
                    current_step: `Evaluated ${i + 1}/${chapters.length} chapters`,
                    last_updated: new Date().toISOString()
                }
            });

            } catch (error) {
            console.error(`Chapter ${i + 1} WAVE evaluation failed:`, error);
            await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                status: 'failed',
                error_message: error.message
            });

            // Update progress to show we moved past this chapter
            const wavePercent = 40 + Math.floor(((i + 1) / chapters.length) * 50);
            await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: chapters.length,
                    chapters_wave_done: i,
                    current_phase: 'wave',
                    percent_complete: wavePercent,
                    current_step: `Chapter ${i + 1} failed, continuing...`,
                    last_updated: new Date().toISOString(),
                    error_message: `Chapter ${i + 1} error: ${error.message}`
                }
            });
            // Continue with remaining chapters
            }
            }

        // PHASE 4: Final composite scoring
        const evaluatedChapters = await base44.asServiceRole.entities.Chapter.filter({ 
            manuscript_id, 
            status: 'evaluated' 
        });

        const avgChapterScore = evaluatedChapters.length > 0
            ? evaluatedChapters.reduce((sum, ch) => sum + (ch.evaluation_score || 0), 0) / evaluatedChapters.length
            : 0;

        const revisiongradeOverall = spineEvaluation.overallScore && avgChapterScore
            ? (0.5 * spineEvaluation.overallScore + 0.5 * avgChapterScore)
            : spineEvaluation.overallScore || avgChapterScore;

        // Mark manuscript as ready
        await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
            status: 'ready',
            revisiongrade_overall: revisiongradeOverall,
            revisiongrade_breakdown: {
                spine_score: spineEvaluation.overallScore,
                average_chapter_score: avgChapterScore,
                chapters_evaluated: evaluatedChapters.length,
                chapters_total: chapters.length
            },
            evaluation_progress: {
                chapters_total: chapters.length,
                chapters_summarized: chapters.length,
                chapters_wave_done: evaluatedChapters.length,
                current_phase: 'finalize',
                percent_complete: 100,
                current_step: 'Evaluation complete',
                last_updated: new Date().toISOString()
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