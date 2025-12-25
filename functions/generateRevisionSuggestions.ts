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

    // Generate suggestions using AI with wave-specific instructions
    const prompt = `You are a professional manuscript editor applying targeted revision.

Wave Focus: ${wave.name} - ${wave.focus}

Analyze this text and identify 5-10 specific passages that need revision for this wave only.

For each issue found, provide:
1. The exact original text (quote it precisely)
2. A suggested revision
3. Why it was flagged (editorial explanation, no technical jargon)
4. Why this fix works (editorial rationale)

TEXT TO ANALYZE:
${text}

Return ONLY valid JSON with this structure:
{
  "suggestions": [
    {
      "original_text": "exact quote from text",
      "suggested_text": "revised version",
      "why_flagged": "editorial explanation",
      "why_this_fix": "editorial rationale"
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