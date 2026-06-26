import type { LongFormMultiLayerEvaluationViewModel } from "@/lib/evaluation/evaluationReportViewModel";

type Props = { vm: LongFormMultiLayerEvaluationViewModel };

type ActBlock = { readerQuestion: string; emotionalState: string; risk: string } | null | undefined;

function ActCard({ label, block }: { label: string; block: ActBlock }) {
  if (!block) return null;
  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
      {block.readerQuestion && (
        <p className="text-sm text-gray-800">
          <span className="font-medium">Question:</span> {block.readerQuestion}
        </p>
      )}
      {block.emotionalState && (
        <p className="text-sm text-gray-600">
          <span className="font-medium">Emotional state:</span> {block.emotionalState}
        </p>
      )}
      {block.risk && (
        <p className="text-xs text-rose-600">
          <span className="font-medium">Risk:</span> {block.risk}
        </p>
      )}
    </div>
  );
}

export default function LongformReaderExperience({ vm }: Props) {
  const rx = vm.readerExperience;
  if (!rx) return null;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <ActCard label="First act" block={rx.firstAct} />
        <ActCard label="Middle" block={rx.middle} />
        <ActCard label="Final act" block={rx.finalAct} />
      </div>
      {rx.aftertaste && (
        <p className="text-sm text-gray-700 italic border-l-4 border-indigo-200 pl-3">
          <span className="not-italic font-medium text-gray-700">Aftertaste: </span>
          {rx.aftertaste}
        </p>
      )}
    </div>
  );
}
