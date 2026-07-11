import fs from 'fs';
import path from 'path';

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const artifactPath = process.argv[2] ??
  'artifacts/revision-proof-let-the-river-decide-9ee70f12.json';
const resolvedPath = path.resolve(process.cwd(), artifactPath);
const artifact = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as AnyRecord;
const reconstruction = asRecord(artifact.current_code_reconstruction);
const preflight = asRecord(reconstruction.preflight);
const attrition = asRecord(reconstruction.attrition_report);
const hydrationSubset = asRecord(reconstruction.hydration_lookup_runtime_candidate_subset);

const preflightClean = finiteNumber(preflight.passed);
const preflightAdvisory = finiteNumber(preflight.limited_context);
const preflightBlocked = finiteNumber(preflight.blocked);
const preflightStatusAdmissible = preflightClean + preflightAdvisory;
const hydrationRequired = finiteNumber(hydrationSubset.total);

const headline = {
  schema_version: 'revision_preflight_observability_v1',
  source_artifact: artifactPath,
  current_code_reconstruction: {
    reconstructed_opportunities: finiteNumber(reconstruction.revision_ledger),
    preflight_status_admissible: preflightStatusAdmissible,
    preflight_clean: preflightClean,
    preflight_advisory: preflightAdvisory,
    preflight_blocked: preflightBlocked,
    grounding_supported: null,
    hydration_required: hydrationRequired,
    hydration_anchor_lookup_no_match: finiteNumber(
      attrition.hydration_lookup_no_match_runtime_candidate_subset,
    ),
    final_admission_status: 'not_executed',
    workbench_runtime_status: 'not_executed',
  },
  assertions: {
    preflight_reconciles:
      preflightStatusAdmissible + preflightBlocked ===
      finiteNumber(reconstruction.revision_ledger),
    does_not_claim_earned_grounding: true,
    does_not_claim_final_admission: true,
    does_not_claim_workbench_execution: true,
  },
};

console.log(JSON.stringify(headline, null, 2));
