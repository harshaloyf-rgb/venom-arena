import { db } from '@/lib/db';
import type { SessionPayload } from '@/lib/auth';

/**
 * X11: Append an entry to the AdminAuditLog.
 *
 * Every privileged mutation (bans, chip grants, clan edits, config changes,
 * clip moderation, HOF induction) must call this AFTER the mutation succeeds.
 *
 * Design notes:
 * - Fire-and-forget semantics: a logging failure must never roll back or
 *   fail the admin operation that already happened, but it IS surfaced in
 *   server logs so a broken audit trail gets noticed.
 * - details must be a small JSON-serializable summary. NEVER include secrets
 *   or full request bodies.
 */
export async function logAdminAction(
  session: Pick<SessionPayload, 'playerId' | 'userTag'>,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        adminId: session.playerId,
        adminTag: session.userTag,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (e) {
    // Non-fatal: the admin op already succeeded. But make the audit gap loud.
    console.error(`[audit] FAILED to record admin action "${action}" by ${session.userTag}:`, e);
  }
}
