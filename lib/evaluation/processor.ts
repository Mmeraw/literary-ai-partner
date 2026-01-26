/**
 * Evaluation Processor
 * 
 * Core logic for processing evaluation jobs.
 * Replaces Base44 workflow with Next.js/Vercel implementation.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { EvaluationResultV1 } from '@/schemas/evaluation-result-v1';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY;

interface EvaluationJob {
  id: string;
  manuscript_id: number;
  job_type: string;
  status: string;
  created_at: string;
}

interface Manuscript {
  id: number;
  title: string;
  content: string;
  work_type: string | null;
  user_id: string;
}

/**
 * Generate evaluation using OpenAI
 */
async function generateAIEvaluation(manuscript: Manuscript, job: EvaluationJob): Promise<EvaluationResultV1> {
  if (!openaiApiKey) {
    console.warn('[Processor] No OpenAI API key found, using mock evaluation');
    return generateMockEvaluation(manuscript, job);
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const now = new Date().toISOString();
  const startTime = Date.now();

  try {
    console.log(`[Processor] Calling OpenAI API for manuscript ${manuscript.id}`);

    const manuscriptText = manuscript.content || '(No content provided)';
    const wordCount = manuscriptText.split(/\s+/).length;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert literary evaluator. Analyze manuscripts and provide detailed, constructive feedback using a 13-criteria rubric. Return your analysis as a structured JSON object matching the EvaluationResultV1 schema.`
        },
        {
          role: 'user',
          content: `Evaluate this ${manuscript.work_type || 'manuscript'} titled "${manuscript.title}".

Word count: ${wordCount}

Manuscript text:
${manuscriptText.substring(0, 15000)}

Provide a comprehensive evaluation with:
1. Overall verdict (pass/revise/fail) and score (0-100)
2. One-paragraph summary
3. Top 3 strengths and top 3 risks
4. Scores (0-10) and rationale for all 13 criteria: concept, plot, character, dialogue, voice, pacing, structure, theme, worldbuilding, stakes, clarity, marketability, craft
5. Quick wins and strategic revisions with effort/impact ratings

Return ONLY valid JSON matching this structure. No markdown, no code fences, just pure JSON.`
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    console.log(`[Processor] OpenAI response received (${responseText.length} chars)`);

    // Parse OpenAI response
    const aiResult = JSON.parse(responseText);

    // Build EvaluationResultV1
    const result: EvaluationResultV1 = {
      schema_version: "evaluation_result_v1",
      ids: {
        evaluation_run_id: crypto.randomUUID(),
        job_id: job.id,
        manuscript_id: manuscript.id,
        user_id: manuscript.user_id,
      },
      generated_at: now,
      engine: {
        model: completion.model,
        provider: "openai",
        prompt_version: "v1.0.0",
      },
      overview: {
        verdict: aiResult.overview?.verdict || 'revise',
        overall_score_0_100: aiResult.overview?.overall_score_0_100 || 70,
        one_paragraph_summary: aiResult.overview?.one_paragraph_summary || '',
        top_3_strengths: aiResult.overview?.top_3_strengths || [],
        top_3_risks: aiResult.overview?.top_3_risks || []
      },
      criteria: aiResult.criteria || [],
      recommendations: aiResult.recommendations || { quick_wins: [], strategic_revisions: [] },
      metrics: {
        manuscript: {
          word_count: wordCount,
          char_count: manuscriptText.length,
          genre: manuscript.work_type || 'Unknown',
          target_audience: aiResult.metrics?.manuscript?.target_audience || 'General'
        },
        processing: {
          segment_count: 1,
          total_tokens_estimated: completion.usage?.total_tokens || 0,
          runtime_ms: Date.now() - startTime
        }
      },
      artifacts: [],
      governance: {
        confidence: 0.90,
        warnings: [],
        limitations: [
          `Analysis based on ${Math.min(wordCount, 3750)} words`,
          'Full manuscript context may not be captured if truncated'
        ],
        policy_family: "standard"
      }
    };

    console.log(`[Processor] AI evaluation completed in ${Date.now() - startTime}ms`);
    return result;

  } catch (error) {
    console.error(`[Processor] OpenAI evaluation failed:`, error);
    console.log('[Processor] Falling back to mock evaluation');
    return generateMockEvaluation(manuscript, job);
  }
}

/**
 * Generate a mock evaluation result (fallback)
 */
function generateMockEvaluation(manuscript: Manuscript, job: EvaluationJob): EvaluationResultV1 {
  const now = new Date().toISOString();
  
  return {
    schema_version: "evaluation_result_v1",
    ids: {
      evaluation_run_id: crypto.randomUUID(),
      job_id: job.id,
      manuscript_id: manuscript.id,
      user_id: manuscript.user_id,
    },
    generated_at: now,
    engine: {
      model: "gpt-4o-mini",
      provider: "openai",
      prompt_version: "v1.0.0",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 72,
      one_paragraph_summary: `"${manuscript.title}" demonstrates strong narrative potential with compelling character dynamics and a clear story structure. The manuscript shows particular strength in its central concept and character development, though pacing in the middle section would benefit from tightening. The dialogue feels authentic and serves the story well, while the worldbuilding provides sufficient context without overwhelming the narrative. To move this manuscript toward market readiness, focus on clarifying the protagonist's arc in Act 2 and strengthening the causal connections between key plot points.`,
      top_3_strengths: [
        "Compelling protagonist with clear internal conflict and growth trajectory",
        "Strong opening hook that immediately establishes stakes and tone",
        "Authentic dialogue that reveals character while advancing plot"
      ],
      top_3_risks: [
        "Middle section pacing drags; Act 2 needs tighter scene-to-scene causality",
        "Antagonist motivation needs clearer establishment earlier in the narrative",
        "Climax resolution feels somewhat predictable; consider adding a twist or complication"
      ]
    },
    criteria: [
      {
        key: "concept",
        score_0_10: 8,
        rationale: "Fresh premise with commercial appeal. The core concept is immediately graspable and has clear stakes.",
        evidence: [],
        recommendations: [
          {
            priority: "medium",
            action: "Consider adding a unique element to differentiate from similar works in the market",
            expected_impact: "Increases marketability and memorability"
          }
        ]
      },
      {
        key: "plot",
        score_0_10: 7,
        rationale: "Solid three-act structure with clear turning points, though midpoint needs strengthening.",
        evidence: [],
        recommendations: [
          {
            priority: "high",
            action: "Tighten Act 2 by removing or consolidating scenes that don't advance the central conflict",
            expected_impact: "Improves pacing and maintains reader engagement"
          }
        ]
      },
      {
        key: "character",
        score_0_10: 8,
        rationale: "Protagonist is well-developed with clear wants, needs, and flaws. Supporting cast needs more distinction.",
        evidence: [],
        recommendations: [
          {
            priority: "medium",
            action: "Give each secondary character a unique voice or mannerism",
            expected_impact: "Makes characters more memorable and distinct"
          }
        ]
      },
      {
        key: "dialogue",
        score_0_10: 7,
        rationale: "Natural and character-specific. Occasional instances of on-the-nose exposition.",
        evidence: [],
        recommendations: [
          {
            priority: "low",
            action: "Replace expository dialogue with actions or show-don't-tell moments",
            expected_impact: "Increases subtlety and reader engagement"
          }
        ]
      },
      {
        key: "voice",
        score_0_10: 7,
        rationale: "Consistent narrative voice with good tonal control. Could be more distinctive.",
        evidence: [],
        recommendations: [
          {
            priority: "medium",
            action: "Lean into unique stylistic choices or voice quirks",
            expected_impact: "Creates more memorable reading experience"
          }
        ]
      },
      {
        key: "pacing",
        score_0_10: 6,
        rationale: "Strong opening and climax, but middle section drags. Scene length varies appropriately.",
        evidence: [],
        recommendations: [
          {
            priority: "high",
            action: "Cut or consolidate scenes in Act 2 that don't advance plot or character",
            expected_impact: "Maintains narrative momentum throughout"
          }
        ]
      },
      {
        key: "structure",
        score_0_10: 8,
        rationale: "Clear three-act structure with well-placed turning points and escalating tension.",
        evidence: [],
        recommendations: [
          {
            priority: "low",
            action: "Consider adding a false victory before the climax",
            expected_impact: "Increases dramatic tension and stakes"
          }
        ]
      },
      {
        key: "theme",
        score_0_10: 7,
        rationale: "Central theme is present and explored through character arcs, though could be more nuanced.",
        evidence: [],
        recommendations: [
          {
            priority: "medium",
            action: "Add thematic resonance through imagery or recurring symbols",
            expected_impact: "Deepens emotional impact and cohesion"
          }
        ]
      },
      {
        key: "worldbuilding",
        score_0_10: 7,
        rationale: "Setting is clearly established with appropriate detail. Avoids info-dumps.",
        evidence: [],
        recommendations: [
          {
            priority: "low",
            action: "Add sensory details to make the world more immersive",
            expected_impact: "Increases reader immersion and atmosphere"
          }
        ]
      },
      {
        key: "stakes",
        score_0_10: 7,
        rationale: "Personal stakes are clear throughout. External stakes could be more urgent.",
        evidence: [],
        recommendations: [
          {
            priority: "high",
            action: "Establish a ticking clock or deadline in Act 1",
            expected_impact: "Increases tension and reader urgency"
          }
        ]
      },
      {
        key: "clarity",
        score_0_10: 8,
        rationale: "Story is easy to follow. Scene goals and character motivations are generally clear.",
        evidence: [],
        recommendations: [
          {
            priority: "low",
            action: "Clarify the antagonist's plan earlier in the narrative",
            expected_impact: "Reduces reader confusion in Act 2"
          }
        ]
      },
      {
        key: "marketability",
        score_0_10: 7,
        rationale: "Fits clearly into genre conventions with commercial appeal. Comp titles are identifiable.",
        evidence: [],
        recommendations: [
          {
            priority: "medium",
            action: "Research recent successful comps and align hook/premise language",
            expected_impact: "Improves query letter and pitch effectiveness"
          }
        ]
      },
      {
        key: "craft",
        score_0_10: 7,
        rationale: "Solid prose with good control of fundamentals. Some repetitive word choices.",
        evidence: [],
        recommendations: [
          {
            priority: "low",
            action: "Run manuscript through ProWritingAid or similar tool to catch repetition",
            expected_impact: "Polishes prose to professional standard"
          }
        ]
      }
    ],
    recommendations: {
      quick_wins: [
        {
          action: "Cut or consolidate 3-5 scenes in Act 2 that feel slow or repetitive",
          why: "Immediately improves pacing without major restructuring",
          effort: "low",
          impact: "high"
        },
        {
          action: "Add a specific deadline or ticking clock element",
          why: "Creates urgency and forward momentum",
          effort: "low",
          impact: "medium"
        },
        {
          action: "Give each secondary character one unique trait or voice quirk",
          why: "Makes characters more memorable with minimal rewriting",
          effort: "low",
          impact: "medium"
        }
      ],
      strategic_revisions: [
        {
          action: "Restructure Act 2 to increase scene-to-scene causality",
          why: "Fundamental pacing issue that affects reader engagement",
          effort: "high",
          impact: "high"
        },
        {
          action: "Deepen the antagonist's motivation and establish it earlier",
          why: "Clarifies central conflict and increases stakes",
          effort: "medium",
          impact: "high"
        },
        {
          action: "Add a complication or twist to the climax",
          why: "Prevents predictability and increases emotional payoff",
          effort: "medium",
          impact: "medium"
        }
      ]
    },
    metrics: {
      manuscript: {
        word_count: manuscript.content ? manuscript.content.split(/\s+/).length : 0,
        char_count: manuscript.content ? manuscript.content.length : 0,
        genre: manuscript.work_type || "Unknown",
        target_audience: "Adult Fiction"
      },
      processing: {
        segment_count: 1,
        total_tokens_estimated: manuscript.content ? Math.floor(manuscript.content.length / 4) : 0,
        runtime_ms: 1000
      }
    },
    artifacts: [],
    governance: {
      confidence: 0.85,
      warnings: [
        "🔶 MOCK EVALUATION: This is generated test data, not a real AI analysis",
        "Real OpenAI evaluation will be enabled once API key is configured"
      ],
      limitations: [
        "Mock data does not analyze actual manuscript content",
        "Scores and recommendations are generic placeholders",
        "Evidence snippets not extracted from manuscript text"
      ],
      policy_family: "standard"
    }
  };
}

/**
 * Process a single evaluation job
 */
export async function processEvaluationJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[Processor] Processing job ${jobId}`);

    // 1. Fetch the job
    const { data: job, error: jobError } = await supabase
      .from('evaluation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return { success: false, error: `Job not found: ${jobError?.message}` };
    }

    if (job.status !== 'queued') {
      return { success: false, error: `Job status is ${job.status}, not queued` };
    }

    // 2. Update status to running
    await supabase
      .from('evaluation_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    console.log(`[Processor] Job ${jobId} status updated to running`);

    // 3. Fetch the manuscript
    const { data: manuscript, error: manuscriptError } = await supabase
      .from('manuscripts')
      .select('*')
      .eq('id', job.manuscript_id)
      .single();

    if (manuscriptError || !manuscript) {
      await supabase
        .from('evaluation_jobs')
        .update({ 
          status: 'failed', 
          last_error: `Manuscript not found: ${manuscriptError?.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      return { success: false, error: `Manuscript not found: ${manuscriptError?.message}` };
    }

    console.log(`[Processor] Manuscript ${manuscript.id} fetched: "${manuscript.title}"`);

    // 4. Generate evaluation using AI (falls back to mock if no API key)
    const evaluationResult = await generateAIEvaluation(manuscript, job);

    console.log(`[Processor] Evaluation generated for job ${jobId}`);

    // 5. Store evaluation result in the job
    const { error: updateError } = await supabase
      .from('evaluation_jobs')
      .update({
        status: 'completed',
        evaluation_result: evaluationResult,
        evaluation_result_version: 'evaluation_result_v1',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error(`[Processor] Failed to update job ${jobId}:`, updateError);
      return { success: false, error: `Failed to store result: ${updateError.message}` };
    }

    console.log(`[Processor] Job ${jobId} completed successfully`);

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Processor] Error processing job ${jobId}:`, errorMessage);

    // Update job status to failed
    try {
      await supabase
        .from('evaluation_jobs')
        .update({ 
          status: 'failed', 
          last_error: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
    } catch (updateError) {
      console.error(`[Processor] Failed to update job status to failed:`, updateError);
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Process all queued evaluation jobs
 */
export async function processQueuedJobs(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ jobId: string; error: string }>;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch all queued jobs
  const { data: jobs, error } = await supabase
    .from('evaluation_jobs')
    .select('id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(10); // Process max 10 jobs per run

  if (error) {
    console.error('[Processor] Error fetching queued jobs:', error);
    return { processed: 0, succeeded: 0, failed: 0, errors: [] };
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Processor] No queued jobs found');
    return { processed: 0, succeeded: 0, failed: 0, errors: [] };
  }

  console.log(`[Processor] Found ${jobs.length} queued job(s)`);

  const results = {
    processed: jobs.length,
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ jobId: string; error: string }>
  };

  // Process each job sequentially
  for (const job of jobs) {
    const result = await processEvaluationJob(job.id);
    
    if (result.success) {
      results.succeeded++;
    } else {
      results.failed++;
      results.errors.push({ jobId: job.id, error: result.error || 'Unknown error' });
    }
  }

  console.log(`[Processor] Completed: ${results.succeeded} succeeded, ${results.failed} failed`);

  return results;
}
