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
1. Use proper sluglines: INT. or EXT. LOCATION – TIME OF DAY (use en dash –)
2. ALL CAPS for character first appearances in action lines
3. Character names centered in dialogue, ALL CAPS
4. Dialogue indented below character names (no quotes needed, character name implies speech)
5. Action lines: present tense, visual, filmable only
6. Em dashes in action: no spaces (e.g., "slides by—corn")
7. Em dashes as separators/labels: spaces allowed (e.g., "GLYPH VISIBLE: ● — the symbol pulses")
8. Parentheticals sparingly, only for essential delivery notes
9. Transitions (CUT TO:, FADE OUT.) right-aligned, only when necessary

CRITICAL: HANDLING ITALICIZED TEXT (formatted as <em> or <i> tags):
- Italicized text often represents INTERNAL THOUGHT
- If it's internal thought, you have two options:
  A) Convert to (V.O.) voiceover if it adds dramatic value
  B) Remove it entirely if it's unfilmable or redundant
- Use your judgment: preserve powerful internal moments as V.O., cut the rest
- If italics are just emphasis (not thought), preserve the meaning in action

Example italicized thought handling:
INPUT: "Then why am I checking the rearview mirror?" (italicized)
OUTPUT: 
                    MIKE (V.O.)
        Then why am I checking the rearview mirror?

OR remove if it's redundant with visual action.

PROSE TO CONVERT (may contain HTML tags for formatting):
${text}

Output ONLY the formatted screenplay text. Strip all HTML tags from final output. No explanations, no markdown formatting, just the raw screenplay text following WriterDuet standards.`;

        } else {
            // Cleanup crude screenplay
            prompt = `Clean up this crude screenplay draft to proper WriterDuet industry standards.

FIX THESE ISSUES:
1. Proper sluglines: INT./EXT. LOCATION – TIME OF DAY (use en dash –)
2. ALL CAPS for character first appearances in action
3. Centered character names in dialogue, ALL CAPS
4. Remove prose descriptions - make visual/filmable
5. Remove unfilmable internals (thoughts, feelings) OR convert to (V.O.) if powerful
6. Present tense action lines only
7. Remove section headers, prose labels
8. Proper dialogue formatting (no quotes needed)
9. Remove philosophical statements
10. Clean up mixed tenses
11. Em dashes: tight in action sentences, spaced for separators/labels

CRITICAL: HANDLING ITALICIZED TEXT (formatted as <em> or <i> tags):
- If italics represent internal thought, convert to (V.O.) or remove if unfilmable
- Use judgment: preserve dramatic internal moments as V.O., cut redundant ones

CRUDE SCREENPLAY (may contain HTML tags):
${text}

Output ONLY the cleaned screenplay text. Strip all HTML tags from final output. No explanations, no markdown, just the raw formatted screenplay following WriterDuet standards.`;
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