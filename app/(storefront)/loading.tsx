export default function Loading() {
  /* A route-level skeleton is the FIRST thing a visitor sees, so it has to do
     two jobs the old one did not:

       1. mirror the real layout closely enough that nothing jumps when the
          content arrives — same container, same heading block, same grid, same
          card rhythm. The previous skeleton drew 8 tall cards where the page
          renders 4 short ones, so the page visibly reflowed on load (a real CLS
          cost, not just a cosmetic one).

       2. be cheap to paint. `skeleton` uses a shimmer that animates
          `background-position`; on a 2× phone with 8 of them running it competes
          with the JS that is still parsing. Same look, one animation layer.

     `role="status"` + `aria-live` announces "লোড হচ্ছে" once, instead of the
     screen reader reading twenty empty boxes. `aria-busy` marks the region so
     assistive tech knows the content is coming. */
  return (
    <div className="container-x py-10 sm:py-14" role="status" aria-live="polite" aria-busy="true">
      {/* heading block */}
      <div className="skeleton h-7 w-44 sm:h-8 sm:w-56" />
      <div className="skeleton mt-3 h-4 w-64 max-w-full sm:w-80" />

      {/* filter chips */}
      <div className="mt-6 flex gap-2" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* product grid — matches components/product-card.tsx proportions */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neu-line/60 bg-neu-surface p-2.5">
            <div className="skeleton aspect-square w-full rounded-lg" />
            <div className="skeleton mt-3 h-3.5 w-3/4" />
            <div className="skeleton mt-2 h-3 w-1/2" />
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="skeleton h-4 w-14" />
              <div className="skeleton h-7 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">লোড হচ্ছে…</span>
    </div>
  );
}
