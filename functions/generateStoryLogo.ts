import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { title, synopsis, genre, themes } = await req.json();

        if (!title || !synopsis) {
            return Response.json({ 
                error: 'Title and synopsis required' 
            }, { status: 400 });
        }

        // Extract key visual themes and motifs using LLM
        const themeAnalysis = await base44.integrations.Core.InvokeLLM({
            prompt: `Analyze this story and extract 3-5 key visual themes, symbols, or motifs that would work well in a logo design.

Title: ${title}
Genre: ${genre || 'Not specified'}
Synopsis: ${synopsis}
${themes ? `Additional themes: ${themes}` : ''}

Return a JSON object with:
{
  "primary_symbol": "main visual element (e.g., 'ancient tree', 'broken crown', 'shadow figure')",
  "color_palette": "suggested colors (e.g., 'deep blue and gold', 'black and crimson')",
  "mood": "visual mood (e.g., 'mysterious', 'heroic', 'dark elegance')",
  "style": "design style (e.g., 'minimalist', 'ornate', 'geometric')",
  "secondary_elements": ["2-3 supporting visual elements"]
}`,
            response_json_schema: {
                type: "object",
                properties: {
                    primary_symbol: { type: "string" },
                    color_palette: { type: "string" },
                    mood: { type: "string" },
                    style: { type: "string" },
                    secondary_elements: { type: "array", items: { type: "string" } }
                },
                required: ["primary_symbol", "color_palette", "mood", "style"]
            }
        });

        console.log('Theme analysis:', themeAnalysis);

        // Generate 4 logo variations based on theme analysis
        const logoPrompts = [
            // Variant 1: Clean minimal
            `Professional book/film logo for "${title}". ${themeAnalysis.style} style. Central focus on ${themeAnalysis.primary_symbol}. ${themeAnalysis.color_palette} color scheme. ${themeAnalysis.mood} mood. Clean, minimal, vector-style design suitable for covers and promotional materials. High contrast, legible, professional publishing quality.`,
            
            // Variant 2: Ornate detailed
            `Detailed artistic logo for "${title}". Ornate design featuring ${themeAnalysis.primary_symbol} with ${themeAnalysis.secondary_elements?.[0] || 'decorative elements'}. ${themeAnalysis.color_palette} palette. ${themeAnalysis.mood} atmosphere. Intricate details, suitable for special editions and premium materials. Publishing-grade quality.`,
            
            // Variant 3: Bold symbolic
            `Bold symbolic logo for "${title}". Strong silhouette of ${themeAnalysis.primary_symbol}. ${themeAnalysis.color_palette} color scheme. ${themeAnalysis.mood} mood. High-impact, memorable, works at any size. Perfect for merchandise and branding. Vector art style.`,
            
            // Variant 4: Cinematic
            `Cinematic logo for "${title}". Movie poster style featuring ${themeAnalysis.primary_symbol}. ${themeAnalysis.color_palette} colors with dramatic lighting. ${themeAnalysis.mood} atmosphere. Film-ready design suitable for pitch decks and promotional materials. Professional Hollywood quality.`
        ];

        console.log('Generating 4 logo variations...');
        
        // Generate all logos in parallel
        const logoPromises = logoPrompts.map(prompt => 
            base44.integrations.Core.GenerateImage({ prompt })
        );

        const logoResults = await Promise.all(logoPromises);

        const logos = logoResults.map((result, idx) => ({
            url: result.url,
            variant: ['Minimal', 'Ornate', 'Bold Symbolic', 'Cinematic'][idx],
            description: logoPrompts[idx].substring(0, 150) + '...'
        }));

        // Track analytics
        try {
            await base44.entities.Analytics.create({
                page: 'LogoGeneration',
                path: '/generate-story-logo',
                event_type: 'logo_generated',
                metadata: {
                    title,
                    genre,
                    theme_analysis: themeAnalysis
                }
            });
        } catch (e) {
            console.error('Analytics error:', e);
        }

        return Response.json({
            success: true,
            logos,
            themeAnalysis,
            message: '4 logo variations generated successfully'
        });

    } catch (error) {
        console.error('Logo generation error:', error);
        return Response.json({ 
            error: error.message || 'Failed to generate logos' 
        }, { status: 500 });
    }
});