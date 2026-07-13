import React from 'react';
import type { StrategyCardViewModel } from '@/lib/revision/recommendationExecutability';

type StrategyCardColors = {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderFaint: string;
  gold: string;
  cream: string;
  cream2: string;
  muted: string;
  dim: string;
  dangerText: string;
};

function Eyebrow({ children, W }: { children: React.ReactNode; W: StrategyCardColors }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: W.muted }}>
      {children}
    </p>
  );
}

function Panel({
  label,
  children,
  W,
  tone = 'default',
}: {
  label: string;
  children: React.ReactNode;
  W: StrategyCardColors;
  tone?: 'default' | 'warning';
}) {
  return (
    <section
      className="rounded px-4 py-4"
      style={
        tone === 'warning'
          ? { border: '1px solid rgba(122,43,26,0.35)', backgroundColor: 'rgba(122,43,26,0.06)' }
          : { border: `1px solid ${W.borderFaint}`, backgroundColor: W.surface2 }
      }
    >
      <Eyebrow W={W}>{label}</Eyebrow>
      <div className="mt-2 text-sm leading-[1.65]" style={{ color: W.cream2 }}>
        {children}
      </div>
    </section>
  );
}

function nonEmpty(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim() ?? '').filter(Boolean);
}

export default function StrategyCard({
  viewModel,
  W,
}: {
  viewModel: StrategyCardViewModel;
  W: StrategyCardColors;
}) {
  const { scaffold } = viewModel;
  const approaches = nonEmpty([
    scaffold.conservativeApproach,
    scaffold.moderateApproach,
    scaffold.boldApproach,
  ]);

  return (
    <div className="space-y-5" data-testid="revision-strategy-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow W={W}>Revision Strategy</Eyebrow>
          <h3 className="mt-1 text-base font-semibold" style={{ color: W.cream }}>
            One guided repair plan
          </h3>
        </div>
        <span
          className="rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ border: `1px solid ${W.border}`, color: W.dim }}
        >
          Author review required
        </span>
      </div>

      <Panel label="Why direct copy-paste is unsafe" W={W} tone="warning">
        <p>{scaffold.reasonCopyPasteIsUnsafe}</p>
      </Panel>

      <Panel label="Evidence anchor" W={W}>
        <p style={{ fontFamily: 'Georgia, serif' }}>
          {scaffold.evidenceAnchor || 'No excerpt available'}
        </p>
      </Panel>

      <Panel label="Recommended strategy" W={W}>
        <p>{approaches[0] || 'Review the evidence and complete the repair at the smallest safe narrative scope.'}</p>
      </Panel>

      {approaches.length > 1 && (
        <Panel label="Implementation approaches" W={W}>
          <ol className="space-y-3">
            {approaches.slice(1).map((approach, index) => (
              <li key={`${index}-${approach.slice(0, 24)}`} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{ border: `1px solid ${W.border}`, color: W.gold }}
                >
                  {index + 1}
                </span>
                <span>{approach}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {scaffold.authorDecisionRequired?.trim() && (
        <Panel label="Author decision required" W={W}>
          <p>{scaffold.authorDecisionRequired}</p>
        </Panel>
      )}

      <div
        className="rounded px-4 py-3 text-xs leading-relaxed"
        style={{ border: `1px solid ${W.borderFaint}`, backgroundColor: W.surface, color: W.dim }}
      >
        This card provides a revision plan, not replacement prose. There are no A/B/C options and nothing here can be accepted into the manuscript automatically.
      </div>
    </div>
  );
}
