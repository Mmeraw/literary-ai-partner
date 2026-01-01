import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptId, genre } = await req.json();

        if (!manuscriptId || !genre) {
            return Response.json({ error: 'manuscriptId and genre are required' }, { status: 400 });
        }

        // Fetch manuscript
        const manuscripts = await base44.entities.Manuscript.filter({ id: manuscriptId });
        const manuscript = manuscripts[0];

        if (!manuscript) {
            return Response.json({ error: 'Manuscript not found' }, { status: 404 });
        }

        // Fetch chapters for detailed analysis
        const chapters = await base44.entities.Chapter.filter({ manuscript_id: manuscriptId });

        // Build manuscript analysis summary
        const analysisSummary = {
            title: manuscript.title,
            word_count: manuscript.word_count,
            spine_score: manuscript.spine_score,
            revisiongrade_overall: manuscript.revisiongrade_overall,
            spine_evaluation: manuscript.spine_evaluation
        };

        // Generate comparables analysis
        const comparablesPrompt = `You are a literary agent analyst. Analyze this manuscript against genre benchmarks.

Manuscript: "${manuscript.title}"
Genre: ${genre}
Word Count: ${manuscript.word_count}
Overall RevisionGrade Score: ${manuscript.revisiongrade_overall || manuscript.spine_score || 'N/A'}

Spine Evaluation Summary:
${JSON.stringify(manuscript.spine_evaluation, null, 2)}

Task: Compare this manuscript to bestselling ${genre} titles from 2018-2025 across the 13 Story Evaluation Criteria:
1. Voice & Style
2. Opening Hook
3. Character Development
4. Dialogue
5. Pacing
6. Show Don't Tell
7. Emotional Resonance
8. Plot Structure
9. Theme & Depth
10. Sensory Details
11. Scene Craft
12. Market Readiness
13. Comparative Positioning

For each criterion:
- Rate the manuscript (0-10)
- Provide genre average (0-10)
- Note if above/below average
- Give 1-2 sentence positioning insight

Also provide:
- 5-7 comparable bestselling titles (real titles, 2018-2025) with brief justification
- Overall market positioning summary (2-3 paragraphs)
- 3-5 strategic revision priorities for agent readiness

Return structured JSON.`;

        const comparablesAnalysis = await base44.integrations.Core.InvokeLLM({
            prompt: comparablesPrompt,
            add_context_from_internet: true,
            response_json_schema: {
                type: 'object',
                properties: {
                    criteria_scores: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                criterion: { type: 'string' },
                                manuscript_score: { type: 'number' },
                                genre_average: { type: 'number' },
                                above_average: { type: 'boolean' },
                                insight: { type: 'string' }
                            }
                        }
                    },
                    comparable_titles: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                author: { type: 'string' },
                                year: { type: 'number' },
                                justification: { type: 'string' }
                            }
                        }
                    },
                    market_positioning: { type: 'string' },
                    revision_priorities: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                }
            }
        });

        // Create comparative report entity
        const report = await base44.entities.ComparativeReport.create({
            manuscript_id: manuscriptId,
            manuscript_title: manuscript.title,
            genre: genre,
            comparison_data: comparablesAnalysis,
            summary_bullets: [
                `Overall RevisionGrade: ${manuscript.revisiongrade_overall || manuscript.spine_score || 'N/A'}/10`,
                `Comparable titles: ${comparablesAnalysis.comparable_titles.length} matches identified`,
                `Criteria above genre average: ${comparablesAnalysis.criteria_scores.filter(c => c.above_average).length}/${comparablesAnalysis.criteria_scores.length}`,
                ...comparablesAnalysis.revision_priorities.slice(0, 2)
            ]
        });

        return Response.json({ 
            success: true,
            report_id: report.id,
            analysis: comparablesAnalysis
        });

    } catch (error) {
        console.error('Comparables generation error:', error);
        return Response.json({ 
            error: 'Failed to generate comparables report', 
            details: error.message 
        }, { status: 500 });
    }
});