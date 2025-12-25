import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Wave definitions (server-side only, never exposed to client)
const WAVES = {
  1: {
    name: "Structural Refinement",
    focus: "POV integrity, causality, scene purpose",
    tier: "early"
  },
  2: {
    name: "Character Clarity",
    focus: "Observable behavior over mind-reading",
    tier: "early"
  },
  3: {
    name: "Concrete Specificity",
    focus: "Replace generic nouns with lived details",
    tier: "mid"
  },
  4: {
    name: "Perception Economy",
    focus: "Remove filter verbs (I saw, I felt, I heard)",
    tier: "mid"
  },
  5: {
    name: "Verb Strength",
    focus: "Reduce adverbs, strengthen verbs",
    tier: "mid"
  },
  6: {
    name: "Active Voice",
    focus: "Restore agency, clarify actors",
    tier: "mid"
  },
  7: {
    name: "Positive Construction",
    focus: "Say what happened, not what didn't",
    tier: "mid"
  },
  8: {
    name: "Rhythmic Control",
    focus: "Balance sentence variety and pacing",
    tier: "late"
  },
  9: {
    name: "Motif Discipline",
    focus: "One strong instance per section",
    tier: "late"
  },
  10: {
    name: "Echo Elimination",
    focus: "Remove duplicate insights",
    tier: "late"
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, wave_number = 1, submission_id } = await req.json();

    if (!text) {
      return Response.json({ error: 'Text required' }, { status: 400 });
    }

    const wave = WAVES[wave_number];
    if (!wave) {
      return Response.json({ error: 'Invalid wave number' }, { status: 400 });
    }

    // Limit text length for performance (roughly 2000 words max)
    const wordCount = text.split(/\s+/).length;
    const maxWords = 2000;
    const truncatedText = wordCount > maxWords 
      ? text.split(/\s+/).slice(0, maxWords).join(' ') + '...'
      : text;

    // Generate suggestions using AI with wave-specific instructions
    const prompt = `You are a professional manuscript editor. Apply ${wave.name} revision (${wave.focus}).

Find 3-5 specific passages that need revision for this wave only.

For each:
- Exact original text (quote precisely)
- Suggested revision
- Why flagged (brief editorial note)
- Why this works (brief rationale)

TEXT:
${truncatedText}

Return JSON:
{
  "suggestions": [
    {
      "original_text": "exact quote",
      "suggested_text": "revision",
      "why_flagged": "issue",
      "why_this_fix": "rationale"
    }
  ]
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                original_text: { type: "string" },
                suggested_text: { type: "string" },
                why_flagged: { type: "string" },
                why_this_fix: { type: "string" }
              },
              required: ["original_text", "suggested_text", "why_flagged", "why_this_fix"]
            }
          }
        },
        required: ["suggestions"]
      }
    });

    // Add wave name and IDs to suggestions
    const suggestions = result.suggestions.map((s, idx) => ({
      id: `w${wave_number}_${idx}`,
      wave_name: wave.name,
      ...s,
      status: "pending",
      alternatives: []
    }));

    return Response.json({ 
      wave_name: wave.name,
      suggestions,
      wave_number 
    });

  } catch (error) {
    console.error('Revision generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});