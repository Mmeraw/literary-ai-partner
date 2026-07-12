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

function Field({ label, value, W }: { label: string; value: string; W: StrategyCardColors }) {
  return (
    <div className="rounded px-4 py-3" style={{ border: `1px solid ${W.borderFaint}`, backgroundColor: W.surface2 }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: W.muted }}>
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-[1.65]" style={{ color: W.cream2 }}>
        {value || '—'}
      </p>
    </div>
  );
}

export default function StrategyCard({
  viewModel,
  W,
}: {
  viewModel: StrategyCardViewModel;
  W: StrategyCardColors;
}) {
  const { scaffold, illustrativeExamples } = viewModel;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <Eyebrow W={W}>Repair Strategy</Eyebrow>
        <span className="text-[10px]" style={{ color: W.dim }}>
          {scaffold.cardNumber}
        </span>
      </div>

      <div
        className="rounded px-4 py-3"
        style={{ border: `1px solid ${W.borderFaint}`, backgroundColor: W.surface }}
      >
        <Eyebrow W={W}>Evidence Anchor</Eyebrow>
        <p
          className="mt-2 text-sm leading-[1.65]"
          style={{ color: W.cream2, fontFamily: 'Georgia, serif' }}
        >
          {scaffold.evidenceAnchor || 'No excerpt available'}
        </p>
      </div>

      <div
        className="rounded px-4 py-3"
        style={{ border: `1px solid rgba(122,43,26,0.35)`, backgroundColor: 'rgba(122,43,26,0.06)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: W.dangerText }}>
          Trusted Path: {scaffold.trustedPathStatus}
        </p>
        <p className="mt-1 text-sm" style={{ color: W.muted }}>
          Why copy-paste is unsafe: {scaffold.reasonCopyPasteIsUnsafe}
        </p>
      </div>

      <div className="grid gap-3">
        <Field label="Recommended repair" value={scaffold.recommendedRepair} W={W} />
        <Field label="Rhythm / cadence alternative" value={scaffold.rhythmCadenceAlternative} W={W} />
        <Field label="Bold structural choice" value={scaffold.boldStructuralChoice} W={W} />
        <Field label="Author decision required" value={scaffold.authorDecisionRequired} W={W} />
      </div>

      {illustrativeExamples.length > 0 && (
        <div className="space-y-3">
          <Eyebrow W={W}>Illustrative examples</Eyebrow>
          <p className="text-xs" style={{ color: W.dim }}>
            These are example approaches, not executable copy-paste drafts.
          </p>
          {illustrativeExamples.map((example) => (
            <div
              key={example.key}
              className="rounded px-4 py-3"
              style={{ border: `1px solid ${W.borderFaint}`, backgroundColor: W.surface }}
            >
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: W.gold }}>
                  {example.key} — {example.label}
                </p>
              </div>
              <p
                className="text-sm leading-[1.65] whitespace-pre-wrap"
                style={{ color: W.cream2 }}
              >
                {example.text}
              </p>
              <button
                type="button"
                onClick={() => handleCopy(example.text)}
                className="mt-2 rounded px-2 py-0.5 text-[10px]"
                style={{ border: `1px solid ${W.border}`, color: W.muted }}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
