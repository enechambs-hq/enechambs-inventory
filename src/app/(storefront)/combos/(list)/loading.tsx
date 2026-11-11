/** Streamed while the catalogue loads. Skeleton only; no data. Mirrors the page and ComboCard proportions. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[80rem] px-4 py-10 sm:px-6 md:py-12 lg:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading combos&hellip;</span>
      <div className="mb-10 flex flex-col gap-5 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="h-9 w-64 animate-pulse rounded-xl bg-[#eadfc8] sm:h-10" />
          <div className="h-5 w-72 max-w-full animate-pulse rounded bg-[#eadfc8]" />
        </div>
        <div className="h-11 w-full animate-pulse rounded-full bg-[#eadfc8] lg:max-w-sm" />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-2xl border border-[#eadfc8] bg-white">
            <div className="aspect-[4/3] animate-pulse bg-[#f1e8d3] lg:aspect-square" />
            <div className="space-y-3 p-3 sm:p-4">
              <div className="min-h-[2.75rem]">
                <div className="h-4 w-4/5 animate-pulse rounded bg-[#eadfc8]" />
              </div>
              <div className="h-7 w-1/3 animate-pulse rounded bg-[#eadfc8]" />
              <div className="h-10 animate-pulse rounded-full bg-[#eadfc8]" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
