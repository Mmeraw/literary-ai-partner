import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Background evaluation runner
async function runEvaluation(manuscriptId, base44) {
    try {
        // Get manuscript and chapters
        const [manuscript] = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscriptId });
        const chapters = await base44.asServiceRole.entities.Chapter.filter({ manuscript_id: manuscriptId }, 'order');

        if (!manuscript || chapters.length === 0) {
            throw new Error('Manuscript or chapters not found');
        }

        // PHASE 0: INTEGRITY CHECK (NEW - prevents V3 contamination)
        const integrityCheck = await base44.asServiceRole.functions.invoke('checkManuscriptIntegrity', {
            text: manuscript.full_text,
            manuscript_id: manuscriptId
        });

        const integrity = integrityCheck.data.integrity;
        
        // Store integrity report
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            evaluation_progress: {
                current_step: `Integrity Check: ${integrity.clean_score}% clean (${integrity.mode})`,
                integrity_report: integrity,
                last_updated: new Date().toISOString()
            }
        });

        // Apply development mode penalty if contaminated
        const integrityPenalty = integrity.is_clean ? 0 : 0.5;
        const evaluationMode = integrity.mode;

        // PHASE 1: Generate chapter summaries (structural abstraction)
        // Check which chapters already have summaries (for resume capability)
        const summarizedChapters = chapters.filter(ch => ch.status === 'summarized' && ch.summary_json);
        const chapterSummaries = summarizedChapters.map(ch => ch.summary_json);

        if (summarizedChapters.length < chapters.length) {
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                status: 'summarizing',
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: summarizedChapters.length,
                    chapters_wave_done: 0,
                    current_phase: 'summarize',
                    percent_complete: Math.floor((summarizedChapters.length / chapters.length) * 25),
                    current_step: `Resuming summaries... (${summarizedChapters.length}/${chapters.length} done)`,
                    last_updated: new Date().toISOString()
                }
            });
        }

        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];

            // Skip if already summarized
            if (chapter.status === 'summarized' && chapter.summary_json) {
                chapterSummaries.push(chapter.summary_json);
                continue;
            }

            try {
                await base44.asServiceRole.entities.Chapter.update(chapter.id, { status: 'summarizing' });

                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapterSummaries.length,
                        chapters_wave_done: 0,
                        current_phase: 'summarize',
                        percent_complete: Math.floor((chapterSummaries.length / chapters.length) * 25),
                        current_step: `Summarizing Chapter ${i + 1} of ${chapters.length}...`,
                        last_updated: new Date().toISOString()
                    }
                });

                const summaryPrompt = `You are a professional developmental editor. Produce accurate structural summaries. Do not invent events. Do not rewrite prose. Output must be valid JSON matching the schema. Keep language neutral and specific.

        TASK: Create a structural chapter summary for later whole-book 'spine' evaluation.

        RULES:
        - Use only information in the chapter text. Do not invent.
        - Summary must be 200–300 words, focused on plot movement, character change, stakes, and unresolved hooks.
        - Then fill the structured fields.
        - If chapter boundaries or names are unclear, make the best inference and mark uncertainty in 'notes'.

        CHAPTER TEXT:
        ${chapter.text}`;

                const summary = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: summaryPrompt,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            chapter_index: { type: "number" },
                            chapter_title: { type: "string" },
                            summary_200_300_words: { type: "string" },
                            key_beats: { type: "array", items: { type: "string" } },
                            characters_present: { type: "array", items: { type: "string" } },
                            primary_pov: { type: "string" },
                            settings: { type: "array", items: { type: "string" } },
                            stakes_shift: { type: "string" },
                            conflict_type: { type: "string" },
                            turning_point: { type: "string" },
                            unresolved_hooks: { type: "array", items: { type: "string" } },
                            tension_level_1_5: { type: "number" },
                            arc_movement_notes: { type: "string" },
                            notes: { type: "string" }
                        },
                        required: ["chapter_index", "chapter_title", "summary_200_300_words", "key_beats"]
                    }
                });

                await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                    summary_json: summary,
                    status: 'summarized'
                });

                chapterSummaries.push(summary);

                // Update progress after successful summary
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapterSummaries.length,
                        chapters_wave_done: 0,
                        current_phase: 'summarize',
                        percent_complete: Math.floor((chapterSummaries.length / chapters.length) * 25),
                        current_step: `Summarized ${chapterSummaries.length}/${chapters.length} chapters`,
                        last_updated: new Date().toISOString()
                    }
                });

                } catch (error) {
                console.error(`Chapter ${i + 1} summary failed:`, error);
                await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                    status: 'failed',
                    error_message: error.message
                });

                // Update progress to show we moved past this chapter
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapterSummaries.length,
                        chapters_wave_done: 0,
                        current_phase: 'summarize',
                        percent_complete: Math.floor((chapterSummaries.length / chapters.length) * 25),
                        current_step: `Chapter ${i + 1} failed, continuing...`,
                        last_updated: new Date().toISOString(),
                        error_message: `Chapter ${i + 1} error: ${error.message}`
                    }
                });
                // Continue with remaining chapters
                }
                }

        // PHASE 2: Spine synthesis (all summaries at once)
        // Skip if spine already evaluated
        if (!manuscript.spine_score || !manuscript.spine_evaluation) {
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                status: 'spine_evaluating',
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: chapters.length,
                    chapters_wave_done: 0,
                    current_phase: 'spine',
                    percent_complete: 25,
                    current_step: 'Building Spine Evaluation...',
                    last_updated: new Date().toISOString()
                }
            });

        const spinePrompt = `You are a literary agent–style evaluator and developmental editor. Evaluate the manuscript's narrative architecture using chapter summaries. Do not invent missing scenes. Your job is to judge structural execution and story engine quality.

        TASK: Using the provided chapter summary objects (not raw prose), produce a whole-manuscript 'Spine Evaluation' and score the manuscript on 12 agent criteria (1–10).

        RULES:
        - Base your evaluation ONLY on the summaries provided.
        - Do not mention token limits or the fact that this is summarized.
        - Be specific: cite chapter indices when referencing problems or strengths (e.g., 'Ch. 7–9').
        - Scores must be integers 1–10.
        - Provide concise, actionable rationale per criterion (3–6 sentences each).

        12 AGENT CRITERIA:
        1. The Hook (Opening Impact)
        2. Voice & Narrative Style
        3. Characters & Development
        4. Conflict & Tension Architecture
        5. Thematic Resonance
        6. Pacing & Structural Flow
        7. Dialogue & Subtext
        8. Worldbuilding & Immersion
        9. Stakes & Emotional Investment
        10. Line-Level Polish
        11. Marketability & Genre Fit
        12. Would Agent Request Full Manuscript

        CHAPTER SUMMARIES:
        ${JSON.stringify(chapterSummaries, null, 2)}`;

        const spineEvaluation = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: spinePrompt,
            response_json_schema: {
                type: "object",
                properties: {
                    overallScore: { type: "number" },
                    verdict: { type: "string" },
                    majorStrengths: { type: "array", items: { type: "string" } },
                    criticalWeaknesses: { type: "array", items: { type: "string" } },
                    criteria: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                score: { type: "number" },
                                strengths: { type: "array", items: { type: "string" } },
                                weaknesses: { type: "array", items: { type: "string" } },
                                notes: { type: "string" }
                            },
                            required: ["name", "score", "strengths", "weaknesses", "notes"]
                        }
                    }
                },
                required: ["overallScore", "verdict", "majorStrengths", "criticalWeaknesses", "criteria"]
            }
        });

        // Update manuscript with spine evaluation (apply integrity penalty)
        const adjustedSpineScore = Math.max(0, spineEvaluation.overallScore - integrityPenalty);
        
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            spine_score: adjustedSpineScore,
            spine_evaluation: {
                ...spineEvaluation,
                integrity_adjusted: !integrity.is_clean,
                integrity_penalty: integrityPenalty,
                raw_score: spineEvaluation.overallScore,
                evaluation_mode: evaluationMode
            },
            status: 'evaluating_chapters',
            evaluation_progress: {
                chapters_total: chapters.length,
                chapters_summarized: chapters.length,
                chapters_wave_done: 0,
                current_phase: 'wave',
                percent_complete: 40,
                current_step: 'Running chapter-by-chapter craft checks...',
                last_updated: new Date().toISOString()
            }
        });
        } else {
        // Spine already done, update status for WAVE phase
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            status: 'evaluating_chapters',
            evaluation_progress: {
                chapters_total: chapters.length,
                chapters_summarized: chapters.length,
                chapters_wave_done: 0,
                current_phase: 'wave',
                percent_complete: 40,
                current_step: 'Resuming chapter craft checks...',
                last_updated: new Date().toISOString()
            }
        });
        }

        // PHASE 3: WAVE chapter craft evaluation
        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];

            // Skip if already evaluated OR failed
            if ((chapter.status === 'evaluated' && chapter.evaluation_score) || chapter.status === 'failed') {
                continue;
            }

            // If chapter stuck in 'evaluating' status, mark as failed and skip
            // (Aggressive recovery: any chapter in evaluating state when we start a new run is considered hung)
            if (chapter.status === 'evaluating') {
                console.log(`Chapter ${i + 1} was stuck in evaluating status, marking as failed and skipping`);
                await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                    status: 'failed',
                    error_message: 'Previous evaluation attempt did not complete'
                });

                // Update progress to show we skipped this chapter
                const evaluatedSoFar = chapters.filter(ch => ch.status === 'evaluated').length;
                const wavePercent = 40 + Math.floor(((i + 1) / chapters.length) * 50);
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapters.length,
                        chapters_wave_done: evaluatedSoFar,
                        current_phase: 'wave',
                        percent_complete: wavePercent,
                        current_step: `Skipped stuck chapter ${i + 1}, continuing...`,
                        last_updated: new Date().toISOString()
                    }
                });
                continue;
            }

            try {
                await base44.asServiceRole.entities.Chapter.update(chapter.id, { 
                    status: 'evaluating',
                    error_message: null
                });

                // Update progress
                const wavePercent = 40 + Math.floor((i / chapters.length) * 50);
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapters.length,
                        chapters_wave_done: i,
                        current_phase: 'wave',
                        percent_complete: wavePercent,
                        current_step: `Evaluating Chapter ${i + 1}: ${chapter.title}`,
                        last_updated: new Date().toISOString()
                    }
                });

            // Timeout wrapper for LLM calls (2 minutes max per chapter)
            const withTimeout = (promise, timeoutMs = 120000) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Chapter evaluation timeout - continuing with next chapter')), timeoutMs)
                    )
                ]);
            };

            // Story Evaluation (Agents, Editors, Script Readers)
                const agentAnalysis = await withTimeout(
                    base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: `You are a professional evaluator (agent/editor/script reader). Analyze this chapter against the 12 Story Evaluation Criteria, rating each 1-10:

            1. Opening Hook (opening_hook)
            2. Narrative Voice & Style (narrative_voice_style)
            3. Character Depth & Introduction (character_depth_introduction)
            4. Conflict, Tension & Escalation (conflict_tension_escalation)
            5. Thematic Resonance (thematic_resonance)
            6. Structure, Pacing & Flow (structure_pacing_flow)
            7. Dialogue & Subtext (dialogue_subtext)
            8. Worldbuilding & Immersion (worldbuilding_immersion)
            9. Stakes & Emotional Investment (stakes_emotional_investment)
            10. Line-Level Craft & Polish (line_level_craft_polish)
            11. Marketability & Genre Position (marketability_genre_position)
            12. 'Would They Keep Reading?' Gate (would_keep_reading_gate)

            RED-FLAG CHECKS (embedded in criteria):
            - POV discipline, no head-hopping
            - Protagonist clear and active early
            - No backstory dumps without scene pressure
            - Scene anchoring (who, where, what's happening)
            - Story logic coherent, no contradictions

            CHAPTER: ${chapter.title}

            TEXT:
            ${chapter.text}

            For each criterion provide: score (1-10), strengths (array), weaknesses (array), notes (detailed commentary), evidence_excerpts (2-4 short text excerpts showing why this score was given).
            Provide overall score (1-10) and verdict.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        overallScore: { type: "number" },
                        verdict: { type: "string" },
                        criteria: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    score: { type: "number" },
                                    strengths: { type: "array", items: { type: "string" } },
                                    weaknesses: { type: "array", items: { type: "string" } },
                                    notes: { type: "string" },
                                    evidence_excerpts: { type: "array", items: { type: "string" } }
                                },
                                required: ["name", "score", "strengths", "weaknesses", "notes"]
                            }
                        }
                    },
                    required: ["overallScore", "verdict", "criteria"]
                }
                })
                );

                // WAVE Revision System evaluation (61+ waves, three-tier framework)
                const waveAnalysis = await withTimeout(
                base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `You are an elite developmental editor applying the complete WAVE Revision System (61+ waves organized in three tiers).

            WAVE SYSTEM FRAMEWORK:
            **EARLY WAVES (Structural Truth):** POV integrity, stakes clarity, character consistency, cause-effect logic
            **MID WAVES (Momentum & Meaning):** Specificity, scene mechanics, dialogue purpose, choreography compression, emotional escalation
            **LATE WAVES (Authority & Polish):** Body-part clichés, filter verbs, motif discipline, reflexive redundancy, submission readiness

            **SMILE LEXICON REFERENCE (Optional Polish for 8-10 Tier Only)**:
            - Track "smile" usage density (flag if 3+ per 1k words)
            - FOR PROFESSIONAL TIER (scores 8-10): Offer as OPTIONAL alternatives with context-appropriate suggestions from smile lexicon (beam/grin/simper/sneer/fleer/leer/rictus)
            - FOR DEVELOPMENTAL TIER (<6): Suggest alternatives for repetitive usage only
            - CRITICAL: Frame as "Optional polish" NOT required corrections
            - Match to genre/tone: horror→rictus/sinister, literary→wry/enigmatic, romance→warm/tender
            - Never replace if author's restraint is intentional

            CRITICAL VALIDATION RULES - Use ONLY these exact category names and match issues correctly:
            - "Body-Part Clichés (Wave 1)" = jaw/chest/eyes/breath/heart that don't advance action (MUST contain actual body part)
            - "Filter Verbs (Wave 4)" = saw/felt/heard/noticed/realized creating distance (MUST contain perception verb)
            - "Generic Nouns (Wave 3)" = thing/stuff/place/room/situation lacking specificity
            - "Telling vs Showing" = "felt [emotion]", "seemed [state]" instead of evidence
            - "Adverbs (Wave 5)" = very/really/suddenly/quickly propping up weak verbs
            - "Passive Voice (Wave 6)" = was/were + verb, hiding actors
            - "Negation (Wave 7)" = didn't/not/never overuse
            - "On-the-Nose (Wave 15)" = because/which meant/in order to
            - "Dialogue Tags (Wave 13)" = over-attribution
            - "Reflexive Redundancy (Wave 61)" = himself/herself/own/just without narrative function

            HARD GATES (must validate before labeling):
            - "Body-Part Clichés" requires lexical match: jaw, chest, eyes, breath, heart, hands, stomach, throat, etc.
            - "Filter Verbs" requires perception verb: saw, felt, heard, noticed, realized, knew, thought, etc.
            - If text has "felt peaceful" = "Telling vs Showing" NOT body-part
            - If text has "noticed a shadow" = "Filter Verbs" NOT body-part
            - Multiple issues = list all relevant waves (primary + secondary)

            SCAN THIS CHAPTER across all three tiers:

            EARLY TIER CHECKS:
            - POV Honesty (Wave 2): No mind-reading, observable proof only
            - Concrete Stakes (Wave 17): What's at risk if this fails?
            - Character Consistency (Wave 36): Voice logic maintained?

            MID TIER CHECKS:
            - Generic Nouns (Wave 3): Replace "room," "thing," "place" with lived specificity
            - Filter Verbs (Wave 4): Remove "I saw/felt/heard" distance
            - Adverb Diet (Wave 5): Weak verbs propped up by adverbs?
            - Active Voice (Wave 6): Restore agency, name actors
            - Negation Discipline (Wave 7): Say what happened, not what didn't
            - Micro-Location Economy (Wave 12): 1 body + 1 system, then exit
            - Dialogue Tags (Wave 13): Over-attribution bloat?
            - Dialogue Under Pressure (Wave 14): Speech roughens under stress
            - Choreography Compression (Wave 21): Show only steps where failure is possible
            - Sentence Start Variety (Wave 23): Fix pronoun stacking

            LATE TIER CHECKS:
            - Body-Part Clichés (Wave 1): Jaw/chest/eyes that don't change action
            - Abstract Triples (Wave 8): Two beats sharpen, three soften
            - Motif Hygiene (Wave 9): Spotlight once per section
            - Duplicate Brilliance (Wave 10): Echoed insights
            - Theme After Shown (Wave 11): Trust subtext, don't declare
            - On-the-Nose Explanations (Wave 15): Cut "because," "which meant"
            - Metaphor Freshness (Wave 25): Dead phrases signal autopilot
            - Cliché Alarm (Wave 26): AI-adjacent tells
            - Rhythm Balance (Wave 27): Vary sentence length intentionally
            - Paragraph Endings (Wave 28): End on proof or cut
            - Ending Trust (Wave 54): No explaining the last beat
            - Reader Trust (Wave 55): Remove hand-holding

            **WAVE 61 GATING RULE (CRITICAL):**
            - Reflexives (himself/herself/themselves) are NOT automatically bad
            - Only flag when they add NO narrative function AND weaken the sentence
            - KEEP reflexives that serve: embodiment, intimacy, agency reinforcement, character voice, psychological cohesion
            - Same rule for: "own", "just", "as if", "like" (as filler), redundant "them"
            - If construction strengthens voice or serves narrative purpose → DO NOT FLAG IT

            **GOLDEN RULE FOR ALL SUGGESTIONS:**
            "Suggest, don't prescribe. Preserve voice before optimizing prose."
            - Lexicons (smile alternatives, etc.) are REFERENCE TOOLS, not correction mandates
            - For 8-10 tier: treat all line-level items as optional polish opportunities
            - Never auto-apply or force substitutions—these are inspiration, not rules

            CHAPTER: ${chapter.title}

            TEXT:
            ${chapter.text}

            For each WAVE issue found, provide: category (cite wave number), severity (Low/Medium/High), description, example_quote (actual text), fix_suggestion.
            IMPORTANT: Apply the two-stage pipeline: detect patterns, then validate through WAVE context. Only flag issues that genuinely weaken the manuscript.
            Provide: waveScore (1-10), criticalIssues (array), strengthAreas (array).`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        waveScore: { type: "number" },
                        criticalIssues: { type: "array", items: { type: "string" } },
                        strengthAreas: { type: "array", items: { type: "string" } },
                        waveHits: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    category: { type: "string" },
                                    severity: { type: "string" },
                                    description: { type: "string" },
                                    example_quote: { type: "string" },
                                    fix_suggestion: { type: "string" }
                                },
                                required: ["category", "severity", "description", "example_quote", "fix_suggestion"]
                            }
                        }
                    },
                    required: ["waveScore", "criticalIssues", "strengthAreas", "waveHits"]
                    }
                    })
                    );

                    // Combined score: 50% agent + 50% WAVE (apply integrity penalty)
            const rawCombinedScore = (agentAnalysis.overallScore * 0.5) + (waveAnalysis.waveScore * 0.5);
            const combinedScore = Math.max(0, rawCombinedScore - integrityPenalty);

            // Update chapter
            await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                evaluation_score: combinedScore,
                chapter_craft_score: waveAnalysis.waveScore,
                evaluation_result: {
                    ...agentAnalysis,
                    waveAnalysis: waveAnalysis,
                    combinedScore: combinedScore,
                    rawCombinedScore: rawCombinedScore,
                    agentScore: agentAnalysis.overallScore,
                    waveScore: waveAnalysis.waveScore,
                    integrity_adjusted: !integrity.is_clean,
                    integrity_penalty: integrityPenalty,
                    evaluation_mode: evaluationMode
                },
                wave_results_json: waveAnalysis,
                status: 'evaluated'
            });

            // Update progress after successful evaluation
            const wavePercent = 40 + Math.floor(((i + 1) / chapters.length) * 50);
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: chapters.length,
                    chapters_wave_done: i + 1,
                    current_phase: 'wave',
                    percent_complete: wavePercent,
                    current_step: `Evaluated ${i + 1}/${chapters.length} chapters`,
                    last_updated: new Date().toISOString()
                }
            });

            } catch (error) {
            console.error(`Chapter ${i + 1} WAVE evaluation failed:`, error);
            await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                status: 'failed',
                error_message: error.message
            });

            // Update progress to show we moved past this chapter
            const wavePercent = 40 + Math.floor(((i + 1) / chapters.length) * 50);
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: chapters.length,
                    chapters_wave_done: i,
                    current_phase: 'wave',
                    percent_complete: wavePercent,
                    current_step: `Chapter ${i + 1} failed, continuing...`,
                    last_updated: new Date().toISOString(),
                    error_message: `Chapter ${i + 1} error: ${error.message}`
                }
            });
            // Continue with remaining chapters
            }
            }

        // PHASE 4: Final composite scoring
        const evaluatedChapters = await base44.asServiceRole.entities.Chapter.filter({ 
            manuscript_id: manuscriptId, 
            status: 'evaluated' 
        });

        const avgChapterScore = evaluatedChapters.length > 0
            ? evaluatedChapters.reduce((sum, ch) => sum + (ch.evaluation_score || 0), 0) / evaluatedChapters.length
            : 0;

        const revisiongradeOverall = spineEvaluation.overallScore && avgChapterScore
            ? (0.5 * spineEvaluation.overallScore + 0.5 * avgChapterScore)
            : spineEvaluation.overallScore || avgChapterScore;

        // Mark manuscript as ready
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            status: 'ready',
            revisiongrade_overall: revisiongradeOverall,
            revisiongrade_breakdown: {
                spine_score: adjustedSpineScore,
                average_chapter_score: avgChapterScore,
                chapters_evaluated: evaluatedChapters.length,
                chapters_total: chapters.length,
                integrity_report: integrity,
                integrity_clean: integrity.is_clean,
                evaluation_mode: evaluationMode,
                integrity_penalty_applied: integrityPenalty
            },
            evaluation_progress: {
                chapters_total: chapters.length,
                chapters_summarized: chapters.length,
                chapters_wave_done: evaluatedChapters.length,
                current_phase: 'finalize',
                percent_complete: 100,
                current_step: 'Evaluation complete',
                last_updated: new Date().toISOString()
            }
        });

        console.log(`✅ Evaluation complete for manuscript ${manuscriptId}`);

    } catch (error) {
        console.error('❌ Evaluation error for manuscript', manuscriptId, ':', error);
        
        // Update manuscript status to show error
        try {
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                status: 'failed',
                evaluation_progress: {
                    current_step: `Error: ${error.message}`,
                    error_message: error.message,
                    last_updated: new Date().toISOString()
                }
            });
        } catch (updateError) {
            console.error('Failed to update error status:', updateError);
        }
    }
}

// HTTP Handler - Returns immediately, runs evaluation in background
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { manuscript_id } = await req.json();

        if (!manuscript_id) {
            return Response.json({ error: 'Manuscript ID required' }, { status: 400 });
        }

        // Verify manuscript exists
        const [manuscript] = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscript_id });
        
        if (!manuscript) {
            return Response.json({ error: 'Manuscript not found' }, { status: 404 });
        }

        // Start evaluation in background (don't await)
        runEvaluation(manuscript_id, base44).catch(err => {
            console.error('Background evaluation failed:', err);
        });

        // Return immediately with job started status
        return Response.json({ 
            success: true,
            message: 'Evaluation started',
            manuscript_id: manuscript_id,
            note: 'Evaluation is running in the background. Refresh the page to check progress.'
        });

    } catch (error) {
        console.error('API error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});