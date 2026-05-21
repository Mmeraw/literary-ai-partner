import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { approveLedgerAction } from './actions';
import type { Pass1aCharacterLedger, CharacterLedgerV2 } from '@/lib/evaluation/pipeline/types';

type LedgerArtifactContent = {
  job_id?: string;
  manuscript_id?: number;
  created_at?: string;
  schema_version?: string;
  ledger_v1?: Pass1aCharacterLedger;
  ledger_v2?: CharacterLedgerV2;
  summary?: {
    entries?: number;
    protagonists?: string[];
    co_protagonists?: string[];
    symbol_items?: number;
    hard_fail_triggers?: number;
    v2_active_blockers?: number;
    v2_relationship_pairs?: number;
    v2_objects_tracked?: number;
  };
};

type LedgerJob = {
  id: string;
  user_id?: string | null;
  manuscript_id?: number | null;
  status?: string | null;
  phase?: string | null;
  phase_status?: string | null;
  ledger_approved_at?: string | null;
  evaluation_project_id?: string | null;
  manuscripts?: { user_id?: string | null; title?: string | null } | Array<{ user_id?: string | null; title?: string | null }> | null;
};

function relationTitle(job: LedgerJob): string {
  const relation = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  return relation?.title?.trim() || 'Untitled manuscript';
}

function relationOwner(job: LedgerJob): string | null {
  const relation = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  return job.user_id ?? relation?.user_id ?? null;
}

function pill(label: string, tone: 'green' | 'blue' | 'amber' | 'gray' | 'red' = 'gray') {
  const classes = {
    green: 'bg-emerald-100 text-emerald-800',
    blue: 'bg-blue-100 text-blue-800',
    amber: 'bg-amber-100 text-amber-800',
    gray: 'bg-gray-100 text-gray-800',
    red: 'bg-rose-100 text-rose-800',
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function joinList(values: string[] | null | undefined, fallback = 'None detected'): string {
  if (!values || values.length === 0) return fallback;
  return values.join(', ');
}

/** Capitalize the first letter of a string. */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Group flat hard_fail_triggers by the character/subject they reference. */
function groupWarnings(triggers: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const trigger of triggers) {
    // Extract quoted name if present, e.g. HARD_FAIL: Pronoun inconsistency for "Michael"
    const match = trigger.match(/"([^"]+)"/);
    const key = match ? match[1] : 'General';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(trigger.replace(/^(HARD_FAIL|WARN): /, ''));
  }
  return map;
}

async function getLedgerContext(jobId: string, userId: string) {
  const supabase = createAdminClient();

  const { data: job, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('id, user_id, manuscript_id, status, phase, phase_status, ledger_approved_at, evaluation_project_id, manuscripts(user_id,title)')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) return null;

  const typedJob = job as LedgerJob;
  if (relationOwner(typedJob) !== userId) return null;

  const { data: artifact, error: artifactError } = await supabase
    .from('evaluation_artifacts')
    .select('id, content, created_at, updated_at')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_character_ledger_v1')
    .maybeSingle();

  if (artifactError) {
    console.error('[StoryLedger] artifact read failed', artifactError.message);
  }

  return {
    job: typedJob,
    artifact: artifact as { id: string; content: LedgerArtifactContent; created_at?: string; updated_at?: string } | null,
  };
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/** Stub section shown when a ledger section has no data yet — signals what V2 will populate. */
function EmptySection({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
      <h2 className="text-base font-semibold text-gray-500">{title}</h2>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
      <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Requires Ledger V2</p>
    </section>
  );
}

export default async function StoryLedgerPage({ params, searchParams }: {
  params: { jobId: string };
  searchParams?: { approved?: string };
}) {
  const user = await getAuthenticatedUser();
  if (!user) notFound();

  const context = await getLedgerContext(params.jobId, user.id);
  if (!context) notFound();

  const { job, artifact } = context;
  const content = artifact?.content ?? null;
  const ledger = content?.ledger_v1 ?? null;
  const ledgerV2 = content?.ledger_v2 ?? null;
  const entries = ledger?.entries ?? [];
  const summary = content?.summary ?? {};
  const approved = Boolean(job.ledger_approved_at);
  const justApproved = searchParams?.approved === '1';
  const title = relationTitle(job);

  // Quality gate: block approval if hard fails exist or no antagonists detected
  const hardFails = ledger?.coverage_summary?.hard_fail_triggers ?? [];
  const antagonists = ledger?.coverage_summary?.antagonists ?? [];
  const hasQualityFailures = hardFails.length > 0 || antagonists.length === 0;
  const groupedWarnings = groupWarnings(hardFails);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">RevisionGrade Full-Novel Beta</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">Story Ledger</h1>
            <p className="mt-2 text-lg font-semibold text-gray-800">{title}</p>
            <p className="mt-1 text-sm text-gray-600">Job ID: <span className="font-mono">{job.id}</span></p>
          </div>
          <div className="flex gap-3">
            <Link href={`/evaluate/${job.id}`} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
              Back to Evaluation
            </Link>
            <Link href="/evaluate" className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
              Job List
            </Link>
          </div>
        </div>

        {/* ── Approval success banner ── */}
        {justApproved && (
          <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">Story Ledger approved.</p>
            <p className="mt-1 text-sm text-emerald-800">The next beta step is to run the manuscript diagnosis from this accepted story map.</p>
          </section>
        )}

        {/* ── Ledger not ready ── */}
        {!ledger ? (
          <section className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-semibold text-gray-900">Story Ledger not ready yet</h2>
            <p className="mt-2 text-sm text-gray-600">
              RevisionGrade has not yet written the Pass 1A character ledger for this job. Once the ledger is ready, this page will show the story map for review.
            </p>
            <div className="mt-4 flex gap-2">
              {pill(job.status ?? 'unknown', job.status === 'failed' ? 'red' : job.status === 'running' ? 'blue' : 'gray')}
              {job.phase ? pill(job.phase, 'amber') : null}
              {job.phase_status ? pill(job.phase_status, 'gray') : null}
            </div>
          </section>
        ) : (
          <>
            {/* ── Quality failure banner ── */}
            {hasQualityFailures && !approved && (
              <section className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
                <p className="font-semibold text-rose-900">This ledger has quality issues and needs review before evaluation can run.</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-800">
                  {antagonists.length === 0 && (
                    <li>No antagonists detected — required for all narrative manuscripts.</li>
                  )}
                  {hardFails.length > 0 && (
                    <li>{hardFails.length} hard warning{hardFails.length > 1 ? 's' : ''} require resolution before approval.</li>
                  )}
                </ul>
              </section>
            )}

            {/* ── Review header ── */}
            <section className="mb-6 rounded-xl border bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Review before running the full manuscript diagnosis</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                    This ledger is RevisionGrade&apos;s map of the manuscript: characters, arcs, relationships, objects, continuity warnings, and recommendation blockers. Approving it means the next evaluation stage can use this story map as accepted grounding.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {approved
                    ? pill('Approved', 'green')
                    : hasQualityFailures
                      ? pill('Needs Review', 'red')
                      : pill('Awaiting approval', 'amber')}
                  {pill(`Evidence span: ${ledger.total_chunks_processed} sections`, 'blue')}
                  {ledgerV2 ? pill('Ledger V2 present', 'green') : pill('Ledger V2 pending', 'amber')}
                </div>
              </div>

              {/* Metric cards */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Characters" value={summary.entries ?? entries.length} />
                <MetricCard label="Protagonists" value={ledger.coverage_summary.protagonists.length} />
                <MetricCard label="Relationships" value={summary.v2_relationship_pairs ?? ledger.coverage_summary.relational_engines.length} />
                <MetricCard label="Objects / Symbols" value={summary.v2_objects_tracked ?? ledger.coverage_summary.symbol_payoff_items.length} />
              </div>

              {/* Approval / gating buttons */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {approved ? (
                  <span className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 cursor-not-allowed">Ledger approved</span>
                ) : hasQualityFailures ? (
                  <>
                    <span className="rounded-md bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 cursor-not-allowed">Ledger Needs Review</span>
                    <form action={approveLedgerAction}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                        title="Admin override — approve despite quality warnings"
                      >
                        Approve Anyway (Admin)
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={approveLedgerAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Approve Ledger and Run Evaluation
                    </button>
                  </form>
                )}
                <p className="text-sm text-gray-500">
                  Stage 2 queuing will be wired in the next patch; this approval is the first durable gate.
                </p>
              </div>
            </section>

            {/* ── POV Structure stub ── */}
            <EmptySection
              title="POV Structure"
              description="Primary and secondary POV characters, their narrative share, and voice notes will appear here once Ledger V2 is generated."
            />

            <div className="mt-4" />

            {/* ── Coverage Summary ── */}
            <section className="mb-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-white p-5 lg:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900">Coverage Summary</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Protagonists</dt>
                    <dd className="mt-1 text-sm text-gray-900">{joinList(ledger.coverage_summary.protagonists)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Co-protagonists</dt>
                    <dd className="mt-1 text-sm text-gray-900">{joinList(ledger.coverage_summary.co_protagonists)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Antagonists</dt>
                    <dd className={`mt-1 text-sm ${antagonists.length === 0 ? 'font-semibold text-rose-700' : 'text-gray-900'}`}>
                      {antagonists.length === 0
                        ? '⚠ None detected — ledger V2 required'
                        : joinList(antagonists)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Major secondary characters</dt>
                    <dd className="mt-1 text-sm text-gray-900">{joinList(ledger.coverage_summary.major_secondary_characters)}</dd>
                  </div>
                </dl>
              </div>

              {/* ── Warnings (grouped) ── */}
              <div className="rounded-xl border bg-white p-5">
                <h2 className="text-lg font-semibold text-gray-900">Warnings</h2>
                {hardFails.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-600">No hard ledger warnings detected.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {Array.from(groupedWarnings.entries()).map(([subject, warnings]) => (
                      <div key={subject} className="rounded-md bg-rose-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">{subject}</p>
                        <ul className="mt-1 space-y-1">
                          {warnings.map((w, i) => (
                            <li key={i} className="text-sm text-rose-800">{w}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ── Antagonists stub (when none detected) ── */}
            {antagonists.length === 0 && (
              <EmptySection
                title="Antagonists"
                description="No antagonists were detected in this ledger pass. Ledger V2 will include antagonist sweep logic to capture cartel enforcers, threat-bearing characters, and institutional forces."
              />
            )}

            <div className="mt-4" />

            {/* ── Major Secondary stub (when none detected) ── */}
            {(ledger.coverage_summary.major_secondary_characters ?? []).length === 0 && (
              <EmptySection
                title="Major Secondary Characters"
                description="Supporting cast (camp characters, embassy staff, family members) will be captured in Ledger V2 with the increased character detection cap."
              />
            )}

            <div className="mt-4" />

            {/* ── Objects / Symbols stub ── */}
            <EmptySection
              title="Object / Symbol Ledger"
              description="Plot-critical objects (weapons, surveillance tools, identity tokens, foreshadowing objects) will be tracked here in Ledger V2 with type, function, and evidence references."
            />

            <div className="mt-4" />

            {/* ── Ending Accountability stub ── */}
            <EmptySection
              title="Ending Accountability"
              description="Each character's final status (resolved / transformed / fate unknown / abandoned arc) with their last evidence reference will appear here in Ledger V2."
            />

            <div className="mt-6" />

            {/* ── Character Arc Ledger ── */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Character Arc Ledger</h2>
              <p className="text-sm text-gray-500">
                Note: identity fragmentation may cause the same character to appear as multiple entries below. This is resolved in Ledger V2 via canonical identity grouping.
              </p>
              {entries.map((entry) => (
                <article key={`${entry.canonical_name}-${entry.first_chunk_index}`} className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{entry.canonical_name}</h3>
                      <p className="mt-1 text-sm text-gray-600">{entry.who_is_this || 'No summary available.'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pill(entry.role, entry.role === 'protagonist' ? 'green' : entry.role === 'antagonist' ? 'red' : 'gray')}
                      {pill(entry.narrative_weight_band, 'blue')}
                      {pill(`Evidence span ${entry.first_chunk_index}–${entry.last_chunk_index}`, 'gray')}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Arc</p>
                      <p className="mt-1 text-sm text-gray-800"><span className="font-medium">Start:</span> {entry.arc_start || 'N/A'}</p>
                      <p className="mt-1 text-sm text-gray-800"><span className="font-medium">Pressure:</span> {entry.arc_pressure || 'N/A'}</p>
                      <p className="mt-1 text-sm text-gray-800"><span className="font-medium">End:</span> {entry.arc_end_state || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Motivation / How Signal</p>
                      <p className="mt-1 text-sm text-gray-800"><span className="font-medium">Want:</span> {entry.what_do_they_want || 'N/A'}</p>
                      <p className="mt-1 text-sm text-gray-800"><span className="font-medium">Why:</span> {entry.why_signal || 'N/A'}</p>
                      <p className="mt-1 text-sm text-gray-800"><span className="font-medium">How:</span> {entry.how_signal || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Coping mechanisms — hide "rare", capitalize */}
                  {entry.copingMechanisms.filter((m) => m.frequency !== 'rare').length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coping patterns</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {entry.copingMechanisms
                          .filter((m) => m.frequency !== 'rare')
                          .map((mechanism) => (
                            <li key={`${entry.canonical_name}-${mechanism.description}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-800">
                              {capitalize(mechanism.description)} · {mechanism.frequency}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* Relationships */}
                  {entry.relational_engines.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Relationships</p>
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {entry.relational_engines.map((rel) => (
                          <li key={`${entry.canonical_name}-${rel.other_character}`} className="rounded-md border p-2 text-sm text-gray-800">
                            <span className="font-medium">{rel.other_character}</span>: {rel.relationship_type} — {rel.dynamic || 'No dynamic note'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Evidence anchors — renamed from "Chunk" */}
                  {entry.evidence_anchors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Evidence</p>
                      <ul className="mt-2 space-y-2">
                        {entry.evidence_anchors.slice(0, 3).map((anchor) => (
                          <li key={`${entry.canonical_name}-${anchor.chunk_index}-${anchor.excerpt.slice(0, 20)}`} className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                            <span className="font-semibold">Evidence {anchor.chunk_index}:</span> &ldquo;{anchor.excerpt}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
