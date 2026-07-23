import { NextResponse } from "next/server";
import { createJob, getAllJobs } from "@/lib/jobs/store";
import * as metrics from "@/lib/jobs/metrics";
import {
  checkJobCreationRateLimit,
  checkFeatureAccess,
  validateManuscriptSize,
  type RateLimitResult,
} from "@/lib/jobs/rateLimiter";
import { JOB_TYPES, isEvaluationJobType, type JobType } from "@/lib/jobs/types";
import { generateTraceId, logger, jobLogger } from "@/lib/observability/logger";
import { emitLatencyTrace } from "@/lib/observability/latencyTrace";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProofJobIdentity } from "@/lib/auth/proofJobIdentity";
import { backpressureGuard } from "@/lib/jobs/backpressure";
import { isTriggerWorkerFailure, triggerEvaluationWorker } from "@/lib/jobs/triggerWorker";
import { resolveManuscriptTitle } from "@/lib/manuscripts/title";
import { computeEnrichment, type EnrichmentResult } from "@/lib/evaluation/enrichment";
import {
  buildNarrativePreflightAudit,
  routeNarrativeEvaluationPreflight,
} from "@/lib/evaluation/preflight/manuscriptTypeRouting";
import { createInitialVersion } from "@/lib/manuscripts/versions";
import { attachFreeDiagnosticJob, claimFreeDiagnostic } from "@/lib/freeDiagnostic/claims";
import { normalizeEnglishVariant } from "@/lib/evaluation/englishVariant";

function isRateLimited(
  result: RateLimitResult
): result is { allowed: false; reason: string; retryAfter?: number } {
  return result.allowed === false;
}

const ALLOWED_JOB_TYPES = new Set<string>(Object.values(JOB_TYPES));

function normalizeWordCountCandidate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

function decodeInlineManuscriptText(fileUrl: string | null | undefined): string {
  if (typeof fileUrl !== "string" || fileUrl.trim().length === 0) return "";
  const trimmed = fileUrl.trim();
  if (!trimmed.startsWith("data:")) return "";
  const comma = trimmed.indexOf(",");
  if (comma === -1) return "";

  try {
    return decodeURIComponent(trimmed.slice(comma + 1));
  } catch {
    return "";
  }
}

function buildInstantEnrichmentProgress(enrichment: EnrichmentResult | null): Record<string, unknown> {
  if (!enrichment) return {};
  return {
    enrichment_reading_grade_level: enrichment.reading_grade_level ?? null,
    enrichment_dialogue_percentage: enrichment.dialogue_percentage ?? null,
    enrichment_narrative_percentage: enrichment.narrative_percentage ?? null,
    enrichment_computed_at: new Date().toISOString(),
    enrichment_source: "job_intake",
  };
}

async function readOwnedManuscriptText(params: {
  manuscriptId: number;
  userId: string;
  trace_id: string;
  request_id: string;
}): Promise<string> {
  try {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("manuscripts")
      .select("file_url")
      .eq("id", params.manuscriptId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to read manuscript text for evaluation intake enrichment", {
        trace_id: params.trace_id,
        request_id: params.request_id,
        event: "api.jobs.create.manuscript_text_lookup_failed",
        manuscript_id: params.manuscriptId,
        error: error.message,
      });
      return "";
    }

    return decodeInlineManuscriptText(data?.file_url as string | null | undefined);
  } catch (error) {
    logger.warn("Failed to read manuscript text for evaluation intake enrichment", {
      trace_id: params.trace_id,
      request_id: params.request_id,
      event: "api.jobs.create.manuscript_text_lookup_exception",
      manuscript_id: params.manuscriptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

async function readOwnedManuscriptWordCount(params: {
  manuscriptId: number;
  userId: string;
  trace_id: string;
  request_id: string;
}): Promise<number | null> {
  try {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("manuscripts")
      .select("word_count")
      .eq("id", params.manuscriptId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to read manuscript word count for evaluation intake", {
        trace_id: params.trace_id,
        request_id: params.request_id,
        event: "api.jobs.create.manuscript_word_count_lookup_failed",
        manuscript_id: params.manuscriptId,
        error: error.message,
      });
      return null;
    }

    return normalizeWordCountCandidate(data?.word_count);
  } catch (error) {
    logger.warn("Failed to read manuscript word count for evaluation intake", {
      trace_id: params.trace_id,
      request_id: params.request_id,
      event: "api.jobs.create.manuscript_word_count_lookup_exception",
      manuscript_id: params.manuscriptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function seedJobIntakeProgress(params: {
  job: { id: string; progress?: Record<string, unknown> | null };
  manuscriptWordCount: number | null;
  instantEnrichment: Record<string, unknown>;
  submittedAuthorName: string | null;
  submittedProjectTitle: string | null;
  fastTrackPhase0: boolean;
  trace_id: string;
  request_id: string;
  manuscript_id: number | string;
}): Promise<void> {
  if (
    params.manuscriptWordCount === null &&
    Object.keys(params.instantEnrichment).length === 0 &&
    params.submittedAuthorName === null &&
    params.submittedProjectTitle === null &&
    !params.fastTrackPhase0
  ) return;

  const supabaseAdmin = createAdminClient();
  const now = new Date().toISOString();
  const existingProgress = (params.job.progress ?? {}) as Record<string, unknown>;
  const existingChunkRoutingRaw = existingProgress["chunk_routing"];
  const existingChunkRouting =
    existingChunkRoutingRaw && typeof existingChunkRoutingRaw === "object"
      ? (existingChunkRoutingRaw as Record<string, unknown>)
      : {};

  const nextProgress: Record<string, unknown> = {
    ...existingProgress,
    ...params.instantEnrichment,
    ...(params.submittedAuthorName !== null
      ? { submitted_author_name: params.submittedAuthorName }
      : {}),
    ...(params.submittedProjectTitle !== null
      ? { submitted_project_title: params.submittedProjectTitle }
      : {}),
    ...(params.manuscriptWordCount !== null
      ? {
          manuscript_word_count: params.manuscriptWordCount,
          chunk_routing: {
            ...existingChunkRouting,
            manuscript_words: params.manuscriptWordCount,
            source_manuscript_words: params.manuscriptWordCount,
          },
        }
      : {}),
  };

  const updatePayload: Record<string, unknown> = {
    progress: nextProgress,
    updated_at: now,
  };

  if (params.fastTrackPhase0) {
    Object.assign(nextProgress, {
      phase: "phase_0",
      phase_status: "queued",
      message: "Short-form evaluation queued for Phase 0 seed preparation",
      phase0_fast_track: true,
      phase0_fast_track_reason: "short_form_under_25000_words",
      phase0_calibration_word_count: params.manuscriptWordCount ?? null,
      total_units: 100,
      completed_units: 0,
    });

    Object.assign(updatePayload, {
      phase: "phase_0",
      phase_status: "queued",
    });
  }

  const { error } = await supabaseAdmin
    .from("evaluation_jobs")
    .update(updatePayload)
    .eq("id", params.job.id);

  if (error) {
    logger.warn("Failed to seed evaluation job intake progress", {
      trace_id: params.trace_id,
      request_id: params.request_id,
      event: "api.jobs.create.intake_progress_seed_failed",
      job_id: params.job.id,
      manuscript_id: params.manuscript_id,
      manuscript_word_count: params.manuscriptWordCount,
      fast_track_phase0: params.fastTrackPhase0,
      error: error.message,
    });
    return;
  }

  if (params.fastTrackPhase0) {
    logger.info("Short-form evaluation marked for Phase 0 fast-track seed preparation", {
      trace_id: params.trace_id,
      request_id: params.request_id,
      event: "api.jobs.create.phase0_fast_track",
      job_id: params.job.id,
      manuscript_id: params.manuscript_id,
      manuscript_word_count: params.manuscriptWordCount,
    });
  }
}

export async function POST(req: Request) {
  const trace_id = generateTraceId();
  const request_id = generateTraceId();

  if (process.env.NODE_ENV === "production" && process.env.USE_SUPABASE_JOBS !== "true") {
    logger.error("Production misconfiguration: memory store disabled", {
      trace_id,
      request_id,
      event: "api.jobs.create.production_memory_store_blocked",
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          "Server misconfiguration: USE_SUPABASE_JOBS must be true in production.",
        trace_id,
      },
      { status: 503 }
    );
  }

  logger.info("Job creation request received", {
    trace_id,
    request_id,
    event: "api.jobs.create.start",
  });

  try {
    const rateLimitResult = await checkJobCreationRateLimit(req);
    if (isRateLimited(rateLimitResult)) {
      const { reason, retryAfter } = rateLimitResult;

      logger.warn("Job creation rate limited", {
        trace_id,
        request_id,
        event: "api.jobs.create.rate_limited",
        reason,
      });

      return NextResponse.json(
        {
          ok: false,
          error: reason,
          retry_after: retryAfter ?? null,
          trace_id,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const processing_terms_accepted = body?.processing_terms_accepted;

    let manuscript_id = body?.manuscript_id;
    const job_type = body?.job_type;
    const manuscript_text = body?.manuscript_text;
    const author_name = body?.author_name;
    const manuscript_title = body?.manuscript_title;
    const manuscript_size = body?.manuscript_size;
    const english_variant = normalizeEnglishVariant(body?.english_variant);
    const sensitivity_mode = typeof body?.sensitivity_mode === "string" && ["STANDARD", "TRANSGRESSIVE", "TESTIMONY"].includes(body.sensitivity_mode) ? body.sensitivity_mode : "STANDARD";
    const voice_preservation_level = typeof body?.voice_preservation_level === "string" && ["maximum", "balanced", "polished"].includes(body.voice_preservation_level) ? body.voice_preservation_level : "balanced";
    const user_tier = body?.user_tier as "free" | "premium" | "agent" | undefined;
    let immediateManuscriptWordCount: number | null = null;
    let resolvedManuscriptWordCount: number | null = null;
    let intakeManuscriptText = "";
    let sourceVersionId: string | null = null;
    let narrativePreflightAudit: Record<string, unknown> = {};

    if (!manuscript_id && !manuscript_text) {
      logger.warn("Job creation validation failed", {
        trace_id,
        request_id,
        event: "api.jobs.create.validation_failed",
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: manuscript_id or manuscript_text",
          trace_id,
        },
        { status: 400 }
      );
    }

    if (
      manuscript_id !== undefined &&
      manuscript_id !== null &&
      typeof manuscript_text === "string" &&
      manuscript_text.trim().length > 0
    ) {
      logger.warn("Job creation validation failed: ambiguous manuscript input", {
        trace_id,
        request_id,
        event: "api.jobs.create.ambiguous_manuscript_input",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "Ambiguous manuscript source: provide either manuscript_id or manuscript_text, not both.",
          trace_id,
        },
        { status: 400 }
      );
    }

    if (!job_type) {
      logger.warn("Job creation validation failed", {
        trace_id,
        request_id,
        event: "api.jobs.create.validation_failed",
      });

      return NextResponse.json(
        { ok: false, error: "Missing required fields: job_type", trace_id },
        { status: 400 }
      );
    }

    if (typeof job_type !== "string" || !ALLOWED_JOB_TYPES.has(job_type)) {
      logger.warn("Invalid job_type", {
        trace_id,
        request_id,
        event: "api.jobs.create.invalid_job_type",
        job_type,
      });

      return NextResponse.json(
        { ok: false, error: "Invalid job_type", trace_id },
        { status: 400 }
      );
    }

    const validatedJobType = job_type as JobType;

    if (isEvaluationJobType(validatedJobType) && processing_terms_accepted !== true) {
      logger.warn("Job creation validation failed: processing terms acknowledgement missing", {
        trace_id,
        request_id,
        event: "api.jobs.create.processing_terms_ack_missing",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "Please acknowledge that RevisionGrade evaluations are custom digital services and that processing begins after submission.",
          trace_id,
        },
        { status: 400 }
      );
    }

    const resolvedManuscriptSize =
      typeof manuscript_size === "number"
        ? manuscript_size
        : typeof manuscript_text === "string"
        ? new TextEncoder().encode(manuscript_text).length
        : undefined;

    if (resolvedManuscriptSize && typeof resolvedManuscriptSize === "number") {
      const sizeCheck = validateManuscriptSize(resolvedManuscriptSize);
      if (sizeCheck.allowed === false) {
        const { reason } = sizeCheck;
        logger.warn("Manuscript size validation failed", {
          trace_id,
          request_id,
          event: "api.jobs.create.size_validation_failed",
          manuscript_size: resolvedManuscriptSize,
          reason,
        });
        return NextResponse.json({ ok: false, error: reason, trace_id }, { status: 413 });
      }
    }

    const authenticatedUser = await getAuthenticatedUser();
    // Third, explicitly gated fallback: operator-nominated proof identity for the
    // C2 live-proof harness (bearer CRON_SECRET + x-proof-user-id that must own
    // the target manuscript, gated by ALLOW_PROOF_JOB_IDENTITY). Only consulted
    // when there is no authenticated user. Never bypasses manuscript ownership;
    // returns null unless every safety condition holds. See lib/auth/proofJobIdentity.
    const proofIdentity = authenticatedUser?.id
      ? null
      : await resolveProofJobIdentity(req, manuscript_id);
    if (proofIdentity) {
      // Audit trail for the privileged proof path. Wrapped so a logging failure
      // can never break job creation. Ownership is already verified upstream
      // (verified_owner is always true here by construction of the helper).
      try {
        logger.warn("Operator-nominated proof identity used for job creation", {
          trace_id,
          proof_identity_used: true,
          proof_user_id: proofIdentity.userId,
          manuscript_id,
          verified_owner: true,
          source: proofIdentity.source,
        });
      } catch {
        /* never let audit logging break the request */
      }
    }
    const userId =
      authenticatedUser?.id ??
      proofIdentity?.userId ??
      (process.env.ALLOW_HEADER_USER_ID === "true"
        ? req.headers.get("x-user-id")
        : null);
    const userEmail = authenticatedUser?.email ?? null;

    if (!userId) {
      logger.warn("Job creation blocked: missing authenticated user", {
        trace_id,
        request_id,
        event: "api.jobs.create.auth_missing",
      });

      return NextResponse.json(
        { ok: false, error: "Authentication required for this feature.", trace_id },
        { status: 401 }
      );
    }

    if (!manuscript_id && typeof manuscript_text === "string") {
      const trimmedText = manuscript_text.trim();
      intakeManuscriptText = trimmedText;
      if (trimmedText.length === 0) {
        return NextResponse.json(
          { ok: false, error: "manuscript_text cannot be empty", trace_id },
          { status: 400 }
        );
      }

      const preflightDecision = routeNarrativeEvaluationPreflight(trimmedText);
      // Audit-only: record detected type in job progress but never block submission.
      narrativePreflightAudit = buildNarrativePreflightAudit(preflightDecision);

      const encodedText = encodeURIComponent(trimmedText);
      const fileUrl = `data:text/plain;charset=utf-8,${encodedText}`;
      const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;
      immediateManuscriptWordCount = wordCount;
      resolvedManuscriptWordCount = wordCount;
      const fileSize = new TextEncoder().encode(trimmedText).length;
      const resolvedTitle = resolveManuscriptTitle({
        explicitTitle: manuscript_title,
        text: trimmedText,
        fallback: "Imported Manuscript",
      });

      const supabaseAdmin = createAdminClient();
      const { data: manuscript, error: manuscriptError } = await supabaseAdmin
        .from("manuscripts")
        .insert({
          title: resolvedTitle,
          user_id: userId,
          created_by: userId,
          file_url: fileUrl,
          file_size: fileSize,
          work_type: "novel",
          tone_context: "neutral",
          mood_context: "calm",
          voice_mode: "balanced",
          storygate_linked: false,
          allow_industry_discovery: false,
          is_final: false,
          source: "paste",
          english_variant,
          word_count: wordCount,
        })
        .select("id")
        .single();

      if (manuscriptError || !manuscript) {
        logger.error("Failed to create manuscript", {
          trace_id,
          request_id,
          event: "api.jobs.create.manuscript_error",
          error: manuscriptError?.message,
        });

        return NextResponse.json(
          { ok: false, error: "Failed to create manuscript", trace_id },
          { status: 500 }
        );
      }

      manuscript_id = manuscript.id;
    }

    if (typeof manuscript_id === "string") {
      const trimmedId = manuscript_id.trim();
      const parsedId = Number.parseInt(trimmedId, 10);
      if (Number.isNaN(parsedId) || String(parsedId) !== trimmedId) {
        return NextResponse.json(
          { ok: false, error: "Invalid manuscript_id: must be numeric", trace_id },
          { status: 400 }
        );
      }
      manuscript_id = parsedId;
    }

    if (resolvedManuscriptWordCount === null && typeof manuscript_id === "number") {
      resolvedManuscriptWordCount = await readOwnedManuscriptWordCount({
        manuscriptId: manuscript_id,
        userId,
        trace_id,
        request_id,
      });
    }

    if (!intakeManuscriptText && typeof manuscript_id === "number") {
      intakeManuscriptText = await readOwnedManuscriptText({
        manuscriptId: manuscript_id,
        userId,
        trace_id,
        request_id,
      });
    }

    if (typeof manuscript_id === "number") {
      if (!intakeManuscriptText || intakeManuscriptText.trim().length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Source snapshot missing. Please repair before evaluating.",
            code: "MANUSCRIPT_SOURCE_SNAPSHOT_MISSING",
            trace_id,
          },
          { status: 422 }
        );
      }

      const preflightDecision = routeNarrativeEvaluationPreflight(intakeManuscriptText);
      // Audit-only: record detected type in job progress but never block submission.
      narrativePreflightAudit = buildNarrativePreflightAudit(preflightDecision);

      try {
        const sourceVersion = await createInitialVersion({
          manuscript_id,
          raw_text: intakeManuscriptText,
          word_count: resolvedManuscriptWordCount ?? immediateManuscriptWordCount ?? undefined,
          created_by: userId,
        });
        sourceVersionId = sourceVersion.id;
      } catch (snapshotError: unknown) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to create manuscript source snapshot",
            details:
              snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
            trace_id,
          },
          { status: 500 }
        );
      }
    }

    const instantEnrichment = buildInstantEnrichmentProgress(
      intakeManuscriptText ? computeEnrichment(intakeManuscriptText) : null,
    );

    const featureAccess = await checkFeatureAccess(userId, validatedJobType, user_tier);

    if (featureAccess.allowed === false) {
      const { reason } = featureAccess;
      logger.warn("Feature access denied", {
        trace_id,
        request_id,
        event: "api.jobs.create.access_denied",
        user_id: userId,
        job_type: validatedJobType,
        reason,
      });
      return NextResponse.json({ ok: false, error: reason, trace_id }, { status: 403 });
    }

    const isFreeDiagnosticClaim = user_tier === "free" && isEvaluationJobType(validatedJobType);
    let freeDiagnosticClaimId: string | null = null;

    const backpressureBlock = await backpressureGuard();
    if (backpressureBlock) {
      logger.warn("Job creation blocked by backpressure", {
        trace_id,
        request_id,
        event: "api.jobs.create.backpressure_blocked",
        queue_depth: backpressureBlock.queueDepth,
      });
      return NextResponse.json(
        {
          ok: false,
          error: backpressureBlock.error,
          code: backpressureBlock.code,
          retry_after: backpressureBlock.retryAfter,
          trace_id,
        },
        {
          status: 503,
          headers: { "retry-after": String(backpressureBlock.retryAfter) },
        }
      );
    }

    // Proactive check: block duplicate active jobs for the same manuscript before INSERT
    // This gives a clean user-facing message instead of relying on the DB constraint error
    {
      const adminClient = createAdminClient();
      const { data: activeJobs } = await adminClient
        .from("evaluation_jobs")
        .select("id, status, user_id")
        .eq("manuscript_id", manuscript_id)
        .in("status", ["queued", "running"])
        .limit(1);
      if (activeJobs && activeJobs.length > 0) {
        const existingJob = activeJobs[0];
        logger.warn("Job creation blocked: active job exists for manuscript", {
          trace_id,
          request_id,
          event: "api.jobs.create.active_job_conflict",
          manuscript_id,
          existing_job_id: existingJob.id,
          existing_job_user_id: existingJob.user_id,
        });
        return NextResponse.json(
          {
            ok: false,
            error: "An evaluation is already running or queued for this manuscript. Please wait for it to finish, cancel it, or use a different manuscript.",
            code: "ACTIVE_JOB_CONFLICT",
            existing_job_id: existingJob.id,
            existing_job_user_id: existingJob.user_id,
            trace_id,
          },
          { status: 409 }
        );
      }
    }

    if (isFreeDiagnosticClaim) {
      const claimResult = await claimFreeDiagnostic({
        supabase: createAdminClient(),
        req,
        userId,
        email: userEmail,
        manuscriptId: manuscript_id,
      });

      if (claimResult.ok === false) {
        logger.warn("Free diagnostic claim blocked", {
          trace_id,
          request_id,
          event: "api.jobs.create.free_diagnostic_blocked",
          user_id: userId,
          code: claimResult.code,
        });

        return NextResponse.json(
          {
            ok: false,
            error: claimResult.message,
            code: claimResult.code,
            trace_id,
          },
          { status: claimResult.status },
        );
      }

      freeDiagnosticClaimId = claimResult.claimId;
    }

    const job = await createJob({
      manuscript_id,
      manuscript_version_id: sourceVersionId ?? undefined,
      user_id: userId,
      job_type: validatedJobType,
      sensitivity_mode,
      voice_preservation_level,
      english_variant,
    });

    if (freeDiagnosticClaimId) {
      await attachFreeDiagnosticJob({
        supabase: createAdminClient(),
        claimId: freeDiagnosticClaimId,
        jobId: job.id,
      });
    }

    const shouldFastTrackPhase0 =
      isEvaluationJobType(validatedJobType) &&
      typeof (resolvedManuscriptWordCount ?? immediateManuscriptWordCount) === "number" &&
      (resolvedManuscriptWordCount ?? immediateManuscriptWordCount)! < 25_000;

    await seedJobIntakeProgress({
      job,
      manuscriptWordCount: resolvedManuscriptWordCount ?? immediateManuscriptWordCount,
      instantEnrichment: { ...instantEnrichment, ...narrativePreflightAudit },
      submittedAuthorName: typeof author_name === "string" && author_name.trim().length > 0 ? author_name.trim() : null,
      submittedProjectTitle: typeof manuscript_title === "string" && manuscript_title.trim().length > 0 ? manuscript_title.trim() : null,
      fastTrackPhase0: shouldFastTrackPhase0,
      trace_id,
      request_id,
      manuscript_id,
    });

    const jobAcceptedAt = new Date().toISOString();
    emitLatencyTrace({
      job_id: job.id,
      stage: "job_create",
      state: "accepted",
      started_at: jobAcceptedAt,
      metadata: {
        source: "api.jobs.create",
        job_type: validatedJobType,
        manuscript_word_count: resolvedManuscriptWordCount,
        phase0_fast_track: shouldFastTrackPhase0,
      },
    });

    jobLogger.created(job.id, validatedJobType, {
      trace_id,
      request_id,
      manuscript_id,
      user_id: userId,
    });

    metrics.onJobCreated(job.id, validatedJobType);

    const kickoffDispatchStartedAt = new Date().toISOString();
    emitLatencyTrace({
      job_id: job.id,
      stage: "worker_kickoff",
      state: "dispatch_started",
      started_at: kickoffDispatchStartedAt,
      metadata: {
        source: "api.jobs.create",
        phase0_fast_track: shouldFastTrackPhase0,
      },
    });
    // Do not block the user-facing job creation response on worker kickoff.
    // The evaluation page/poller can show queued/running state while the worker claims the job.
    void triggerEvaluationWorker({
      req,
      jobId: job.id,
      trace_id,
      request_id,
      source: "api.jobs.create",
      kickoffDispatchStartedAt,
    }).then((kickoffResult) => {
      const targetClaimFailed = kickoffResult.ok && kickoffResult.targetClaimed === false;
      const noJobsClaimed = kickoffResult.ok && kickoffResult.claimed !== null && kickoffResult.claimed < 1;

      if (!kickoffResult.ok || targetClaimFailed || noJobsClaimed) {
        const reason = isTriggerWorkerFailure(kickoffResult)
          ? (kickoffResult.error ?? kickoffResult.reason)
          : targetClaimFailed
            ? "worker_did_not_claim_created_job"
            : "worker_returned_zero_claims";

        logger.error("Worker kickoff failed after job creation", {
          trace_id,
          request_id,
          event: "api.jobs.create.worker_kickoff_failed_async",
          job_id: job.id,
          reason,
          worker_body: kickoffResult.ok ? kickoffResult.body : kickoffResult.body,
        });

        return;
      }

      logger.info("Worker kickoff accepted job asynchronously", {
        trace_id,
        request_id,
        event: "api.jobs.create.worker_kickoff_async_ok",
        job_id: job.id,
      });
    }).catch((error) => {
      logger.error("Worker kickoff threw after job creation", {
        trace_id,
        request_id,
        event: "api.jobs.create.worker_kickoff_async_exception",
        job_id: job.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return;
    });

    logger.info("Job created successfully", {
      trace_id,
      request_id,
      event: "api.jobs.create.success",
      job_id: job.id,
      job_type: validatedJobType,
      manuscript_word_count: resolvedManuscriptWordCount,
      phase0_fast_track: shouldFastTrackPhase0,
    });

    return NextResponse.json(
      {
        ok: true,
        job_id: job.id,
        status: job.status,
        manuscript_word_count: resolvedManuscriptWordCount,
        phase0_fast_track: shouldFastTrackPhase0,
        trace_id,
      },
      { status: 201 }
    );
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    const looksLikeJsonParseError =
      err instanceof SyntaxError || /json/i.test(details);
    const looksLikeDuplicateActiveJobConflict =
      /duplicate key value violates unique constraint/i.test(details) ||
      /uq_eval_jobs_active/i.test(details) ||
      /ACTIVE_JOB_CONFLICT/i.test(details);

    logger.error("Job creation error", {
      trace_id,
      request_id,
      event: "api.jobs.create.error",
      error: details,
      error_type: looksLikeJsonParseError
        ? "client_json"
        : looksLikeDuplicateActiveJobConflict
        ? "active_job_conflict"
        : "system",
    });

    console.error("POST /api/jobs error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: looksLikeJsonParseError
          ? "Invalid JSON body"
          : looksLikeDuplicateActiveJobConflict
          ? "An evaluation is already running or queued for this manuscript. Please wait for it to finish or use a different manuscript."
          : "Failed to create job",
        details,
        trace_id,
      },
      {
        status: looksLikeJsonParseError
          ? 400
          : looksLikeDuplicateActiveJobConflict
          ? 409
          : 500,
      }
    );
  }
}

export async function GET() {
  const trace_id = generateTraceId();
  const request_id = crypto.randomUUID();

  if (process.env.NODE_ENV === "production" && process.env.USE_SUPABASE_JOBS !== "true") {
    logger.error("Production misconfiguration: memory store disabled", {
      trace_id,
      request_id,
      event: "api.jobs.list.production_memory_store_blocked",
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          "Server misconfiguration: USE_SUPABASE_JOBS must be true in production.",
        trace_id,
      },
      { status: 503 }
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    logger.info("GET /api/jobs request received", {
      trace_id,
      request_id,
      event: "api.jobs.list.request",
      user_id: userId,
    });

    const jobs = await getAllJobs(userId);

    logger.info("Jobs retrieved", {
      trace_id,
      request_id,
      event: "api.jobs.list.success",
      job_count: jobs.length,
    });

    return NextResponse.json({ jobs, trace_id }, { status: 200 });
  } catch (err) {
    logger.error("GET /api/jobs error", {
      trace_id,
      request_id,
      event: "api.jobs.list.error",
      error: err instanceof Error ? err.message : String(err),
    });

    console.error("GET /api/jobs error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Jobs endpoint failure",
        details: err instanceof Error ? err.message : String(err),
        trace_id,
      },
      { status: 500 }
    );
  }
}
