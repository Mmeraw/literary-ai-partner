import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptId, manuscriptText, genre } = await req.json();

        if (!genre) {
            return Response.json({ error: 'genre is required' }, { status: 400 });
        }

        let manuscript = null;
        let manuscriptTextForAnalysis = manuscriptText;

        // Handle either manuscriptId OR manuscriptText (upload path)
        if (manuscriptId) {
            const manuscripts = await base44.entities.Manuscript.filter({ id: manuscriptId });
            manuscript = manuscripts[0];

            if (!manuscript) {
                return Response.json({ error: 'Manuscript not found' }, { status: 404 });
            }
            
            manuscriptTextForAnalysis = manuscript.full_text;
        } else if (!manuscriptText) {
            return Response.json({ error: 'Either manuscriptId or manuscriptText is required' }, { status: 400 });
        }

        // Auto-detect genre if requested
        let finalGenre = genre;
        if (genre === 'auto') {
            const genreDetectionPrompt = `Based on this manuscript analysis, identify the primary genre:

Title: "${manuscript.title}"
Word Count: ${manuscript.word_count}
Spine Evaluation: ${JSON.stringify(manuscript.spine_evaluation, null, 2)}

Return only the genre name (e.g., "thriller", "literary_fiction", "romance", "mystery", "fantasy", "sci_fi", "historical", "horror", "ya").`;

            const detectedGenre = await base44.integrations.Core.InvokeLLM({
                prompt: genreDetectionPrompt
            });
            
            finalGenre = detectedGenre.toLowerCase().replace(/\s+/g, '_');
        }

        // Fetch chapters for detailed analysis (only if using existing manuscript)
        const chapters = manuscriptId ? await base44.entities.Chapter.filter({ manuscript_id: manuscriptId }) : [];

        // Build manuscript analysis summary
        const analysisSummary = manuscript ? {
            title: manuscript.title,
            word_count: manuscript.word_count,
            spine_score: manuscript.spine_score,
            revisiongrade_overall: manuscript.revisiongrade_overall,
            spine_evaluation: manuscript.spine_evaluation
        } : {
            title: 'Uploaded Manuscript',
            word_count: manuscriptTextForAnalysis.split(/\s+/).length,
            text_sample: manuscriptTextForAnalysis.substring(0, 5000)
        };

        // Use Perplexity for real-time market research
        const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
        
        let marketContext = '';
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
                            content: `Research bestselling ${finalGenre} novels published 2020-2025. Focus on: recent award winners, bestseller list titles, and critically acclaimed debuts. Include specific titles, authors, and what made them successful in the market.`
                        }]
                    })
                });
                
                const perplexityData = await perplexityResponse.json();
                marketContext = perplexityData.choices?.[0]?.message?.content || '';
            } catch (perplexityError) {
                console.error('Perplexity API error:', perplexityError);
            }
        }
        
        // Generate comparables analysis
        const comparablesPrompt = `You are a literary agent analyst. Analyze this manuscript against genre benchmarks.

Manuscript: "${analysisSummary.title}"
Genre: ${finalGenre}
Word Count: ${analysisSummary.word_count}
${manuscript ? `Overall RevisionGrade Score: ${manuscript.revisiongrade_overall || manuscript.spine_score || 'N/A'}` : ''}

${manuscript ? `Spine Evaluation Summary:\n${JSON.stringify(manuscript.spine_evaluation, null, 2)}` : `Manuscript Sample:\n${analysisSummary.text_sample}\n\n(Note: This is an uploaded manuscript without prior evaluation)`}

${marketContext ? `Recent Market Research:\n${marketContext}\n\n` : ''}

Task: Compare this manuscript to bestselling ${genre} titles from 2020-2025 across the 13 Story Evaluation Criteria:
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
            manuscript_id: manuscriptId || 'uploaded',
            manuscript_title: analysisSummary.title,
            genre: finalGenre,
            comparison_data: comparablesAnalysis,
            summary_bullets: [
                manuscript ? `Overall RevisionGrade: ${manuscript.revisiongrade_overall || manuscript.spine_score || 'N/A'}/10` : `Word Count: ${analysisSummary.word_count.toLocaleString()} words`,
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