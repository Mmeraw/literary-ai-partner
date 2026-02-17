/**
 * Gate A7 — Shared Report View (Anonymous Access)
 * 
 * GET /share/[token]
 * 
 * Read-only projection of canonical evaluation artifact.
 * 
 * Security:
 * - No authentication required
 * - Token validated server-side
 * - Fail-closed: invalid/revoked/expired → 404
 * - Never mutates evaluation data
 * - Validates A6 credibility contract
 */

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupShareByToken } from "@/lib/reportShares/server";

const ARTIFACT_FIELDS = `
  job_id,
  artifact_type,
  artifact_version,
  content,
  created_at,
  updated_at,
  source_hash,
  source_phase
`;

type RubricAxis = {
  key: string;
  label: string;
  score: number;
  explanation: string;
};

type Credibility = {
  rubricBreakdown: RubricAxis[];
  confidence: number;
  evidenceCount: number;
  coverageRatio: number;
  varianceStability: number;
  modelVersion: string;
};

type ReportContent = {
  summary?: string;
  overall_score?: number | string;
  chunk_count?: number | string;
  processed_count?: number | string;
  generated_at?: string;
  credibility?: Credibility;
};

/**
 * Validate A6 credibility contract (fail-closed).
 * If score exists but credibility is invalid, deny access.
 */
function isValidCredibility(c: any): c is Credibility {
  if (!c) return false;

  // Must have rubric breakdown with at least one axis
  if (!Array.isArray(c.rubricBreakdown) || c.rubricBreakdown.length < 1) {
    return false;
  }

  // Helper: value in 0..1 range
  const in01 = (n: any) => typeof n === "number" && n >= 0 && n <= 1;

  // Validate numeric fields
  if (!in01(c.confidence)) return false;
  if (!in01(c.coverageRatio)) return false;
  if (!in01(c.varianceStability)) return false;

  // Evidence count must be non-negative integer
  if (typeof c.evidenceCount !== "number" || c.evidenceCount < 0) {
    return false;
  }

  // Model version must be non-empty string
  if (typeof c.modelVersion !== "string" || c.modelVersion.length < 1) {
    return false;
  }

  return true;
}

export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;

  // 1. Validate share token (fail-closed)
  const share = await lookupShareByToken(token);
  if (!share.ok) {
    notFound();
  }

  // 2. Load canonical artifact (server-side admin read)
  const supabase = createAdminClient();

  const { data: artifact } = await supabase
    .from("evaluation_artifacts")
    .select(ARTIFACT_FIELDS)
    .eq("job_id", share.jobId)
    .eq("artifact_type", share.artifactType)
    .maybeSingle();

  if (!artifact) {
    notFound();
  }

  // 3. Parse content (defensive)
  const content: ReportContent = (artifact.content as any) ?? {};

  // 4. Fail-closed: if score exists but credibility missing/invalid, deny
  const hasScore =
    content.overall_score !== undefined && content.overall_score !== null;
  if (hasScore && !isValidCredibility(content.credibility)) {
    notFound();
  }

  // 5. Render read-only report (matches owner view structure)
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Evaluation Report</h1>

      <p className="text-sm text-gray-500">Job: {artifact.job_id}</p>
      <p className="text-sm text-gray-500">Updated: {artifact.updated_at}</p>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Summary</h2>
        <p className="mt-2 whitespace-pre-wrap">
          {content.summary ?? "(no summary available)"}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Overall Score</h2>
        <p className="mt-2 text-3xl font-bold">
          {content.overall_score ?? "--"}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Processing Details</h2>
        <ul className="mt-2 list-disc pl-6">
          <li>Chunks: {content.chunk_count ?? "--"}</li>
          <li>Processed: {content.processed_count ?? "--"}</li>
          <li>Generated: {content.generated_at ?? "--"}</li>
        </ul>
      </section>

      {/* Gate A6: Credibility sections (same as owner view) */}
      {content.credibility ? (
        <>
          <section className="mt-6">
            <h2 className="text-xl font-semibold">Score Explanation</h2>
            <ul className="mt-2 list-disc pl-6">
              {content.credibility.rubricBreakdown.map((axis) => (
                <li key={axis.key}>
                  <strong>{axis.label}</strong>: {axis.score.toFixed(1)} —{" "}
                  {axis.explanation}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-xl font-semibold">Confidence & Provenance</h2>
            <ul className="mt-2 list-disc pl-6">
              <li>
                Confidence:{" "}
                {(content.credibility.confidence * 100).toFixed(1)}%
              </li>
              <li>Evidence Count: {content.credibility.evidenceCount}</li>
              <li>
                Coverage:{" "}
                {(content.credibility.coverageRatio * 100).toFixed(1)}%
              </li>
              <li>
                Variance Stability:{" "}
                {(content.credibility.varianceStability * 100).toFixed(1)}%
              </li>
              <li>Model: {content.credibility.modelVersion}</li>
            </ul>
          </section>
        </>
      ) : null}

      {/* Provenance (always show) */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold">Provenance</h2>
        <ul className="mt-2 list-disc pl-6 text-sm text-gray-500">
          <li>Artifact Type: {artifact.artifact_type}</li>
          <li>Version: {artifact.artifact_version ?? "--"}</li>
          <li>Source Phase: {artifact.source_phase ?? "--"}</li>
          <li>Source Hash: {artifact.source_hash ?? "--"}</li>
        </ul>
      </section>

      {/* Footer attribution */}
      <footer className="mt-12 border-t pt-6 text-center text-sm text-gray-400">
        <p>Generated by RevisionGrade</p>
        <p>This is a read-only view of an authoritative evaluation artifact.</p>
      </footer>
    </main>
  );
}
