import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscript_id, genre, subgenre } = await req.json();

        // Fetch manuscript
        const manuscripts = await base44.entities.Manuscript.filter({ id: manuscript_id });
        if (!manuscripts || manuscripts.length === 0) {
            return Response.json({ error: 'Manuscript not found' }, { status: 404 });
        }

        const manuscript = manuscripts[0];
        const genreLabel = subgenre || genre;

        // Generate comparison using AI
        const comparison = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a literary benchmarking analyst. Compare this manuscript against typical craft patterns for the ${genreLabel} genre.

MANUSCRIPT TITLE: ${manuscript.title}
MANUSCRIPT TEXT (first 15,000 words):
${manuscript.full_text.slice(0, 50000)}

Generate a professional craft comparison report with these exact sections:

1. USER SYNOPSIS: Write a 150-word synopsis of the user's manuscript based on the text provided.

2. GENRE BENCHMARK DESCRIPTION: Describe typical craft patterns for ${genreLabel} novels (structure, pacing, voice, typical strengths).

3. SUMMARY BULLETS: Provide exactly 5 bullets:
   - Where the manuscript aligns with genre standards
   - Where it diverges from typical patterns
   - Top 3 specific craft upgrades to match genre expectations

4. CRITERIA COMPARISON: Score both the genre benchmark and the user's manuscript on these 16 criteria (1-10 scale):
   1. Hook (Opening)
   2. Voice
   3. Character Depth
   4. Conflict & Tension
   5. Thematic Resonance
   6. Pacing & Structure
   7. Dialogue & Subtext
   8. Worldbuilding & Immersion
   9. Emotional Stakes
   10. Line-Level Polish
   11. Marketability
   12. Would an Agent Keep Reading
   13. Cinematic Adaptability
   14. Franchise & Brand Expansion
   15. Authenticity / Realism
   16. Emotional Aftershock

For each criterion provide:
- benchmark_score (1-10)
- benchmark_description (2-3 sentences explaining typical genre patterns)
- user_score (1-10)
- user_description (2-3 sentences about this manuscript)
- advantage (string: "genre_benchmark", "user", or "tie")
- advantage_note (1 sentence explaining the observed advantage in neutral language)

Use neutral, educational language. Never say "better than" - use "observed advantage" or "relative strength" language.`,
            response_json_schema: {
                type: "object",
                properties: {
                    user_synopsis: { type: "string" },
                    genre_description: { type: "string" },
                    summary_bullets: {
                        type: "array",
                        items: { type: "string" }
                    },
                    criteria: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                benchmark_score: { type: "number" },
                                benchmark_description: { type: "string" },
                                user_score: { type: "number" },
                                user_description: { type: "string" },
                                advantage: { type: "string" },
                                advantage_note: { type: "string" }
                            },
                            required: ["name", "benchmark_score", "benchmark_description", "user_score", "user_description", "advantage", "advantage_note"]
                        }
                    }
                },
                required: ["user_synopsis", "genre_description", "summary_bullets", "criteria"]
            }
        });

        // Create comparative report
        const report = await base44.entities.ComparativeReport.create({
            manuscript_id: manuscript.id,
            manuscript_title: manuscript.title,
            genre: genre,
            subgenre: subgenre || null,
            user_synopsis: comparison.user_synopsis,
            comparison_data: comparison,
            summary_bullets: comparison.summary_bullets
        });

        return Response.json({ 
            success: true, 
            report_id: report.id,
            comparison: comparison
        });

    } catch (error) {
        console.error('Benchmark comparison error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});