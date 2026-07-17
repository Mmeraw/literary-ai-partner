import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Workbench authority source guard', () => {
  const root = join(__dirname, '..', '..', '..');
  const projectionSource = readFileSync(join(root, 'lib', 'revision', 'workbenchQueueProjection.ts'), 'utf8');
  const queueSource = readFileSync(join(root, 'lib', 'revision', 'workbenchQueue.ts'), 'utf8');
  const adapterSource = readFileSync(join(root, 'components', 'revision', 'workbenchCardAdapter.ts'), 'utf8');
  const workflowV2Source = readFileSync(join(root, 'components', 'revision', 'ReviseCockpitClientWorkflowV2.tsx'), 'utf8');

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
    expect(adapterSource).toContain('finalDecision.cardType');
    expect(adapterSource).not.toContain('switch (item.cardType)');
    expect(adapterSource).not.toContain('partitionWorkbenchQueue');
    expect(adapterSource).not.toContain('partitionClassifiedWorkbenchQueue');
  });

  // -------------------------------------------------------------------------
  // Workflow V2 authority boundary guard
  // After the classified-payload authority cleanup, Workflow V2 must not
  // import the classifier or reconstruct classified decisions from mirrored
  // fields. This guard prevents that drift from returning.
  // -------------------------------------------------------------------------

  it('Workflow V2 does not invoke the live classifier', () => {
    expect(workflowV2Source).not.toContain('classifyWorkbenchExecutabilityDetailed');
    expect(workflowV2Source).not.toContain('classifyWorkbenchExecutabilityDetailedWithoutNeedsTargeting');
    expect(workflowV2Source).not.toContain('classifyWorkbenchExecutability(');
  });

  it('Workflow V2 does not reconstruct classified objects from mirrored fields', () => {
    expect(workflowV2Source).not.toContain('buildClassifiedWorkbenchOpportunity');
    expect(workflowV2Source).not.toContain('asClassifiedOpportunity');
  });

  it('Workflow V2 routes interactive/held membership by finalDecision.cardType', () => {
    expect(workflowV2Source).toContain('finalDecision.cardType');
    // The mirrored item.cardType must not be used as a routing authority.
    // The only permitted reference to item.cardType is in the pre-existing
    // label/badge helpers that are themselves typed on ClassifiedWorkbenchOpportunity,
    // where cardType is kept in sync by buildClassifiedWorkbenchOpportunity.
    expect(workflowV2Source).not.toContain('item.cardType !== "withheld"');
    expect(workflowV2Source).not.toContain('item.cardType === "withheld"');
    expect(workflowV2Source).not.toContain('item.cardType !== \'withheld\'');
    expect(workflowV2Source).not.toContain('item.cardType === \'withheld\'');
  });
});
