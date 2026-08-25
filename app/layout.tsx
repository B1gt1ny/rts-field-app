import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Field Service",
  description: "Mobile-first field service operations",
  applicationName: "Field Service",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg" }, { rel: "apple-touch-icon", url: "/icon.svg" }],
  appleWebApp: { capable: true, title: "Field Service", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17211c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ServiceWorkerRegister /><AuthGate><AppShell>{children}</AppShell></AuthGate></body></html>;
}
