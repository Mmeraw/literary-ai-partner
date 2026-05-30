import { getSupabaseAdminClient } from "@/lib/supabase";
import { ensureRevisionOpportunityLedgerArtifact } from './opportunityLedger';
import {
  bulkCreateDiagnosticFindings,
  listFindingsForEvaluationRun,
} from "./normalizeFindings";
import type { CreateDiagnosticFindingInput, DiagnosticFinding } from "./types";

export const OPERATIONAL_FINDINGS_SOURCE_CONTRACT = "derived_from_revision_opportunity_ledger_v1" as const;
export const OPERATIONAL_FINDING_TYPE = "revision_opportunity_ledger" as const;

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

function mapSeverityFromLedger(value: 'must' | 'should' | 'could'): 'high' | 'medium' | 'low' {
  if (value === 'must') return 'high';
  if (value === 'should') return 'medium';
  return 'low';
}

export async function ensureOperationalRevisionFindings(
  evaluationRunId: string,
  manuscriptVersionId: string,
): Promise<DiagnosticFinding[]> {
  const existingFindings = await listFindingsForEvaluationRun(evaluationRunId);
  if (existingFindings.length > 0) {
    return existingFindings;
  }

  const { artifactId, opportunities } = await ensureRevisionOpportunityLedgerArtifact(supabase, evaluationRunId);
  if (opportunities.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const inputs: CreateDiagnosticFindingInput[] = [];

  for (const opportunity of opportunities) {
    const input: CreateDiagnosticFindingInput = {
      evaluation_job_id: evaluationRunId,
      manuscript_version_id: manuscriptVersionId,
      artifact_id: artifactId,
      criterion_key: opportunity.criterion,
      wave_id: null,
      finding_type: OPERATIONAL_FINDING_TYPE,
      severity: mapSeverityFromLedger(opportunity.severity),
      confidence:
        opportunity.confidence === 'high'
          ? 0.9
          : opportunity.confidence === 'medium'
            ? 0.6
            : 0.35,
      location_ref: opportunity.manuscript_coordinates,
      original_text: opportunity.evidence_anchor,
      evidence_excerpt: opportunity.evidence_anchor,
      diagnosis: opportunity.rationale,
      recommendation: opportunity.rationale,
      action_hint: 'refine',
      status: 'open',
    };

    const key = signature(input);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    inputs.push(input);
  }

  if (inputs.length > 0) {
    await bulkCreateDiagnosticFindings(inputs);
  }

  return listFindingsForEvaluationRun(evaluationRunId);
}
