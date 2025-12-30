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

        // IMMEDIATE PROGRESS KICK - Show 1% so bar moves instantly
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            status: 'summarizing',
            evaluation_progress: {
                chapters_total: chapters.length,
                chapters_summarized: 0,
                chapters_wave_done: 0,
                current_phase: 'summarize',
                percent_complete: 1,
                current_step: 'Starting evaluation...',
                last_updated: new Date().toISOString()
            }
        });

        // PHASE 0: INTEGRITY CHECK (NEW - prevents V3 contamination)
        const integrityCheck = await base44.asServiceRole.functions.invoke('checkManuscriptIntegrity', {
            text: manuscript.full_text,
            manuscript_id: manuscriptId
        });

        const integrity = integrityCheck.data.integrity;
        
        // Store integrity report
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            evaluation_progress: {
                chapters_total: chapters.length,
                chapters_summarized: 0,
                chapters_wave_done: 0,
                current_phase: 'summarize',
                percent_complete: 3,
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

                // Show "starting chapter X" progress
                const startPercent = Math.floor((chapterSummaries.length / chapters.length) * 25) + 1;
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapterSummaries.length,
                        chapters_wave_done: 0,
                        current_phase: 'summarize',
                        percent_complete: startPercent,
                        current_step: `Summarizing Chapter ${i + 1} of ${chapters.length}...`,
                        last_updated: new Date().toISOString()
                    }
                });

                const summaryPrompt = `You are a professional developmental editor. Produce accurate structural summaries.

CRITICAL RULES (NON-NEGOTIABLE):
1. NO INVENTION. Use only information present in the text.
2. NO REWRITING. Summarize, do not revise prose.
3. PRESERVE AUTHENTICITY. Keep technical terminology, proper nouns, ranks as-is.
4. NO HALLUCINATION. Do not claim events/details that aren't in the text.

TASK: Create a structural chapter summary for later whole-book 'spine' evaluation.

SUMMARY REQUIREMENTS:
- 200–300 words, focused on plot movement, character change, stakes, unresolved hooks
- Use neutral, specific language
- If chapter boundaries/names unclear, mark uncertainty in 'notes'

CHAPTER TEXT:
${chapter.text}`;

                // Show "processing chapter X" progress during LLM call
                const processingPercent = Math.floor((chapterSummaries.length / chapters.length) * 25) + 2;
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: chapters.length,
                        chapters_summarized: chapterSummaries.length,
                        chapters_wave_done: 0,
                        current_phase: 'summarize',
                        percent_complete: processingPercent,
                        current_step: `Processing Chapter ${i + 1} summary (analyzing structure, beats, stakes)...`,
                        last_updated: new Date().toISOString()
                    }
                });

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

        const spinePrompt = `You are a literary agent–style evaluator and developmental editor. Evaluate the manuscript's narrative architecture using chapter summaries.

CRITICAL RULES (NON-NEGOTIABLE):
1. NO INVENTION. Judge only what's in the summaries.
2. NO HALLUCINATION. Do not reference scenes/events not present.
3. DOCUMENT IDENTITY: Extract 3 anchors (names, locations, events) and verify consistency.
4. CITE SOURCES. Reference specific chapter indices (e.g., 'Ch. 7–9').
5. PRESERVE VOICE. Respect author's authority, genre conventions, technical authenticity.

EVALUATION MODE: This is diagnostic assessment, not rewriting guidance.

TASK: Using the provided chapter summary objects (not raw prose), produce a whole-manuscript 'Spine Evaluation' and score the manuscript on 12 agent criteria (1–10).

SCORING GUIDELINES:
- Scores must be integers 1–10
- Provide concise, actionable rationale per criterion (3–6 sentences)
- Do not mention token limits or summarization
- Flag what weakens submission readiness, honor what strengthens authority

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
        // Reload chapters to get fresh status after summaries/spine
        const freshChapters = await base44.asServiceRole.entities.Chapter.filter({ manuscript_id: manuscriptId }, 'order');
        
        console.log(`🔍 PHASE 3 START: ${freshChapters.length} chapters to evaluate`);
        console.log(`Chapter statuses:`, freshChapters.map(ch => ({ title: ch.title, status: ch.status, has_score: !!ch.evaluation_score })));

        const MAX_RETRIES = 2;
        const WAVE_MAX_RETRIES = 2; // Hard cap for WAVE-specific failures

        for (let i = 0; i < freshChapters.length; i++) {
            console.log(`📖 Processing chapter ${i + 1}/${freshChapters.length}: ${freshChapters[i].title}`);

            const chapter = freshChapters[i];

            // Skip if already evaluated
            if (chapter.status === 'evaluated' && chapter.evaluation_score) {
                console.log(`Chapter ${i + 1} already evaluated, skipping`);
                continue;
            }

            // Check retry count and handle exceeded retries
            const retryCount = chapter.retry_count || 0;

            // If stuck in evaluating or failed AND exceeded retries, mark as permanently failed
            if ((chapter.status === 'evaluating' || chapter.status === 'failed') && retryCount >= MAX_RETRIES) {
                console.log(`Chapter ${i + 1} exceeded retry limit (${retryCount} attempts), marking as permanently failed`);
                await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                    status: 'failed',
                    error_message: `Exceeded retry limit (${MAX_RETRIES} attempts) - chapter evaluation incomplete`
                });

                // Count this as "done" so we can move on
                const wavePercent = 40 + Math.floor(((i + 1) / freshChapters.length) * 50);
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: freshChapters.length,
                        chapters_summarized: freshChapters.length,
                        chapters_wave_done: i + 1,
                        current_phase: 'wave',
                        percent_complete: wavePercent,
                        current_step: `Chapter ${i + 1} permanently failed after ${MAX_RETRIES} retries`,
                        last_updated: new Date().toISOString()
                    }
                });
                continue;
            }

            // Retry loop for this chapter's evaluation
            let evaluationSuccess = false;
            let agentAnalysis = null;
            let waveAnalysis = null;
            let waveErrors = [];

            for (let attempt = 0; attempt < MAX_RETRIES && !evaluationSuccess; attempt++) {
                try {
                    console.log(`Chapter ${i + 1} evaluation attempt ${attempt + 1}/${MAX_RETRIES}`);

                    await base44.asServiceRole.entities.Chapter.update(chapter.id, { 
                        status: 'evaluating',
                        error_message: null,
                        retry_count: attempt
                    });

                // Update progress - starting chapter evaluation
                const wavePercent = 40 + Math.floor((i / freshChapters.length) * 50);
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: freshChapters.length,
                        chapters_summarized: freshChapters.length,
                        chapters_wave_done: i,
                        current_phase: 'wave',
                        percent_complete: wavePercent,
                        current_step: `Evaluating Chapter ${i + 1}: ${chapter.title} (attempt ${attempt + 1}/${MAX_RETRIES})`,
                        last_updated: new Date().toISOString()
                    }
                });

                // Show "Running agent analysis" progress
                await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: freshChapters.length,
                        chapters_summarized: freshChapters.length,
                        chapters_wave_done: i,
                        current_phase: 'wave',
                        percent_complete: wavePercent + 1,
                        current_step: `Chapter ${i + 1}: Deep story analysis (attempt ${attempt + 1})...`,
                        last_updated: new Date().toISOString()
                    }
                });

            // Timeout wrapper for LLM calls
            const withTimeout = (promise, timeoutMs = 120000, label = 'Operation') => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs/1000}s`)), timeoutMs)
                    )
                ]);
            };

            // Story Evaluation (Agents, Editors, Script Readers) - 2 minute timeout
            agentAnalysis = await withTimeout(
                base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: `You are a professional evaluator (agent/editor/script reader). Analyze this chapter against the 12 Story Evaluation Criteria.

CRITICAL EVALUATION RULES (NON-NEGOTIABLE):
1. NO HALLUCINATION. Quote only text that exists. Do not invent examples.
2. DOCUMENT IDENTITY. Extract 3 anchors (character names, key events, setting details) to verify you're evaluating the correct text.
3. RESPECT PROTECTED ZONES:
   - Do not penalize operational authenticity (orders, briefings, technical procedures)
   - Do not penalize genre-appropriate jargon or specialized terminology
   - Do not flag proper nouns, ranks, units as "unclear" without cause
4. PRESERVE VOICE. Honor author's authority, lived experience, and narrative choices.
5. EVIDENCE-BASED. Every weakness must cite specific text; every strength must show proof.

12 STORY EVALUATION CRITERIA (rate each 1-10):
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
                    }),
                    120000,
                    'Agent Analysis'
                    );

                    // WAVE Revision System evaluation - SPLIT INTO THREE TIERS
                    waveErrors = [];
                    let earlyWaveScore = 0;
                    let midWaveScore = 0;
                    let lateWaveScore = 0;
                    let allWaveHits = [];

                    // TIER 1: EARLY WAVES (Structural Truth) - 60s timeout
                    try {
                        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                            evaluation_progress: {
                                chapters_total: freshChapters.length,
                                chapters_summarized: freshChapters.length,
                                chapters_wave_done: i,
                                current_phase: 'wave',
                                percent_complete: wavePercent + 2,
                                current_step: `Chapter ${i + 1}: Early WAVE (Structural) - attempt ${attempt + 1}`,
                                last_updated: new Date().toISOString()
                            }
                        });

                        const earlyWave = await withTimeout(
                            base44.asServiceRole.integrations.Core.InvokeLLM({
                                prompt: `You are an elite developmental editor. Analyze EARLY TIER structural issues only.

EARLY TIER CHECKS (Structural Truth):
- POV Honesty (Wave 2): No mind-reading, observable proof only
- Concrete Stakes (Wave 17): What's at risk if this fails?
- Character Consistency (Wave 36): Voice logic maintained?

CHAPTER: ${chapter.title}
TEXT: ${chapter.text}

For each issue: category, severity, description, example_quote, fix_suggestion.
Provide: score (1-10), criticalIssues, strengthAreas, waveHits.`,
                                response_json_schema: {
                                    type: "object",
                                    properties: {
                                        score: { type: "number" },
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
                                    required: ["score", "criticalIssues", "strengthAreas", "waveHits"]
                                }
                            }),
                            60000,
                            'Early WAVE'
                        );
                        earlyWaveScore = earlyWave.score;
                        allWaveHits.push(...earlyWave.waveHits);
                    } catch (error) {
                        console.error('Early WAVE failed:', error.message);
                        waveErrors.push({ tier: 'early', error: error.message });
                        earlyWaveScore = agentAnalysis.overallScore; // fallback
                    }

                    // TIER 2: MID WAVES (Momentum & Meaning) - 60s timeout
                    try {
                        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                            evaluation_progress: {
                                chapters_total: freshChapters.length,
                                chapters_summarized: freshChapters.length,
                                chapters_wave_done: i,
                                current_phase: 'wave',
                                percent_complete: wavePercent + 4,
                                current_step: `Chapter ${i + 1}: Mid WAVE (Craft) - attempt ${attempt + 1}`,
                                last_updated: new Date().toISOString()
                            }
                        });

                        const midWave = await withTimeout(
                            base44.asServiceRole.integrations.Core.InvokeLLM({
                                prompt: `You are an elite developmental editor. Analyze MID TIER craft issues only.

MID TIER CHECKS (Momentum & Meaning):
- Generic Nouns (Wave 3): Replace "room," "thing," "place" with specificity
- Filter Verbs (Wave 4): Remove "I saw/felt/heard" distance
- Adverb Diet (Wave 5): Weak verbs propped up by adverbs?
- Active Voice (Wave 6): Restore agency, name actors
- Negation Discipline (Wave 7): Say what happened, not what didn't
- Dialogue Tags (Wave 13): Over-attribution bloat?

CHAPTER: ${chapter.title}
TEXT: ${chapter.text}

For each issue: category, severity, description, example_quote, fix_suggestion.
Provide: score (1-10), criticalIssues, strengthAreas, waveHits.`,
                                response_json_schema: {
                                    type: "object",
                                    properties: {
                                        score: { type: "number" },
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
                                    required: ["score", "criticalIssues", "strengthAreas", "waveHits"]
                                }
                            }),
                            60000,
                            'Mid WAVE'
                        );
                        midWaveScore = midWave.score;
                        allWaveHits.push(...midWave.waveHits);
                    } catch (error) {
                        console.error('Mid WAVE failed:', error.message);
                        waveErrors.push({ tier: 'mid', error: error.message });
                        midWaveScore = agentAnalysis.overallScore; // fallback
                    }

                    // TIER 3: LATE WAVES (Authority & Polish) - 60s timeout
                    try {
                        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                            evaluation_progress: {
                                chapters_total: freshChapters.length,
                                chapters_summarized: freshChapters.length,
                                chapters_wave_done: i,
                                current_phase: 'wave',
                                percent_complete: wavePercent + 6,
                                current_step: `Chapter ${i + 1}: Late WAVE (Polish) - attempt ${attempt + 1}`,
                                last_updated: new Date().toISOString()
                            }
                        });

                        const lateWave = await withTimeout(
                            base44.asServiceRole.integrations.Core.InvokeLLM({
                                prompt: `You are an elite developmental editor. Analyze LATE TIER polish issues only.

LATE TIER CHECKS (Authority & Polish):
- Body-Part Clichés (Wave 1): Jaw/chest/eyes that don't change action
- Abstract Triples (Wave 8): Two beats sharpen, three soften
- Motif Hygiene (Wave 9): Spotlight once per section
- On-the-Nose Explanations (Wave 15): Cut "because," "which meant"
- Reflexive Redundancy (Wave 61): himself/herself/own/just without function

CHAPTER: ${chapter.title}
TEXT: ${chapter.text}

For each issue: category, severity, description, example_quote, fix_suggestion.
Provide: score (1-10), criticalIssues, strengthAreas, waveHits.`,
                                response_json_schema: {
                                    type: "object",
                                    properties: {
                                        score: { type: "number" },
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
                                    required: ["score", "criticalIssues", "strengthAreas", "waveHits"]
                                }
                            }),
                            60000,
                            'Late WAVE'
                        );
                        lateWaveScore = lateWave.score;
                        allWaveHits.push(...lateWave.waveHits);
                    } catch (error) {
                        console.error('Late WAVE failed:', error.message);
                        waveErrors.push({ tier: 'late', error: error.message });
                        lateWaveScore = agentAnalysis.overallScore; // fallback
                    }

                    // Aggregate WAVE results
                    const avgWaveScore = (earlyWaveScore + midWaveScore + lateWaveScore) / 3;
                    waveAnalysis = {
                        waveScore: avgWaveScore,
                        criticalIssues: waveErrors.length > 0 ? waveErrors.map(e => `${e.tier} tier: ${e.error}`) : [],
                        strengthAreas: [],
                        waveHits: allWaveHits,
                        partial: waveErrors.length > 0,
                        tiered_scores: { early: earlyWaveScore, mid: midWaveScore, late: lateWaveScore }
                    };



                    // Combined score: 50% agent + 50% WAVE (apply integrity penalty)
                    const rawCombinedScore = (agentAnalysis.overallScore * 0.5) + (waveAnalysis.waveScore * 0.5);
                    const combinedScore = Math.max(0, rawCombinedScore - integrityPenalty);

                    // Update chapter with results
                    console.log(`✅ Chapter ${i + 1} evaluation complete: Agent=${agentAnalysis.overallScore}, WAVE=${waveAnalysis.waveScore}, Combined=${combinedScore}`);
                    
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
                        evaluation_mode: evaluationMode,
                        wave_errors: waveErrors.length > 0 ? waveErrors : undefined,
                        partial_wave: waveAnalysis.partial || false,
                        attempts: attempt + 1
                    },
                    wave_results_json: waveAnalysis,
                    status: 'evaluated',
                    error_message: waveErrors.length > 0 
                        ? `Completed with ${waveErrors.length} WAVE check(s) skipped due to timeout` 
                        : null
                    });
                    
                    console.log(`💾 Chapter ${i + 1} saved with status='evaluated'`);

                    // Update progress after successful evaluation
                    const finalWavePercent = 40 + Math.floor(((i + 1) / freshChapters.length) * 50);
                    const stepMessage = waveErrors.length > 0 
                    ? `Evaluated ${i + 1}/${freshChapters.length} chapters (${waveErrors.length} WAVE check(s) skipped)`
                    : `Evaluated ${i + 1}/${freshChapters.length} chapters`;

                    await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                    evaluation_progress: {
                        chapters_total: freshChapters.length,
                        chapters_summarized: freshChapters.length,
                        chapters_wave_done: i + 1,
                        current_phase: 'wave',
                        percent_complete: finalWavePercent,
                        current_step: stepMessage,
                        last_updated: new Date().toISOString()
                    }
                    });

                    evaluationSuccess = true;
                    break; // Success, exit retry loop

                    } catch (error) {
                    console.error(`Chapter ${i + 1} evaluation attempt ${attempt + 1} failed:`, error);

                    // If this was the last attempt, mark chapter as failed
                    if (attempt === MAX_RETRIES - 1) {
                    await base44.asServiceRole.entities.Chapter.update(chapter.id, {
                        status: 'failed',
                        error_message: `All ${MAX_RETRIES} attempts failed: ${error.message}`,
                        retry_count: MAX_RETRIES
                    });

                    // Always move progress forward
                    const failWavePercent = 40 + Math.floor(((i + 1) / freshChapters.length) * 50);
                    await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                        evaluation_progress: {
                            chapters_total: freshChapters.length,
                            chapters_summarized: freshChapters.length,
                            chapters_wave_done: i + 1,
                            current_phase: 'wave',
                            percent_complete: failWavePercent,
                            current_step: `Chapter ${i + 1} failed after ${MAX_RETRIES} attempts, continuing...`,
                            last_updated: new Date().toISOString()
                        }
                    });
                    }
                    // Otherwise, loop will retry
                    }
                    } // End retry loop
                    }

        // PHASE 4: Final composite scoring
        // Reload all chapters to get final status
        const finalChapters = await base44.asServiceRole.entities.Chapter.filter({ 
            manuscript_id: manuscriptId 
        }, 'order');
        
        const evaluatedChapters = finalChapters.filter(ch => ch.status === 'evaluated');
        const failedChapters = finalChapters.filter(ch => ch.status === 'failed');

        // Force-fail any chapters still stuck in intermediate states
        const stuckChapters = finalChapters.filter(ch => 
            ch.status !== 'evaluated' && ch.status !== 'failed'
        );
        
        for (const stuck of stuckChapters) {
            console.log(`Force-failing stuck chapter: ${stuck.title} (status: ${stuck.status})`);
            await base44.asServiceRole.entities.Chapter.update(stuck.id, {
                status: 'failed',
                error_message: `Chapter evaluation incomplete - forced cleanup`
            });
            failedChapters.push(stuck);
        }

        const avgChapterScore = evaluatedChapters.length > 0
            ? evaluatedChapters.reduce((sum, ch) => sum + (ch.evaluation_score || 0), 0) / evaluatedChapters.length
            : 0;

        const revisiongradeOverall = manuscript.spine_score && avgChapterScore
            ? (0.5 * manuscript.spine_score + 0.5 * avgChapterScore)
            : manuscript.spine_score || avgChapterScore;
        
        const hasFailures = failedChapters.length > 0;
        const completionStatus = hasFailures ? 'ready_with_errors' : 'ready';
        const completionMessage = hasFailures 
            ? `Evaluation complete (${failedChapters.length} chapter(s) failed)`
            : 'Evaluation complete';

        console.log(`Finalizing manuscript: ${evaluatedChapters.length} evaluated, ${failedChapters.length} failed, ${finalChapters.length} total`);

        // Mark manuscript as ready (even with failures) - use finalChapters.length for accurate total
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            status: completionStatus,
            revisiongrade_overall: revisiongradeOverall,
            revisiongrade_breakdown: {
                spine_score: manuscript.spine_score,
                average_chapter_score: avgChapterScore,
                chapters_evaluated: evaluatedChapters.length,
                chapters_failed: failedChapters.length,
                chapters_total: finalChapters.length,
                integrity_report: integrity,
                integrity_clean: integrity.is_clean,
                evaluation_mode: evaluationMode,
                integrity_penalty_applied: integrityPenalty
            },
            evaluation_progress: {
                chapters_total: finalChapters.length,
                chapters_summarized: finalChapters.length,
                chapters_wave_done: finalChapters.length,
                current_phase: 'finalize',
                percent_complete: 100,
                current_step: completionMessage,
                last_updated: new Date().toISOString(),
                has_failures: hasFailures,
                failed_chapters: failedChapters.map(ch => ({ id: ch.id, title: ch.title, error: ch.error_message }))
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