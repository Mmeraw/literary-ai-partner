import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Wave definitions (server-side only, never exposed to client)
// Complete 61+ WAVE System definitions
const WAVES = {
  1: { name: "Body-Part Clichés", focus: "Physical tells that advance story, not summarize emotion", tier: "mid" },
  2: { name: "POV Honesty", focus: "Observable proof over mind-reading", tier: "early" },
  3: { name: "Concrete Specificity", focus: "Replace generic nouns with lived details", tier: "mid" },
  4: { name: "Filter Verbs", focus: "Remove I saw/felt/heard distance", tier: "mid" },
  5: { name: "Adverb Diet", focus: "Strengthen verbs, cut intensifiers", tier: "mid" },
  6: { name: "Active Voice", focus: "Restore agency, clarify actors", tier: "mid" },
  7: { name: "Negation Discipline", focus: "Say what happened, not what didn't", tier: "mid" },
  8: { name: "Abstract Triples", focus: "Two beats sharpen, three soften", tier: "mid" },
  9: { name: "Motif Hygiene", focus: "Spotlight once per section, not wallpaper", tier: "late" },
  10: { name: "Duplicate Brilliance", focus: "Remove echoed insights", tier: "late" },
  11: { name: "Theme After Shown", focus: "Trust subtext, stop declaring", tier: "late" },
  12: { name: "Micro-Location Economy", focus: "1 body + 1 system, then exit", tier: "mid" },
  13: { name: "Dialogue Tags", focus: "Minimal attribution, trust the exchange", tier: "mid" },
  14: { name: "Dialogue Under Pressure", focus: "Stress roughens speech, meaning over polish", tier: "mid" },
  15: { name: "On-the-Nose Explanations", focus: "Trust subtext, cut because/which meant", tier: "late" },
  16: { name: "Orientation Paragraphs", focus: "Orient once, enforce afterward", tier: "mid" },
  17: { name: "Concrete Stakes", focus: "Name the loss or scene floats", tier: "early" },
  18: { name: "Seed the Timer", focus: "External clock tightens momentum", tier: "mid" },
  19: { name: "Consequence Marker", focus: "Every choice leaves a mark", tier: "mid" },
  20: { name: "Decision Line", focus: "Every scene needs a turn", tier: "mid" },
  21: { name: "Choreography Compression", focus: "Show only the step where failure is possible", tier: "mid" },
  22: { name: "Continuity & Naming", focus: "Confusion is never clever unless intentional", tier: "mid" },
  23: { name: "Sentence Start Variety", focus: "Vary entry point, not just verbs", tier: "late" },
  24: { name: "Overused Sensory Words", focus: "Show interaction, not sensation", tier: "mid" },
  25: { name: "Metaphor Freshness", focus: "If metaphor isn't doing work, it's dead weight", tier: "late" },
  26: { name: "Cliché Alarm", focus: "Remove AI-adjacent tells", tier: "late" },
  27: { name: "Rhythm Balance", focus: "Rhythm should track pressure", tier: "late" },
  28: { name: "Paragraph Endings", focus: "End on proof or cut", tier: "late" },
  29: { name: "Scene Entry", focus: "Arrive late, trust the reader", tier: "mid" },
  30: { name: "Scene Exit", focus: "Exit on impact", tier: "mid" },
  31: { name: "Information Density", focus: "Select, don't stack", tier: "mid" },
  32: { name: "Spatial Clarity", focus: "Place bodies before you move them", tier: "mid" },
  33: { name: "Pronoun Clarity", focus: "Never make the reader guess who acts", tier: "mid" },
  34: { name: "Time Clarity", focus: "Time should never be implied when it can be anchored", tier: "mid" },
  35: { name: "Emotional Escalation", focus: "Same emotion, higher cost—or change it", tier: "mid" },
  36: { name: "Character Consistency", focus: "Change needs pressure or price", tier: "early" },
  37: { name: "Dialogue Purpose", focus: "Dialogue must move something", tier: "mid" },
  38: { name: "Exposition Camouflage", focus: "Information rides action", tier: "mid" },
  39: { name: "Tension Without Saying Tension", focus: "Prove tension; never name it", tier: "late" },
  40: { name: "Avoiding Summary Voice", focus: "Stay inside the moment", tier: "late" },
  41: { name: "Concrete Proof Lines", focus: "If change is real, it leaves evidence", tier: "late" },
  42: { name: "Symbol & Motif Placement", focus: "Symbols gain power through restraint", tier: "late" },
  43: { name: "System Detail Accuracy", focus: "Bureaucracy must feel real", tier: "mid" },
  44: { name: "Institutional Stakes", focus: "Clarify what they can/can't do", tier: "mid" },
  45: { name: "Transaction Metaphor Discipline", focus: "One clean metaphor beats repeated cleverness", tier: "late" },
  46: { name: "Over-Detail in Repeated Beats", focus: "Render it once, make it count", tier: "late" },
  47: { name: "Compression of Similar Scenes", focus: "If it doesn't advance, it repeats", tier: "mid" },
  48: { name: "Cutting Redundant Instructions", focus: "Show competence through behavior", tier: "late" },
  49: { name: "Avoid Repeating Same Insight", focus: "One insight per chapter", tier: "late" },
  50: { name: "Replace Explained Beats", focus: "Let readers watch, don't explain", tier: "late" },
  51: { name: "Late-Stage Sentence Vanity", focus: "If line serves you more than story, cut it", tier: "late" },
  52: { name: "Emotional Honesty Audit", focus: "Honest emotion shows in behavior, not volume", tier: "late" },
  53: { name: "Narrative Distance Control", focus: "Choose your distance, don't drift", tier: "late" },
  54: { name: "Ending Trust", focus: "End on proof, not commentary", tier: "late" },
  55: { name: "Reader Trust Test", focus: "Readers remember more than you think", tier: "late" },
  56: { name: "Earned Aphorisms Only", focus: "Wisdom must be paid for in story", tier: "late" },
  57: { name: "Silence as Action", focus: "Silence must act", tier: "late" },
  58: { name: "Negative Space", focus: "Implied meaning lingers longer", tier: "late" },
  59: { name: "Final Consistency Pass", focus: "The world must obey itself", tier: "late" },
  60: { name: "Submission Read Pass", focus: "Pages must earn their turn", tier: "late" },
  61: { name: "Reflexive Pronouns & Redundancy", focus: "If removing the word strengthens, cut it", tier: "late" }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { text, title, wave_number = 1, submission_id, evaluation_result, style_mode = 'neutral' } = await req.json();

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
    // Reference: Complete WAVE system in functions/WAVE_GUIDE (61+ waves)

    // Style guidance based on user selection
    const styleGuidance = {
      neutral: "Standard industry conventions. Clear, professional prose.",
      lyrical: "Poetic rhythm, sensory immersion, elevated language. Prioritize beauty and resonance.",
      rhythmical: "Cadence-driven, repetition for effect, oral-tradition pulse. Music in the prose.",
      literary: "Dense imagery, subtext layering, mythic elevation. Sophisticated, literary fiction standards.",
      commercial: "Tight pacing, accessible language, hooky dialogue. Reader engagement and momentum."
    }[style_mode] || "Standard industry conventions.";

    // STAGE 1: Detect risk patterns (candidates only, not final decisions)
    const detectionPrompt = `You are a professional manuscript editor applying the WAVE Revision System. Focus on ${wave.name} (${wave.focus}).

    WAVE CONTEXT:
    - Tier: ${wave.tier}
    - This is wave ${wave_number} of 61+ in the professional revision system
    - Reference the complete WAVE Guide for full context on all 61 waves

    STYLE MODE: ${style_mode}
    - ${styleGuidance}
    - Suggestions should align with this style while still addressing WAVE concerns

SCAN FOR REVISION CANDIDATES matching these patterns:
- Body-part clichés (jaw, chest, eyes) that summarize instead of advance
- POV breaches (mind-reading, unobservable claims)
- Generic nouns (thing, stuff, place, dark SUV) needing specificity
- Filter verbs (saw, heard, felt) creating distance
- Reflexive pronouns (himself, herself) with no narrative function
- "As if" / "like" constructions weakening directness
- Hedge phrases diluting authority
- Passive constructions obscuring actors
- Negation stacks (didn't, not, never)
- Abstract triples (fear, doubt, uncertainty)
- Motif repetition without escalation
- Duplicate insights or echoed brilliance
- On-the-nose explanations (because, which meant)
- Summary voice instead of in-scene experience

For each CANDIDATE (not final suggestions yet):
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
    const validationPrompt = `You are a literary editor applying the complete WAVE Revision System (61+ waves) + 12 Story Evaluation Criteria.

    WAVE SYSTEM PHILOSOPHY:
    The WAVE system is designed to systematically remove weakness while preserving voice. It operates in stages:
    - EARLY waves (1-16): Structural truth, POV integrity, stakes clarity
    - MID waves (17-40): Momentum, specificity, scene mechanics
    - LATE waves (41-61): Authority, polish, submission readiness

    STYLE MODE: ${style_mode}
    - ${styleGuidance}
    - All suggestions must respect this style preference while maintaining WAVE standards
    - Lyrical/literary modes may preserve more poetic constructions
    - Commercial mode prioritizes clarity and pace over stylistic flourishes

    MANDATORY QUALITY GATES (REJECT if any violated):

    1. IDIOMATIC ENGLISH ONLY
    - NO translation artifacts ("Chief passed strike", "Strike passed")
    - NO ungrammatical compression ("cinched deliberate" → must be "cinched deliberately")
    - Must sound like natural, professional English prose

    2. NO INVENTED CHOREOGRAPHY
    - Don't add staging/actions not in original ("Shelter swallowed him" when no shelter entry exists)
    - Don't introduce setting elements not present ("Shelter closed" implies door/action)
    - Preserve original scene boundaries exactly

    3. NO COINED JARGON
    - Avoid invented compounds unless source uses them ("rope-hiss", "cat-lined", "mouth-marked")
    - Keep language clean and accessible, not pseudo-poetic

    4. MEANING FIDELITY ABSOLUTE
    - "eyes met his" ≠ "kept eyes from the face" (opposite meanings!)
    - Preserve original intent precisely; never drift to convenience
    - If original shows avoidance, keep avoidance; don't invent connection

    5. CORRECT WAVE CATEGORIZATION
    - W2 (POV) = unverifiable internal motive/knowledge ONLY
    - "where a mouth had closed" is physical inference, NOT mind-reading
    - Don't mislabel observable evidence as POV breach

    6. GRAMMATICAL CORRECTNESS
    - All suggestions must be grammatically complete
    - No broken constructions ("Back turned final" is not English)
    - Adverbs need -ly unless legitimately stylistic

    CRITICAL GATING RULE (from WAVE 61):
    **Reflexive ≠ automatically bad**

    If a flagged phrase serves:
    - Embodiment (physical/psychological grounding)
    - Intimacy (character-to-self connection)
    - Agency reinforcement (deliberate self-action)
    - Character voice (authentic speech patterns)
    - Psychological cohesion (mental state tracking)

    → KEEP IT (mark as "justified")

    If it's:
    - Redundant (meaning already clear)
    - Weakens clarity or authority
    - Adds no narrative function
    - Generic/autopilot writing

    → FLAG IT (mark as "revise")

For each candidate, validate MANDATORY QUALITY GATES:
1. Is the suggested fix idiomatic English? (no translation artifacts, no broken grammar)
2. Does it preserve original meaning exactly? (no drift, no invention of opposite intent)
3. Does it avoid invented choreography/staging? (only what source text contains)
4. Is it free of coined jargon? (unless source uses it)
5. Is the WAVE category correct? (W2 = true mind-reading only, not physical inference)
6. Is it grammatically complete? (all adverbs properly formed, sentences complete)

Then determine:
7. Does this construction serve voice/embodiment/agency? (yes/no)
8. Does it strengthen psychological cohesion or intimacy? (yes/no)
9. Is it justified by narrative context? (yes/no)
10. Which WAVE principle applies? (cite wave number if known)
11. Final verdict: "keep" or "revise"

If "keep": explain what narrative function it serves
If "revise": provide editorial rationale aligned with WAVE principles
If any quality gate FAILS: verdict MUST be "keep" (don't suggest broken fixes)

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

    // SINGLE PRIMARY FIX PROTOCOL: Validate if alternatives are viable
    const validateAlternatives = (suggestion, waveNum) => {
      // Conditions where only ONE correct fix exists (no semantic alternatives allowed):
      // 1. W13 (Dialogue Tags) - Ritual/teaching cadence requiring specific attribution
      // 2. Fidelity-locked fixes where any deviation introduces drift
      // 3. Agency-critical fixes where verb must stay with original actor
      
      const isRitualDialogue = waveNum === 13 && 
        /^["'].*["']\s*["'].*["']\s*["']/.test(suggestion.original_text) &&
        (suggestion.why_flagged?.includes('ritual') || suggestion.why_flagged?.includes('teaching'));
      
      const isFidelityLocked = suggestion.why_this_fix?.includes('fidelity') || 
        suggestion.why_this_fix?.includes('agency') ||
        suggestion.why_this_fix?.includes('cadence');
      
      if (isRitualDialogue || isFidelityLocked) {
        console.log(`[WAVE ${waveNum}] Single Primary Fix locked - ${isRitualDialogue ? 'ritual dialogue' : 'fidelity constraint'}`);
        return {
          allows_alternatives: false,
          alternatives_reason: "Any alternate would introduce semantic drift or break ritual cadence",
          lock_scope: "row",
          lock_type: isRitualDialogue ? "ritual_cadence" : "fidelity_constraint"
        };
      }
      
      return { allows_alternatives: true, alternatives_reason: null, lock_scope: null, lock_type: null };
    };

    // Add wave name and IDs to approved suggestions only
    const suggestions = approvedSuggestions.map((s, idx) => {
      const altValidation = validateAlternatives(s, wave_number);
      return {
        id: `w${wave_number}_${idx}`,
        wave_name: wave.name,
        ...s,
        status: "pending",
        alternatives: altValidation.allows_alternatives ? [] : null,
        alternatives_status: altValidation.allows_alternatives ? null : "fidelity_locked",
        alternatives_reason: altValidation.alternatives_reason,
        lock_scope: altValidation.lock_scope,
        lock_type: altValidation.lock_type
      };
    });

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