import type { LongFormMultiLayerEvaluationViewModel } from "@/lib/evaluation/evaluationReportViewModel";

type Props = { vm: LongFormMultiLayerEvaluationViewModel };

const PRIORITY_COLORS = [
  "border-rose-400 bg-rose-50",
  "border-orange-400 bg-orange-50",
  "border-amber-400 bg-amber-50",
  "border-yellow-400 bg-yellow-50",
  "border-lime-400 bg-lime-50",
];

export default function LongformRevisionPlan({ vm }: Props) {
  const plan = vm.revisionPlan ?? [];
  if (plan.length === 0) return null;

  return (
    <div className="space-y-3">
      {plan.map((item, i) => {
        const colorClass = PRIORITY_COLORS[i] ?? "border-gray-300 bg-gray-50";
        return (
          <div key={i} className={`rounded-lg border-l-4 p-4 ${colorClass}`}>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-xs font-bold text-gray-700">
                {item.displayPriority}
              </span>
              <div className="flex-1 space-y-2">
                <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
                {item.goal && (
                  <p className="text-xs text-gray-600 leading-relaxed">{item.goal}</p>
                )}
                {item.actions?.length > 0 && (
                  <ul className="list-none space-y-1 pl-0 mt-1">
                    {item.actions.map((action, j) => (
                      <li key={j} className="text-xs text-gray-600 flex gap-2">
                        <span className="shrink-0 text-gray-600">→</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                )}
                {item.acceptanceCheck && (
                  <p className="text-xs text-indigo-700 mt-2 pt-2 border-t border-indigo-100">
                    <span className="font-semibold">Done when:</span> {item.acceptanceCheck}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
