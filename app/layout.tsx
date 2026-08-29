import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Command — RTS Field App",
  description: "Mobile home contractor field operations",
  applicationName: "Company Command",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg" }, { rel: "apple-touch-icon", url: "/icon.svg" }],
  appleWebApp: { capable: true, title: "Command", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17211c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ServiceWorkerRegister /><AuthGate><AppShell>{children}</AppShell></AuthGate><Analytics /></body></html>;
}
