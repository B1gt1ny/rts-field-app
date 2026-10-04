export default function Loading() {
  return <section className="card p-6 sm:p-8" role="status" aria-live="polite">
    <p className="eyebrow">RTS Field App</p>
    <h1 className="mt-2 text-xl font-bold">Loading your workspace…</h1>
    <p className="mt-2 text-sm text-content/65">Your jobs and current work will appear here.</p>
    <div aria-hidden="true" className="mt-6 grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-content/5" />)}
    </div>
  </section>;
}
