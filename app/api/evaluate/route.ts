// app/api/evaluate/route.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { PHASES } from '@/lib/jobs/types';
import { getDevHeaderActor } from '@/lib/auth/devHeaderActor';
import { triggerEvaluationWorker } from '@/lib/jobs/triggerWorker';
import { triggerEvaluationWorkflow } from '@/lib/jobs/triggerWorkflow';
import { generateTraceId } from '@/lib/observability/logger';
import { resolveManuscriptTitle } from '@/lib/manuscripts/title';
import { createInitialVersion } from '@/lib/manuscripts/versions';
import { computeEnrichment } from '@/lib/evaluation/enrichment/computeEnrichment';
import { routeNarrativeEvaluationPreflight } from '@/lib/evaluation/preflight/manuscriptTypeRouting';
import { enforceApiRateLimit } from '@/lib/security/apiRateLimit';
import { requireUser } from '@/lib/security/apiGuards';

function decodeDataUrlText(fileUrl: string): string | null {
  if (!fileUrl.startsWith('data:')) return null;

  const commaIndex = fileUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const payload = fileUrl.slice(commaIndex + 1);
  if (!payload) return null;

  try {
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

const MAX_PASTED_MANUSCRIPT_BYTES = 6 * 1024 * 1024;
const MAX_EVALUATION_JOBS_PER_HOUR = 10;
const MAX_ACTIVE_EVALUATION_JOBS = 5;

function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error, ...extra }, { status });
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

async function enforceUserEvaluationAbuseLimits(args: {
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
}): Promise<Response | null> {
  const { supabase, userId } = args;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: recentCount, error: recentErr } = await supabase
    .from('evaluation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo);

  if (recentErr) {
    console.error('[/api/evaluate] rate-limit recent-count failed', recentErr);
    return jsonError('Unable to verify evaluation quota. Please try again shortly.', 503);
  }

  if ((recentCount ?? 0) >= MAX_EVALUATION_JOBS_PER_HOUR) {
    return jsonError(
      `Too many evaluation requests. Please wait before starting another evaluation.`,
      429,
      { retry_after_seconds: 3600 }
    );
  }

  const { count: activeCount, error: activeErr } = await supabase
    .from('evaluation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['queued', 'running']);

  if (activeErr) {
    console.error('[/api/evaluate] active-job limit check failed', activeErr);
    return jsonError('Unable to verify active evaluation limit. Please try again shortly.', 503);
  }

  if ((activeCount ?? 0) >= MAX_ACTIVE_EVALUATION_JOBS) {
    return jsonError(
      `You already have ${MAX_ACTIVE_EVALUATION_JOBS} evaluations queued or running. Please wait for one to finish before starting another.`,
      429
    );
  }

  return null;
}

export async function POST(req: Request) {
  const trace_id = generateTraceId();
  const request_id = generateTraceId();

  try {
    const rateLimitDenied = enforceApiRateLimit(req, {
      bucket: 'evaluate_submit',
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (rateLimitDenied) return rateLimitDenied;

    // Use admin client to bypass RLS for trusted server operations
    const supabase = createAdminClient();

    // 1) Auth: dev header actor (test-mode only) OR production session
    const actor = getDevHeaderActor(req);
    let userId: string | null = null;

    if (actor) {
      // Dev-only user identity from x-user-id header
      userId = actor.userId;
    } else {
      // Production path: Supabase session cookie
      const auth = await requireUser();
      if (!auth.ok) {
        return auth.response;
      }
      userId = auth.user.id;
    }

    if (!userId) {
      return jsonError('Unauthorized', 401);
    }

    const abuseLimitResponse = await enforceUserEvaluationAbuseLimits({ supabase, userId });
    if (abuseLimitResponse) return abuseLimitResponse;

    const body = await req.json().catch(() => ({}));
    const manuscriptIdInput = body?.manuscript_id;
    const manuscriptTextInput =
      typeof body?.manuscript_text === 'string'
        ? body.manuscript_text
        : typeof body?.content === 'string'
          ? body.content
          : typeof body?.text === 'string'
            ? body.text
            : '';
    const manuscriptTitleInput =
      typeof body?.manuscript_title === 'string'
        ? body.manuscript_title
        : typeof body?.title === 'string'
          ? body.title
          : 'Untitled Manuscript';
    const trimmedText = manuscriptTextInput.trim();

    let manuscriptId: number | null = null;
    let sourceManuscriptText: string | null = null;
    let sourceManuscriptWordCount: number | undefined;

    if (manuscriptIdInput !== undefined && manuscriptIdInput !== null) {
      // Reject ambiguous input: both manuscript_id and new text together is a contract violation.
      const trimmedTextForConflictCheck = manuscriptTextInput.trim();
      if (trimmedTextForConflictCheck.length > 0) {
        return jsonError('Ambiguous manuscript source: provide either manuscript_id or manuscript_text, not both.', 400);
      }

      const parsed = Number.parseInt(String(manuscriptIdInput), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return jsonError('Invalid manuscript_id', 400);
      }
      manuscriptId = parsed;

      const { data: existingManuscript, error: manuscriptLookupError } =
        await supabase
          .from('manuscripts')
          .select('id,user_id,file_url,word_count')
          .eq('id', manuscriptId)
          .single();

      if (manuscriptLookupError || !existingManuscript) {
        return jsonError('manuscript_id not found', 404);
      }

      if (existingManuscript.user_id !== userId) {
        return jsonError('Forbidden: manuscript does not belong to user', 403);
      }

      const existingText =
        typeof existingManuscript.file_url === 'string'
          ? decodeDataUrlText(existingManuscript.file_url)
          : null;

      if (!existingText || existingText.trim().length === 0) {
        return Response.json(
          {
            ok: false,
            error:
              'Missing manuscript source snapshot: unable to bind immutable Version 1 for evaluation.',
          },
          { status: 500 }
        );
      }

      const preflightDecision = routeNarrativeEvaluationPreflight(existingText);
      if (!preflightDecision.allowed) {
        return Response.json(
          {
            ok: false,
            error: preflightDecision.userMessage,
            code: 'NARRATIVE_EVALUATION_PREFLIGHT_REJECTED',
            manuscript_type: preflightDecision.detectedType,
          },
          { status: 422 }
        );
      }

      sourceManuscriptText = existingText;
      sourceManuscriptWordCount =
        typeof existingManuscript.word_count === 'number'
          ? existingManuscript.word_count
          : existingText.split(/\s+/).filter(Boolean).length;
    }

    if (!manuscriptId && trimmedText.length === 0) {
      return jsonError('Missing manuscript input: provide manuscript_id or manuscript_text/content', 400);
    }

    if (!manuscriptId) {
      const inputBytes = byteLength(trimmedText);
      if (inputBytes > MAX_PASTED_MANUSCRIPT_BYTES) {
        return jsonError(
          `Manuscript text is too large for direct paste upload. Please upload a file instead.`,
          413,
          { max_bytes: MAX_PASTED_MANUSCRIPT_BYTES }
        );
      }
    }

    if (!manuscriptId && trimmedText.length > 0) {
      const preflightDecision = routeNarrativeEvaluationPreflight(trimmedText);
      if (!preflightDecision.allowed) {
        return Response.json(
          {
            ok: false,
            error: preflightDecision.userMessage,
            code: 'NARRATIVE_EVALUATION_PREFLIGHT_REJECTED',
            manuscript_type: preflightDecision.detectedType,
          },
          { status: 422 }
        );
      }
    }

    // Step 1: Create manuscript
    if (!manuscriptId) {
      const encodedText = encodeURIComponent(trimmedText);
      const fileUrl = `data:text/plain;charset=utf-8,${encodedText}`;
      const fileSize = byteLength(trimmedText);
      const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;
      const resolvedTitle = resolveManuscriptTitle({
        explicitTitle: manuscriptTitleInput,
        text: trimmedText,
        fallback: 'Imported Manuscript',
      });

      const { data: manuscript, error: manuscriptError } = await supabase
        .from('manuscripts')
        .insert({
          title: resolvedTitle,
          user_id: userId,
          created_by: userId,
          file_url: fileUrl,
          file_size: fileSize,
          work_type: 'novel',
          tone_context: 'neutral',
          mood_context: 'calm',
          voice_mode: 'balanced',
          storygate_linked: false,
          allow_industry_discovery: false,
          is_final: false,
          source: 'paste',
          english_variant: 'us',
          word_count: wordCount,
        })
        .select('id')
        .single();

      if (manuscriptError || !manuscript) {
        console.error('Manuscript insert error:', manuscriptError);
        return jsonError('Manuscript creation failed. Please try again.', 500);
      }
      manuscriptId = manuscript.id;
      sourceManuscriptText = trimmedText;
      sourceManuscriptWordCount = wordCount;
    }

    // Step 1b: Enforce immutable source snapshot before any evaluation job is created.
    if (!sourceManuscriptText || sourceManuscriptText.trim().length === 0) {
      return Response.json(
        {
          ok: false,
          error:
            'Missing manuscript source snapshot: immutable Version 1 is required before evaluation.',
        },
        { status: 500 }
      );
    }

    let sourceVersionId: string;
    try {
      const sourceVersion = await createInitialVersion({
        manuscript_id: manuscriptId,
        raw_text: sourceManuscriptText,
        word_count: sourceManuscriptWordCount,
        created_by: userId,
      });

      sourceVersionId = sourceVersion.id;
    } catch (snapshotError: unknown) {
      const snapshotMessage =
        snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
      console.error('Failed to create/bind manuscript source snapshot', {
        manuscript_id: manuscriptId,
        user_id: userId,
        error: snapshotMessage,
      });

      return Response.json(
        {
          ok: false,
          error: 'Failed to create manuscript source snapshot',
        },
        { status: 500 }
      );
    }

    // Step 2: Compute instant enrichment (reading grade, dialogue ratio) from manuscript text.
    // These are pure algorithmic computations — available immediately before evaluation starts.
    let instantEnrichment: Record<string, unknown> = {};
    const enrichmentSourceText = trimmedText || null;

    if (enrichmentSourceText && enrichmentSourceText.length > 0) {
      const enrichResult = computeEnrichment(enrichmentSourceText);
      instantEnrichment = {
        enrichment_reading_grade_level: enrichResult.reading_grade_level ?? null,
        enrichment_dialogue_percentage: enrichResult.dialogue_percentage ?? null,
        enrichment_narrative_percentage: enrichResult.narrative_percentage ?? null,
        enrichment_computed_at: new Date().toISOString(),
      };
    } else if (manuscriptId) {
      // For existing manuscripts, fetch text from file_url to compute enrichment
      const { data: msRow } = await supabase
        .from('manuscripts')
        .select('file_url')
        .eq('id', manuscriptId)
        .single();

      if (msRow?.file_url && typeof msRow.file_url === 'string') {
        try {
          let msText = '';
          if (msRow.file_url.startsWith('data:')) {
            const commaIdx = msRow.file_url.indexOf(',');
            if (commaIdx > -1) {
              msText = decodeURIComponent(msRow.file_url.slice(commaIdx + 1));
            }
          }
          if (msText.length > 0) {
            const enrichResult = computeEnrichment(msText);
            instantEnrichment = {
              enrichment_reading_grade_level: enrichResult.reading_grade_level ?? null,
              enrichment_dialogue_percentage: enrichResult.dialogue_percentage ?? null,
              enrichment_narrative_percentage: enrichResult.narrative_percentage ?? null,
              enrichment_computed_at: new Date().toISOString(),
            };
          }
        } catch {
          // Non-fatal: enrichment is best-effort at submission
        }
      }
    }

    // Step 3: Create evaluation job
    const { data, error } = await supabase
      .from('evaluation_jobs')
      .insert({
        manuscript_id: manuscriptId,
        manuscript_version_id: sourceVersionId,
        user_id: userId,
        job_type: 'full_evaluation',
        validity_status: 'pending',
        phase: PHASES.PHASE_0,   // All new jobs start at phase_0 (gold-standard warm-up)
        phase_status: 'queued',
        policy_family: 'standard',
        voice_preservation_level: 'balanced',
        english_variant: 'us',
        queued_at: new Date().toISOString(),
        ...(Object.keys(instantEnrichment).length > 0 ? { progress: instantEnrichment } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error('Evaluation job insert error:', error);
      return jsonError('Evaluation job creation failed. Please try again.', 500);
    }

    // MISTAKE-PROOF: SELECT-back verification before the job ID ever leaves this process.
    // PostgREST returns HTTP 200 on INSERT even when the transaction is rolled back by a
    // trigger or constraint — the only reliable truth is reading the row back.
    // If the row is missing here, the INSERT was silently lost. Return 500 instead of
    // sending a phantom job ID to the client (which would create a ghost job in the UI).
    const { data: verifiedJob, error: verifyError } = await supabase
      .from('evaluation_jobs')
      .select('id, status')
      .eq('id', data.id)
      .maybeSingle();

    if (verifyError || !verifiedJob) {
      console.error(
        '[/api/evaluate] Job INSERT appeared to succeed but SELECT-back found no row. ' +
        'Probable silent rollback. Refusing to send job ID to client.',
        { job_id: data.id, verifyError }
      );
      return jsonError('Job creation failed — database verification failed. Please try again.', 500);
    }

    // Belt-and-suspenders dispatch: cron remains fallback.
    // When WORKFLOW_EVALUATION_ENABLED=true, use durable Vercel Workflow
    // (each phase gets a fresh 800s budget; overall run has no duration limit).
    // Otherwise fall back to the cron-based worker path.
    if (process.env.WORKFLOW_EVALUATION_ENABLED === 'true') {
      void triggerEvaluationWorkflow({
        req,
        jobId: data.id,
        trace_id,
        request_id,
        source: 'api.evaluate.create',
      });
    } else {
      void triggerEvaluationWorker({
        req,
        jobId: data.id,
        trace_id,
        request_id,
        source: 'api.evaluate.create',
      });
    }

    return Response.json(
      {
        ok: true,
        message: 'Evaluation job created',
        job: {
          id: data.id,
          manuscript_id: manuscriptId,
          status: data.status,
          phase: data.phase,
          phase_1_status: data.phase_1_status,
          policy_family: data.policy_family,
          voice_preservation_level: data.voice_preservation_level,
          english_variant: data.english_variant,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('Hard fail in /api/evaluate:', err);
    return Response.json(
      {
        ok: false,
        error: 'Evaluation request failed',
        code: 'EVALUATION_SUBMIT_FAILED',
      },
      { status: 500 }
    );
  }
}
