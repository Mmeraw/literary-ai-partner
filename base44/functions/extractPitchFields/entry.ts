import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url, raw_text, voiceIntensity = 'house' } = await req.json();

        if (!file_url && !raw_text) {
            return Response.json({ error: 'Either file_url or raw_text is required' }, { status: 400 });
        }

        let manuscriptSample;
        let extractedText;

        if (raw_text) {
            // Direct text ingestion (pasted text, imported text, cloned text)
            console.log('📝 Step 1: Processing raw text input...');
            extractedText = raw_text;
            manuscriptSample = extractedText.substring(0, Math.min(50000, extractedText.length));
            console.log(`Using ${manuscriptSample.length} characters from raw text`);
        } else {
            // File ingestion pathway
            console.log('📄 Step 1: Ingesting manuscript via central pipeline...');
            
            const ingestionResult = await base44.asServiceRole.functions.invoke('ingestUploadedFileToText', { file_url });
            const ingestionData = ingestionResult.data || ingestionResult;
            
            if (!ingestionData.success) {
                throw new Error(`File ingestion failed: ${ingestionData.error?.message || 'Unknown error'}`);
            }
            
            extractedText = ingestionData.text;
            console.log(`✅ File ingested: ${ingestionData.meta.charCount} characters from ${ingestionData.meta.filename}`);

            manuscriptSample = extractedText.substring(0, Math.min(50000, extractedText.length));
            console.log(`Using ${manuscriptSample.length} characters for analysis`);
        }

        console.log('🔍 Step 2: Extracting all pitch fields with thematic substrate...');
        const extractionPrompt = `Analyze this manuscript/screenplay excerpt and extract all fields for pitch generation with thematic substrate.

MANUSCRIPT TEXT:
${manuscriptSample}

CRITICAL: NO INVENTED ENTITIES POLICY
- For protagonist/character names: MUST be directly from the manuscript OR a generic role description
- NEVER create character names that don't appear in the source text
- If the protagonist is unnamed, use role descriptions like "an unnamed narrator", "a disillusioned man", "a young woman"
- Proper nouns (names, places) must exist in the manuscript or be left generic

Extract and provide:
1. Title - Extract from the document header or opening
2. Genre - Be specific (e.g., "Eco-horror, Dark Fantasy", "Literary Thriller", "Contemporary Romance")
3. Word count estimate - Based on the full manuscript length (as number)
4. Logline - A compelling 1-2 sentence pitch that captures the core story
5. Key themes - Comma-separated list of 3-5 key themes
6. Protagonist - ONLY use names that appear in manuscript OR generic role descriptions (e.g., "an unnamed narrator")
7. Stakes - What's at risk? What will happen if the protagonist fails?
8. Setting - Location, time period, and world details
9. Unique hook - What makes this story different from everything else in the genre? The distinctive element that sets it apart.

10. Named Entities - Extract ONLY proper nouns that appear in the text: character names, locations, objects, organizations (array)

11. Thematic Schema - Extract the story's moral architecture:
    - law: The governing rule/norm of this world
    - taboo: What is forbidden or transgressed
    - enforcer: Who/what upholds the law
    - resistor: Who/what defies it
    - costOfDefiance: What price is paid for breaking the law
    - moralAxis: The core moral tension
    - symbolicCenter: The central recurring symbol or motif

12. Meta - Provide quality metrics:
    - motifCount: Number of distinct recurring motifs identified
    - namedEntityCount: Number of named entities extracted
    - bannedPhraseHits: Any generic phrases found (e.g., "heart-wrenching", "gripping tale")
    - lawMentioned: Did you identify a clear governing law/rule?
    - passedVoiceGate: Does this have specific, non-generic substance?
    - inventedNames: Array of any names you created that weren't in source (should be empty!)

Return structured JSON with all fields populated. Be specific and compelling.`;

        console.log('Calling LLM for Voice-Anchored extraction...');
        const extracted = await base44.integrations.Core.InvokeLLM({
            prompt: extractionPrompt,
            response_json_schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    genre: { type: 'string' },
                    wordCount: { type: 'number' },
                    logline: { type: 'string' },
                    keyThemes: { type: 'string' },
                    protagonist: { type: 'string' },
                    stakes: { type: 'string' },
                    setting: { type: 'string' },
                    uniqueHook: { type: 'string' },
                    namedEntities: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    thematicSchema: {
                        type: 'object',
                        properties: {
                            law: { type: 'string' },
                            taboo: { type: 'string' },
                            enforcer: { type: 'string' },
                            resistor: { type: 'string' },
                            costOfDefiance: { type: 'string' },
                            moralAxis: { type: 'string' },
                            symbolicCenter: { type: 'string' }
                        }
                    },
                    meta: {
                        type: 'object',
                        properties: {
                            motifCount: { type: 'number' },
                            namedEntityCount: { type: 'number' },
                            bannedPhraseHits: {
                                type: 'array',
                                items: { type: 'string' }
                            },
                            lawMentioned: { type: 'boolean' },
                            passedVoiceGate: { type: 'boolean' },
                            inventedNames: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Names created but not found in source text (should be empty)'
                            }
                        }
                    }
                }
            }
        });

        console.log('✅ Step 2 complete - Extraction successful');
        console.log('Extracted data:', JSON.stringify(extracted, null, 2));

        // STEP 3: Validate No Invented Entities (Hard Gate with Regeneration)
        console.log('🚦 Step 3: Validating No Invented Entities policy...');
        
        const validateExtraction = (extractionResult) => {
            const inventedNames = extractionResult.meta?.inventedNames || [];
            const namedEntitiesLower = (extractionResult.namedEntities || []).map(e => e.toLowerCase());
            
            // Extract potential names from protagonist field (capitalized words)
            const potentialNames = (extractionResult.protagonist || '').match(/\b[A-Z][a-z]+\b/g) || [];
            const suspectNames = potentialNames.filter(name => 
                !namedEntitiesLower.some(entity => entity.toLowerCase().includes(name.toLowerCase())) &&
                name.length > 2 && // Ignore short words like "He", "In"
                !/^(The|A|An|In|On|At|To|For|Of|With|By|From)$/.test(name) // Common false positives
            );
            
            const allInvented = [...inventedNames, ...suspectNames];
            return {
                passed: allInvented.length === 0,
                inventedNames: allInvented
            };
        };
        
        const validation = validateExtraction(extracted);
        
        if (!validation.passed) {
            console.error('❌ NO INVENTED ENTITIES GATE FAILED (Attempt 1)');
            console.error('Invented names detected:', validation.inventedNames);
            console.log('🔄 Attempting regeneration with stricter constraints...');
            
            // REGENERATION ATTEMPT with explicit constraints
            const strictPrompt = `CRITICAL FAILURE: You created character names that don't exist in the source text.

INVENTED NAMES DETECTED: ${validation.inventedNames.join(', ')}

MANUSCRIPT TEXT (same as before):
${manuscriptSample}

RE-EXTRACT with ABSOLUTE ENFORCEMENT:
- For protagonist: ONLY use names that appear in the manuscript text above
- If no name is mentioned, use a ROLE DESCRIPTION like "a recently divorced man" or "an unnamed narrator"
- DO NOT CREATE ANY NAMES
- Proper nouns MUST be directly quoted from the text

Return the same JSON structure, but with NO invented entities.`;

            const reextracted = await base44.integrations.Core.InvokeLLM({
                prompt: strictPrompt,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        genre: { type: 'string' },
                        wordCount: { type: 'number' },
                        logline: { type: 'string' },
                        keyThemes: { type: 'string' },
                        protagonist: { type: 'string' },
                        stakes: { type: 'string' },
                        setting: { type: 'string' },
                        uniqueHook: { type: 'string' },
                        namedEntities: {
                            type: 'array',
                            items: { type: 'string' }
                        },
                        thematicSchema: {
                            type: 'object',
                            properties: {
                                law: { type: 'string' },
                                taboo: { type: 'string' },
                                enforcer: { type: 'string' },
                                resistor: { type: 'string' },
                                costOfDefiance: { type: 'string' },
                                moralAxis: { type: 'string' },
                                symbolicCenter: { type: 'string' }
                            }
                        },
                        meta: {
                            type: 'object',
                            properties: {
                                motifCount: { type: 'number' },
                                namedEntityCount: { type: 'number' },
                                bannedPhraseHits: {
                                    type: 'array',
                                    items: { type: 'string' }
                                },
                                lawMentioned: { type: 'boolean' },
                                passedVoiceGate: { type: 'boolean' },
                                inventedNames: {
                                    type: 'array',
                                    items: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            });
            
            const revalidation = validateExtraction(reextracted);
            
            if (!revalidation.passed) {
                console.error('❌ NO INVENTED ENTITIES GATE FAILED (Attempt 2 - HARD FAIL)');
                console.error('Still invented:', revalidation.inventedNames);
                
                return Response.json({
                    success: false,
                    error: 'NO_INVENTED_ENTITIES_POLICY_VIOLATION',
                    details: `Extraction failed after regeneration. The system created character names (${revalidation.inventedNames.join(', ')}) that do not appear in the source manuscript. This violates the No Invented Entities policy.`,
                    inventedNames: revalidation.inventedNames,
                    requiresManualIntervention: true
                }, { status: 422 });
            }
            
            console.log('✅ Regeneration successful - No Invented Entities check passed');
            extracted = reextracted;
            extracted.meta.regenerationAttempts = 1;
        }
        
        // Add meta flags for role descriptions vs named protagonists
        const isRoleDescription = !extracted.namedEntities.some(entity => 
            extracted.protagonist.toLowerCase().includes(entity.toLowerCase())
        );
        
        if (isRoleDescription) {
            extracted.meta.UNSPECIFIED_NAME = true;
            extracted.meta.protagonistType = 'ROLE_DESCRIPTION';
            console.log('📝 Protagonist is a role description (no specific name in text)');
        } else {
            extracted.meta.protagonistType = 'NAMED';
            console.log('📝 Protagonist is named from manuscript');
        }
        
        console.log('✅ No Invented Entities check passed');

        return Response.json({
            success: true,
            fields: extracted
        });

    } catch (error) {
        console.error('❌ Pitch field extraction error:', error);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Failed to extract pitch fields', 
            details: error.message 
        }, { status: 500 });
    }
});