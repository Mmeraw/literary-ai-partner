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
            prompt = `Convert this prose narrative into a properly formatted screenplay following the RevisionGrade Screenplay Formatting Standard (WriterDuet v1.0 compatible).

CRITICAL FORMATTING RULES (RevisionGrade Standard v1.0):

SLUGLINES:
- Format: INT. or EXT. LOCATION – TIME OF DAY (en dash –)
- ALL CAPS, left-aligned, one blank line before/after
- Use CONTINUOUS only for truly immediate continuity

CHARACTER INTRODUCTION:
- First appearance: ALL CAPS + brief identifier (e.g., "MIKE (60s), ex-military, drives alone")
- Cap one-off speakers on first mention (e.g., "A FARM WORKER whispers")

DIALOGUE FORMATTING:
- Character names: ALL CAPS, centered (~3.5" from left)
- Dialogue: indented ~2.5", directly under name, NO QUOTES
- Character name implies speech—no quotation marks needed
- Parentheticals: brief, ~3.0" indent, between name and dialogue

ACTION LINES:
- Present tense, visual, filmable only
- Left-aligned, no indent, 2-4 line blocks
- Em dashes: tight in sentences (slides by—corn), spaced for labels (GLYPH: ● — pulses)

SFX / SOUND:
- Format: SFX: CRACK! A shot echoes.
- ALL CAPS tag, sentence-case description

TRANSITIONS:
- Right-aligned (~6.0"), ALL CAPS (CUT TO:, FADE OUT.)
- Use sparingly, one blank line before

CRITICAL: HANDLING ITALICIZED TEXT (HTML <em> or <i> tags):
- Italics = internal thought in most cases
- OPTIONS:
  A) Convert to (V.O.) voiceover if dramatically powerful
  B) Remove if unfilmable/redundant with visual action
- Preserve only strong internal moments; cut the rest

Example:
INPUT: "Then why am I checking the rearview mirror?" (italicized)
OUTPUT Option A:
                                MIKE (V.O.)
            Then why am I checking the rearview mirror?

OUTPUT Option B: Remove (if action already shows this)

PROSE TO CONVERT (may contain HTML tags):
${text}

Output ONLY the formatted screenplay text. Strip all HTML tags. No explanations, no markdown. Raw WriterDuet-compatible screenplay only.`;

        } else {
            // Cleanup crude screenplay
            prompt = `Clean up this crude screenplay draft to the RevisionGrade Screenplay Formatting Standard (WriterDuet v1.0 compatible).

FIX THESE ISSUES (RevisionGrade Standard v1.0):

SLUGLINES:
- Format: INT./EXT. LOCATION – TIME OF DAY (en dash –)
- ALL CAPS, left-aligned, one blank line before/after

CHARACTER HANDLING:
- First appearances: ALL CAPS in action (e.g., "MIKE (60s)...")
- Consistent character names (including accents if used)

DIALOGUE:
- Character names: centered, ALL CAPS
- Dialogue: indented ~2.5", NO QUOTES (character name implies speech)
- Parentheticals: brief, ~3.0" indent

ACTION LINES:
- Present tense, visual, filmable only
- Remove prose metaphors, unfilmable internals, philosophical statements
- Em dashes: tight in sentences, spaced for labels
- Break into 2-4 line blocks

SFX / SOUND:
- Format: SFX: DESCRIPTION
- Consistent tagging

TRANSITIONS:
- Right-aligned, ALL CAPS, minimal use
- One blank line before

REMOVE:
- Section headers, prose labels
- Mixed tenses
- Curly quotes (use straight " or none)
- Special hyphens (use standard -)

CRITICAL: HANDLING ITALICIZED TEXT (HTML <em> or <i> tags):
- If italics = internal thought → convert to (V.O.) if dramatic, or remove if redundant
- Use judgment: preserve powerful internal moments, cut the rest

CRUDE SCREENPLAY (may contain HTML tags):
${text}

Output ONLY the cleaned screenplay text. Strip all HTML tags. No explanations, no markdown. Raw WriterDuet-compatible screenplay only.`;
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