export type PreflightObservabilityOpportunity = {
  preflight_status?: 'passed' | 'limited_context' | 'blocked' | string | null;
  candidate_text_a?: string | null;
  candidate_text_b?: string | null;
  candidate_text_c?: string | null;
};

export type PreflightObservabilityMetrics = {
  preflight_status_admissible: number;
  preflight_clean: number;
  preflight_advisory: number;
  preflight_blocked: number;
  grounding_supported: null;
  hydration_required: number;
  final_admission_status: 'not_executed';
  workbench_runtime_status: 'not_executed';
};

function hasCandidateSet(opportunity: PreflightObservabilityOpportunity): boolean {
  return [
    opportunity.candidate_text_a,
    opportunity.candidate_text_b,
    opportunity.candidate_text_c,
  ].every((value) => typeof value === 'string' && value.trim().length > 0);
}

/**
 * Reports only the stages a reconstruction actually executed.
 *
 * This intentionally does not infer earned grounding or final Revise admission from
 * projection defaults. Hydration, final admission, and workbench runtime remain
 * explicitly unexecuted until the production path performs them.
 */
export function summarizePreflightObservability(
  opportunities: PreflightObservabilityOpportunity[],
): PreflightObservabilityMetrics {
  const preflightClean = opportunities.filter(
    (opportunity) => opportunity.preflight_status === 'passed',
  ).length;
  const preflightAdvisory = opportunities.filter(
    (opportunity) => opportunity.preflight_status === 'limited_context',
  ).length;
  const preflightBlocked = opportunities.filter(
    (opportunity) => opportunity.preflight_status === 'blocked',
  ).length;
  const preflightAdmissible = preflightClean + preflightAdvisory;
  const hydrationRequired = opportunities.filter(
    (opportunity) =>
      (opportunity.preflight_status === 'passed' ||
        opportunity.preflight_status === 'limited_context') &&
      !hasCandidateSet(opportunity),
  ).length;

  return {
    preflight_status_admissible: preflightAdmissible,
    preflight_clean: preflightClean,
    preflight_advisory: preflightAdvisory,
    preflight_blocked: preflightBlocked,
    grounding_supported: null,
    hydration_required: hydrationRequired,
    final_admission_status: 'not_executed',
    workbench_runtime_status: 'not_executed',
  };
}
