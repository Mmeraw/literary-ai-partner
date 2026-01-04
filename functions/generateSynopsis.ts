import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

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
        const payload = await req.json();
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscriptInfo, synopsisType, source_document_id, source_version_id, mode, variant, allowAmbiguity, debug_force_constraint_violation } = payload;

        // QA-SYN-008: Debug constraint violation (admin-only debug flag)
        if (user.role === 'admin' && debug_force_constraint_violation) {
            return Response.json({
                error: 'ERR_SYNOPSIS_CONSTRAINT_VIOLATION',
                gate_blocked: true,
                message: 'Constraint violation: synopsis validation failed',
                details: 'Debug mode constraint violation triggered'
            }, { status: 400 });
        }

        if (!manuscriptInfo && !source_document_id) {
            return Response.json({ error: 'Manuscript information or ID required' }, { status: 400 });
        }

        // HARD GATE: Check preconditions (if source_document_id provided)
        let manuscript = null;
        let evaluationSnapshot = null;

        if (source_document_id) {
            const manuscripts = await base44.asServiceRole.entities.Manuscript.filter({ id: source_document_id });
            manuscript = manuscripts[0];

            if (!manuscript) {
                return Response.json({ 
                    error: 'ERR_SOURCE_NOT_FOUND',
                    message: 'Manuscript not found'
                }, { status: 404 });
            }

            // Gate 1: Required metadata
            const requiredMetadata = ['language_variant', 'word_count'];
            const missingMeta = requiredMetadata.filter(field => !manuscript[field]);
            if (missingMeta.length > 0) {
                return Response.json({
                    error: 'ERR_SYNOPSIS_PRECONDITION_MISSING_METADATA',
                    gate_blocked: true,
                    message: 'Synopsis blocked: missing required metadata (POV, word count, genre band)',
                    missing_fields: missingMeta
                }, { status: 400 });
            }

            // Gate 2: Spine evaluation complete
            const spineEval = manuscript.spine_evaluation;
            if (!spineEval || spineEval.status !== 'COMPLETE' || !spineEval.story_spine) {
                return Response.json({
                    error: 'ERR_SYNOPSIS_PRECONDITION_MISSING_SPINE',
                    gate_blocked: true,
                    message: 'Synopsis blocked: spine statement not found or incomplete',
                    current_status: spineEval?.status || 'NOT_STARTED'
                }, { status: 400 });
            }

            // Gate 3: 13 Criteria complete
            const thirteenCriteria = manuscript.revisiongrade_breakdown?.thirteen_criteria;
            if (!thirteenCriteria || thirteenCriteria.status !== 'COMPLETE') {
                return Response.json({
                    error: 'ERR_SYNOPSIS_PRECONDITION_MISSING_13CRITERIA',
                    gate_blocked: true,
                    message: 'Synopsis blocked: 13 Story Criteria incomplete',
                    current_status: thirteenCriteria?.status || 'NOT_STARTED'
                }, { status: 400 });
            }

            // Gate 4: WAVE flags complete
            const waveFlags = manuscript.revisiongrade_breakdown?.wave_flags;
            if (!waveFlags || waveFlags.status !== 'COMPLETE') {
                return Response.json({
                    error: 'ERR_SYNOPSIS_PRECONDITION_MISSING_WAVE',
                    gate_blocked: true,
                    message: 'Synopsis blocked: WAVE flags incomplete',
                    current_status: waveFlags?.status || 'NOT_STARTED'
                }, { status: 400 });
            }

            // Gate 5: Weak spine requires explicit opt-in
            const SPINE_THRESHOLD = 7.0;
            if (manuscript.spine_score < SPINE_THRESHOLD && !allowAmbiguity) {
                return Response.json({
                    error: 'ERR_SYNOPSIS_SPINE_TOO_WEAK',
                    gate_blocked: true,
                    spine_score: manuscript.spine_score,
                    spine_flags: spineEval.spine_flags || [],
                    message: 'This manuscript has a weak narrative spine (score < 7/10). Choose: (1) Strengthen spine first (recommended), or (2) Generate synopsis with ambiguity acknowledged.',
                    spine_statement: spineEval.story_spine,
                    recommended_action: 'Revise manuscript to clarify protagonist objective, strengthen causal chains, and sharpen climax mechanism.'
                }, { status: 400 });
            }

            // All gates passed - capture evaluation snapshot
            evaluationSnapshot = {
                spine: spineEval,
                thirteen_criteria: thirteenCriteria,
                wave_flags: waveFlags,
                metadata: {
                    title: manuscript.title,
                    pov: manuscript.language_variant, // TODO: Add proper POV field
                    word_count: manuscript.word_count,
                    language_variant: manuscript.language_variant
                }
            };

            // Use manuscript data
            manuscriptInfo = manuscriptInfo || manuscript.full_text;
        }

        // Get version config
        const versionConfig = SYNOPSIS_SPEC.outputs.versions.find(v => v.id === synopsisType) || 
                              SYNOPSIS_SPEC.outputs.versions.find(v => v.id === 'standard');

        // Extract title from manuscript or use provided title
        const manuscriptTitle = manuscript?.title || (typeof manuscriptInfo === 'object' ? manuscriptInfo.title : null);
        
        if (!manuscriptTitle) {
            return Response.json({ 
                error: 'ERR_SYNOPSIS_MISSING_TITLE',
                message: 'Manuscript title is required for synopsis generation'
            }, { status: 400 });
        }

        // Step 1: Build Story Skeleton
        const skeletonPrompt = `You are analyzing a manuscript to extract structural elements for a professional synopsis.

MANUSCRIPT TITLE: ${manuscriptTitle}

MANUSCRIPT INFORMATION:
${manuscriptInfo}

Extract the following story elements in a structured format:

1. MANUSCRIPT TITLE: Return the exact title "${manuscriptTitle}" - do not change, shorten, or elaborate
2. Protagonists (names and roles - ONLY characters with major page time)
   - Include page_time estimate: major (>50% of text), significant (25-50%), minor (<25%)
   - DO NOT elevate minor characters to protagonist status
   - If character appears <25% of text, they are NOT a protagonist
3. Antagonist: Identify what/who opposes the protagonist
   - Type: person, system, internal conflict, nature, society, or none
   - Description: Be specific (not "society" but "homophobia in 1980s Atlanta")
4. Inciting incident (the event that starts the story)
5. Core conflict (who wants what, why now, what stands in the way)
6. 3-5 major turning points that escalate stakes
7. Climax (decisive confrontation/choice)
8. Resolution (outcome, new normal, protagonist change)
9. 2-3 core themes (concrete, not abstract)
10. Tone and style (one sentence)
11. 2-3 comparable titles with brief differentiation
12. Closing resonant line

CRITICAL RULES:
- Use EXACT manuscript title: "${manuscriptTitle}"
- Only list characters as protagonists if they appear in >25% of the manuscript
- Be precise about antagonist - avoid generic labels
- This is for professional agent submission - accuracy is essential`;

        const skeletonResponse = await base44.integrations.Core.InvokeLLM({
            prompt: skeletonPrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    manuscript_title: { type: "string", description: "Exact title as provided - do not modify" },
                    protagonists: { type: "array", items: { type: "object", properties: {
                        name: { type: "string" },
                        role: { type: "string" },
                        page_time: { type: "string", description: "Estimate of how much of the manuscript this character appears in: major (>50%), significant (25-50%), minor (<25%)" }
                    }}},
                    antagonist: { type: "object", properties: {
                        type: { type: "string", description: "person, system, internal, nature, society, or none" },
                        description: { type: "string", description: "What opposes the protagonist - be specific, not generic" }
                    }},
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
                required: ["manuscript_title", "protagonists", "antagonist", "inciting_incident", "core_conflict", "turning_points", "climax", "resolution", "themes", "tone_style", "comparables", "closing_line"]
            }
        });

        // Step 2-3: Generate Synopsis with Exact 9 Headers
        const synopsisPrompt = `You are a professional synopsis writer calibrated against Dr. Patricia Anderson's standards.

Generate a ${versionConfig.name.toUpperCase()} (${versionConfig.min_words}-${versionConfig.max_words} words).

MANUSCRIPT TITLE (USE EXACTLY AS SHOWN): ${manuscriptTitle}

STORY SKELETON:
${JSON.stringify(skeletonResponse, null, 2)}

MANDATORY STRUCTURE - USE THESE EXACT 9 HEADERS:

1. Basic Metadata
[Use this exact title: ${manuscriptTitle} — Genre — Word Count — POV — Author Name]
[One-sentence logline: premise + stakes + hook]

2. Premise / Setup
[Protagonists by name and role - ONLY major/significant characters from skeleton]
[Antagonist: ${skeletonResponse.antagonist.type} - ${skeletonResponse.antagonist.description}]
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

        // WAVE-SYN VALIDATORS: POV Supremacy & Character Elevation Rules
        const waveValidationPrompt = `WAVE SYNOPSIS CANON VALIDATION

ORIGINAL MANUSCRIPT TITLE: ${manuscriptTitle}
STORY SKELETON: ${JSON.stringify(skeletonResponse, null, 2)}
GENERATED SYNOPSIS: ${synopsisResponse.synopsis_text}

ENFORCE WAVE-SYN RULES (FAIL if violated):

WAVE-SYN-01: POV Supremacy (First-Person)
- If manuscript is first-person, POV narrator MUST be the protagonist
- No other character can be elevated unless text explicitly centers them

WAVE-SYN-02: Character Elevation Threshold
- Any protagonist/antagonist MUST:
  * Appear in main event narrative (not just titles/notes)
  * Act on-page (in-scene)
  * Materially influence outcomes
- Check skeleton page_time: major (>50%), significant (25-50%), minor (<25%)
- FAIL if minor character (<25% page time) is labeled protagonist/antagonist

WAVE-SYN-03: Antagonist Optionality
- For memoir/essay/observational work: human antagonist NOT required
- Opposition may be internal, situational, environmental, ethical, systemic
- FAIL if human antagonist invented where none exists

WAVE-SYN-04: Meta-Layer Containment
- Title contributors, thematic lenses, end-note voices CANNOT be protagonist/antagonist
- They must appear as "contextual contributors" only
- FAIL if meta-commentary figure elevated to central character

WAVE-SYN-05: Reflection Cannot Override Events
- End-notes, thematic bullets, abstract commentary cannot override concrete events
- Story focus determined by action sequence, not later reflection

TITLE CANON:
- Title in synopsis MUST exactly match: ${manuscriptTitle}
- FAIL if title changed, shortened, or elaborated

QUALITY CHECKS:
- All 9 headers present with exact labels
- Word count in range (${versionConfig.min_words}-${versionConfig.max_words})
- Ending clearly revealed
- Present tense, third person maintained
- Too many characters or subplots
- Theme instead of story (plot must drive)
- Teaser ending or rhetorical questions
- Inconsistent tense/POV
- Adjectival padding or vague stakes
- Missing emotional arc

Provide validation report with WAVE rule compliance.`;

        const validationResponse = await base44.integrations.Core.InvokeLLM({
            prompt: waveValidationPrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    validation_status: { type: "string", enum: ["pass", "needs_revision", "wave_violation"] },
                    title_matches: { type: "boolean", description: "Title exactly matches input" },
                    wave_syn_01_pov_supremacy: { type: "boolean", description: "POV narrator is protagonist (first-person)" },
                    wave_syn_02_character_threshold: { type: "boolean", description: "No minor characters elevated" },
                    wave_syn_03_antagonist_optional: { type: "boolean", description: "Human antagonist not invented" },
                    wave_syn_04_meta_containment: { type: "boolean", description: "Meta-commentary figures not elevated" },
                    wave_syn_05_events_primacy: { type: "boolean", description: "Events override reflection" },
                    wave_violations: { type: "array", items: { type: "string" }, description: "Specific WAVE rule violations" },
                    headers_present: { type: "boolean" },
                    word_count: { type: "number" },
                    word_count_in_range: { type: "boolean" },
                    ending_revealed: { type: "boolean" },
                    tense_pov_correct: { type: "boolean" },
                    pitfalls_detected: { type: "array", items: { type: "string" } },
                    quality_notes: { type: "string" }
                },
                required: ["validation_status", "title_matches", "wave_syn_01_pov_supremacy", "wave_syn_02_character_threshold", "wave_syn_03_antagonist_optional", "wave_syn_04_meta_containment", "wave_syn_05_events_primacy", "wave_violations", "word_count", "pitfalls_detected"]
            }
        });

        // HARD FAIL on WAVE violations
        if (validationResponse.validation_status === 'wave_violation' || validationResponse.wave_violations?.length > 0) {
            return Response.json({
                error: 'ERR_SYNOPSIS_WAVE_VIOLATION',
                gate_blocked: true,
                message: 'Synopsis failed WAVE canon validation',
                wave_violations: validationResponse.wave_violations,
                validation_details: validationResponse,
                synopsis_draft: synopsisResponse.synopsis_text
            }, { status: 400 });
        }

        // Create Document record in UPLOADED state
        const documentTitle = versionConfig.name;
        const document = await base44.entities.Document.create({
            type: 'SYNOPSIS',
            scope: variant === 'EXTENDED' ? 'FULL' : variant === 'STANDARD' ? 'FULL' : 'PARTIAL',
            state: 'UPLOADED',
            title: documentTitle,
            parent_document_id: source_document_id || null,
            content_reference_id: null,
            content_reference_type: null
        });

        // Compute separate snapshot hashes for audit trail
        const spineSnapshotHash = evaluationSnapshot ? 
            JSON.stringify(evaluationSnapshot.spine).substring(0, 64) : null;
        const criteriaSnapshotHash = evaluationSnapshot ? 
            JSON.stringify(evaluationSnapshot.thirteen_criteria).substring(0, 64) : null;
        const waveSnapshotHash = evaluationSnapshot ? 
            JSON.stringify(evaluationSnapshot.wave_flags).substring(0, 64) : null;
        const constraintHash = evaluationSnapshot ? 
            JSON.stringify({
                spine_statement: evaluationSnapshot.spine.story_spine,
                spine_score: evaluationSnapshot.spine.spine_score,
                criteria_scores: evaluationSnapshot.thirteen_criteria.scores,
                wave_flags: evaluationSnapshot.wave_flags.flags,
                metadata: evaluationSnapshot.metadata
            }) : null;

        // Create initial version (UPLOAD kind) with full audit trail
        await base44.entities.DocumentVersion.create({
            document_id: document.id,
            version_number: 1,
            state_at_time: 'UPLOADED',
            content_snapshot: synopsisResponse.synopsis_text,
            score_snapshot: null,
            evaluation_data: {
                validation: validationResponse,
                skeleton: skeletonResponse,
                audit_trail: {
                    source_manuscript_id: source_document_id || null,
                    source_document_id: source_document_id || null,
                    source_version_id: source_version_id || null,
                    evaluation_id: source_document_id || null,
                    story_spine_used: evaluationSnapshot?.spine.story_spine || null,
                    spine_snapshot_hash: spineSnapshotHash,
                    criteria_snapshot_hash: criteriaSnapshotHash,
                    wave_snapshot_hash: waveSnapshotHash,
                    constraint_hash: constraintHash,
                    evaluation_snapshot: evaluationSnapshot,
                    prompt_template_version: "SYNOPSIS_PROMPT_v1.0",
                    mode: mode || (allowAmbiguity ? "AMBIGUITY_ACK" : "STANDARD"),
                    variant: variant || versionConfig.id.toUpperCase(),
                    ambiguity_acknowledged: allowAmbiguity || false,
                    generated_at: new Date().toISOString()
                }
            },
            notes: `Generated ${versionConfig.name}${allowAmbiguity ? ' (ambiguity acknowledged)' : ''}`
        });

        // Transition to EVALUATED state (since we have validation data)
        await base44.functions.invoke('transitionDocumentState', {
            document_id: document.id,
            to_state: 'EVALUATED',
            transition_data: {
                evaluation_score: validationResponse.validation_status === 'pass' ? 9 : 7,
                evaluation_data: validationResponse
            }
        });

        return Response.json({
            success: true,
            synopsis: synopsisResponse.synopsis_text,
            validation: validationResponse,
            version: versionConfig.name,
            word_count: validationResponse.word_count,
            document_id: document.id
        });

    } catch (error) {
        console.error('Synopsis generation error:', error);
        
        // Capture to Sentry with full context
        Sentry.captureException(error, {
            tags: {
                pipeline: 'synopsis',
                feature: 'output_generation'
            },
            extra: {
                function: 'generateSynopsis',
                operation: 'output_generation',
                manuscript_id: source_document_id,
                manuscript_title: manuscript?.title,
                synopsis_type: synopsisType,
                version_config: versionConfig?.name,
                user_email: user?.email,
                spine_score: manuscript?.spine_score,
                spine_complete: !!manuscript?.spine_evaluation,
                thirteen_criteria_complete: manuscript?.revisiongrade_breakdown?.thirteen_criteria?.status === 'COMPLETE',
                wave_flags_complete: manuscript?.revisiongrade_breakdown?.wave_flags?.status === 'COMPLETE',
                allow_ambiguity: allowAmbiguity,
                error_message: error.message,
                timestamp: new Date().toISOString()
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ 
            success: false,
            error: error.message || 'Failed to generate synopsis'
        }, { status: 500 });
    }
});