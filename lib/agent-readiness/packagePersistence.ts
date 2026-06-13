import { createHash } from 'crypto';
import { buildCreatorApprovalV1, type CreatorApprovalState, type CreatorApprovalV1 } from '@/lib/agent-readiness/creatorApprovalGate';
import type { ExportFormat, SectionType } from '@/lib/agent-readiness/agentReadinessRegistry';

export const AGENT_READINESS_REQUIRED_SECTION_TYPES = [
  'query_letter',
  'what_makes_unique',
  'synopsis',
  'query_pitch',
  'comparables',
  'author_bio',
] as const satisfies readonly SectionType[];

export type AgentReadinessRequiredSectionType = typeof AGENT_READINESS_REQUIRED_SECTION_TYPES[number];

export type AgentReadinessPersistedSectionV1 = {
  artifact_type: 'agent_readiness_section_v1';
  section_type: AgentReadinessRequiredSectionType;
  content: string;
  status: 'approved';
  manuscript_id: string;
  evaluation_job_id: string;
  user_id: string;
  updated_at: string | null;
};

export type AgentReadinessPackageV1 = {
  artifact_type: 'agent_readiness_package_v1';
  artifact_version: 'agent_readiness_package_v1';
  manuscript_id: string;
  evaluation_job_id: string;
  user_id: string;
  manuscript_title: string;
  package_version: number;
  package_hash: string;
  sections: Record<AgentReadinessRequiredSectionType, string>;
  section_hashes: Record<AgentReadinessRequiredSectionType, string>;
  source_section_count: typeof AGENT_READINESS_REQUIRED_SECTION_TYPES.length;
  created_at: string;
};

export type PackageCompletenessResultV1 = {
  artifact_type: 'package_completeness_result_v1';
  allSectionsApproved: boolean;
  approvedCount: number;
  manuscript_id: string;
  missingSections: AgentReadinessRequiredSectionType[];
};

export type PackageExportV1 = {
  artifact_type: 'package_export_v1';
  package_hash: string;
  format: ExportFormat;
  filename: string;
  exported_at: string;
};

export type PackageAssemblyResult =
  | { ok: true; package: AgentReadinessPackageV1; completeness: PackageCompletenessResultV1 }
  | { ok: false; completeness: PackageCompletenessResultV1 };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashAgentReadinessPayload(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function evaluatePackageCompleteness(input: {
  manuscriptId: string | number;
  sections: Array<{ section_type: string; status: string; content?: string | null }>;
}): PackageCompletenessResultV1 {
  const approvedSectionTypes = new Set(
    input.sections
      .filter((section) => section.status === 'approved' && typeof section.content === 'string' && section.content.trim().length > 0)
      .map((section) => section.section_type),
  );
  const missingSections = AGENT_READINESS_REQUIRED_SECTION_TYPES.filter((sectionType) => !approvedSectionTypes.has(sectionType));

  return {
    artifact_type: 'package_completeness_result_v1',
    allSectionsApproved: missingSections.length === 0,
    approvedCount: AGENT_READINESS_REQUIRED_SECTION_TYPES.length - missingSections.length,
    manuscript_id: String(input.manuscriptId),
    missingSections,
  };
}

export function buildAgentReadinessPackageV1(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
  userId: string;
  manuscriptTitle: string;
  approvedSections: Array<{ section_type: string; content: string; updated_at?: string | null }>;
  packageVersion: number;
  createdAt?: string;
}): PackageAssemblyResult {
  const completeness = evaluatePackageCompleteness({ manuscriptId: input.manuscriptId, sections: input.approvedSections.map((section) => ({ ...section, status: 'approved' })) });
  if (!completeness.allSectionsApproved) return { ok: false, completeness };

  const sections = Object.fromEntries(
    AGENT_READINESS_REQUIRED_SECTION_TYPES.map((sectionType) => {
      const match = input.approvedSections.find((section) => section.section_type === sectionType);
      return [sectionType, match?.content.trim() ?? ''];
    }),
  ) as Record<AgentReadinessRequiredSectionType, string>;

  const section_hashes = Object.fromEntries(
    AGENT_READINESS_REQUIRED_SECTION_TYPES.map((sectionType) => [sectionType, hashAgentReadinessPayload(sections[sectionType])]),
  ) as Record<AgentReadinessRequiredSectionType, string>;

  const createdAt = input.createdAt ?? new Date().toISOString();
  const packagePayload = {
    artifact_type: 'agent_readiness_package_v1' as const,
    artifact_version: 'agent_readiness_package_v1' as const,
    manuscript_id: String(input.manuscriptId),
    evaluation_job_id: input.evaluationJobId,
    user_id: input.userId,
    manuscript_title: input.manuscriptTitle.trim(),
    package_version: input.packageVersion,
    sections,
    section_hashes,
    source_section_count: AGENT_READINESS_REQUIRED_SECTION_TYPES.length,
    created_at: createdAt,
  };

  return {
    ok: true,
    completeness,
    package: {
      ...packagePayload,
      package_hash: hashAgentReadinessPayload(packagePayload),
    },
  };
}

export function buildPackageExportV1(input: {
  packageHash: string;
  format: ExportFormat;
  filename: string;
  exportedAt?: string;
}): PackageExportV1 {
  return {
    artifact_type: 'package_export_v1',
    package_hash: input.packageHash,
    format: input.format,
    filename: input.filename,
    exported_at: input.exportedAt ?? new Date().toISOString(),
  };
}

export function buildPersistedCreatorApprovalV1(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
  packageHash: string;
  approvalState: CreatorApprovalState;
  decidedBy?: string | null;
  decidedAt?: string | null;
}): CreatorApprovalV1 {
  return buildCreatorApprovalV1(input);
}
