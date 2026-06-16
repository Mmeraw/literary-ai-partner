"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ArtifactHealthPayload = {
  ok: boolean;
  error?: string;
  details?: string;
  generatedAt: string;
  qualityThreshold0To100: number;
  summary: {
    jobs: number;
    artifacts: number;
    expectedArtifacts: number;
    missingExpectedArtifacts: number;
    registeredArtifacts: number;
    unregisteredArtifacts: number;
    belowThresholdArtifacts: number;
    contractGapArtifacts?: number;
    blockingSignalArtifacts: number;
    registryArtifacts: number;
  };
  jobs: Array<{
    id: string;
    manuscriptId: number | null;
    manuscript: { title: string | null; word_count: number | null };
    status: string;
    phase: string | null;
    phaseStatus: string | null;
    failureCode: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    artifactCount: number;
    certifiedArtifactCount: number;
    contractCleanArtifactCount?: number;
    averageQuality0To100: number | null;
    missingAuthorExposureArtifacts: string[];
  }>;
  expectedArtifacts: Array<{
    jobId: string;
    manuscriptId: number | null;
    artifactType: string;
    present: boolean;
    artifactId: string | null;
    createdAt: string | null;
    sourceHashPresent: boolean;
    registry: {
      artifact: string;
      producerStageId: string;
      producerProcessName: string;
      producerOutputMetrics: string[];
      consumerStageIds: string[];
      consumerProcessNames: string[];
      consumerInputMetrics: string[];
      requiredFields: string[];
      completenessMetric: string;
      accuracyMetric: string;
      dirtyDataRule: string;
      regenerationOwnerStageId: string;
      requiredForAuthorExposure: boolean;
      fitGapStatus: string;
      processDirtyDataRules: string[];
      processFailureCodes: string[];
      kicks: Array<{
        dirtyDataDetectedAt: string;
        failure: string;
        kickBackTo: string;
        redoAction: string;
        retryLimit: number;
        failureCode: string;
        blocksAuthorExposure: boolean;
      }>;
    };
    quality: null | {
      score0To100: number;
      threshold0To100: number;
      certified: boolean;
      contractStatus: string;
      missingFields: string[];
      issues: Array<{ code: string; path: string; message: string }>;
    };
    statusSignals: Record<string, unknown>;
    topLevelKeys: string[];
    sizeBytes: number | null;
  }>;
  artifacts: Array<{
    id: string;
    jobId: string;
    manuscriptId: number | null;
    artifactType: string;
    artifactVersion: string | null;
    createdAt: string;
    sourceHashPresent: boolean;
    registered: boolean;
    registry: null | {
      producerStageId: string;
      producerProcessName: string;
      producerOutputMetrics: string[];
      consumerStageIds: string[];
      consumerInputMetrics: string[];
      requiredFields: string[];
      completenessMetric: string;
      accuracyMetric: string;
      dirtyDataRule: string;
      regenerationOwnerStageId: string;
      requiredForAuthorExposure: boolean;
      fitGapStatus: string;
      processDirtyDataRules: string[];
      processFailureCodes: string[];
      kicks: Array<{
        dirtyDataDetectedAt: string;
        failure: string;
        kickBackTo: string;
        redoAction: string;
        retryLimit: number;
        failureCode: string;
        blocksAuthorExposure: boolean;
      }>;
    };
    quality: {
      score0To100: number;
      threshold0To100: number;
      certified: boolean;
      contractStatus: string;
      missingFields: string[];
      issues: Array<{ code: string; path: string; message: string }>;
    };
    statusSignals: Record<string, unknown>;
    topLevelKeys: string[];
    sizeBytes: number | null;
  }>;
  registryArtifacts: Array<{
    artifact: string;
    producerStageId: string;
    completenessMetric: string;
    accuracyMetric: string;
    dirtyDataRule: string;
    requiredForAuthorExposure: boolean;
    fitGapStatus: string;
  }>;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function scoreClass(score: number) {
  if (score >= 95) return "border-green-400/30 bg-green-900/25 text-green-200";
  if (score >= 80) return "border-amber-400/30 bg-amber-900/25 text-amber-100";
  if (score >= 50) return "border-orange-400/30 bg-orange-900/25 text-orange-100";
  return "border-red-400/30 bg-red-900/25 text-red-200";
}

function statusClass(status: string) {
  if (status === "complete") return "border-green-400/30 bg-green-900/25 text-green-200";
  if (status === "failed") return "border-red-400/30 bg-red-900/25 text-red-200";
  if (status === "running") return "border-blue-400/30 bg-blue-900/25 text-blue-200";
  return "border-rg-cream2/20 bg-rg-ink2 text-rg-cream2/75";
}

function compactList(items: string[], max = 3) {
  if (items.length === 0) return "—";
  const head = items.slice(0, max).join(", ");
  return items.length > max ? `${head} +${items.length - max}` : head;
}

export default function AdminArtifactHealthPage() {
  const router = useRouter();
  const [data, setData] = useState<ArtifactHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("all");
  const [showTest, setShowTest] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", "25");
    params.set("show_test", showTest ? "1" : "0");
    if (status !== "all") params.set("status", status);
    if (jobId.trim()) params.set("job_id", jobId.trim());

    setLoading(true);
    setError(null);
    fetch(`/api/admin/artifact-health?${params}`, { cache: "no-store" })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.replace("/evaluate");
          return null;
        }
        return res.json();
      })
      .then((payload) => {
        if (!payload) return;
        if (!payload.ok) {
          setError(payload.details ? `${payload.error}: ${payload.details}` : payload.error ?? "Failed to load artifact health");
          setData(null);
          return;
        }
        setData(payload);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [jobId, status, showTest, router]);

  const selectedJob = useMemo(() => {
    if (!data || data.jobs.length === 0) return null;
    if (jobId.trim()) return data.jobs.find((job) => job.id === jobId.trim()) ?? data.jobs[0];
    return data.jobs[0];
  }, [data, jobId]);

  const visibleArtifacts = useMemo(() => {
    if (!data) return [];
    if (!selectedJob) return data.artifacts;
    return data.artifacts.filter((artifact) => artifact.jobId === selectedJob.id);
  }, [data, selectedJob]);

  const visibleExpectedArtifacts = useMemo(() => {
    if (!data) return [];
    if (!selectedJob) return data.expectedArtifacts;
    return data.expectedArtifacts.filter((artifact) => artifact.jobId === selectedJob.id);
  }, [data, selectedJob]);

  return (
    <main className="min-h-screen bg-rg-ink px-4 py-8 text-rg-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-3">
          <Link href="/admin" className="text-sm text-rg-gold underline">← Back to Admin</Link>
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Admin · Artifact Health</p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-rg-serif text-3xl font-semibold sm:text-4xl">SIPOC Artifact Health Dashboard</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-rg-cream2/70">
                Read-only artifact inventory with FIPOC/SIPOC completeness and accuracy metrics, required fields,
                dirty-data rules, producer/consumer metrics, and kickback ownership. Manuscript prose is not exposed here.
              </p>
            </div>
            {data && <p className="text-xs text-rg-cream2/55">Generated {fmtDate(data.generatedAt)}</p>}
          </div>
        </header>

        <section className="grid gap-3 rounded-lg border border-rg-cream2/15 bg-rg-ink2/60 p-4 lg:grid-cols-[1fr_auto_auto]">
          <label className="space-y-1">
            <span className="font-rg-mono text-[10px] uppercase tracking-[0.16em] text-rg-gold">Job ID</span>
            <input
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              placeholder="Optional exact job id"
              className="w-full rounded border border-rg-cream2/20 bg-rg-ink px-3 py-2 font-rg-mono text-sm text-rg-cream outline-none focus:border-rg-gold/70"
            />
          </label>
          <label className="space-y-1">
            <span className="font-rg-mono text-[10px] uppercase tracking-[0.16em] text-rg-gold">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded border border-rg-cream2/20 bg-rg-ink px-3 py-2 text-sm text-rg-cream outline-none focus:border-rg-gold/70"
            >
              {['all', 'queued', 'running', 'complete', 'failed'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-rg-cream2/70">
            <input type="checkbox" checked={showTest} onChange={(event) => setShowTest(event.target.checked)} />
            Show test manuscripts
          </label>
        </section>

        {loading && <p className="rounded border border-rg-cream2/15 bg-rg-ink2/60 p-5 text-rg-cream2/70">Loading artifact health…</p>}
        {error && <p className="rounded border border-red-400/30 bg-red-900/20 p-5 text-red-200">{error}</p>}

        {data && !loading && (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <Metric label="Jobs" value={data.summary.jobs} />
              <Metric label="Artifacts" value={data.summary.artifacts} />
              <Metric label="Registry artifacts" value={data.summary.registryArtifacts} />
              <Metric label="Missing expected" value={data.summary.missingExpectedArtifacts} tone={data.summary.missingExpectedArtifacts > 0 ? "warn" : "ok"} />
              <Metric label="SIPOC gaps" value={data.summary.contractGapArtifacts ?? data.summary.belowThresholdArtifacts} tone={(data.summary.contractGapArtifacts ?? data.summary.belowThresholdArtifacts) > 0 ? "warn" : "ok"} />
              <Metric label="Unregistered" value={data.summary.unregisteredArtifacts} tone={data.summary.unregisteredArtifacts > 0 ? "warn" : "ok"} />
              <Metric label="Blocking signals" value={data.summary.blockingSignalArtifacts} tone={data.summary.blockingSignalArtifacts > 0 ? "bad" : "ok"} />
            </section>

            <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/60 p-5">
              <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-end">
                <div>
                  <h2 className="font-rg-serif text-2xl">Expected SIPOC artifact coverage</h2>
                  <p className="mt-1 text-sm text-rg-cream2/60">
                    {selectedJob ? `Showing all ${visibleExpectedArtifacts.length} registry artifact contract(s) for ${selectedJob.id}.` : `Showing ${visibleExpectedArtifacts.length} expected artifact contract(s).`}
                  </p>
                </div>
                <p className="font-rg-mono text-xs text-rg-cream2/55">Missing rows identify pipeline output gaps; they do not fabricate job progress.</p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[1500px] divide-y divide-rg-cream2/10 text-sm">
                  <thead>
                    <tr>
                      <Th>Artifact</Th><Th>Presence</Th><Th>Score</Th><Th>Producer</Th><Th>Consumers</Th><Th>Completeness metric</Th><Th>Accuracy metric</Th><Th>Dirty data / kickback</Th><Th>Required fields</Th><Th>Missing fields</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rg-cream2/10">
                    {visibleExpectedArtifacts.map((artifact) => (
                      <tr key={`${artifact.jobId}:${artifact.artifactType}`} className="align-top hover:bg-rg-ink/50">
                        <Td>
                          <div className="space-y-1">
                            <p className="font-rg-mono text-xs text-rg-gold">{artifact.artifactType}</p>
                            <p className="text-xs text-rg-cream2/50">{artifact.registry.requiredForAuthorExposure ? "author exposure" : "supporting"} · {artifact.registry.fitGapStatus}</p>
                            {artifact.present && <Link href={`/admin/forensics/${artifact.jobId}`} className="text-xs text-rg-gold underline">Forensics →</Link>}
                          </div>
                        </Td>
                        <Td>
                          <span className={`rounded border px-2 py-1 font-rg-mono text-xs ${artifact.present ? "border-green-400/30 bg-green-900/25 text-green-200" : "border-red-400/30 bg-red-900/25 text-red-200"}`}>
                            {artifact.present ? "present" : "missing"}
                          </span>
                        </Td>
                        <Td>{artifact.quality ? <span className={`rounded border px-2 py-1 font-rg-mono text-xs ${scoreClass(artifact.quality.score0To100)}`}>{artifact.quality.score0To100}%</span> : "—"}</Td>
                        <Td>{artifact.registry.producerProcessName}</Td>
                        <Td>{compactList(artifact.registry.consumerProcessNames, 3)}</Td>
                        <Td>{artifact.registry.completenessMetric}</Td>
                        <Td>{artifact.registry.accuracyMetric}</Td>
                        <Td>
                          <p>{artifact.registry.dirtyDataRule}</p>
                          <p className="mt-1 text-xs text-rg-cream2/50">Owner: {artifact.registry.regenerationOwnerStageId}</p>
                          {artifact.registry.kicks[0] && <p className="mt-1 text-xs text-rg-cream2/50">Kick: {artifact.registry.kicks[0].kickBackTo} · {artifact.registry.kicks[0].failureCode}</p>}
                        </Td>
                        <Td>{compactList(artifact.registry.requiredFields, 5)}</Td>
                        <Td>{artifact.quality?.missingFields.length ? compactList(artifact.quality.missingFields, 5) : artifact.present ? "—" : "artifact row missing"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/60 p-5">
              <h2 className="font-rg-serif text-2xl">Recent jobs</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-rg-cream2/10 text-sm">
                  <thead>
                    <tr>
                      <Th>Job</Th><Th>Manuscript</Th><Th>Status</Th><Th>Created</Th><Th>Artifacts</Th><Th>Avg quality</Th><Th>Missing author exposure</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rg-cream2/10">
                    {data.jobs.map((job) => (
                      <tr key={job.id} className={selectedJob?.id === job.id ? "bg-rg-gold/10" : "hover:bg-rg-ink/50"}>
                        <Td><button onClick={() => setJobId(job.id)} className="font-rg-mono text-xs text-rg-gold underline">{job.id.slice(0, 8)}…</button></Td>
                        <Td>{job.manuscript.title ?? `#${job.manuscriptId ?? '—'}`}</Td>
                        <Td><span className={`rounded border px-2 py-0.5 text-xs font-bold ${statusClass(job.status)}`}>{job.status}</span></Td>
                        <Td>{fmtDate(job.createdAt)}</Td>
                        <Td>{job.contractCleanArtifactCount ?? job.certifiedArtifactCount}/{job.artifactCount} clean</Td>
                        <Td>{job.averageQuality0To100 == null ? "—" : `${job.averageQuality0To100}%`}</Td>
                        <Td>{compactList(job.missingAuthorExposureArtifacts, 2)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/60 p-5">
              <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-end">
                <div>
                  <h2 className="font-rg-serif text-2xl">Persisted artifact metrics</h2>
                  <p className="mt-1 text-sm text-rg-cream2/60">
                    {selectedJob ? `Showing ${visibleArtifacts.length} artifact(s) for ${selectedJob.id}.` : `Showing ${visibleArtifacts.length} artifact(s).`}
                  </p>
                </div>
                <p className="font-rg-mono text-xs text-rg-cream2/55">Score is observability only; SIPOC status drives triage.</p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[1400px] divide-y divide-rg-cream2/10 text-sm">
                  <thead>
                    <tr>
                      <Th>Artifact</Th><Th>Score</Th><Th>Producer</Th><Th>Completeness metric</Th><Th>Accuracy metric</Th><Th>Missing fields</Th><Th>Dirty data / kickback</Th><Th>Status signals</Th><Th>SIPOC metrics</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rg-cream2/10">
                    {visibleArtifacts.map((artifact) => (
                      <tr key={artifact.id} className="align-top hover:bg-rg-ink/50">
                        <Td>
                          <div className="space-y-1">
                            <p className="font-rg-mono text-xs text-rg-gold">{artifact.artifactType}</p>
                            <p className="text-xs text-rg-cream2/50">{artifact.registered ? "registered" : "unregistered"} · {Math.round((artifact.sizeBytes ?? 0) / 1024)} KB</p>
                            <Link href={`/admin/forensics/${artifact.jobId}`} className="text-xs text-rg-gold underline">Forensics →</Link>
                          </div>
                        </Td>
                        <Td><span className={`rounded border px-2 py-1 font-rg-mono text-xs ${scoreClass(artifact.quality.score0To100)}`}>{artifact.quality.score0To100}%</span></Td>
                        <Td>{artifact.registry?.producerProcessName ?? "No registry entry"}</Td>
                        <Td>{artifact.registry?.completenessMetric ?? "Registry missing — add SIPOC contract"}</Td>
                        <Td>{artifact.registry?.accuracyMetric ?? "Registry missing — no accuracy metric assigned"}</Td>
                        <Td>{artifact.quality.missingFields.length ? compactList(artifact.quality.missingFields, 4) : "—"}</Td>
                        <Td>
                          <p>{artifact.registry?.dirtyDataRule ?? "No dirty-data rule assigned"}</p>
                          <p className="mt-1 text-xs text-rg-cream2/50">Owner: {artifact.registry?.regenerationOwnerStageId ?? "—"}</p>
                          {artifact.registry?.kicks?.[0] && <p className="mt-1 text-xs text-rg-cream2/50">Kick: {artifact.registry.kicks[0].kickBackTo}</p>}
                        </Td>
                        <Td><pre className="max-w-xs whitespace-pre-wrap rounded bg-rg-ink/70 p-2 text-xs text-rg-cream2/70">{JSON.stringify(artifact.statusSignals, null, 2)}</pre></Td>
                        <Td>
                          <p className="text-xs"><span className="text-rg-gold">Output:</span> {compactList(artifact.registry?.producerOutputMetrics ?? [], 2)}</p>
                          <p className="mt-2 text-xs"><span className="text-rg-gold">Input:</span> {compactList(artifact.registry?.consumerInputMetrics ?? [], 2)}</p>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-green-200" : tone === "warn" ? "text-amber-100" : tone === "bad" ? "text-red-200" : "text-rg-cream";
  return <div className="rounded-lg border border-rg-cream2/15 bg-rg-ink2/70 p-4"><p className="font-rg-mono text-[10px] uppercase tracking-[0.16em] text-rg-gold">{label}</p><p className={`mt-2 font-rg-serif text-3xl ${color}`}>{value}</p></div>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 text-left font-rg-mono text-xs uppercase tracking-wider text-rg-gold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 text-rg-cream2/80">{children}</td>;
}