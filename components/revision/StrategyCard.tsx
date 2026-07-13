import React from 'react';
import type { StrategyCardViewModel as LegacyStrategyCardViewModel } from '@/lib/revision/recommendationExecutability';
import type { StrategyCardUiViewModel } from './workbenchCardModels';

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

const DEFAULT_COLORS: StrategyCardColors = {
  bg: '#0D0A05',
  surface: '#12100B',
  surface2: '#171209',
  surface3: '#1C160E',
  border: '#2E261A',
  borderFaint: '#231D12',
  gold: '#C8A96E',
  cream: '#F5EFE4',
  cream2: '#E8D8BA',
  muted: '#BBAA8B',
  dim: '#9C8A6E',
  dangerText: '#F1B6A5',
};

type StrategyPresentation = {
  recommendedStrategy: string;
  whyDirectCopyPasteUnsafe: string;
  evidenceAnchor: string;
  implementationSequence: string[];
  implementationApproaches: string[];
  authorDecisionRequired?: string;
  safeguards: string[];
  illustrativeExample?: { text: string; disclaimer: string };
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function isStrictViewModel(value: LegacyStrategyCardViewModel | StrategyCardUiViewModel): value is StrategyCardUiViewModel {
  return 'recommendedStrategy' in value;
}

function toPresentation(viewModel: LegacyStrategyCardViewModel | StrategyCardUiViewModel): StrategyPresentation {
  if (isStrictViewModel(viewModel)) {
    return {
      recommendedStrategy: normalize(viewModel.recommendedStrategy),
      whyDirectCopyPasteUnsafe: normalize(viewModel.whyDirectCopyPasteUnsafe),
      evidenceAnchor: normalize(viewModel.evidenceAnchor),
      implementationSequence: viewModel.implementationSequence.map(normalize).filter(Boolean),
      implementationApproaches: (viewModel.implementationApproaches ?? []).map(normalize).filter(Boolean),
      authorDecisionRequired: normalize(viewModel.authorDecisionRequired) || undefined,
      safeguards: (viewModel.safeguards ?? []).map(normalize).filter(Boolean),
      illustrativeExample: viewModel.illustrativeExample,
    };
  }

  const scaffold = viewModel.scaffold;
  const approaches = [
    normalize(scaffold.conservativeApproach),
    normalize(scaffold.moderateApproach),
    normalize(scaffold.boldApproach),
  ].filter(Boolean);
  const illustrativeText = normalize(viewModel.illustrativeExamples?.[0]?.text);
  return {
    recommendedStrategy: approaches[0] || 'Review the evidence and complete the repair at the smallest safe narrative scope.',
    whyDirectCopyPasteUnsafe: normalize(scaffold.reasonCopyPasteIsUnsafe),
    evidenceAnchor: normalize(scaffold.evidenceAnchor),
    implementationSequence: approaches,
    implementationApproaches: approaches.slice(1),
    authorDecisionRequired: normalize(scaffold.authorDecisionRequired) || undefined,
    safeguards: [],
    illustrativeExample: illustrativeText
      ? { text: illustrativeText, disclaimer: 'Illustrative phrasing only—not a replacement passage' }
      : undefined,
  };
}

function Eyebrow({ children, W }: { children: React.ReactNode; W: StrategyCardColors }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: W.muted }}>{children}</p>;
}

function Panel({ label, children, W, tone = 'default' }: { label: string; children: React.ReactNode; W: StrategyCardColors; tone?: 'default' | 'warning' }) {
  return (
    <section
      className="rounded px-4 py-4"
      style={tone === 'warning'
        ? { border: '1px solid rgba(122,43,26,0.35)', backgroundColor: 'rgba(122,43,26,0.06)' }
        : { border: `1px solid ${W.borderFaint}`, backgroundColor: W.surface2 }}
    >
      <Eyebrow W={W}>{label}</Eyebrow>
      <div className="mt-2 text-sm leading-[1.65]" style={{ color: W.cream2 }}>{children}</div>
    </section>
  );
}

export default function StrategyCard({
  viewModel,
  W = DEFAULT_COLORS,
}: {
  viewModel: LegacyStrategyCardViewModel | StrategyCardUiViewModel;
  W?: StrategyCardColors;
}) {
  const presentation = toPresentation(viewModel);
  const sequence = presentation.implementationSequence.length
    ? presentation.implementationSequence
    : [presentation.recommendedStrategy];

  return (
    <div className="space-y-5" data-testid="revision-strategy-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow W={W}>Revision Strategy</Eyebrow>
          <h3 className="mt-1 text-base font-semibold" style={{ color: W.cream }}>One guided repair plan</h3>
        </div>
        <span className="rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ border: `1px solid ${W.border}`, color: W.dim }}>
          Author review required
        </span>
      </div>

      <Panel label="Why direct copy-paste is unsafe" W={W} tone="warning">
        <p>{presentation.whyDirectCopyPasteUnsafe || 'This repair requires author judgment across more context than a bounded replacement can safely change.'}</p>
      </Panel>

      <Panel label="Evidence anchor" W={W}>
        <p style={{ fontFamily: 'Georgia, serif' }}>{presentation.evidenceAnchor || 'No excerpt available'}</p>
      </Panel>

      <Panel label="Recommended strategy" W={W}>
        <p>{presentation.recommendedStrategy}</p>
      </Panel>

      <Panel label="Implementation sequence" W={W}>
        <ol className="space-y-3">
          {sequence.map((step, index) => (
            <li key={`${index}-${step.slice(0, 24)}`} className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ border: `1px solid ${W.border}`, color: W.gold }}>
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Panel>

      {presentation.implementationApproaches.length > 0 && (
        <Panel label="Optional subordinate approaches" W={W}>
          <ul className="space-y-2">
            {presentation.implementationApproaches.map((approach) => <li key={approach} className="before:mr-2 before:content-['—']">{approach}</li>)}
          </ul>
        </Panel>
      )}

      {presentation.authorDecisionRequired && (
        <Panel label="Author decision required" W={W}><p>{presentation.authorDecisionRequired}</p></Panel>
      )}

      {presentation.safeguards.length > 0 && (
        <Panel label="Continuity and voice safeguards" W={W}>
          <ul className="space-y-2">{presentation.safeguards.map((item) => <li key={item} className="before:mr-2 before:content-['•']">{item}</li>)}</ul>
        </Panel>
      )}

      {presentation.illustrativeExample && (
        <Panel label="Optional illustration" W={W}>
          <p className="whitespace-pre-wrap" style={{ fontFamily: 'Georgia, serif' }}>{presentation.illustrativeExample.text}</p>
          <p className="mt-3 text-xs font-semibold" style={{ color: W.dangerText }}>{presentation.illustrativeExample.disclaimer}</p>
        </Panel>
      )}

      <div className="rounded px-4 py-3 text-xs leading-relaxed" style={{ border: `1px solid ${W.borderFaint}`, backgroundColor: W.surface, color: W.dim }}>
        This card provides a revision plan, not replacement prose. There are no A/B/C options and nothing here can be accepted into the manuscript automatically.
      </div>
    </div>
  );
}
