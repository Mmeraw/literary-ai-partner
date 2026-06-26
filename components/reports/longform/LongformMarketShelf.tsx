import type { LongFormMultiLayerEvaluationViewModel } from "@/lib/evaluation/evaluationReportViewModel";

type Props = { vm: LongFormMultiLayerEvaluationViewModel };

export default function LongformMarketShelf({ vm }: Props) {
  const shelf = vm.marketShelf;
  if (!shelf) return null;

  return (
    <div className="space-y-4">
      {shelf.bestShelf && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Best shelf</p>
          <p className="text-gray-800 font-medium">{shelf.bestShelf}</p>
        </div>
      )}

      {shelf.marketableHook && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Marketable hook</p>
          <p className="text-gray-700">{shelf.marketableHook}</p>
        </div>
      )}

      {(shelf.shelfNeighbors?.length > 0 || shelf.comparisonSpace?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {shelf.shelfNeighbors?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Shelf neighbors</p>
              <ul className="list-none space-y-0.5 pl-0">
                {shelf.shelfNeighbors.map((n, i) => (
                  <li key={i} className="text-sm text-gray-600 before:content-['·'] before:mr-1.5 before:text-gray-500">{n}</li>
                ))}
              </ul>
            </div>
          )}
          {shelf.comparisonSpace?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Comparison space</p>
              <ul className="list-none space-y-0.5 pl-0">
                {shelf.comparisonSpace.map((c, i) => (
                  <li key={i} className="text-sm text-gray-600 before:content-['·'] before:mr-1.5 before:text-gray-500">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {shelf.marketDanger && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500 mb-1">Market danger</p>
          <p className="text-sm text-rose-800">{shelf.marketDanger}</p>
        </div>
      )}
    </div>
  );
}
