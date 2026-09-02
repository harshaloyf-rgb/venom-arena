import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor remote-URL shell (T5).
 *
 * The game is real-time multiplayer — the WebView always needs a live
 * backend, so the shell loads the deployed app over HTTP instead of
 * bundling a static export (which could never host /api + the game server).
 *
 * URL resolution order (set at `cap sync` / build time, NOT baked twice):
 *   1. CAPACITOR_SERVER_URL env — the deployed origin, e.g.
 *      `CAPACITOR_SERVER_URL=https://play.venomarena.gg npx cap sync android`
 *   2. default: http://10.0.2.2:3000 — Android emulator alias for the host
 *      machine's localhost:3000 dev server (emulator dev loop).
 *
 * cleartext is auto-enabled for http:// targets (emulator/dev only); release
 * builds MUST point at https.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL;
const isHttp = !!serverUrl && serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'gg.venomarena.app',
  appName: 'Venom Arena',
  // Remote-URL shell: the native bundle only carries icons/splash + whatever
  // cap sync copies from public/ (icons, manifest, sw.js). No static export.
  webDir: 'public',
  server: serverUrl
    ? { url: serverUrl, cleartext: isHttp }
    : { url: 'http://10.0.2.2:3000', cleartext: true },
  android: {
    // Release hardening happens per-build; keep mixed content off.
    allowMixedContent: false,
  },
};

export default config;
