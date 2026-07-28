'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[VenomArena] route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-destructive/40 bg-card/80 backdrop-blur p-6 text-center space-y-4">
        <div className="text-5xl">🐍</div>
        <h2 className="text-xl font-bold">The arena hit a snag</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Your progress is safe — try reloading.
        </p>
        {error?.message && (
          <pre className="text-xs text-left bg-muted/40 rounded p-2 overflow-auto max-h-32 va-scroll">
            {error.message}
          </pre>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} variant="default">Try again</Button>
          <Button onClick={() => window.location.reload()} variant="outline">Reload</Button>
        </div>
      </div>
    </div>
  );
}
