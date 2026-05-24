import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

type ActBlock = { reader_question: string; emotional_state: string; risk: string } | undefined;

function ActCard({ label, block }: { label: string; block: ActBlock }) {
  if (!block) return null;
  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
      {block.reader_question && (
        <p className="text-sm text-gray-800">
          <span className="font-medium">Question:</span> {block.reader_question}
        </p>
      )}
      {block.emotional_state && (
        <p className="text-sm text-gray-600">
          <span className="font-medium">Emotional state:</span> {block.emotional_state}
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

export default function LongformReaderExperience({ doc }: Props) {
  const rx = doc.reader_experience;
  if (!rx) return null;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <ActCard label="First act" block={rx.first_act} />
        <ActCard label="Middle" block={rx.middle} />
        <ActCard label="Final act" block={rx.final_act} />
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
