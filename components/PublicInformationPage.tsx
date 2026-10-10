import Link from "next/link";
import { supportEmail } from "@/lib/public-pages";

export function PublicInformationPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-3xl space-y-5 px-4 py-8 sm:py-12">
    <Link href="/login" className="inline-flex min-h-11 items-center font-bold text-accent">RTS Field App · Sign in</Link>
    <section className="card space-y-4 p-5 sm:p-8">
      <p className="eyebrow">RTS Land Solutions LLC</p>
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="space-y-4 text-base leading-relaxed text-content/85">{children}</div>
      <p><a href={`mailto:${supportEmail}`} className="inline-flex min-h-11 items-center break-all font-bold text-accent">{supportEmail}</a></p>
    </section>
    <nav aria-label="App information" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-accent">
      <Link href="/privacy" className="inline-flex min-h-11 items-center">Privacy</Link>
      <Link href="/support" className="inline-flex min-h-11 items-center">Support</Link>
      <Link href="/account-request" className="inline-flex min-h-11 items-center">Account and data requests</Link>
    </nav>
  </main>;
}
