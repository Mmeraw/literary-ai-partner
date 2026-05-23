import type { ReactNode } from 'react';
import Link from 'next/link';

const STORY_LAYER_LABELS = [
  ['source_integrity_layer', 'Source Integrity'],
  ['pov_structure_layer', 'POV Structure'],
  ['canonical_identity_layer', 'Canonical Identity'],
  ['cast_role_tier_layer', 'Cast Role Tiers'],
  ['relationship_network_layer', 'Relationship Network'],
  ['object_symbol_layer', 'Object / Symbol'],
  ['location_timeline_worldstate_layer', 'Location / Timeline / Worldstate'],
  ['threat_antagonist_ending_layer', 'Threat / Antagonist / Ending'],
] as const;

type StoryLayerWorkspacePageProps = {
  params: Promise<{ evaluationProjectId: string }>;
};

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ready' | 'blocked' }) {
  const toneClass = tone === 'ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : tone === 'blocked'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-stone-200 bg-stone-50 text-stone-700';

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>{children}</span>;
}

function WorkspaceShell({ evaluationProjectId }: { evaluationProjectId: string }) {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-stone-500">RevisionGrade Review Gate</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Story Layer Workspace</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
                Review the raw Phase 1A Story Layer and quality verdict before approval normalization. This shell captures review intent only; artifact writes stay in the PR5 normalizer boundary.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill>Project {evaluationProjectId}</StatusPill>
              <StatusPill tone="blocked">Phase 2 locked until accepted ledger</StatusPill>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">8-Layer Index</h2>
            <nav className="mt-4 space-y-2">
              {STORY_LAYER_LABELS.map(([key, label], index) => (
                <a
                  key={key}
                  href={`#${key}`}
                  className="block rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 text-sm hover:bg-stone-100"
                >
                  <span className="text-xs text-stone-500">Layer {index + 1}</span>
                  <span className="block font-medium text-stone-900">{label}</span>
                </a>
              ))}
            </nav>
          </aside>

          <section className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Identity Resolution Card</h2>
                  <p className="mt-1 text-sm text-stone-600">Prepared for alias grouping and correction capture; no persistence happens in this React shell.</p>
                </div>
                <StatusPill>Read-only scaffold</StatusPill>
              </div>
              <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5">
                <p className="text-sm font-medium text-stone-800">Example review task</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Confirm whether name variants belong to one canonical identity group before the Approval Normalizer writes `accepted_story_ledger_v1`.
                </p>
              </div>
            </div>

            {STORY_LAYER_LABELS.map(([key, label]) => (
              <article key={key} id={key} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{label}</h3>
                    <p className="mt-1 font-mono text-xs text-stone-500">{key}</p>
                  </div>
                  <StatusPill>Awaiting artifact data</StatusPill>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Evidence anchors</p>
                    <p className="mt-2 text-sm text-stone-600">Reserved for snippet references from `pass1a_story_layer_v1`.</p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Reviewer disposition</p>
                    <p className="mt-2 text-sm text-stone-600">Reserved for accepted / modified / rejected layer feedback.</p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Artifact Status</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="font-mono text-xs text-stone-500">pass1a_story_layer_v1</p>
                  <p className="mt-1 font-medium">Required before Review Gate</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="font-mono text-xs text-stone-500">ledger_quality_report_v1</p>
                  <p className="mt-1 font-medium">Controls hard-fail lock state</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="font-mono text-xs text-stone-500">accepted_story_ledger_v1</p>
                  <p className="mt-1 font-medium">Not written by this UI shell</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Evidence Anchor Rail</h2>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                Future integration point for contextual text snippets that support each Story Layer claim.
              </p>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-900">Review Disposition</h2>
              <p className="mt-4 text-sm leading-6 text-amber-950">
                Approval action is intentionally disabled in this shell until the PR5 normalizer endpoint/server action is wired and hard-fail state is verified.
              </p>
              <button
                type="button"
                disabled
                className="mt-5 w-full rounded-2xl bg-stone-300 px-4 py-3 text-sm font-semibold text-stone-600"
              >
                Approve and Proceed to Evaluation — Locked
              </button>
            </section>
          </aside>
        </div>

        <footer className="rounded-3xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-sm">
          <Link href="/dashboard" className="font-medium text-stone-900 underline underline-offset-4">Back to dashboard</Link>
        </footer>
      </div>
    </main>
  );
}

export default async function StoryLayerWorkspacePage({ params }: StoryLayerWorkspacePageProps) {
  const { evaluationProjectId } = await params;
  return <WorkspaceShell evaluationProjectId={evaluationProjectId} />;
}
