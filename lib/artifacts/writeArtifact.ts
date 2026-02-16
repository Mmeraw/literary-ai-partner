/**
 * Authoritative artifact writer.
 * Contract:
 *  - idempotent per (job_id, artifact_type)
 *  - last write wins
 *  - NEVER ignoreDuplicates
 */
import { createAdminClient } from "@/lib/supabase/admin";

/** Canonical artifact_type constants. Every writer MUST use these. */
export const ARTIFACT_TYPES = {
  ONE_PAGE_SUMMARY: "one_page_summary",
} as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[keyof typeof ARTIFACT_TYPES];

export type ArtifactInput = {
  job_id: string;
  manuscript_id: number;
  artifact_type: ArtifactType;
  artifact_version?: string;
  content: unknown;
  source_phase?: string;
  source_hash?: string | null;
};

export async function writeArtifact(input: ArtifactInput): Promise<string | null> {
  const now = new Date().toISOString();

  const artifact = {
    job_id: input.job_id,
    manuscript_id: input.manuscript_id,
    artifact_type: input.artifact_type,
    artifact_version: input.artifact_version ?? "v1",
    content: input.content,
    source_phase: input.source_phase ?? "phase_2",
    source_hash: input.source_hash ?? null,
    created_at: now,
    updated_at: now,
  };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .upsert(artifact as any, {
      onConflict: "job_id,artifact_type",
      ignoreDuplicates: false,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      "Failed to persist artifact (job=" + input.job_id + ", type=" + input.artifact_type + "): " + error.message
    );
  }

  return data?.id ?? null;
}
