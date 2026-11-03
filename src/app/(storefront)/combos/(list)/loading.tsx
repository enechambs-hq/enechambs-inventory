/** Streamed while the catalogue loads. Skeleton only; no data. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading combos&hellip;</span>
      <div className="mb-8 h-10 w-72 animate-pulse rounded-xl bg-[#eadfc8]" />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-3xl border border-[#eadfc8] bg-white">
            <div className="aspect-[4/3] animate-pulse bg-[#f1e8d3]" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-4/5 animate-pulse rounded bg-[#eadfc8]" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-[#eadfc8]" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
