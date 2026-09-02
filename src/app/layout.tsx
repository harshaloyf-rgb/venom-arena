import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Venom Arena — Multiplayer Snake Battle",
  description:
    "A server-authoritative multiplayer snake battle arena. Hunt, harvest, and extract chips across 30 deadly tiers.",
  keywords: ["snake", "multiplayer", "io game", "venom arena", "pvp"],
  authors: [{ name: "Venom Arena" }],
  // T3 Mobile Shell (M3): PWA manifest + iOS web-app metadata
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Venom Arena",
  },
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo.svg", type: "image/svg+xml" }],
  },
};

// T3 Mobile Shell (M1/M2/M6): the audit found NO viewport meta at all —
// mobile browsers defaulted to a 980px layout viewport (zoomed-out page),
// auto text inflation, pinch/double-tap zoom mid-game and pull-to-refresh.
// viewportFit=cover lets fixed UI opt into notch corners via safe-area CSS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
