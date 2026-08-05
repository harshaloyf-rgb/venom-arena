'use client';

/**
 * Share Card Generator — Pure Canvas API, zero external dependencies.
 * Produces branded 1080×1080 PNG cards for social media sharing.
 *
 * Usage:
 *   import { renderMatchCard, renderProfileCard, downloadBlob, shareBlob } from '@/lib/share-card';
 *   const blob = await renderMatchCard({ ... });
 *   downloadBlob(blob, 'venom-arena-highlight.png');
 */

// Re-export types
export type { MatchCardData, ProfileCardData, MilestoneCardData } from './card-branding';

// Re-export render functions
export { renderMatchCard, renderProfileCard, renderMilestoneCard, drawBranding } from './card-branding';

// ── Utility functions ──

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareBlob(blob: Blob, title?: string) {
  const file = new File([blob], 'venom-arena-highlight.png', { type: 'image/png' });
  if (navigator.share) {
    try {
      await navigator.share({
        title: title || 'Venom Arena Highlight',
        text: 'Check out my Venom Arena match! 🐍',
        files: [file],
      });
      return { shared: true, method: 'share-api' as const };
    } catch (e: unknown) {
      // User cancelled or not supported
      if ((e as Error).name === 'AbortError') return { shared: false, method: 'cancelled' as const };
    }
  }
  return { shared: false, method: 'not-supported' as const };
}

export async function copyBlobToClipboard(blob: Blob) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
