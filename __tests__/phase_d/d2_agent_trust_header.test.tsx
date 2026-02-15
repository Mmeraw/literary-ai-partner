/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import AgentTrustHeader from '@/components/reports/AgentTrustHeader';

describe('D2 agent trust header', () => {
  const defaultProps = {
    jobId: 'job-123',
    generatedAt: '2026-02-08T00:00:00Z',
    finalWorkTypeUsed: 'mainstream_agent_ready',
    matrixVersion: 'work_type_matrix.v1',
    criteriaPlan: { R: ['a'], O: ['b'], NA: ['c'], C: [] }
  };

  it('renders the header section with correct aria-label', () => {
    const { container } = render(<AgentTrustHeader {...defaultProps} />);
    const section = container.querySelector('[aria-label="Agent Trust Header"]');
    expect(section).toBeTruthy();
  });

  it('renders the "Evaluation Transparency" heading', () => {
    render(<AgentTrustHeader {...defaultProps} />);
    expect(screen.getByText('Evaluation Transparency')).toBeTruthy();
  });

  it('displays the Work Type used field', () => {
    render(<AgentTrustHeader {...defaultProps} />);
    expect(screen.getByText(/Work Type used/)).toBeTruthy();
    expect(screen.getByText('mainstream_agent_ready')).toBeTruthy();
  });

  it('displays the Matrix version field', () => {
    render(<AgentTrustHeader {...defaultProps} />);
    expect(screen.getByText(/Matrix version/)).toBeTruthy();
    expect(screen.getByText('work_type_matrix.v1')).toBeTruthy();
  });

  it('displays the Applicability summary with correct counts', () => {
    render(<AgentTrustHeader {...defaultProps} />);
    expect(screen.getByText(/Applicability summary/)).toBeTruthy();
    expect(screen.getByText(/R=1 · O=1 · NA=1 · C=0/)).toBeTruthy();
  });

  it('displays the Repro anchor with all components', () => {
    render(<AgentTrustHeader {...defaultProps} />);
    expect(screen.getByText(/Repro anchor/)).toBeTruthy();
    // Query for the composite text that includes all three components
    expect(screen.getByText(/jobId job-123 · 2026-02-08T00:00:00Z · work_type_matrix\.v1/)).toBeTruthy();
  });

  it('displays the NA exclusion language explicitly', () => {
    render(<AgentTrustHeader {...defaultProps} />);
    expect(
      screen.getByText(/NA criteria were structurally excluded and were not evaluated\./)
    ).toBeTruthy();
  });

  it('handles empty criterial plan arrays gracefully', () => {
    const propsWithEmptyPlan = {
      ...defaultProps,
      criteriaPlan: { R: [], O: [], NA: [], C: [] }
    };
    render(<AgentTrustHeader {...propsWithEmptyPlan} />);
    expect(screen.getByText(/R=0 · O=0 · NA=0 · C=0/)).toBeTruthy();
  });

  it('handles missing optional criteria perfectly gracefully', () => {
    const propsWithPartialPlan = {
      ...defaultProps,
      criteriaPlan: { R: ['a', 'b'], O: ['c'] }
      // NA and C are undefined
    };
    render(<AgentTrustHeader {...propsWithPartialPlan} />);
    expect(screen.getByText(/R=2 · O=1 · NA=0 · C=0/)).toBeTruthy();
  });

  it('renders all required fields with proper styling', () => {
    const { container } = render(<AgentTrustHeader {...defaultProps} />);
    const greyLabels = container.querySelectorAll('.text-gray-600');
    expect(greyLabels.length).toBeGreaterThan(0); // labels styled in gray
    const monoValues = container.querySelectorAll('.font-mono');
    expect(monoValues.length).toBeGreaterThan(0); // values in monospace
  });
});
