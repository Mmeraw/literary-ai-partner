import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Load the Synopsis Master Spec
const SYNOPSIS_SPEC = {
  "spec_id": "SYNOPSIS_MASTER_SPEC_v1.0",
  "outputs": {
    "versions": [
      { "id": "query", "name": "Short / Query Synopsis", "min_words": 100, "max_words": 150 },
      { "id": "standard", "name": "Standard Synopsis", "min_words": 250, "max_words": 500 },
      { "id": "extended", "name": "Extended Synopsis", "min_words": 700, "max_words": 1000 }
    ]
  },
  "global_constraints": {
    "tense": "present",
    "pov": "third_person",
    "ending_policy": "reveal",
    "max_named_characters": 7,
    "avoid_blurb_speak": true
  },
  "required_headers": [
    "1. Basic Metadata",
    "2. Premise / Setup",
    "3. Major Plot Points",
    "4. Climax",
    "5. Resolution",
    "6. Themes",
    "7. Style / Voice",
    "8. Market Positioning",
    "9. Closing Note"
  ],
  "pitfalls": [
    "too_many_characters_or_subplots",
    "theme_instead_of_story",
    "teaser_or_rhetorical_ending",
    "tense_or_pov_inconsistent",
    "adjectival_padding_or_vague_stakes",
    "missing_emotional_arc"
  ]
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptInfo, synopsisType, manuscriptId } = await req.json();

        if (!manuscriptInfo && !manuscriptId) {
            return Response.json({ error: 'Manuscript information or ID required' }, { status: 400 });
        }

        // Get version config
        const versionConfig = SYNOPSIS_SPEC.outputs.versions.find(v => v.id === synopsisType) || 
                              SYNOPSIS_SPEC.outputs.versions.find(v => v.id === 'standard');

        // Step 1: Build Story Skeleton
        const skeletonPrompt = `You are analyzing a manuscript to extract structural elements for a professional synopsis.

MANUSCRIPT INFORMATION:
${manuscriptInfo}

Extract the following story elements in a structured format:

1. Protagonists (names and roles - max 5-7 characters)
2. Inciting incident (the event that starts the story)
3. Core conflict (who wants what, why now, what stands in the way)
4. 3-5 major turning points that escalate stakes
5. Climax (decisive confrontation/choice)
6. Resolution (outcome, new normal, protagonist change)
7. 2-3 core themes (concrete, not abstract)
8. Tone and style (one sentence)
9. 2-3 comparable titles with brief differentiation
10. Closing resonant line

Be precise and factual. This is for professional agent submission.`;

        const skeletonResponse = await base44.integrations.Core.InvokeLLM({
            prompt: skeletonPrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    protagonists: { type: "array", items: { type: "object", properties: {
                        name: { type: "string" },
                        role: { type: "string" }
                    }}},
                    inciting_incident: { type: "string" },
                    core_conflict: { type: "string" },
                    turning_points: { type: "array", items: { type: "string" } },
                    climax: { type: "string" },
                    resolution: { type: "string" },
                    themes: { type: "array", items: { type: "string" } },
                    tone_style: { type: "string" },
                    comparables: { type: "array", items: { type: "object", properties: {
                        title: { type: "string" },
                        connection: { type: "string" }
                    }}},
                    closing_line: { type: "string" }
                },
                required: ["protagonists", "inciting_incident", "core_conflict", "turning_points", "climax", "resolution", "themes", "tone_style", "comparables", "closing_line"]
            }
        });

        // Step 2-3: Generate Synopsis with Exact 9 Headers
        const synopsisPrompt = `You are a professional synopsis writer calibrated against Dr. Patricia Anderson's standards.

Generate a ${versionConfig.name.toUpperCase()} (${versionConfig.min_words}-${versionConfig.max_words} words).

STORY SKELETON:
${JSON.stringify(skeletonResponse, null, 2)}

MANDATORY STRUCTURE - USE THESE EXACT 9 HEADERS:

1. Basic Metadata
[Title — Genre — Word Count — POV — Author Name]
[One-sentence logline: premise + stakes + hook]

2. Premise / Setup
[Protagonists by name and role]
[Inciting incident]
[Core conflict: who wants what, why now, obstacle]
[Time period / setting cue]

3. Major Plot Points
[3-5 turning points that escalate stakes]
[Only include subplots that change the ending or raise stakes]

4. Climax
[Decisive confrontation/choice named]
[Objective vs antagonist/system collision]

5. Resolution
[Outcome and fallout]
[New normal]
[Character change in one sentence]

6. Themes
• [Theme 1]
• [Theme 2]
• [Theme 3 if applicable]

7. Style / Voice
[Tense/POV confirmation: present tense, third person]
[Tone sentence]
[Dual-POV structure if applicable]

8. Market Positioning
[2-3 comps: "For readers of X and Y"]
[Differentiation: what you do differently]

9. Closing Note
[One resonant line - no cliffhanger]

STRICT CONSTRAINTS:
- Present tense, third person throughout
- Reveal the ending completely (no teasers)
- Limit to ${SYNOPSIS_SPEC.global_constraints.max_named_characters} named characters max
- Strong verbs, precise nouns; minimal adjectives/adverbs
- No blurb-speak ("gripping," "breathtaking")
- Paragraphs 3-6 lines each
- Professional, agent-ready tone

Word target: ${versionConfig.min_words}-${versionConfig.max_words} words`;

        const synopsisResponse = await base44.integrations.Core.InvokeLLM({
            prompt: synopsisPrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    synopsis_text: { type: "string" }
                },
                required: ["synopsis_text"]
            }
        });

        // Step 4-6: Validation & Quality Check
        const validationPrompt = `Validate this synopsis against professional standards:

SYNOPSIS:
${synopsisResponse.synopsis_text}

Check for these PITFALLS (flag if present):
- Too many characters or subplots
- Theme instead of story (plot must drive)
- Teaser ending or rhetorical questions
- Inconsistent tense/POV
- Adjectival padding or vague stakes
- Missing emotional arc

Also verify:
- All 9 headers present with exact labels
- Word count in range (${versionConfig.min_words}-${versionConfig.max_words})
- Ending clearly revealed
- Present tense, third person maintained

Provide validation report with pass/fail status and specific flags.`;

        const validationResponse = await base44.integrations.Core.InvokeLLM({
            prompt: validationPrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    validation_status: { type: "string", enum: ["pass", "needs_revision"] },
                    headers_present: { type: "boolean" },
                    word_count: { type: "number" },
                    word_count_in_range: { type: "boolean" },
                    ending_revealed: { type: "boolean" },
                    tense_pov_correct: { type: "boolean" },
                    pitfalls_detected: { type: "array", items: { type: "string" } },
                    quality_notes: { type: "string" }
                },
                required: ["validation_status", "word_count", "pitfalls_detected"]
            }
        });

        return Response.json({
            success: true,
            synopsis: synopsisResponse.synopsis_text,
            validation: validationResponse,
            version: versionConfig.name,
            word_count: validationResponse.word_count
        });

    } catch (error) {
        console.error('Synopsis generation error:', error);
        return Response.json({ 
            success: false,
            error: error.message || 'Failed to generate synopsis'
        }, { status: 500 });
    }
});