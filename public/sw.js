/* ============================================================================
 * Venom Arena service worker — offline shell (T4-M3)
 * ============================================================================
 * Strategies:
 *  - Navigations: network-first; the last-good copy of each page is cached
 *    and reused when the network fails; final fallback is /offline.
 *  - /_next/static + /icons: cache-first (content-hashed / immutable).
 *  - /api/*: network-only — auth and game data must never be served stale;
 *    offline API failures surface as normal network errors the app handles.
 *  - Socket.IO/WebSocket: untouched (SW cannot proxy live sockets anyway).
 *
 * Registration is production-only (see src/components/providers/
 * sw-register.tsx) so `next dev` / HMR / the live preview are never cached.
 * Bump VERSION to invalidate every cache after a deploy.
 * ========================================================================== */

const VERSION = 'venom-shell-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const PAGE_CACHE = `${VERSION}-pages`;
const STATIC_CACHE = `${VERSION}-static`;

const PRECACHE = [
  '/offline',
  '/manifest.json',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // allSettled: one transient 404 must not fail the whole install
    await Promise.allSettled(
      PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // network-only
  if (url.pathname.startsWith('/socket.io/')) return; // live sockets

  // Immutable build output: cache-first forever.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Navigations: network-first → last-good page → /offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(PAGE_CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const pageCache = await caches.open(PAGE_CACHE);
        const lastGood = await pageCache.match(req, { ignoreSearch: true });
        if (lastGood) return lastGood;
        const shell = await caches.open(SHELL_CACHE);
        const offline = await shell.match('/offline');
        if (offline) return offline;
        return new Response('You are offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    })());
    return;
  }

  // Everything else (svg, png, manifest…): network-first with cache fallback.
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      const hit = await caches.match(req);
      if (hit) return hit;
      return new Response('Offline and not cached.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  })());
});
