import { db } from '@/lib/db';

/**
 * Find a player by their VM tag.
 *
 * Tags are generated lowercase (e.g. VM-ha45462 — see generateUserTag in
 * lib/auth), but players often type them from memory in uppercase because
 * the docs and UI show the generic "VM-XXXXXX" pattern. Every API route that
 * used to `.toUpperCase()` the input before lookup therefore broke friend
 * requests, accepts, gifts, blocks, and clan payouts with a false
 * "Player not found."
 *
 * This helper tries the exact tag first, then falls back to the lowercase
 * form, so "vm-ha45462" and "VM-HA45462" both resolve to the same account.
 * Generated tags are always lowercase, so the fallback can never match the
 * wrong account.
 */
export async function findPlayerByTag(raw: string) {
  const tag = String(raw || '').trim();
  if (!tag) return null;
  const exact = await db.player.findUnique({ where: { userTag: tag } });
  if (exact) return exact;
  // Case variants of the same tag: players type "VM-C85DBV" (uppercased
  // suffix) or "vm-c85dbv" (all lowercase). Generated tags keep the "VM-"
  // prefix uppercase and a lowercase suffix, so normalize accordingly.
  const candidates = new Set<string>([tag.toLowerCase()]);
  if (/^vm-/i.test(tag)) candidates.add('VM-' + tag.slice(3).toLowerCase());
  const list = [...candidates].filter((c) => c !== tag);
  if (!list.length) return null;
  return db.player.findFirst({ where: { userTag: { in: list } } });
}
