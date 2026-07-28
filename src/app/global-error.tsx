'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[VenomArena] global error:', error);
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a120e', color: '#e8f5e9', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>🐍</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '12px 0 8px' }}>Venom Arena crashed</h2>
            <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
              A fatal error broke the page. Your account and chips are safe on the server.
            </p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Reload arena
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
