import { describe, expect, it } from '@jest/globals';
import {
  filterAuthorFacingTextList,
  getRenumberedAuthorFacingRevisionPlan,
} from '@/lib/evaluation/reportRenderSafety';

describe('reportRenderSafety author-facing helpers', () => {
  it('drops internal diagnostic strings from free text lists', () => {
    const input = [
      'Correct Source-Integrity and Extraction Semantics',
      'Repair Relationship Network Representation',
      'Reframe Threat / Pressure / Ending Taxonomy',
      'Normalize Location / Timeline and Separate Diagnostics',
      'Rewrite the midpoint exchange to force an irreversible choice.',
      'Seed a callback line in the final act.',
    ];

    const filtered = filterAuthorFacingTextList(input);

    expect(filtered).toEqual([
      'Rewrite the midpoint exchange to force an irreversible choice.',
      'Seed a callback line in the final act.',
    ]);

    const joined = filtered.join(' ');
    expect(joined).not.toMatch(/source[-\s]?integrity/i);
    expect(joined).not.toMatch(/relationship\s+network/i);
    expect(joined).not.toMatch(/threat\s*\/?\s*pressure/i);
    expect(joined).not.toMatch(/location\s*\/?\s*timeline/i);
  });

  it('strips internal actions but keeps valid manuscript priorities', () => {
    const plan = [
      {
        priority: 1,
        title: 'Correct Source-Integrity and Extraction Semantics',
        goal: 'Repair diagnostics pipeline outputs.',
        actions: ['Rebuild extractor status map'],
        acceptance_check: 'Source integrity status no longer hard-fails.',
      },
      {
        priority: 2,
        title: 'Strengthen midpoint causality',
        goal: 'Force consequential midpoint decision.',
        actions: [
          'Reframe Threat / Pressure / Ending Taxonomy',
          'Normalize Location / Timeline and Separate Diagnostics',
          'Rewrite chapter 12 ending to force a public choice.',
          'Cut one repetitive setup beat in chapter 10.',
        ],
        acceptance_check: 'Midpoint introduces irreversible social consequence.',
      },
      {
        priority: 3,
        title: 'Sharpen final emotional aftercare',
        goal: 'Separate plot closure from emotional closure.',
        actions: [
          'Add a final-scene callback that resolves emotional debt.',
        ],
        acceptance_check: 'Final act lands both plot and emotional aftercare.',
      },
    ];

    const result = getRenumberedAuthorFacingRevisionPlan(plan);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Strengthen midpoint causality');
    expect(result[1].title).toBe('Sharpen final emotional aftercare');

    expect(result[0].actions).toEqual([
      'Rewrite chapter 12 ending to force a public choice.',
      'Cut one repetitive setup beat in chapter 10.',
    ]);

    expect(result[1].actions).toEqual([
      'Add a final-scene callback that resolves emotional debt.',
    ]);
  });

  it('renumbers display priorities contiguously after filtering', () => {
    const plan = [
      {
        priority: 2,
        title: 'Repair Relationship Network Representation',
        goal: 'Internal diagnostic remediation',
        actions: ['No qualifying relationship pairs found'],
        acceptance_check: 'Diagnostics clean',
      },
      {
        priority: 4,
        title: 'Condense repetitive chapter transitions',
        goal: 'Improve pace and consequence continuity.',
        actions: ['Merge two transition scenes in Act II.'],
        acceptance_check: 'Transitions preserve causality while reducing repetition.',
      },
      {
        priority: 6,
        title: 'Clarify symbol payoff',
        goal: 'Make symbol lifecycle legible from setup to payoff.',
        actions: ['Seed symbol transfer in chapter 3 and resolve in finale.'],
        acceptance_check: 'Symbol appears, transfers, and resolves by ending.',
      },
    ];

    const result = getRenumberedAuthorFacingRevisionPlan(plan);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.displayPriority)).toEqual([1, 2]);
  });
});
