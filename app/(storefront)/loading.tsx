export default function Loading() {
  return (
    <div className="container-x py-14" role="status" aria-label="লোড হচ্ছে">
      <div className="skeleton h-8 w-52" />
      <div className="mt-3 skeleton h-4 w-80" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card overflow-hidden p-3">
            <div className="skeleton aspect-[4/3] w-full rounded-2xl" />
            <div className="skeleton mt-3 h-4 w-3/4" />
            <div className="skeleton mt-2 h-3 w-1/2" />
            <div className="mt-4 flex items-center justify-between">
              <div className="skeleton h-5 w-16" />
              <div className="skeleton h-8 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">লোড হচ্ছে…</span>
    </div>
  );
}
