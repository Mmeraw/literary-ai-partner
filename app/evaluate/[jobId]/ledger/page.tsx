import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { approveLedgerAction, rejectLedgerAction } from './actions';
import type { Pass1aCharacterLedger, CharacterLedgerV2 } from '@/lib/evaluation/pipeline/types';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// Shape of pass1a_story_layer_v1 content (8 canonical layers + gate report)
type StoryLayerContent = {
  job_id?: string;
  artifact_type?: string;
  generated_at?: string;
  layers?: {
    source_integrity_layer?: Record<string, unknown>;
    pov_structure_layer?: Record<string, unknown>;
    canonical_identity_layer?: Record<string, unknown>;
    cast_role_tier_layer?: Record<string, unknown>;
    relationship_network_layer?: Record<string, unknown>;
    object_symbol_layer?: Record<string, unknown>;
    location_timeline_worldstate_layer?: Record<string, unknown>;
    threat_antagonist_ending_layer?: Record<string, unknown>;
  };
  layer_completion_summary?: {
    total_layers: number;
    populated_layers: number;
    empty_layers: string[];
    degraded_layers: string[];
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
  manuscripts?:
    | { user_id?: string | null; title?: string | null }
    | Array<{ user_id?: string | null; title?: string | null }>
    | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}

function joinList(values: string[] | null | undefined, fallback = 'None detected'): string {
  if (!values || values.length === 0) return fallback;
  return values.join(', ');
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function groupWarnings(triggers: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const trigger of triggers) {
    const match = trigger.match(/"([^"]+)"/);
    const key = match ? match[1] : 'General';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(trigger.replace(/^(HARD_FAIL|WARN): /, ''));
  }
  return map;
}

// Human-readable display name for each canonical story layer key
const LAYER_DISPLAY_NAMES: Record<string, string> = {
  source_integrity_layer: 'Source Integrity',
  pov_structure_layer: 'POV Structure',
  canonical_identity_layer: 'Canonical Identity',
  cast_role_tier_layer: 'Cast & Role Tier',
  relationship_network_layer: 'Relationship Network',
  object_symbol_layer: 'Objects & Symbols',
  location_timeline_worldstate_layer: 'Location · Timeline · World State',
  threat_antagonist_ending_layer: 'Threat · Antagonist · Ending',
};

const LAYER_ORDER = [
  'source_integrity_layer',
  'pov_structure_layer',
  'canonical_identity_layer',
  'cast_role_tier_layer',
  'relationship_network_layer',
  'object_symbol_layer',
  'location_timeline_worldstate_layer',
  'threat_antagonist_ending_layer',
] as const;

// ─── Data access ─────────────────────────────────────────────────────────────

async function getLedgerContext(jobId: string, userId: string) {
  const supabase = createAdminClient();

  const { data: job, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select(
      'id, user_id, manuscript_id, status, phase, phase_status, ledger_approved_at, evaluation_project_id, manuscripts(user_id,title)',
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) return null;

  const typedJob = job as LedgerJob;
  if (relationOwner(typedJob) !== userId) return null;

  // Load pass1a_character_ledger_v1 (legacy character arc data — still rendered)
  const { data: characterArtifact, error: characterArtifactError } = await supabase
    .from('evaluation_artifacts')
    .select('id, content, created_at, updated_at')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_character_ledger_v1')
    .maybeSingle();

  if (characterArtifactError) {
    console.error('[StoryLedger] character artifact read failed', characterArtifactError.message);
  }

  // Load pass1a_story_layer_v1 (new 8-layer story map — primary Review Gate artifact)
  const { data: storyLayerArtifact, error: storyLayerArtifactError } = await supabase
    .from('evaluation_artifacts')
    .select('id, content, created_at, source_hash')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_story_layer_v1')
    .maybeSingle();

  if (storyLayerArtifactError) {
    console.error('[StoryLedger] story layer artifact read failed', storyLayerArtifactError.message);
  }

  return {
    job: typedJob,
    characterArtifact: characterArtifact as {
      id: string;
      content: LedgerArtifactContent;
      created_at?: string;
      updated_at?: string;
    } | null,
    storyLayerArtifact: storyLayerArtifact as {
      id: string;
      content: StoryLayerContent;
      created_at?: string;
      source_hash?: string;
    } | null,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function EmptySection({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
      <h2 className="text-base font-semibold text-gray-500">{title}</h2>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
      <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        Requires Ledger V2
      </p>
    </section>
  );
}

/**
 * StoryLayerPanel — renders a single named story layer from pass1a_story_layer_v1.
 * Falls back to a "not populated" state for empty/missing layers.
 */
function StoryLayerPanel({
  layerKey,
  data,
}: {
  layerKey: string;
  data: Record<string, unknown> | undefined | null;
}) {
  const displayName = LAYER_DISPLAY_NAMES[layerKey] ?? layerKey;

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {displayName}
        </h3>
        <p className="mt-1 text-xs text-gray-400">No data in this layer.</p>
      </div>
    );
  }

  // Render every top-level field as a key–value row.
  // Values that are arrays are joined; objects are JSON-expanded.
  const fields = Object.entries(data).filter(([k]) => !k.startsWith('_'));

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
        {displayName}
      </h3>
      <dl className="space-y-3">
        {fields.map(([key, val]) => (
          <div key={key}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {key.replace(/_/g, ' ')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {Array.isArray(val)
                ? val.length === 0
                  ? <span className="text-gray-400">—</span>
                  : (val as unknown[]).map((v) =>
                      typeof v === 'string' ? v : JSON.stringify(v),
                    ).join(', ')
                : typeof val === 'object' && val !== null
                  ? <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">{JSON.stringify(val, null, 2)}</pre>
                  : val === null || val === undefined
                    ? <span className="text-gray-400">—</span>
                    : String(val)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StoryLedgerPage({
  params,
  searchParams,
}: {
  params: { jobId: string };
  searchParams?: { approved?: string; rejected?: string };
}) {
  const user = await getAuthenticatedUser();
  if (!user) notFound();

  const context = await getLedgerContext(params.jobId, user.id);
  if (!context) notFound();

  const { job, characterArtifact, storyLayerArtifact } = context;

  // Character ledger (legacy)
  const content = characterArtifact?.content ?? null;
  const ledger = content?.ledger_v1 ?? null;
  const ledgerV2 = content?.ledger_v2 ?? null;
  const entries = ledger?.entries ?? [];
  const summary = content?.summary ?? {};

  // Story layer (new)
  const storyLayers = storyLayerArtifact?.content?.layers ?? null;
  const layerCompletionSummary = storyLayerArtifact?.content?.layer_completion_summary ?? null;

  // Gate state
  const atReviewGate =
    job.phase === 'review_gate' && job.phase_status === 'awaiting_approval';
  const approved = Boolean(job.ledger_approved_at) || job.phase === 'phase_2';
  const justApproved = searchParams?.approved === '1';
  const justRejected = searchParams?.rejected === '1';
  const title = relationTitle(job);

  // Quality gate (from character ledger — kept for backwards compat)
  const hardFails = ledger?.coverage_summary?.hard_fail_triggers ?? [];
  const antagonists = ledger?.coverage_summary?.antagonists ?? [];
  const hasQualityFailures = hardFails.length > 0 || antagonists.length === 0;
  const groupedWarnings = groupWarnings(hardFails);

  // Determine which artifact to show in the Review Gate CTA
  const hasStoryLayer = Boolean(storyLayerArtifact?.id);
  const hasCharacterLedger = Boolean(characterArtifact?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
              RevisionGrade Full-Novel Beta
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">Story Ledger</h1>
            <p className="mt-2 text-lg font-semibold text-gray-800">{title}</p>
            <p className="mt-1 text-sm text-gray-600">
              Job ID: <span className="font-mono">{job.id}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/evaluate/${job.id}`}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Back to Evaluation
            </Link>
            <Link
              href="/evaluate"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Job List
            </Link>
          </div>
        </div>

        {/* ── Approval success banner ── */}
        {justApproved && (
          <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">Story Ledger approved.</p>
            <p className="mt-1 text-sm text-emerald-800">
              Phase 2 (Craft Diagnostic) has been queued. You can close this tab — the
              evaluation runs in the background and you will be notified when it is complete.
            </p>
          </section>
        )}

        {/* ── Rejection confirmation banner ── */}
        {justRejected && (
          <section className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="font-semibold text-rose-900">Story Ledger rejected.</p>
            <p className="mt-1 text-sm text-rose-800">
              This evaluation has been closed. Revise your manuscript and submit a new evaluation
              when you are ready.
            </p>
          </section>
        )}

        {/* ── Nothing ready yet ── */}
        {!hasStoryLayer && !hasCharacterLedger ? (
          <section className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-semibold text-gray-900">Story Ledger not ready yet</h2>
            <p className="mt-2 text-sm text-gray-600">
              Phase 1A has not completed for this job. Once the Story Ledger is written, this page
              will show the story map for review.
            </p>
            <div className="mt-4 flex gap-2">
              {pill(job.status ?? 'unknown', job.status === 'failed' ? 'red' : job.status === 'running' ? 'blue' : 'gray')}
              {job.phase ? pill(job.phase, 'amber') : null}
              {job.phase_status ? pill(job.phase_status, 'gray') : null}
            </div>
          </section>
        ) : (
          <>
            {/* ── Review Gate — Approval Panel ─────────────────────────── */}
            {(atReviewGate || !approved) && hasStoryLayer && (
              <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-amber-900">
                      Review Gate — Story Ledger Awaiting Approval
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-800">
                      This is RevisionGrade&apos;s 8-layer story map of your manuscript: characters,
                      POV structure, relationships, objects, locations, timeline, antagonists, and
                      ending accountability. Approving it allows Phase 2 (Craft Diagnostic) to run
                      using this story map as accepted grounding. Rejecting it closes this evaluation
                      — you may revise and resubmit.
                    </p>
                  </div>
                  {layerCompletionSummary && (
                    <div className="flex-shrink-0 rounded-lg border border-amber-200 bg-white px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {layerCompletionSummary.populated_layers}/{layerCompletionSummary.total_layers}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Layers populated</p>
                    </div>
                  )}
                </div>

                {/* Approve / Reject forms */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <form action={approveLedgerAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <input type="hidden" name="disposition" value="accepted_without_changes" />
                    <button
                      type="submit"
                      data-testid="button-approve-ledger"
                      className="rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                    >
                      Approve — Run Phase 2
                    </button>
                  </form>

                  <form action={rejectLedgerAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <input type="hidden" name="disposition" value="rejected" />
                    <button
                      type="submit"
                      data-testid="button-reject-ledger"
                      className="rounded-md border border-rose-300 bg-white px-5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Reject — Close Evaluation
                    </button>
                  </form>
                </div>

                <p className="mt-3 text-xs text-amber-700">
                  Approval is backend-enforced. Phase 2 will not start until this gate is passed.
                </p>
              </section>
            )}

            {/* ── Already approved banner (when past review gate) ── */}
            {approved && !justApproved && !atReviewGate && (
              <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-900">Story Ledger approved — Phase 2 queued.</p>
              </section>
            )}

            {/* ── 8-Layer Story Map (pass1a_story_layer_v1) ── */}
            {hasStoryLayer && storyLayers && (
              <section className="mb-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold text-gray-900">8-Layer Story Map</h2>
                  <div className="flex flex-wrap gap-2">
                    {pill('pass1a_story_layer_v1', 'blue')}
                    {layerCompletionSummary &&
                      layerCompletionSummary.empty_layers.length > 0 &&
                      pill(
                        `${layerCompletionSummary.empty_layers.length} empty layer${layerCompletionSummary.empty_layers.length > 1 ? 's' : ''}`,
                        'amber',
                      )}
                    {layerCompletionSummary &&
                      layerCompletionSummary.degraded_layers.length > 0 &&
                      pill(
                        `${layerCompletionSummary.degraded_layers.length} degraded`,
                        'red',
                      )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {LAYER_ORDER.map((key) => (
                    <StoryLayerPanel
                      key={key}
                      layerKey={key}
                      data={storyLayers[key] as Record<string, unknown> | undefined}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Character Ledger (pass1a_character_ledger_v1) ── */}
            {hasCharacterLedger && ledger && (
              <>
                {/* Quality failure banner */}
                {hasQualityFailures && !approved && (
                  <section className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <p className="font-semibold text-rose-900">
                      This character ledger has quality issues.
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-800">
                      {antagonists.length === 0 && (
                        <li>No antagonists detected — required for all narrative manuscripts.</li>
                      )}
                      {hardFails.length > 0 && (
                        <li>
                          {hardFails.length} hard warning{hardFails.length > 1 ? 's' : ''} require
                          resolution before approval.
                        </li>
                      )}
                    </ul>
                  </section>
                )}

                {/* Review header — character ledger metrics */}
                <section className="mb-6 rounded-xl border bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Character Arc Ledger
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        pass1a_character_ledger_v1 — character arcs, relationships, and evidence anchors
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
                    <MetricCard
                      label="Relationships"
                      value={summary.v2_relationship_pairs ?? ledger.coverage_summary.relational_engines.length}
                    />
                    <MetricCard
                      label="Objects / Symbols"
                      value={summary.v2_objects_tracked ?? ledger.coverage_summary.symbol_payoff_items.length}
                    />
                  </div>
                </section>

                {/* POV Structure stub */}
                <EmptySection
                  title="POV Structure"
                  description="Primary and secondary POV characters, their narrative share, and voice notes will appear here once Ledger V2 is generated."
                />

                <div className="mt-4" />

                {/* Coverage Summary */}
                <section className="mb-6 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border bg-white p-5 lg:col-span-2">
                    <h2 className="text-lg font-semibold text-gray-900">Coverage Summary</h2>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Protagonists</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {joinList(ledger.coverage_summary.protagonists)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Co-protagonists</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {joinList(ledger.coverage_summary.co_protagonists)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Antagonists</dt>
                        <dd
                          className={`mt-1 text-sm ${antagonists.length === 0 ? 'font-semibold text-rose-700' : 'text-gray-900'}`}
                        >
                          {antagonists.length === 0
                            ? '⚠ None detected — ledger V2 required'
                            : joinList(antagonists)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Major secondary characters
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {joinList(ledger.coverage_summary.major_secondary_characters)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Warnings */}
                  <div className="rounded-xl border bg-white p-5">
                    <h2 className="text-lg font-semibold text-gray-900">Warnings</h2>
                    {hardFails.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-600">No hard ledger warnings detected.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {Array.from(groupedWarnings.entries()).map(([subject, warnings]) => (
                          <div key={subject} className="rounded-md bg-rose-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                              {subject}
                            </p>
                            <ul className="mt-1 space-y-1">
                              {warnings.map((w, i) => (
                                <li key={i} className="text-sm text-rose-800">
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {antagonists.length === 0 && (
                  <EmptySection
                    title="Antagonists"
                    description="No antagonists were detected in this ledger pass. Ledger V2 will include antagonist sweep logic to capture cartel enforcers, threat-bearing characters, and institutional forces."
                  />
                )}

                <div className="mt-4" />

                {(ledger.coverage_summary.major_secondary_characters ?? []).length === 0 && (
                  <EmptySection
                    title="Major Secondary Characters"
                    description="Supporting cast will be captured in Ledger V2 with the increased character detection cap."
                  />
                )}

                <div className="mt-4" />

                <EmptySection
                  title="Object / Symbol Ledger"
                  description="Plot-critical objects will be tracked here in Ledger V2 with type, function, and evidence references."
                />

                <div className="mt-4" />

                <EmptySection
                  title="Ending Accountability"
                  description="Each character's final status with their last evidence reference will appear here in Ledger V2."
                />

                <div className="mt-6" />

                {/* Character Arc Ledger — individual entries */}
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Character Entries</h2>
                  <p className="text-sm text-gray-500">
                    Note: identity fragmentation may cause the same character to appear as multiple
                    entries below. This is resolved in Ledger V2 via canonical identity grouping.
                  </p>
                  {entries.map((entry) => (
                    <article
                      key={`${entry.canonical_name}-${entry.first_chunk_index}`}
                      className="rounded-xl border bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {entry.canonical_name}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">
                            {entry.who_is_this || 'No summary available.'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {pill(
                            entry.role,
                            entry.role === 'protagonist'
                              ? 'green'
                              : entry.role === 'antagonist'
                                ? 'red'
                                : 'gray',
                          )}
                          {pill(entry.narrative_weight_band, 'blue')}
                          {pill(
                            `Evidence span ${entry.first_chunk_index}–${entry.last_chunk_index}`,
                            'gray',
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Arc
                          </p>
                          <p className="mt-1 text-sm text-gray-800">
                            <span className="font-medium">Start:</span> {entry.arc_start || 'N/A'}
                          </p>
                          <p className="mt-1 text-sm text-gray-800">
                            <span className="font-medium">Pressure:</span>{' '}
                            {entry.arc_pressure || 'N/A'}
                          </p>
                          <p className="mt-1 text-sm text-gray-800">
                            <span className="font-medium">End:</span> {entry.arc_end_state || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Motivation / How Signal
                          </p>
                          <p className="mt-1 text-sm text-gray-800">
                            <span className="font-medium">Want:</span>{' '}
                            {entry.what_do_they_want || 'N/A'}
                          </p>
                          <p className="mt-1 text-sm text-gray-800">
                            <span className="font-medium">Why:</span> {entry.why_signal || 'N/A'}
                          </p>
                          <p className="mt-1 text-sm text-gray-800">
                            <span className="font-medium">How:</span> {entry.how_signal || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {entry.copingMechanisms.filter((m) => m.frequency !== 'rare').length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Coping patterns
                          </p>
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {entry.copingMechanisms
                              .filter((m) => m.frequency !== 'rare')
                              .map((mechanism) => (
                                <li
                                  key={`${entry.canonical_name}-${mechanism.description}`}
                                  className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-800"
                                >
                                  {capitalize(mechanism.description)} · {mechanism.frequency}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}

                      {entry.relational_engines.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Relationships
                          </p>
                          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                            {entry.relational_engines.map((rel) => (
                              <li
                                key={`${entry.canonical_name}-${rel.other_character}`}
                                className="rounded-md border p-2 text-sm text-gray-800"
                              >
                                <span className="font-medium">{rel.other_character}</span>:{' '}
                                {rel.relationship_type} — {rel.dynamic || 'No dynamic note'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {entry.evidence_anchors.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Evidence
                          </p>
                          <ul className="mt-2 space-y-2">
                            {entry.evidence_anchors.slice(0, 3).map((anchor) => (
                              <li
                                key={`${entry.canonical_name}-${anchor.chunk_index}-${anchor.excerpt.slice(0, 20)}`}
                                className="rounded-md bg-gray-50 p-3 text-sm text-gray-700"
                              >
                                <span className="font-semibold">Evidence {anchor.chunk_index}:</span>{' '}
                                &ldquo;{anchor.excerpt}&rdquo;
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
          </>
        )}
      </main>
    </div>
  );
}
