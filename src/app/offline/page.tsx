import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

// T4-M3: static offline fallback served by the service worker (public/sw.js)
// when a navigation fails and no last-good copy of the page exists. Server
// component on purpose — no data, no hooks, renders in any environment.
export default function OfflinePage() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-[#0a0a0f] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <WifiOff className="h-8 w-8 text-red-400" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-wide text-white">
          Connection lost
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-slate-400">
          Venom Arena needs a live link to the arena server. Check your
          connection and slide back in — your banked chips are safe.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 active:bg-emerald-600"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Reconnect
      </Link>
    </main>
  );
}
