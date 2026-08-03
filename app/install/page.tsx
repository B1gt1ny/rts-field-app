import Link from "next/link";
import { DevicePhoneMobileIcon, HomeIcon, ShareIcon } from "@heroicons/react/24/outline";
import { InstallAssistant } from "@/components/InstallAssistant";

export default function InstallPage() {
  return <div className="mx-auto max-w-3xl space-y-5">
    <div className="flex items-start gap-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><DevicePhoneMobileIcon className="size-7" /></span>
      <div>
        <p className="text-sm font-extrabold uppercase tracking-widest text-forest">Phone setup</p>
        <h1 className="text-3xl font-black">Install Company Command</h1>
        <p className="mt-1 text-sm text-black/50">Add the live app to your phone home screen so it opens like a normal app.</p>
      </div>
    </div>

    <InstallAssistant />

    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-black">iPhone / Safari</h2>
      <ol className="mt-4 space-y-3 text-sm font-semibold text-black/65">
        <li className="rounded-xl bg-sand p-3">1. Open <span className="font-black">rts-field-app.vercel.app</span> in Safari.</li>
        <li className="rounded-xl bg-sand p-3">2. Tap the Share button <ShareIcon className="inline size-4" /> at the bottom of Safari.</li>
        <li className="rounded-xl bg-sand p-3">3. Tap <span className="font-black">Add to Home Screen</span>.</li>
        <li className="rounded-xl bg-sand p-3">4. Name it <span className="font-black">Company Command</span> or <span className="font-black">Command</span>, then tap Add.</li>
      </ol>
      <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-900">On iPhone, use Safari for the home-screen install. Chrome on iPhone can open the app, but Safari gives the best app-style install.</p>
    </section>

    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-black">Android / Chrome</h2>
      <ol className="mt-4 space-y-3 text-sm font-semibold text-black/65">
        <li className="rounded-xl bg-sand p-3">1. Open <span className="font-black">rts-field-app.vercel.app</span> in Chrome.</li>
        <li className="rounded-xl bg-sand p-3">2. Tap the three-dot menu.</li>
        <li className="rounded-xl bg-sand p-3">3. Tap <span className="font-black">Install app</span> or <span className="font-black">Add to Home screen</span>.</li>
        <li className="rounded-xl bg-sand p-3">4. Confirm the install.</li>
      </ol>
    </section>

    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-black">Quick field notes</h2>
      <div className="mt-4 space-y-3 text-sm font-semibold text-black/65">
        <p className="rounded-xl bg-sand p-3">The app is still web-powered, so saving jobs, photos, files, parts, time logs, and notes needs internet.</p>
        <p className="rounded-xl bg-sand p-3">A lightweight offline shell is registered so the phone shows a helpful offline page instead of a blank browser error.</p>
        <p className="rounded-xl bg-sand p-3">For bad service areas, open the job profile before driving out. Use the offline draft note box on the job profile if signal drops.</p>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/field" className="btn-primary"><HomeIcon className="size-5" />Open Field App</Link>
      <Link href="/" className="btn-secondary">Back to Dashboard</Link>
    </div>
  </div>;
}
