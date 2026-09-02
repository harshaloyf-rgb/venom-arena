'use client';

import { useEffect } from 'react';

/**
 * T4-M3: registers the offline-shell service worker (public/sw.js).
 *
 * PRODUCTION-ONLY on purpose: in `next dev` a service worker caches stale
 * HMR chunks and breaks hot reload / the live preview. When the app is
 * deployed via a production build (`next build` + standalone start), this
 * activates the offline shell.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline shell is progressive enhancement — never surface errors.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
