import { getSupabaseAdminClient } from "@/lib/supabase";
import { buildBaselineManuscriptDiscoveryFindings, isBaselineDiscoveryFindingType } from "./baselineManuscriptDiscovery";
import { buildDeepRevisionFindings } from "./deepRevisionExtraction";
import {
  bulkCreateDiagnosticFindings,
  createDiagnosticFindingsForEvaluationRun,
  listFindingsForEvaluationRun,
} from "./normalizeFindings";
import type { CreateDiagnosticFindingInput, DiagnosticFinding } from "./types";

let _supabase: ReturnType<typeof getSupabaseAdminClient> | undefined;

function getSupabase() {
  if (_supabase === undefined) _supabase = getSupabaseAdminClient();
  return _supabase;
}

const supabase = new Proxy({} as NonNullable<ReturnType<typeof getSupabaseAdminClient>>, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) throw new Error(`[REVISION-QUEUE] Supabase unavailable - cannot access .${String(prop)}`);
    return client[prop as keyof typeof client];
  },
});

function signature(input: CreateDiagnosticFindingInput): string {
  return [
    input.criterion_key,
    input.finding_type,
    input.location_ref ?? "",
    input.diagnosis,
    input.recommendation ?? "",
  ]
    .join("|")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function existingSignature(finding: DiagnosticFinding): string {
  return [
    finding.criterion_key,
    finding.finding_type,
    finding.location_ref ?? "",
    finding.diagnosis,
    finding.recommendation ?? "",
  ]
    .join("|")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hasDeepRevisionFinding(findings: DiagnosticFinding[]): boolean {
  return findings.some((finding) =>
    ["revision_queue", "revision_plan", "revision_priority", "revision_note", "repair_guidance"]
      .some((prefix) => finding.finding_type?.startsWith(prefix)),
  );
}

async function createDeepRevisionFindings(
  evaluationRunId: string,
  manuscriptVersionId: string,
  existing: DiagnosticFinding[],
): Promise<DiagnosticFinding[]> {
  if (hasDeepRevisionFinding(existing)) return existing;

  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .select("id, artifact_type, content, created_at")
    .eq("job_id", evaluationRunId)
    .in("artifact_type", ["evaluation_result_v2", "evaluation_result_v1"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(`createDeepRevisionFindings failed: ${error.message}`);

  const seen = new Set(existing.map(existingSignature));
  const inputs: CreateDiagnosticFindingInput[] = [];

  for (const row of data ?? []) {
    const artifactId = typeof row.id === "string" ? row.id : null;
    if (!artifactId) continue;

    for (const input of buildDeepRevisionFindings(evaluationRunId, manuscriptVersionId, artifactId, row.content ?? {})) {
      const key = signature(input);
      if (seen.has(key)) continue;
      seen.add(key);
      inputs.push(input);
    }
  }

  if (inputs.length > 0) await bulkCreateDiagnosticFindings(inputs);
  return listFindingsForEvaluationRun(evaluationRunId);
}

async function createBaselineDiscoveryFindings(
  evaluationRunId: string,
  manuscriptVersionId: string,
  existing: DiagnosticFinding[],
): Promise<DiagnosticFinding[]> {
  if (existing.some((finding) => isBaselineDiscoveryFindingType(finding.finding_type))) return existing;

  const discovered = await buildBaselineManuscriptDiscoveryFindings(evaluationRunId, manuscriptVersionId);
  if (discovered.length === 0) return existing;

  const seen = new Set(existing.map(existingSignature));
  const deduped = discovered.filter((input) => {
    const key = signature(input);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length > 0) await bulkCreateDiagnosticFindings(deduped);
  return listFindingsForEvaluationRun(evaluationRunId);
}

export async function ensureOperationalRevisionFindings(
  evaluationRunId: string,
  manuscriptVersionId: string,
): Promise<DiagnosticFinding[]> {
  await createDiagnosticFindingsForEvaluationRun(evaluationRunId, manuscriptVersionId);
  let findings = await listFindingsForEvaluationRun(evaluationRunId);
  findings = await createDeepRevisionFindings(evaluationRunId, manuscriptVersionId, findings);
  findings = await createBaselineDiscoveryFindings(evaluationRunId, manuscriptVersionId, findings);
  return findings;
}
