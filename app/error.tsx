"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="card mx-auto max-w-xl p-6 sm:p-8" role="alert">
    <p className="eyebrow">RTS Field App</p>
    <h1 className="mt-2 text-2xl font-bold">This page could not load</h1>
    <p className="mt-3 text-sm text-content/65">Check your connection and try again. If the problem continues, return to another page using the app navigation.</p>
    <button type="button" onClick={reset} className="btn-primary mt-5">Try again</button>
  </section>;
}
