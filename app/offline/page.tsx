import Link from "next/link";
import { DevicePhoneMobileIcon, HomeIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

export default function OfflinePage() {
  return <div className="mx-auto max-w-2xl space-y-5">
    <section className="rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><DevicePhoneMobileIcon className="size-7" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-lime">Offline mode</p>
          <h1 className="text-3xl font-black">Connection is weak</h1>
          <p className="mt-1 text-sm text-white/60">Company Command is installed enough to show this page. Saved job updates still need internet before they can sync to the live app.</p>
        </div>
      </div>
    </section>

    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-black">What to do in the field</h2>
      <div className="mt-4 space-y-3 text-sm font-semibold text-black/60">
        <p className="rounded-xl bg-sand p-3">1. Move to a better signal spot if you need to save job updates, photos, parts, or time logs.</p>
        <p className="rounded-xl bg-sand p-3">2. If you already opened a job profile earlier, try the Back button. Some already-loaded pages may still be visible.</p>
        <p className="rounded-xl bg-sand p-3">3. Use the job profile offline draft box for rough notes, then push them when service returns.</p>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/field" className="btn-primary"><WrenchScrewdriverIcon className="size-5" />Try Field App</Link>
      <Link href="/" className="btn-secondary"><HomeIcon className="size-5" />Try Dashboard</Link>
    </div>
  </div>;
}
