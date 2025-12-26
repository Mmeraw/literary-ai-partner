import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { text, mode } = await req.json();

        if (!text) {
            return Response.json({ error: 'Text required' }, { status: 400 });
        }

        // Auto-detect mode if not specified
        const detectedMode = mode || (text.includes('INT.') || text.includes('EXT.') ? 'cleanup' : 'convert');

        let prompt = '';

        if (detectedMode === 'convert') {
            // Novel/prose → screenplay conversion
            prompt = `Convert this prose narrative into a properly formatted screenplay following WriterDuet standards.

CRITICAL FORMATTING RULES:
1. Use proper sluglines: INT. or EXT. LOCATION - TIME OF DAY
2. ALL CAPS for character first appearances in action lines
3. Character names centered in dialogue, ALL CAPS
4. Dialogue indented below character names
5. Action lines: present tense, visual, filmable only
6. NO internal thoughts, NO unfilmable descriptions
7. NO prose metaphors - convert to visual action
8. Parentheticals sparingly, only for essential delivery notes
9. Transitions (CUT TO:, FADE TO:) only when necessary

PROSE TO CONVERT:
${text}

Output ONLY the formatted screenplay text. No explanations, no markdown formatting, just the raw screenplay text following WriterDuet standards.`;

        } else {
            // Cleanup crude screenplay
            prompt = `Clean up this crude screenplay draft to proper WriterDuet industry standards.

FIX THESE ISSUES:
1. Proper sluglines: INT./EXT. LOCATION - TIME OF DAY
2. ALL CAPS for character first appearances
3. Centered character names in dialogue
4. Remove prose descriptions - make visual/filmable
5. Remove unfilmable internals (thoughts, feelings)
6. Present tense action lines only
7. Remove section headers, prose labels
8. Proper dialogue formatting
9. Remove philosophical statements
10. Clean up mixed tenses

CRUDE SCREENPLAY:
${text}

Output ONLY the cleaned screenplay text. No explanations, no markdown, just the raw formatted screenplay following WriterDuet standards.`;
        }

        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: prompt
        });

        return Response.json({
            formatted_text: result,
            mode: detectedMode
        });

    } catch (error) {
        console.error('Format error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});