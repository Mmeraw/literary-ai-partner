// app/api/evaluate/route.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { PHASES } from '@/lib/jobs/types';
import { getDevHeaderActor } from '@/lib/auth/devHeaderActor';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { triggerEvaluationWorker } from '@/lib/jobs/triggerWorker';
import { triggerEvaluationWorkflow } from '@/lib/jobs/triggerWorkflow';
import { generateTraceId } from '@/lib/observability/logger';
import { resolveManuscriptTitle } from '@/lib/manuscripts/title';
import { computeEnrichment } from '@/lib/evaluation/enrichment/computeEnrichment';

export async function POST(req: Request) {
  const trace_id = generateTraceId();
  const request_id = generateTraceId();

  try {
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
      const user = await getAuthenticatedUser();
      userId = user?.id ?? null;
    }

    if (!userId) {
      return Response.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    let manuscriptId: number | null = null;

    if (manuscriptIdInput !== undefined && manuscriptIdInput !== null) {
      // Reject ambiguous input: both manuscript_id and new text together is a contract violation.
      const trimmedTextForConflictCheck = manuscriptTextInput.trim();
      if (trimmedTextForConflictCheck.length > 0) {
        return Response.json(
          {
            ok: false,
            error:
              'Ambiguous manuscript source: provide either manuscript_id or manuscript_text, not both.',
          },
          { status: 400 }
        );
      }

      const parsed = Number.parseInt(String(manuscriptIdInput), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return Response.json(
          { ok: false, error: 'Invalid manuscript_id' },
          { status: 400 }
        );
      }
      manuscriptId = parsed;

      const { data: existingManuscript, error: manuscriptLookupError } =
        await supabase
          .from('manuscripts')
          .select('id,user_id')
          .eq('id', manuscriptId)
          .single();

      if (manuscriptLookupError || !existingManuscript) {
        return Response.json(
          { ok: false, error: 'manuscript_id not found' },
          { status: 404 }
        );
      }

      if (existingManuscript.user_id !== userId) {
        return Response.json(
          { ok: false, error: 'Forbidden: manuscript does not belong to user' },
          { status: 403 }
        );
      }
    }

    const trimmedText = manuscriptTextInput.trim();
    if (!manuscriptId && trimmedText.length === 0) {
      return Response.json(
        {
          ok: false,
          error:
            'Missing manuscript input: provide manuscript_id or manuscript_text/content',
        },
        { status: 400 }
      );
    }

    // Step 1: Create manuscript
    if (!manuscriptId) {
      const encodedText = encodeURIComponent(trimmedText);
      const fileUrl = `data:text/plain;charset=utf-8,${encodedText}`;
      const fileSize = new TextEncoder().encode(trimmedText).length;
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
        return Response.json(
          { ok: false, error: `Manuscript error: ${manuscriptError?.message}` },
          { status: 500 }
        );
      }
      manuscriptId = manuscript.id;
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
      return Response.json(
        { ok: false, error: `Database error: ${error.message}` },
        { status: 500 }
      );
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
      return Response.json(
        {
          ok: false,
          error: 'Job creation failed — database verification failed. Please try again.',
        },
        { status: 500 }
      );
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
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Hard fail in /api/evaluate:', err);
    return Response.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
