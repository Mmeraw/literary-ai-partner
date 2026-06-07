import {
  REVISE_QUEUE_LEDGER_COLUMNS,
  REVISE_QUEUE_LEDGER_INPUT_METRICS,
  REVISE_QUEUE_LEDGER_LIMITS,
  REVISION_DECISION_LEDGER_COLUMNS,
  getReviseQueueLedgerColumnLabel,
} from '@/lib/revision/reviseQueueLedgerContract';
import {
  REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD,
  REVISE_QUEUE_MAX_LONG_FORM,
  REVISE_QUEUE_MAX_SHORT_FORM,
  getReviseQueueMaxOpportunities,
} from '@/lib/revision/opportunityLedger';

describe('revise queue ledger column contract', () => {
  it('defines every visible Revise Queue table header in display order', () => {
    expect(REVISE_QUEUE_LEDGER_COLUMNS.map((column) => column.label)).toEqual([
      '#',
      'Severity',
      'Scope',
      'Chapter',
      'Criterion',
      'Issue',
      'Options',
      'Status',
    ]);

    expect(getReviseQueueLedgerColumnLabel('issue')).toBe('Issue');
  });

  it('requires a definition, input requirements, output requirements, metrics, and fail-closed rule for every queue column', () => {
    for (const column of REVISE_QUEUE_LEDGER_COLUMNS) {
      expect(column.definition.trim()).not.toHaveLength(0);
      expect(column.requiredInputs.length).toBeGreaterThan(0);
      expect(column.requiredOutputs.length).toBeGreaterThan(0);
      expect(column.inputMetrics.length).toBeGreaterThan(0);
      expect(column.outputMetrics.length).toBeGreaterThan(0);
      expect(column.failClosedRule.trim()).not.toHaveLength(0);

      for (const metric of [...column.inputMetrics, ...column.outputMetrics]) {
        expect(REVISE_QUEUE_LEDGER_INPUT_METRICS[metric].trim()).not.toHaveLength(0);
      }
    }
  });

  it('defines decision-ledger columns with requirements and sync metrics', () => {
    expect(REVISION_DECISION_LEDGER_COLUMNS.map((column) => column.label)).toEqual([
      'Decision',
      'Option',
      'Criterion',
      'Opportunity',
      'Sync',
    ]);

    for (const column of REVISION_DECISION_LEDGER_COLUMNS) {
      expect(column.definition.trim()).not.toHaveLength(0);
      expect(column.requiredInputs.length).toBeGreaterThan(0);
      expect(column.requiredOutputs.length).toBeGreaterThan(0);
      expect(column.inputMetrics.length).toBeGreaterThan(0);
      expect(column.outputMetrics.length).toBeGreaterThan(0);
      expect(column.failClosedRule.trim()).not.toHaveLength(0);
    }
  });

  it('keeps the published ledger limits aligned with runtime queue caps', () => {
    expect(REVISE_QUEUE_LEDGER_LIMITS.shortFormMaxOpportunities).toBe(REVISE_QUEUE_MAX_SHORT_FORM);
    expect(REVISE_QUEUE_LEDGER_LIMITS.longFormMaxOpportunities).toBe(REVISE_QUEUE_MAX_LONG_FORM);
    expect(REVISE_QUEUE_LEDGER_LIMITS.longFormWordThreshold).toBe(REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD);

    expect(getReviseQueueMaxOpportunities(REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD - 1)).toBe(50);
    expect(getReviseQueueMaxOpportunities(REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD)).toBe(100);
  });
});
