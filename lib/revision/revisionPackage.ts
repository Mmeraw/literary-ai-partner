export type RevisionPackageStatus = "open" | "in_progress" | "complete" | "archived";

export type RevisionPackage = {
  revision_package_id: string;
  user_id: string;
  manuscript_id: number;
  manuscript_version_id: string;
  evaluation_job_id: string;
  revision_opportunity_ledger_artifact_id: string;
  status: RevisionPackageStatus;
  created_at: string;
  updated_at: string;
};

export function buildRevisionPackageId(input: {
  manuscriptVersionId: string;
  evaluationJobId: string;
}): string {
  return `revision_package:${input.evaluationJobId}:${input.manuscriptVersionId}`;
}

export function buildRevisionPackage(input: {
  userId: string;
  manuscriptId: number;
  manuscriptVersionId: string;
  evaluationJobId: string;
  revisionOpportunityLedgerArtifactId: string;
  status?: RevisionPackageStatus;
  createdAt?: string;
  updatedAt?: string;
}): RevisionPackage {
  const now = new Date().toISOString();
  return {
    revision_package_id: buildRevisionPackageId({
      manuscriptVersionId: input.manuscriptVersionId,
      evaluationJobId: input.evaluationJobId,
    }),
    user_id: input.userId,
    manuscript_id: input.manuscriptId,
    manuscript_version_id: input.manuscriptVersionId,
    evaluation_job_id: input.evaluationJobId,
    revision_opportunity_ledger_artifact_id: input.revisionOpportunityLedgerArtifactId,
    status: input.status ?? "complete",
    created_at: input.createdAt ?? now,
    updated_at: input.updatedAt ?? now,
  };
}