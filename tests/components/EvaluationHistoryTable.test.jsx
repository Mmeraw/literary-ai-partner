/**
 * @jest-environment jsdom
 */

import { render, screen, within } from '@testing-library/react';
import EvaluationHistoryTable from '@/components/dashboard/EvaluationHistoryTable';

function baseRow(overrides = {}) {
  return {
    id: 'job-failed-1',
    jobId: 'job-failed-1',
    manuscriptId: '101',
    manuscriptTitle: 'Sister',
    manuscriptSubtitle: '',
    createdAt: '2026-06-07T12:00:00.000Z',
    evaluationType: 'Evaluate',
    overallScore: null,
    readinessScore: null,
    status: 'failed',
    reportHref: '/evaluate/job-failed-1',
    ...overrides,
  };
}

describe('EvaluationHistoryTable', () => {
  test('failed evaluations expose a View details link to the evaluation detail page', () => {
    render(<EvaluationHistoryTable rows={[baseRow()]} />);

    const row = screen.getByRole('row', { name: /Sister/i });
    const detailsLink = within(row).getByRole('link', { name: 'View details' });

    expect(detailsLink.getAttribute('href')).toBe('/evaluate/job-failed-1');
    expect(within(row).getByText('Evaluation failed')).toBeTruthy();
  });
});
