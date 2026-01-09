import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.6';
import { captureError, captureCritical } from './utils/errorTracking.js';
import { withTimeoutAndRetry } from './utils/retryLogic.js';
import OpenAI from 'npm:openai@4.76.1';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
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

// JOB HANDLER: Evaluate chapter with agent criteria
async function evaluateChapterAgent(chapter, base44, evaluationMode) {
    const modeGuidance = evaluationMode === 'transgressive' ? `

TRANSGRESSIVE MODE ACTIVE (Critical Override):
- ASSUME INTENT: Violence, offensive language, disturbing imagery, moral darkness are CRAFT CHOICES, not errors
- DO NOT PENALIZE: Extremity, shock, discomfort, moral ambiguity, provocative content
- EVALUATE: Narrative control, thematic function, psychological precision, character logic consistency
- FLAG ONLY IF: Repetitive without escalation, contradicts internal logic, weakens character integrity, unintentional parody
- QUESTION: "Is this precise and controlled?" NOT "Is this appropriate or offensive?"
- PRESERVE: Dark voice, extremity, authorial control, transgressive aesthetic
` : evaluationMode === 'trauma_memoir' ? `

TRAUMA MEMOIR MODE ACTIVE (Critical Override):
- TREAT AS TESTIMONY: Content reflects survivor experience, not gratuitous choice
- DO NOT PENALIZE: Difficult/disturbing content, embodied sensory detail, psychological accuracy
- EVALUATE: Authenticity, coherence, therapeutic/narrative function
- FLAG ONLY IF: Exploitation framing, invented details, breaks psychological truth
- PRESERVE: Survivor voice, embodied truth, sensory accuracy
` : '';

    const agentAnalysis = await withTimeout(
        (async () => {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: `You are a professional evaluator (agent/editor/script reader). Analyze this chapter against the 12 Story Evaluation Criteria.

CRITICAL EVALUATION RULES (NON-NEGOTIABLE):
1. NO HALLUCINATION. Quote only text that exists. Do not invent examples.
2. DOCUMENT IDENTITY. Extract 3 anchors (character names, key events, setting details) to verify you're evaluating the correct text.
3. RESPECT PROTECTED ZONES:
   - Do not penalize operational authenticity (orders, briefings, technical procedures)
   - Do not penalize genre-appropriate jargon or specialized terminology
   - Do not flag proper nouns, ranks, units as "unclear" without cause
4. PRESERVE VOICE. Honor author's authority, lived experience, and narrative choices.
5. EVIDENCE-BASED. Every weakness must cite specific text; every strength must show proof.
${modeGuidance}

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
Provide overall score (1-10) and verdict.` }],
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "agent_analysis",
                        strict: true,
                        schema: {
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
                                        required: ["name", "score", "strengths", "weaknesses", "notes"],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ["overallScore", "verdict", "criteria"],
                            additionalProperties: false
                        }
                    }
                }
            });
            return JSON.parse(response.choices[0].message.content);
        })(),
        120000,
        'Agent Analysis'
    );
    return agentAnalysis;
}

// JOB HANDLER: Evaluate chapter WAVE tier
async function evaluateChapterWaveTier(chapter, tier, base44, evaluationMode) {
    const modePrefix = evaluationMode === 'transgressive' ? `

TRANSGRESSIVE MODE: Extremity is intentional craft. Evaluate precision, not politeness.
- Do NOT flag: violence, offensive language, disturbing content, moral darkness
- Flag ONLY: repetitive shock, contradicts logic, weakens character, unintentional parody
` : evaluationMode === 'trauma_memoir' ? `

TRAUMA MEMOIR MODE: Treat as survivor testimony. Respect embodied truth.
- Do NOT flag: difficult content, sensory detail, psychological accuracy
- Flag ONLY: exploitation, invented details, tonal breaks
` : '';

    const tierConfig = {
        early: {
            prompt: `You are an elite developmental editor. Analyze EARLY TIER structural issues only.
        ${modePrefix}
        EARLY TIER CHECKS (Structural Truth):
        - POV Honesty (Wave 2): No mind-reading, observable proof only
        - Concrete Stakes (Wave 17): What's at risk if this fails?
        - Character Consistency (Wave 36): Voice logic maintained?

        CHAPTER: ${chapter.title}
        TEXT: ${chapter.text}

For each issue: category, severity, description, example_quote, fix_suggestion.
Provide: score (1-10), criticalIssues, strengthAreas, waveHits.`,
            timeout: 60000
        },
        mid: {
            prompt: `You are an elite developmental editor. Analyze MID TIER craft issues only.
        ${modePrefix}
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
            timeout: 60000
        },
        late: {
            prompt: `You are an elite developmental editor. Analyze LATE TIER polish issues only.
        ${modePrefix}
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
            timeout: 60000
        }
    };

    const config = tierConfig[tier];
    const waveResult = await withTimeout(
        (async () => {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: config.prompt }],
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "wave_analysis",
                        strict: true,
                        schema: {
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
                                        required: ["category", "severity", "description", "example_quote", "fix_suggestion"],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ["score", "criticalIssues", "strengthAreas", "waveHits"],
                            additionalProperties: false
                        }
                    }
                }
            });
            return JSON.parse(response.choices[0].message.content);
        })(),
        config.timeout,
        `${tier.toUpperCase()} WAVE`
    );
    return waveResult;
}

// JOB HANDLER: Aggregate chapter results and finalize
async function aggregateChapterResults(chapter, agentAnalysis, waveScores, waveHits, waveErrors, integrity, integrityPenalty, evaluationMode, base44, evaluationRunId, finalStatus = 'evaluated') {
    const avgWaveScore = (waveScores.early + waveScores.mid + waveScores.late) / 3;
    const waveAnalysis = {
        waveScore: avgWaveScore,
        criticalIssues: waveErrors.length > 0 ? waveErrors.map(e => `${e.tier} tier: ${e.error}`) : [],
        strengthAreas: [],
        waveHits: waveHits,
        partial: waveErrors.length > 0,
        tiered_scores: waveScores
    };

    const rawCombinedScore = (agentAnalysis.overallScore * 0.5) + (waveAnalysis.waveScore * 0.5);
    const combinedScore = Math.max(0, rawCombinedScore - integrityPenalty);

    // CREATE GOVERNED SEGMENT (with stable identity)
    const criteriaScores = {};
    agentAnalysis.criteria?.forEach(c => {
        const key = c.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'unknown';
        criteriaScores[key] = c.score;
    });

    await base44.asServiceRole.entities.EvaluationSegment.create({
        runId: evaluationRunId,
        segmentIndex: chapter.order,
        segmentStableId: chapter.id,
        segmentLabel: chapter.title || `Chapter ${chapter.order}`,
        segmentStartOffset: 0,
        segmentEndOffset: chapter.text.length,
        segmentWordCount: chapter.word_count,
        criteriaScores,
        criteriaNotes: agentAnalysis.criteria?.map(c => ({
            name: c.name,
            strengths: c.strengths,
            weaknesses: c.weaknesses,
            notes: c.notes
        })) || [],
        waveSubstrate: {
            waveScore: avgWaveScore,
            waveHits,
            tieredScores: waveScores
        },
        compressedSummary: JSON.stringify(chapter.summary_json || {})
    });

    // LEGACY WRITE (DUAL-WRITE DURING MIGRATION)
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
            partial_wave: waveAnalysis.partial || false
        },
        wave_results_json: waveAnalysis,
        wave_scores: {
            early: waveScores.early,
            mid: waveScores.mid,
            late: waveScores.late,
            combined: waveAnalysis.waveScore
        },
        status: finalStatus,
        wave_status: finalStatus,
        wave_completed_at: new Date().toISOString(),
        error_message: waveErrors.length > 0 
            ? `Completed with ${waveErrors.length} tier(s) failed/timeout` 
            : null
    });

    return { combinedScore, waveAnalysis };
}

// PARALLEL CHAPTER EVALUATOR
async function evaluateChapterParallel(chapter, chapterIndex, totalChapters, manuscriptId, summarizedCount, base44, integrity, integrityPenalty, evaluationMode, MAX_RETRIES) {
    console.log(`📖 Processing chapter ${chapterIndex + 1}/${totalChapters}: ${chapter.title}`, {
        status: chapter.status,
        wave_status: chapter.wave_status,
        has_score: !!chapter.evaluation_score
    });

    // Skip if WAVE already evaluated
    if (chapter.wave_status === 'evaluated' && chapter.evaluation_score) {
        console.log(`Chapter ${chapterIndex + 1} WAVE already evaluated, skipping`);
        return { success: true, skipped: true };
    }

    // Check retry count
    const retryCount = chapter.retry_count || 0;
    if ((chapter.status === 'evaluating' || chapter.status === 'failed') && retryCount >= MAX_RETRIES) {
        console.log(`Chapter ${chapterIndex + 1} exceeded retry limit (${retryCount} attempts), marking as permanently failed`);
        await base44.asServiceRole.entities.Chapter.update(chapter.id, {
            status: 'failed',
            wave_status: 'failed',
            error_message: `Exceeded retry limit (${MAX_RETRIES} attempts) - chapter evaluation incomplete`
        });
        return { success: false, exceeded_retries: true };
    }

    // Mark as running with per-tier status tracking
    try {
        await base44.asServiceRole.entities.Chapter.update(chapter.id, { 
            status: 'evaluating',
            wave_status: 'running',
            wave_started_at: new Date().toISOString(),
            wave_progress: { tier: 'early', completed_tiers: [] },
            agent_status: 'queued',
            early_status: 'queued',
            mid_status: 'queued',
            late_status: 'queued',
            error_message: null,
            retry_count: retryCount
        });
        console.log(`💾 Chapter ${chapterIndex + 1} marked wave_status='running'`);
    } catch (saveError) {
        console.error(`❌ CRITICAL: Failed to save wave_status='running' for chapter ${chapterIndex + 1}:`, saveError);
        await base44.asServiceRole.entities.Chapter.update(chapter.id, {
            wave_status: 'failed',
            wave_error: `Save failure: ${saveError.message}`,
            wave_completed_at: new Date().toISOString()
        });
        throw new Error(`Save failure before WAVE start: ${saveError.message}`);
    }

    try {
        // Update progress
        const wavePercent = 40 + Math.floor((chapterIndex / totalChapters) * 50);
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            evaluation_progress: {
                chapters_total: totalChapters,
                chapters_summarized: summarizedCount,
                chapters_wave_done: chapterIndex,
                current_phase: 'wave',
                percent_complete: wavePercent + 1,
                current_step: `Chapter ${chapterIndex + 1}: Running analysis...`,
                last_updated: new Date().toISOString()
            }
        });

        // FAIL-SOFT: Run Agent Analysis and WAVE tiers in parallel (Agent won't block WAVE)
        await base44.asServiceRole.entities.Chapter.update(chapter.id, { agent_status: 'running' });
        
        const [agentResult, earlyResult, midResult, lateResult] = await Promise.allSettled([
            evaluateChapterAgent(chapter, base44, evaluationMode),
            (async () => {
                await base44.asServiceRole.entities.Chapter.update(chapter.id, { early_status: 'running' });
                return evaluateChapterWaveTier(chapter, 'early', base44, evaluationMode);
            })(),
            (async () => {
                await base44.asServiceRole.entities.Chapter.update(chapter.id, { mid_status: 'running' });
                return evaluateChapterWaveTier(chapter, 'mid', base44, evaluationMode);
            })(),
            (async () => {
                await base44.asServiceRole.entities.Chapter.update(chapter.id, { late_status: 'running' });
                return evaluateChapterWaveTier(chapter, 'late', base44, evaluationMode);
            })()
        ]);

        // Save per-tier statuses
        await base44.asServiceRole.entities.Chapter.update(chapter.id, {
            agent_status: agentResult.status === 'fulfilled' ? 'succeeded' : 'failed',
            early_status: earlyResult.status === 'fulfilled' ? 'succeeded' : 'failed',
            mid_status: midResult.status === 'fulfilled' ? 'succeeded' : 'failed',
            late_status: lateResult.status === 'fulfilled' ? 'succeeded' : 'failed'
        });

        // Use agent result if available, fallback if failed
        const agentAnalysis = agentResult.status === 'fulfilled' 
            ? agentResult.value 
            : { overallScore: 5, verdict: 'Agent analysis timed out', criteria: [] };

        // Collect results and errors (add agent errors too)
        const waveScores = {
            early: earlyResult.status === 'fulfilled' ? earlyResult.value.score : agentAnalysis.overallScore,
            mid: midResult.status === 'fulfilled' ? midResult.value.score : agentAnalysis.overallScore,
            late: lateResult.status === 'fulfilled' ? lateResult.value.score : agentAnalysis.overallScore
        };

        const waveHits = [
            ...(earlyResult.status === 'fulfilled' ? earlyResult.value.waveHits : []),
            ...(midResult.status === 'fulfilled' ? midResult.value.waveHits : []),
            ...(lateResult.status === 'fulfilled' ? lateResult.value.waveHits : [])
        ];

        const waveErrors = [
            ...(agentResult.status === 'rejected' ? [{ tier: 'agent', error: agentResult.reason.message }] : []),
            ...(earlyResult.status === 'rejected' ? [{ tier: 'early', error: earlyResult.reason.message }] : []),
            ...(midResult.status === 'rejected' ? [{ tier: 'mid', error: midResult.reason.message }] : []),
            ...(lateResult.status === 'rejected' ? [{ tier: 'late', error: lateResult.reason.message }] : [])
        ];

        // Determine final status: evaluated if most tiers passed, partial if some failed
        const successCount = [agentResult, earlyResult, midResult, lateResult].filter(r => r.status === 'fulfilled').length;
        const finalStatus = successCount >= 3 ? 'evaluated' : successCount >= 1 ? 'partial' : 'failed';

        // Get evaluationRunId from manuscript context (passed through)
        const [currentManuscript] = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscriptId });
        const evaluationRunId = currentManuscript._current_evaluation_run_id;

        // Get evaluationRunId from manuscript context
        const [currentManuscript] = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscriptId });
        const evaluationRunId = currentManuscript._current_evaluation_run_id;

        // Aggregate and save with final status
        await aggregateChapterResults(chapter, agentAnalysis, waveScores, waveHits, waveErrors, integrity, integrityPenalty, evaluationMode, base44, evaluationRunId, finalStatus);

        console.log(`✅ Chapter ${chapterIndex + 1} evaluation complete (${finalStatus})`);
        return { success: true, status: finalStatus };

    } catch (error) {
        console.error(`Chapter ${chapterIndex + 1} evaluation failed:`, error);
        await base44.asServiceRole.entities.Chapter.update(chapter.id, {
            status: 'failed',
            wave_status: 'failed',
            wave_error: error.message,
            wave_completed_at: new Date().toISOString(),
            error_message: `Evaluation failed: ${error.message}`,
            retry_count: retryCount + 1
        });
        throw error;
    }
}

// Background evaluation runner
async function runEvaluation(manuscriptId) {
    // Create fresh service role client for background execution
    const base44 = createClient(
        Deno.env.get('BASE44_API_URL'),
        Deno.env.get('BASE44_APP_ID'),
        { serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY') }
    );
    
    try {
        // Get manuscript
        const [manuscript] = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscriptId });
        
        if (!manuscript) {
            throw new Error('Manuscript not found');
        }

        // Get chapters - if none exist, split the manuscript first
        let chapters = await base44.asServiceRole.entities.Chapter.filter({ manuscript_id: manuscriptId }, 'order');
        
        if (chapters.length === 0) {
            console.log(`📄 No chapters found, splitting manuscript first...`);
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                status: 'splitting',
                evaluation_progress: {
                    current_step: 'Splitting manuscript into chapters...',
                    percent_complete: 1,
                    last_updated: new Date().toISOString()
                }
            });
            
            // Invoke splitManuscript and wait for it
            await base44.asServiceRole.functions.invoke('splitManuscript', { 
                manuscript_id: manuscriptId 
            });
            
            // Reload chapters after split
            chapters = await base44.asServiceRole.entities.Chapter.filter({ manuscript_id: manuscriptId }, 'order');
            
            if (chapters.length === 0) {
                throw new Error('Failed to split manuscript into chapters');
            }
            
            console.log(`✅ Split complete: ${chapters.length} chapters created`);
        }

        // CREATE GOVERNED RUN (IMMUTABLE BOUNDARY)
        const inputFingerprintHash = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(manuscript.full_text)
        ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

        const evaluationRun = await base44.asServiceRole.entities.EvaluationRun.create({
            projectId: manuscriptId,
            workTypeUi: 'manuscript',
            sourceFileId: manuscriptId,
            sourceFilename: manuscript.title || 'untitled',
            sourceWordCountEstimate: manuscript.word_count || 0,
            inputFingerprintHash,
            segmentationMode: 'auto',
            segmentationUserConfirmed: true,
            phase2Enabled: true,
            readinessFloor: 8.0,
            coverageMinChapters: 5,
            coverageMinWordPct: 0.25,
            governanceVersion: 'EVAL_METHOD_v1.0.0',
            allowRawTextInPhase2: false,
            phase2ReadOnlyScores: true,
            status: 'created'
        });

        console.log(`🔐 GOVERNED_RUN_CREATED`, { runId: evaluationRun.id, inputHash: inputFingerprintHash.substring(0, 12), manuscriptId, timestamp: new Date().toISOString() });

        // Store evaluationRunId reference on manuscript (temp for migration)
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            _current_evaluation_run_id: evaluationRun.id
        });

        // LIFECYCLE: created → segmented
        await base44.asServiceRole.entities.EvaluationRun.update(evaluationRun.id, {
            status: 'segmented'
        });

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
        // Get evaluation mode from manuscript, fallback to standard
        const evaluationMode = manuscript.evaluation_mode || 'standard';

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

                const summaryResponse = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: summaryPrompt }],
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "chapter_summary",
                            strict: true,
                            schema: {
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
                                required: ["chapter_index", "chapter_title", "summary_200_300_words", "key_beats"],
                                additionalProperties: false
                            }
                        }
                    }
                });
                const summary = JSON.parse(summaryResponse.choices[0].message.content);

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
        const runId = `${manuscriptId}_${Date.now()}`;
        console.log(`🚪 PHASE_2_SPINE_ENTRY`, { runId, manuscriptId, timestamp: new Date().toISOString() });

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

        const spineModeGuidance = evaluationMode === 'transgressive' ? `

TRANSGRESSIVE MODE ACTIVE:
- ASSUME INTENT: Violence, darkness, disturbing content, moral ambiguity are intentional craft choices
- DO NOT PENALIZE: Extremity, shock value, offensive content, provocative material
- EVALUATE: Narrative control, thematic coherence, psychological precision
- FLAG ONLY IF: Contradicts internal logic, repetitive without escalation, weakens character integrity
` : evaluationMode === 'trauma_memoir' ? `

TRAUMA MEMOIR MODE ACTIVE:
- TREAT AS TESTIMONY: Content reflects survivor experience
- DO NOT PENALIZE: Difficult material, embodied sensory detail, psychological accuracy
- EVALUATE: Authenticity, coherence, narrative function
- PRESERVE: Survivor voice, embodied truth
` : '';

      const spinePrompt = `You are a literary agent–style evaluator and developmental editor. Evaluate the manuscript's narrative architecture using chapter summaries.

CRITICAL RULES (NON-NEGOTIABLE):
1. NO INVENTION. Judge only what's in the summaries.
2. NO HALLUCINATION. Do not reference scenes/events not present.
3. DOCUMENT IDENTITY: Extract 3 anchors (names, locations, events) and verify consistency.
4. CITE SOURCES. Reference specific chapter indices (e.g., 'Ch. 7–9').
5. PRESERVE VOICE. Respect author's authority, genre conventions, technical authenticity.
${spineModeGuidance}
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

        const spineResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: spinePrompt }],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "spine_evaluation",
                    strict: true,
                    schema: {
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
                                    required: ["name", "score", "strengths", "weaknesses", "notes"],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ["overallScore", "verdict", "majorStrengths", "criticalWeaknesses", "criteria"],
                        additionalProperties: false
                    }
                }
            }
        });
        const spineEvaluation = JSON.parse(spineResponse.choices[0].message.content);

        // Update manuscript with spine evaluation (apply integrity penalty)
        const adjustedSpineScore = Math.max(0, spineEvaluation.overallScore - integrityPenalty);

        // Calculate Trusted Path zone based on spine score
        const getTrustedPathZone = (score) => {
            if (score < 6.0) return 'failure';
            if (score < 8.0) return 'conditional';
            return 'full';
        };

        const trustedPathZone = getTrustedPathZone(adjustedSpineScore);
        const trustedPathCanPolish = trustedPathZone === 'full' ? true : 
                                      trustedPathZone === 'conditional' ? 'limited' : 
                                      false;

        // HARD HANDOFF STEP 1: Write spine terminal state FIRST
        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
            spine_score: adjustedSpineScore,
            spine_evaluation: {
                ...spineEvaluation,
                integrity_adjusted: !integrity.is_clean,
                integrity_penalty: integrityPenalty,
                raw_score: spineEvaluation.overallScore,
                evaluation_mode: evaluationMode,
                trusted_path_zone: trustedPathZone,
                trusted_path_can_polish: trustedPathCanPolish
            },
            spine_completed_at: new Date().toISOString(),
            status: 'spine_complete',
            next_phase: 'wave_phase_3',
            wave_trigger_retry_count: 0
        });

        console.log(`🚪 PHASE_2_SPINE_EXIT`, { runId, manuscriptId, spineScore: adjustedSpineScore, timestamp: new Date().toISOString() });

        // Schedule delayed check to auto-retry if Phase 3 doesn't start
        setTimeout(async () => {
            try {
                const [checkManuscript] = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscriptId });
                if (!checkManuscript.phase_3_started_at && checkManuscript.status === 'spine_complete') {
                    const retryCount = checkManuscript.wave_trigger_retry_count || 0;
                    if (retryCount < 2) {
                        console.log(`⚠️ AUTO_RETRY_PHASE_3`, { runId, manuscriptId, retryCount });
                        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                            status: 'wave_trigger_retrying',
                            wave_trigger_retry_count: retryCount + 1
                        });
                        // Re-invoke this function to continue evaluation
                        await base44.asServiceRole.functions.invoke('evaluateFullManuscript', { manuscript_id: manuscriptId });
                    } else {
                        console.error(`❌ AUTO_RETRY_EXHAUSTED`, { runId, manuscriptId });
                        await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                            status: 'wave_trigger_failed',
                            wave_trigger_error: 'Phase 3 failed to start after 2 retries',
                            wave_trigger_failed_at: new Date().toISOString()
                        });
                    }
                }
            } catch (error) {
                console.error(`❌ AUTO_RETRY_CHECK_FAILED`, { runId, manuscriptId, error: error.message });
            }
        }, 45000); // Check after 45 seconds
        } else {
        // Spine already done, mark as complete if not already
        if (!manuscript.spine_completed_at) {
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                spine_completed_at: new Date().toISOString(),
                status: 'spine_complete',
                next_phase: 'wave_phase_3'
            });
        }
        console.log(`🚪 PHASE_2_SPINE_SKIPPED`, { runId, manuscriptId, reason: 'already_complete', timestamp: new Date().toISOString() });
        }

        // Check if this is a retry scenario
        if (manuscript.status === 'spine_complete' && !manuscript.phase_3_started_at) {
            console.log(`🔄 RESUME_FROM_SPINE_COMPLETE`, { runId, manuscriptId });
        }

        // PHASE 3: WAVE chapter craft evaluation - PARALLEL EXECUTION
        console.log(`🚪 PHASE_3_WAVE_ENTRY`, { runId, manuscriptId, chaptersCount: chapters.length, timestamp: new Date().toISOString() });

        // HARD HANDOFF STEP 2: Write Phase 3 "started" marker IMMEDIATELY
        try {
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                status: 'evaluating_chapters',
                phase_3_started_at: new Date().toISOString(),
                phase_3_run_id: runId,
                evaluation_progress: {
                    chapters_total: chapters.length,
                    chapters_summarized: chapters.length,
                    chapters_wave_done: 0,
                    current_phase: 'wave',
                    percent_complete: 40,
                    current_step: 'Starting WAVE chapter analysis...',
                    last_updated: new Date().toISOString()
                }
            });
            console.log(`✅ PHASE_3_TRIGGER_PERSISTED`, { runId, manuscriptId, timestamp: new Date().toISOString() });
        } catch (triggerError) {
            // HARD HANDOFF STEP 3: Never allow silent exits
            console.error(`❌ PHASE_3_TRIGGER_FAILED`, { runId, manuscriptId, error: triggerError.message });
            await base44.asServiceRole.entities.Manuscript.update(manuscriptId, {
                status: 'wave_trigger_failed',
                wave_trigger_error: triggerError.message,
                wave_trigger_failed_at: new Date().toISOString()
            });
            throw triggerError;
        }

        // Reload chapters to get fresh status after summaries/spine
        const freshChapters = await base44.asServiceRole.entities.Chapter.filter({ manuscript_id: manuscriptId }, 'order');

        console.log(`📊 WAVE_PREP`, { runId, freshChaptersCount: freshChapters.length, timestamp: new Date().toISOString() });

        // WATCHDOG: Fail stale "running" chapters (stuck >15 min)
        const now = new Date();
        const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
        for (const ch of freshChapters) {
            if (ch.wave_status === 'running' && ch.wave_started_at) {
                const startedAt = new Date(ch.wave_started_at);
                const elapsed = now - startedAt;
                if (elapsed > STALE_THRESHOLD_MS) {
                    console.log(`⏱️ Failing stale chapter: ${ch.title} (running for ${Math.round(elapsed/60000)}m)`);
                    await base44.asServiceRole.entities.Chapter.update(ch.id, {
                        wave_status: 'failed',
                        wave_error: `Stale run detected (started ${Math.round(elapsed/60000)}m ago, likely worker crash)`,
                        wave_completed_at: new Date().toISOString()
                    });
                }
            }
        }
        
        // Reload after watchdog cleanup
        const cleanedChapters = await base44.asServiceRole.entities.Chapter.filter({ manuscript_id: manuscriptId }, 'order');

        console.log(`🔄 WAVE_RELOAD_AFTER_WATCHDOG`, { runId, cleanedCount: cleanedChapters.length, timestamp: new Date().toISOString() });

        const MAX_RETRIES = 2;
        const MAX_CONCURRENT_CHAPTERS = 4; // Prevent stampede - batch chapters

        // PARALLEL ORCHESTRATION: Evaluate chapters in batches to prevent overload
        console.log(`🚀 WAVE_ORCHESTRATION_START`, { 
            runId, 
            totalChapters: cleanedChapters.length, 
            maxConcurrent: MAX_CONCURRENT_CHAPTERS,
            maxRetries: MAX_RETRIES,
            timestamp: new Date().toISOString() 
        });
        
        const allResults = [];
        for (let batchStart = 0; batchStart < cleanedChapters.length; batchStart += MAX_CONCURRENT_CHAPTERS) {
            const batch = cleanedChapters.slice(batchStart, batchStart + MAX_CONCURRENT_CHAPTERS);
            console.log(`📦 Processing batch: chapters ${batchStart + 1}-${Math.min(batchStart + MAX_CONCURRENT_CHAPTERS, cleanedChapters.length)}`);
            
            const batchPromises = batch.map((chapter, i) => 
                evaluateChapterParallel(chapter, batchStart + i, cleanedChapters.length, manuscriptId, freshChapters.length, base44, integrity, integrityPenalty, evaluationMode, MAX_RETRIES)
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            allResults.push(...batchResults);
        }

        console.log(`✅ WAVE_ORCHESTRATION_COMPLETE`, { 
            runId, 
            succeeded: allResults.filter(r => r.status === 'fulfilled').length, 
            failed: allResults.filter(r => r.status === 'rejected').length,
            timestamp: new Date().toISOString() 
        });


        // LIFECYCLE: segmented → phase1_complete
        await base44.asServiceRole.entities.EvaluationRun.update(evaluationRun.id, {
            status: 'phase1_complete'
        });

        console.log(`🔐 LIFECYCLE: phase1_complete`, { runId: evaluationRun.id, timestamp: new Date().toISOString() });

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

        // Calculate final Trusted Path zone based on composite score
        const getTrustedPathZone = (score) => {
            if (score < 6.0) return 'failure';
            if (score < 8.0) return 'conditional';
            return 'full';
        };

        const finalTrustedPathZone = getTrustedPathZone(revisiongradeOverall);
        const finalCanPolish = finalTrustedPathZone === 'full' ? true : 
                                finalTrustedPathZone === 'conditional' ? 'limited' : 
                                false;

        const hasFailures = failedChapters.length > 0;
        const completionStatus = hasFailures ? 'ready_with_errors' : 'ready';
        const completionMessage = hasFailures 
            ? `Evaluation complete (${failedChapters.length} chapter(s) failed)`
            : 'Evaluation complete';

        // PHASE GATE EXIT LOG (proof of completion)
        console.log(`🚪 PHASE_3_EXIT`, {
            runId,
            manuscriptId,
            phase: 'PHASE_3_WAVE',
            counts: {
                total: finalChapters.length,
                evaluated: evaluatedChapters.length,
                failed: failedChapters.length,
                stuck: stuckChapters.length
            },
            timestamp: new Date().toISOString()
        });

        console.log(`Finalizing manuscript: ${evaluatedChapters.length} evaluated, ${failedChapters.length} failed, ${finalChapters.length} total`);

        // GOVERNED GATE EVALUATION
        const phase1Readiness = manuscript.spine_score ? Math.max(0, manuscript.spine_score - integrityPenalty) : 0;
        const coverageChapters = evaluatedChapters.length;
        const coverageWordPct = manuscript.word_count > 0 
            ? evaluatedChapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0) / manuscript.word_count
            : 0;

        // Fetch all written segments to verify integrity
        const writtenSegments = await base44.asServiceRole.entities.EvaluationSegment.filter({ runId: evaluationRun.id });
        const segmentsExpected = finalChapters.length;
        const segmentsWritten = writtenSegments.length;
        const segmentsMissing = finalChapters
            .filter(ch => !writtenSegments.some(seg => seg.segmentStableId === ch.id))
            .map(ch => ({ chapterId: ch.id, title: ch.title }));

        const readinessPassed = phase1Readiness >= 8.0;
        const coveragePassed = coverageChapters >= 5 && coverageWordPct >= 0.25;
        const integrityPassed = segmentsMissing.length === 0 && segmentsWritten === segmentsExpected;

        const phase2Allowed = readinessPassed && coveragePassed && integrityPassed;

        const gateDecision = await base44.asServiceRole.entities.EvaluationGateDecision.create({
            runId: evaluationRun.id,
            readinessFloor: 8.0,
            readinessValue: phase1Readiness,
            readinessPassed,
            coverageMinChapters: 5,
            coverageMinWordPct: 0.25,
            coverageChaptersValue: coverageChapters,
            coverageWordPctValue: coverageWordPct,
            coveragePassed,
            coverageFailReason: !coveragePassed 
                ? `Coverage insufficient: ${coverageChapters} chapters (need 5), ${(coverageWordPct * 100).toFixed(1)}% words (need 25%)`
                : null,
            integrityPassed,
            integrityObserved: {
                segmentsExpected,
                segmentsWritten,
                segmentsMissing,
                gateDecisionWritten: true,
                timestamp: new Date().toISOString()
            },
            integrityFailReason: !integrityPassed
                ? `Integrity check failed: ${segmentsMissing.length} missing segment(s), expected ${segmentsExpected}, got ${segmentsWritten}`
                : null,
            phase2Allowed,
            phase2BlockReason: !phase2Allowed 
                ? (!readinessPassed ? 'readiness_insufficient' : !coveragePassed ? 'coverage_insufficient' : 'integrity_failed')
                : null,
            userMessageTitle: phase2Allowed 
                ? 'Evaluation Complete - Submission Ready'
                : 'Evaluation Complete - Not Submission Ready',
            userMessageBody: phase2Allowed
                ? 'Your manuscript meets the readiness, coverage, and integrity thresholds.'
                : `Your manuscript does not yet meet required thresholds. ${!readinessPassed ? 'Readiness score below 8.0. ' : ''}${!coveragePassed ? 'Coverage insufficient. ' : ''}${!integrityPassed ? 'Integrity check failed.' : ''}`
        });

        console.log(`🚪 GATE_DECISION_CREATED`, { 
            gateId: gateDecision.id, 
            phase2Allowed, 
            readinessPassed, 
            coveragePassed,
            integrityPassed,
            timestamp: new Date().toISOString() 
        });

        // LIFECYCLE: phase1_complete → gated (HARD STOP - gates must exist)
        if (!readinessPassed || !coveragePassed || !integrityPassed) {
            console.log(`⛔ GATE_BLOCK`, { runId: evaluationRun.id, readinessPassed, coveragePassed, integrityPassed });
        }

        await base44.asServiceRole.entities.EvaluationRun.update(evaluationRun.id, {
            status: 'gated'
        });

        console.log(`🔐 LIFECYCLE: gated`, { runId: evaluationRun.id, timestamp: new Date().toISOString() });

        // CREATE ARTIFACTS
        const artifacts = await base44.asServiceRole.entities.EvaluationArtifacts.create({
            runId: evaluationRun.id,
            phase1OverallReadiness: phase1Readiness,
            phase1CriteriaAggregate: manuscript.spine_evaluation?.criteria || {},
            coverageSegmentsEvaluated: evaluatedChapters.length,
            coverageSegmentsTotalEstimate: finalChapters.length,
            coverageWordCountEvaluated: evaluatedChapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0),
            coverageWordCountTotalEstimate: manuscript.word_count || 0,
            coverageWordPctEvaluated: coverageWordPct,
            chapterSummaries: finalChapters.map(ch => ch.summary_json).filter(Boolean),
            beatMap: {},
            actMap: {},
            threadGraph: {}
        });

        // CREATE SPINE SYNTHESIS
        const synthesis = await base44.asServiceRole.entities.EvaluationSpineSynthesis.create({
            runId: evaluationRun.id,
            spineReadiness: phase1Readiness,
            diagnosis: [],
            waveGuide: manuscript.spine_evaluation || {},
            governanceAssertions: {
                rawTextReadInPhase2: false,
                scoresModifiedInPhase2: false
            }
        });

        // Generate artifacts hash for integrity verification
        const artifactsPayload = JSON.stringify({
            artifacts: artifacts.id,
            synthesis: synthesis.id,
            gateDecision: gateDecision.id,
            segments: writtenSegments.map(s => s.id).sort()
        });
        const artifactsHash = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(artifactsPayload)
        ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

        // Update integrity observed with artifacts hash
        await base44.asServiceRole.entities.EvaluationGateDecision.update(gateDecision.id, {
            integrityObserved: {
                ...gateDecision.integrityObserved,
                artifactsHash,
                spineSynthesisWritten: true,
                artifactsWritten: true
            }
        });

        // LIFECYCLE: gated → complete (TERMINAL)
        await base44.asServiceRole.entities.EvaluationRun.update(evaluationRun.id, {
            status: phase2Allowed ? 'phase2_complete' : 'phase2_skipped',
            statusDetail: hasFailures 
                ? `Complete with ${failedChapters.length} chapter(s) failed`
                : 'Complete'
        });

        console.log(`🔐 GOVERNED_RUN_COMPLETE`, { 
            runId: evaluationRun.id, 
            status: phase2Allowed ? 'phase2_complete' : 'phase2_skipped',
            phase2Allowed,
            artifactsHash: artifactsHash.substring(0, 12),
            timestamp: new Date().toISOString() 
        });

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
                integrity_penalty_applied: integrityPenalty,
                trusted_path_zone: finalTrustedPathZone,
                trusted_path_can_polish: finalCanPolish
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
        
        // Capture to Sentry with full context
        Sentry.captureException(error, {
            tags: {
                pipeline: 'full_manuscript',
                feature: 'evaluate'
            },
            extra: {
                manuscriptId,
                function: 'evaluateFullManuscript',
                operation: 'manuscript_evaluation',
                manuscript_title: manuscript?.title,
                word_count: manuscript?.word_count,
                chapters_count: chapters?.length,
                evaluation_mode: manuscript?.evaluation_mode,
                spine_score: manuscript?.spine_score,
                status: manuscript?.status,
                error_message: error.message,
                timestamp: new Date().toISOString()
            }
        });
        await Sentry.flush(2000);
        
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
        runEvaluation(manuscript_id).catch(err => {
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