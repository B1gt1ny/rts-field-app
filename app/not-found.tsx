import Link from "next/link";

export default function NotFound() {
  return <section className="card mx-auto max-w-xl p-6 sm:p-8">
    <p className="eyebrow">RTS Field App</p>
    <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
    <p className="mt-3 text-sm text-content/65">This page may have moved, or the link may be incomplete.</p>
    <Link href="/" className="btn-primary mt-5">Return to dashboard</Link>
  </section>;
}
