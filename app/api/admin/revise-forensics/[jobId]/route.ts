import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function countBy<T extends string>(items: unknown[], selector: (item: JsonRecord) => T | null) {
  return items.reduce<Record<string, number>>((acc, raw) => {
    const key = selector(asRecord(raw));
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function collectReasons(items: unknown[]) {
  const reasons = new Set<string>();
  for (const raw of items) {
    const item = asRecord(raw);
    for (const field of ["block_reasons", "withheld_reasons", "hydration_failure_reasons", "preflight_reasons", "reasons"]) {
      for (const reason of asArray(item[field])) {
        if (typeof reason === "string" && reason.trim()) reasons.add(reason.trim());
      }
    }
  }
  return Array.from(reasons).sort();
}

export async function GET(req: NextRequest, context: RouteContext) {
  const actor = getDevHeaderActor(req);
  if (!actor?.isAdmin) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  const { jobId } = await context.params;
  const supabase = createAdminClient();

  const [jobResult, ledgerResult] = await Promise.all([
    supabase
      .from("evaluation_jobs")
      .select("id,user_id,manuscript_id,status,phase,phase_status,failure_code,last_error,created_at,updated_at")
      .eq("id", jobId)
      .maybeSingle(),
    supabase
      .from("evaluation_artifacts")
      .select("id,artifact_type,content,created_at")
      .eq("job_id", jobId)
      .eq("artifact_type", "revision_opportunity_ledger_v1")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (jobResult.error) {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch job", details: jobResult.error.message },
      { status: 500 },
    );
  }

  if (!jobResult.data) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  if (ledgerResult.error) {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch revision opportunity ledger", details: ledgerResult.error.message },
      { status: 500 },
    );
  }

  const ledgerArtifact = ledgerResult.data ?? null;
  const content = asRecord(ledgerArtifact?.content);
  const sourceManifest = asRecord(content.source_manifest);
  const fieldSourceOwnership = asRecord(content.field_source_ownership);
  const fieldSourceOfTruth = asRecord(sourceManifest.field_source_of_truth);
  const opportunities = asArray(content.opportunities);

  const readinessCounts = countBy(opportunities, (item) => {
    const value = item.readiness ?? item.decision_state ?? item.status;
    return typeof value === "string" ? value : null;
  });

  const groundingCounts = countBy(opportunities, (item) => {
    const value = item.grounding_status ?? item.anchor_grounding_status;
    return typeof value === "string" ? value : null;
  });

  const preflightCounts = countBy(opportunities, (item) => {
    const value = item.preflight_status;
    return typeof value === "string" ? value : null;
  });

  const ownershipCounts = countBy(opportunities, (item) => {
    const proof = asRecord(item.field_source_ownership);
    const value = proof.validation_status;
    return typeof value === "string" ? value : null;
  });

  const candidateOwnershipCounts = countBy(opportunities, (item) => {
    const proof = asRecord(item.field_source_ownership);
    const owners = asArray(proof.field_owners);
    const candidateOwner = owners.find((owner) => {
      const ownerRecord = asRecord(owner);
      const fields = asArray(ownerRecord.fields);
      return fields.some((field) => typeof field === "string" && field.startsWith("candidate_text"));
    });
    const ownerRecord = asRecord(candidateOwner);
    const owner = ownerRecord.owner;
    return typeof owner === "string" ? owner : null;
  });

  const sampleOpportunities = opportunities.slice(0, 12).map((raw) => {
    const item = asRecord(raw);
    const proof = asRecord(item.field_source_ownership);
    return {
      opportunity_id: item.opportunity_id ?? item.id ?? null,
      criterion: item.criterion ?? item.criterion_key ?? null,
      readiness: item.readiness ?? item.decision_state ?? item.status ?? null,
      grounding_status: item.grounding_status ?? item.anchor_grounding_status ?? null,
      preflight_status: item.preflight_status ?? null,
      revision_operation: item.revision_operation ?? null,
      ownership_status: proof.validation_status ?? null,
      violations: proof.violations ?? [],
      reasons: collectReasons([item]),
    };
  });

  return NextResponse.json({
    ok: true,
    job: jobResult.data,
    ledger: ledgerArtifact
      ? {
          artifact_id: ledgerArtifact.id,
          artifact_type: ledgerArtifact.artifact_type,
          created_at: ledgerArtifact.created_at,
          opportunity_count: opportunities.length,
          source_hash: content.source_hash ?? sourceManifest.source_hash ?? null,
          source_completeness_status: sourceManifest.source_completeness_status ?? null,
          missing_required_sources: sourceManifest.missing_required_sources ?? [],
          degraded_sources: sourceManifest.degraded_sources ?? [],
          evaluation_result_artifact_type: sourceManifest.evaluation_result_artifact_type ?? null,
          evaluation_result_artifact_id: sourceManifest.evaluation_result_artifact_id ?? null,
          legacy_fallback: sourceManifest.legacy_fallback ?? false,
          revision_opportunity_ledger: sourceManifest.revision_opportunity_ledger ?? null,
          field_source_ownership: fieldSourceOwnership,
          field_source_of_truth: fieldSourceOfTruth,
          source_manifest: sourceManifest,
        }
      : null,
    summary: {
      readiness_counts: readinessCounts,
      grounding_counts: groundingCounts,
      preflight_counts: preflightCounts,
      ownership_counts: ownershipCounts,
      candidate_ownership_counts: candidateOwnershipCounts,
      reasons: collectReasons(opportunities),
    },
    opportunities: sampleOpportunities,
  });
}
