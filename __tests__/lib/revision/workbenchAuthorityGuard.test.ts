import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Workbench authority source guard', () => {
  const root = join(__dirname, '..', '..', '..');
  const projectionSource = readFileSync(join(root, 'lib', 'revision', 'workbenchQueueProjection.ts'), 'utf8');
  const queueSource = readFileSync(join(root, 'lib', 'revision', 'workbenchQueue.ts'), 'utf8');
  const adapterSource = readFileSync(join(root, 'components', 'revision', 'workbenchCardAdapter.ts'), 'utf8');

  it('routes production queueing through the exclusive classified partition function', () => {
    expect(queueSource).toContain('partitionClassifiedWorkbenchQueue(opportunities)');
    expect(queueSource).toContain('buildClassifiedWorkbenchOpportunity(baseOpportunity, executability)');
    expect(queueSource).not.toContain('partitionWorkbenchQueue(opportunities)');
  });

  it('defines the exclusive classified partition function in the projection layer', () => {
    expect(projectionSource).toContain('export function partitionClassifiedWorkbenchQueue');
    expect(projectionSource).toContain('finalDecision.cardType');
    expect(projectionSource).toContain('finalDecision.trustedPathStatus');
  });

  it('keeps readiness out of the exclusive classified partition body', () => {
    const start = projectionSource.indexOf('export function partitionClassifiedWorkbenchQueue');
    const end = projectionSource.indexOf('export function partitionWorkbenchQueue');
    const classifiedPartitionSource = projectionSource.slice(start, end);

    expect(classifiedPartitionSource).toContain('finalDecision.cardType');
    expect(classifiedPartitionSource).not.toContain('readiness ===');
    expect(classifiedPartitionSource).not.toContain('isSupportedForUserQueue');
  });

  it('keeps the legacy wrapper as a compatibility shim, not a downstream authority', () => {
    expect(projectionSource).toContain('export function partitionWorkbenchQueue(opportunities: WorkbenchOpportunity[])');
    expect(projectionSource).toContain('buildClassifiedWorkbenchOpportunity(opportunity)');
  });

  it('does not let the card adapter reintroduce classification or readiness-based routing', () => {
    expect(adapterSource).not.toContain('runCopyPasteAdmissionGate');
    expect(adapterSource).not.toContain('runStrategyAdmissionGate');
    expect(adapterSource).not.toContain('evaluateRecommendationExecutability');
    expect(adapterSource).not.toContain('needs_targeting');
    expect(adapterSource).not.toContain('readiness ===');
    expect(adapterSource).not.toContain('finalDecision');
    expect(adapterSource).not.toContain('partitionWorkbenchQueue');
    expect(adapterSource).not.toContain('partitionClassifiedWorkbenchQueue');
  });
});
