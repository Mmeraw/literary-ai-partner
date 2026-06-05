import { assertReportPersistenceAllowed, type EvaluationBackwardRelookDecision } from '@/lib/evaluation/backwardRelook';

export type StatusAwareReportPersistenceInput<TReport> = {
  report: TReport;
  grounding: EvaluationBackwardRelookDecision;
};

export type StatusAwareReportPersistenceOutput<TReport> = {
  report: TReport;
  grounding_status: EvaluationBackwardRelookDecision['status'];
  grounding_note: string | null;
  report_persistence: 'allow';
  validity_status: 'valid';
  reason_codes: string[];
};

export function prepareStatusAwareReportPersistence<TReport>(
  input: StatusAwareReportPersistenceInput<TReport>,
): StatusAwareReportPersistenceOutput<TReport> {
  assertReportPersistenceAllowed(input.grounding);

  return {
    report: input.report,
    grounding_status: input.grounding.status,
    grounding_note: input.grounding.note,
    report_persistence: 'allow',
    validity_status: 'valid',
    reason_codes: input.grounding.reasonCodes,
  };
}
