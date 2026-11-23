/* Admin skeleton — a table-shaped placeholder so a slow query never looks like
   a broken page (and never shifts the layout when it lands). */
export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-7 w-52 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
      <div className="card h-64 animate-pulse" />
      <p className="text-center text-[11.5px] text-sand-100/35">লোড হচ্ছে…</p>
    </div>
  );
}
