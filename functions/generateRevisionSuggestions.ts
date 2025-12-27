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

    const { text, title, wave_number = 1, submission_id, evaluation_result } = await req.json();

    // Support both direct text/title (anonymous) or submission_id (logged in)
    let workingText = text;
    let workingTitle = title || 'Untitled';
    
    if (!workingText && submission_id) {
      // Fetch from database if submission_id provided
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const submissions = await base44.entities.Submission.filter({ id: submission_id });
      if (!submissions || submissions.length === 0) {
        return Response.json({ error: 'Submission not found' }, { status: 404 });
      }
      workingText = submissions[0].text;
      workingTitle = submissions[0].title;
    }

    if (!workingText) {
      return Response.json({ error: 'Text required (either directly or via submission_id)' }, { status: 400 });
    }

    const wave = WAVES[wave_number];
    if (!wave) {
      return Response.json({ error: 'Invalid wave number' }, { status: 400 });
    }

    // Limit text length for performance (roughly 2000 words max)
    const wordCount = workingText.split(/\s+/).length;
    const maxWords = 2000;
    const truncatedText = wordCount > maxWords 
      ? workingText.split(/\s+/).slice(0, maxWords).join(' ') + '...'
      : workingText;

    // TWO-STAGE PIPELINE: Pattern detection → WAVE contextual validation
    
    // STAGE 1: Detect risk patterns (candidates only, not final decisions)
    const detectionPrompt = `You are a professional manuscript editor scanning for revision candidates. Apply ${wave.name} (${wave.focus}).

Find 12-15 passages that match common risk patterns:
- Reflexives (himself, herself, themselves) that may dilute agency
- "As if" / "like" constructions that may weaken directness
- Hedge phrases (seemed to, appeared to, felt like)
- Filter verbs (saw, heard, felt) that distance reader
- Passive constructions that obscure actors
- Generic nouns that could be more specific

For each CANDIDATE (these are not final suggestions yet):
- Exact original text
- Potential revised version
- What pattern was detected
- Initial reasoning

TEXT:
${truncatedText}

Return JSON with candidates array.`;

    const candidates = await base44.integrations.Core.InvokeLLM({
      prompt: detectionPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                original_text: { type: "string" },
                suggested_text: { type: "string" },
                pattern_detected: { type: "string" },
                initial_reasoning: { type: "string" }
              },
              required: ["original_text", "suggested_text", "pattern_detected", "initial_reasoning"]
            }
          }
        },
        required: ["candidates"]
      }
    });

    // STAGE 2: WAVE contextual validation (gating logic)
    const validationPrompt = `You are a literary editor applying the WAVE Revision System + 12 Literary Agent Criteria.

Your job: validate whether detected patterns should become revision suggestions.

GATING RULE:
- If a flagged phrase serves embodiment, intimacy, agency reinforcement, character voice, or psychological cohesion → KEEP IT (mark as justified)
- If it's redundant, weakens clarity, or adds no narrative function → FLAG IT (approved for revision)

For each candidate, determine:
1. Does this construction serve voice/embodiment/agency? (yes/no)
2. Does it strengthen psychological cohesion or intimacy? (yes/no)
3. Is it justified by narrative context? (yes/no)
4. Final verdict: "keep" or "revise"

If "keep": provide brief note on what it accomplishes
If "revise": provide editorial rationale for the suggested change

CANDIDATES TO EVALUATE:
${JSON.stringify(candidates.candidates, null, 2)}

FULL TEXT CONTEXT:
${truncatedText}

Return JSON with validated results.`;

    const validation = await base44.integrations.Core.InvokeLLM({
      prompt: validationPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          validated: {
            type: "array",
            items: {
              type: "object",
              properties: {
                original_text: { type: "string" },
                suggested_text: { type: "string" },
                verdict: { type: "string", enum: ["keep", "revise"] },
                serves_voice: { type: "boolean" },
                serves_embodiment: { type: "boolean" },
                narrative_justification: { type: "string" },
                why_flagged: { type: "string" },
                why_this_fix: { type: "string" }
              },
              required: ["original_text", "verdict", "narrative_justification"]
            }
          }
        },
        required: ["validated"]
      }
    });

    // FINAL: Only return suggestions where verdict = "revise"
    const approvedSuggestions = validation.validated
      .filter(item => item.verdict === "revise")
      .map(item => ({
        original_text: item.original_text,
        suggested_text: item.suggested_text || item.original_text,
        why_flagged: item.why_flagged || item.narrative_justification,
        why_this_fix: item.why_this_fix || "Strengthens clarity and narrative directness"
      }));

    // Add wave name and IDs to approved suggestions only
    const suggestions = approvedSuggestions.map((s, idx) => ({
      id: `w${wave_number}_${idx}`,
      wave_name: wave.name,
      ...s,
      status: "pending",
      alternatives: []
    }));

    // Create revision session
    const sessionData = {
      submission_id: submission_id || `temp_${Date.now()}`,
      title: workingTitle,
      original_text: workingText,
      current_text: workingText,
      current_wave: wave_number,
      current_position: 0,
      suggestions: suggestions,
      status: 'in_progress'
    };

    try {
      const session = await base44.entities.RevisionSession.create(sessionData);
      return Response.json({ 
        session_id: session.id,
        wave_name: wave.name,
        suggestions,
        wave_number 
      });
    } catch (dbError) {
      // If DB fails (e.g., anonymous user), return suggestions without saving
      console.warn('Could not save session to DB:', dbError);
      return Response.json({ 
        session_id: null,
        wave_name: wave.name,
        suggestions,
        wave_number,
        anonymous: true
      });
    }

  } catch (error) {
    console.error('Revision generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});