import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Voice-Anchored Pitch Layer (P0)
 * 
 * Enforces thematic depth, specificity, and voice consistency for all pitch/deck outputs.
 * This layer sits between extraction and composition per CIAC quality routing.
 * 
 * Contract:
 * - Extracts thematic schema (law, taboo, enforcer, resistor, cost, moral axis)
 * - Applies Voice Anchor (tone: mythic, ritualistic, morally charged)
 * - Enforces Specificity Gate (rejects generic boilerplate)
 * - Generates tiered outputs (thesis, hook, moral engine, market synopsis)
 * 
 * Model-agnostic design allows future model family changes without contract rewrites.
 */

const VOICE_ANCHOR_SYSTEM_PROMPT = `You are a mythic interpreter, not a neutral announcer.

TONE REQUIREMENTS:
- Mythic, ritualistic, morally charged, embodied
- Favor concrete, sensory language over abstraction
- Speak as if the world believes in its own laws

DICTION RULES:
- No generic genre filler ("harsh world", "struggle for survival", "dark secrets", "brutal choices", "fate of their people")
- Use concrete imagery: named rituals, specific consequences, physicalized ethics
- Narrative stance: close witness to law and consequence

REQUIRED SURFACES:
- Law (explicit rule or code)
- Ritual (repeated pattern with meaning)
- Consequence (cost of action/defiance)
- Power asymmetry (who enforces, who resists)

BANNED PHRASES (unless manuscript-literal):
- "harsh world"
- "struggle for survival" 
- "fate of their people"
- "dark secrets"
- "brutal choices"
- "will they survive"
- "dangerous world"
- "fight for survival"

REQUIRED ELEMENTS:
- At least 2 named entities (characters/tribes/places) when present
- At least 1 explicit law/ritual/event that makes this world distinct
- Moral tension framed as "sanctioned law vs private refusal", not generic survival`;

const BANNED_PHRASES = [
    "harsh world",
    "struggle for survival",
    "fate of their people",
    "dark secrets",
    "brutal choices",
    "will they survive",
    "dangerous world",
    "fight for survival",
    "deadly game",
    "life or death",
    "do whatever it takes",
    "estranged lover",
    "depths of addiction",
    "storm brewing",
    "world of drugs",
    "chaotic",
    "tumultuous paths",
    "bid for liberation"
];

const INTENSITY_CONFIG = {
    neutral: {
        motifMinCount: 2,
        namedEntityMinCount: 2,
        regenerationBudget: 1,
        strictness: 'standard'
    },
    house: {
        motifMinCount: 3,
        namedEntityMinCount: 2,
        regenerationBudget: 2,
        strictness: 'high'
    },
    amped: {
        motifMinCount: 5,
        namedEntityMinCount: 3,
        regenerationBudget: 2,
        strictness: 'maximum'
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { extractedText, formatType, projectVoiceProfile, voiceIntensity = 'house' } = await req.json();

        if (!extractedText) {
            return Response.json({ error: 'extractedText is required' }, { status: 400 });
        }

        console.log(`🎭 Step 1: Extracting thematic schema (intensity: ${voiceIntensity})...`);

        const config = INTENSITY_CONFIG[voiceIntensity] || INTENSITY_CONFIG.house;
        console.log('Intensity config:', config);

        // STEP 1: Extract thematic schema
        const thematicSchema = await base44.integrations.Core.InvokeLLM({
            prompt: `Analyze this manuscript and extract its thematic architecture. Focus on the world's internal laws, not plot summary.

Manuscript text:
${extractedText.substring(0, 8000)}

Extract the following schema:`,
            response_json_schema: {
                type: 'object',
                properties: {
                    law: { 
                        type: 'string',
                        description: 'The explicit rule, code, or belief system that governs this world'
                    },
                    taboo: { 
                        type: 'string',
                        description: 'What is forbidden or transgressive in this world'
                    },
                    enforcer: { 
                        type: 'string',
                        description: 'Who or what enforces the law (person, institution, culture)'
                    },
                    resistor: { 
                        type: 'string',
                        description: 'Who or what resists or defies the law'
                    },
                    cost_of_defiance: { 
                        type: 'string',
                        description: 'What happens when someone breaks the law'
                    },
                    moral_axis: { 
                        type: 'string',
                        description: 'The central moral tension (e.g., "sanctioned law vs private refusal")'
                    },
                    symbolic_center: { 
                        type: 'string',
                        description: 'The ritual, object, or pattern that embodies the story\'s meaning'
                    },
                    named_entities: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Key character names, tribe names, or place names'
                    }
                },
                required: ['law', 'moral_axis', 'named_entities']
            }
        });

        console.log('✅ Thematic schema extracted:', JSON.stringify(thematicSchema, null, 2));

        // STEP 2: Generate voice-anchored pitch with schema as context
        console.log('🎭 Step 2: Generating voice-anchored pitch...');

        const pitchPrompt = `${VOICE_ANCHOR_SYSTEM_PROMPT}

THEMATIC SCHEMA (must surface in pitch):
${JSON.stringify(thematicSchema, null, 2)}

MANUSCRIPT TEXT:
${extractedText.substring(0, 8000)}

Generate a ${formatType || 'complete'} pitch that:
1. Uses the thematic schema (law, moral axis, symbolic center) as the foundation
2. Names at least 2 entities from the manuscript
3. Surfaces explicit law/ritual/consequence
4. Avoids ALL banned phrases unless they appear literally in the manuscript
5. Frames tension as moral conflict (sanctioned vs private), not generic survival

Generate tiered outputs:`;

        const pitchOutput = await base44.integrations.Core.InvokeLLM({
            prompt: pitchPrompt,
            response_json_schema: {
                type: 'object',
                properties: {
                    one_sentence_thesis: {
                        type: 'string',
                        description: 'Mythic, absolute one-sentence statement of the core conflict'
                    },
                    short_hook: {
                        type: 'string',
                        description: 'What makes this world different (2-3 sentences, ritual/law-focused)'
                    },
                    moral_engine: {
                        type: 'string',
                        description: 'What belief/law is being tested (1 paragraph, thesis-driven)'
                    },
                    market_synopsis: {
                        type: 'string',
                        description: 'Clean market-facing synopsis (still specific + lawful, 200-300 words)'
                    }
                },
                required: ['one_sentence_thesis', 'short_hook', 'moral_engine', 'market_synopsis']
            }
        });

        console.log('✅ Voice-anchored pitch generated');

        // STEP 3: Specificity Gate - validate against constraints
        console.log('🚦 Step 3: Running Specificity Gate...');

        const allText = Object.values(pitchOutput).join(' ').toLowerCase();
        const manuscriptLower = extractedText.toLowerCase();
        
        const bannedPhraseHits = BANNED_PHRASES.filter(phrase => {
            const inOutput = allText.includes(phrase.toLowerCase());
            const inManuscript = manuscriptLower.includes(phrase.toLowerCase());
            return inOutput && !inManuscript; // Only flag if in output but NOT in manuscript
        });

        const namedEntityCount = thematicSchema.named_entities?.length || 0;
        const hasExplicitLaw = thematicSchema.law && thematicSchema.law.length > 20;
        const hasMoralTension = pitchOutput.moral_engine && pitchOutput.moral_engine.length > 50;
        const motifCount = Object.keys(thematicSchema).filter(k => k !== 'named_entities' && thematicSchema[k]).length;

        const passedGate = bannedPhraseHits.length === 0 && 
                          namedEntityCount >= config.namedEntityMinCount && 
                          motifCount >= config.motifMinCount &&
                          hasExplicitLaw &&
                          hasMoralTension;

        const gateReport = {
            passed: passedGate,
            bannedPhraseHits,
            namedEntityCount,
            motifCount,
            hasExplicitLaw,
            hasMoralTension,
            voiceIntensity,
            minimumRequirements: {
                namedEntities: namedEntityCount >= config.namedEntityMinCount,
                motifCount: motifCount >= config.motifMinCount,
                explicitLaw: hasExplicitLaw,
                moralTension: hasMoralTension,
                noBoilerplate: bannedPhraseHits.length === 0
            }
        };

        console.log('🚦 Specificity Gate result:', gateReport);

        // STEP 4: If failed gate, regenerate with stricter constraints
        if (!passedGate) {
            console.log('⚠️ Failed Specificity Gate, regenerating with stricter constraints...');
            
            const stricterPrompt = `${VOICE_ANCHOR_SYSTEM_PROMPT}

CRITICAL FAILURES DETECTED (${voiceIntensity.toUpperCase()} INTENSITY):
${bannedPhraseHits.length > 0 ? `- Used banned phrases: ${bannedPhraseHits.join(', ')}` : ''}
${namedEntityCount < config.namedEntityMinCount ? `- Only ${namedEntityCount} named entities (need ${config.namedEntityMinCount}+)` : ''}
${motifCount < config.motifMinCount ? `- Only ${motifCount} motifs surfaced (need ${config.motifMinCount}+)` : ''}
${!hasExplicitLaw ? '- No explicit law/ritual surfaced' : ''}
${!hasMoralTension ? '- Insufficient moral tension' : ''}

THEMATIC SCHEMA (MUST USE):
${JSON.stringify(thematicSchema, null, 2)}

MANUSCRIPT TEXT:
${extractedText.substring(0, 8000)}

Regenerate with STRICT adherence to Voice Anchor. Name specific characters, rituals, laws. NO abstractions. NO banned phrases. Frame as moral conflict (sanctioned vs private).`;

            const retriedOutput = await base44.integrations.Core.InvokeLLM({
                prompt: stricterPrompt,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        one_sentence_thesis: { type: 'string' },
                        short_hook: { type: 'string' },
                        moral_engine: { type: 'string' },
                        market_synopsis: { type: 'string' }
                    }
                }
            });

            // Re-validate
            const retriedText = Object.values(retriedOutput).join(' ').toLowerCase();
            const retriedHits = BANNED_PHRASES.filter(phrase => 
                retriedText.includes(phrase.toLowerCase()) && !manuscriptLower.includes(phrase.toLowerCase())
            );

            if (retriedHits.length === 0) {
                console.log('✅ Regeneration passed gate');
                return Response.json({
                    success: true,
                    pitch: retriedOutput,
                    thematicSchema,
                    meta: {
                        motifCount: Object.keys(thematicSchema).length,
                        namedEntityCount,
                        bannedPhraseHits: retriedHits,
                        passedGate: true,
                        regenerated: true
                    }
                });
            } else {
                console.log('❌ Regeneration still failed gate');
                return Response.json({
                    success: false,
                    error: 'Specificity Gate failed after retry',
                    details: {
                        bannedPhraseHits: retriedHits,
                        requirements: gateReport.minimumRequirements
                    }
                }, { status: 422 });
            }
        }

        // Success path
        return Response.json({
            success: true,
            pitch: pitchOutput,
            thematicSchema,
            meta: {
                motifCount: Object.keys(thematicSchema).length,
                namedEntityCount,
                bannedPhraseHits,
                passedGate,
                gateReport
            }
        });

    } catch (error) {
        console.error('Voice Anchor service error:', error);
        return Response.json({ 
            error: 'Voice Anchor processing failed', 
            details: error.message 
        }, { status: 500 });
    }
});