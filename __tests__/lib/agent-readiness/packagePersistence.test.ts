import {
  AGENT_READINESS_REQUIRED_SECTION_TYPES,
  buildAgentReadinessPackageV1,
  buildPackageExportV1,
  buildPersistedCreatorApprovalV1,
  evaluatePackageCompleteness,
} from '@/lib/agent-readiness/packagePersistence';
import { evaluateCreatorApprovalGate } from '@/lib/agent-readiness/creatorApprovalGate';

function approvedSections() {
  return AGENT_READINESS_REQUIRED_SECTION_TYPES.map((section_type) => ({
    section_type,
    content: `${section_type} approved content`,
    updated_at: '2026-06-13T00:00:00.000Z',
  }));
}

describe('agent_readiness_package_v1 persistence helpers', () => {
  it('blocks package assembly until all six canonical sections are approved', () => {
    const sections = approvedSections().filter((section) => section.section_type !== 'author_bio');

    const completeness = evaluatePackageCompleteness({
      manuscriptId: 123,
      sections: sections.map((section) => ({ ...section, status: 'approved' })),
    });

    expect(completeness.allSectionsApproved).toBe(false);
    expect(completeness.approvedCount).toBe(5);
    expect(completeness.missingSections).toEqual(['author_bio']);

    const assembly = buildAgentReadinessPackageV1({
      manuscriptId: 123,
      evaluationJobId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      manuscriptTitle: 'Governed Novel',
      approvedSections: sections,
      packageVersion: 1,
      createdAt: '2026-06-13T00:00:00.000Z',
    });

    expect(assembly.ok).toBe(false);
  });

  it('builds a hashed package version and export history artifact from approved persisted sections', () => {
    const assembly = buildAgentReadinessPackageV1({
      manuscriptId: 123,
      evaluationJobId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      manuscriptTitle: 'Governed Novel',
      approvedSections: approvedSections(),
      packageVersion: 2,
      createdAt: '2026-06-13T00:00:00.000Z',
    });

    expect(assembly.ok).toBe(true);
    if (!assembly.ok) return;

    expect(assembly.package.artifact_type).toBe('agent_readiness_package_v1');
    expect(assembly.package.package_version).toBe(2);
    expect(assembly.package.package_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(assembly.package.sections).sort()).toEqual([...AGENT_READINESS_REQUIRED_SECTION_TYPES].sort());
    expect(Object.keys(assembly.package.section_hashes).sort()).toEqual([...AGENT_READINESS_REQUIRED_SECTION_TYPES].sort());

    const exportArtifact = buildPackageExportV1({
      packageHash: assembly.package.package_hash,
      format: 'txt',
      filename: 'Governed-Novel-Submission-Package.txt',
      exportedAt: '2026-06-13T00:01:00.000Z',
    });

    expect(exportArtifact).toMatchObject({
      artifact_type: 'package_export_v1',
      package_hash: assembly.package.package_hash,
      format: 'txt',
      filename: 'Governed-Novel-Submission-Package.txt',
    });
  });

  it('sanitizes consecutive duplicate sentence residue while assembling package sections', () => {
    const sections = approvedSections();
    const querySection = sections.find((section) => section.section_type === 'query_letter');
    if (querySection) {
      querySection.content = 'She opens with urgency. She opens with urgency. Then she names the cost.';
    }

    const assembly = buildAgentReadinessPackageV1({
      manuscriptId: 123,
      evaluationJobId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      manuscriptTitle: 'Governed Novel',
      approvedSections: sections,
      packageVersion: 3,
      createdAt: '2026-06-13T00:00:00.000Z',
    });

    expect(assembly.ok).toBe(true);
    if (!assembly.ok) return;

    expect(assembly.package.sections.query_letter).toBe('She opens with urgency. Then she names the cost.');
  });

  it('persists creator_approval_v1 semantics required by Storygate', () => {
    const approval = buildPersistedCreatorApprovalV1({
      manuscriptId: 123,
      evaluationJobId: '11111111-1111-4111-8111-111111111111',
      packageHash: 'a'.repeat(64),
      approvalState: 'approved',
      decidedBy: '22222222-2222-4222-8222-222222222222',
      decidedAt: '2026-06-13T00:02:00.000Z',
    });

    expect(approval.artifact_type).toBe('creator_approval_v1');
    expect(approval.approved).toBe(true);
    expect(evaluateCreatorApprovalGate({ approval }).ok).toBe(true);
  });
});
