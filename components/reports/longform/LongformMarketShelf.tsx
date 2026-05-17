import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Props = { doc: LongformDreamDocument };

export default function LongformMarketShelf({ doc }: Props) {
  const shelf = doc.market_shelf;
  if (!shelf) return null;

  return (
    <div className="space-y-4">
      {shelf.best_shelf && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Best shelf</p>
          <p className="text-gray-800 font-medium">{shelf.best_shelf}</p>
        </div>
      )}

      {shelf.marketable_hook && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Marketable hook</p>
          <p className="text-gray-700">{shelf.marketable_hook}</p>
        </div>
      )}

      {(shelf.shelf_neighbors?.length > 0 || shelf.comparison_space?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {shelf.shelf_neighbors?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Shelf neighbors</p>
              <ul className="space-y-0.5">
                {shelf.shelf_neighbors.map((n, i) => (
                  <li key={i} className="text-sm text-gray-600 before:content-['·'] before:mr-1.5 before:text-gray-400">{n}</li>
                ))}
              </ul>
            </div>
          )}
          {shelf.comparison_space?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Comparison space</p>
              <ul className="space-y-0.5">
                {shelf.comparison_space.map((c, i) => (
                  <li key={i} className="text-sm text-gray-600 before:content-['·'] before:mr-1.5 before:text-gray-400">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {shelf.market_danger && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500 mb-1">Market danger</p>
          <p className="text-sm text-rose-800">{shelf.market_danger}</p>
        </div>
      )}
    </div>
  );
}
