import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';
import { refundWarsOnDisband } from '@/lib/clan-weekly';

// ── Helpers ────────────────────────────────────────────────────────────────

function adminOnly(session: { role?: string } | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }
  return null;
}

// ── GET /api/admin/clans?search=xxx&limit=50 ──────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  const blocked = adminOnly(session);
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  let limit = parseInt(searchParams.get('limit') || '50', 10);
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;

  const whereClause: Record<string, unknown> = {};
  if (search) {
    whereClause.OR = [
      { name: { contains: search } },
      { tag: { contains: search.toUpperCase() } },
    ];
  }

  const [clans, total] = await Promise.all([
    db.clan.findMany({
      where: whereClause,
      select: {
        tag: true, name: true, emblem: true, description: true,
        level: true, xp: true, totalDeposited: true, bankedChips: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { totalDeposited: 'desc' },
      take: limit,
    }),
    db.clan.count({ where: whereClause }),
  ]);

  const clansWithCount = clans.map((clan) => ({
    tag: clan.tag, name: clan.name, emblem: clan.emblem, description: clan.description,
    level: clan.level, xp: clan.xp, totalDeposited: clan.totalDeposited,
    bankedChips: clan.bankedChips, memberCount: clan._count.members, createdAt: clan.createdAt,
  }));

  return NextResponse.json({ clans: clansWithCount, total });
}

// ── POST /api/admin/clans ─────────────────────────────────────────────────
//
// Body: { action, tag, ...actionFields }
//
// Actions:
//   disband     { tag }                                          → delete clan + remove members
//   edit        { tag, name?, description?, emblem? }            → update clan fields
//   setLevel    { tag, level }                                   → set clan level + reset XP
//   setXp       { tag, xp }                                      → set clan XP directly
//   setChips    { tag, bankedChips }                             → set banked chips
//   setTotalDep { tag, totalDeposited }                          → set total deposited
//   members     { tag }                                          → list all members with ranks
//   kick        { tag, targetTag }                               → remove member from clan
//   promote     { tag, targetTag, rank: 'Co-Leader' | 'Viper' }  → change member rank

export async function POST(req: NextRequest) {
  const session = await getSession();
  const blocked = adminOnly(session);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim();
  const tag = String(body.tag || '').toUpperCase().trim();

  if (!tag) return NextResponse.json({ error: 'Missing clan tag.' }, { status: 400 });

  try {
    switch (action) {
      // ── DISBAND ────────────────────────────────────────────────
      case 'disband': {
        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });

        // T50 (BUG 3): same escrow-refund fix as the user disband route —
        // refund active-war wagers before the cascade delete, opponent gets
        // their treasury share, the clan's own share goes to its Leader.
        let warsCancelled = 0;

        await db.$transaction(async (tx) => {
          const leader = await tx.player.findFirst({
            where: { clanTag: tag, clanRank: 'Leader' },
            select: { id: true },
          });
          warsCancelled = await refundWarsOnDisband(tx, tag, leader?.id);

          await tx.clanActivity.deleteMany({ where: { clanTag: tag } });
          await tx.clanChallenge.deleteMany({ where: { clanTag: tag } });
          await tx.clanMessage.deleteMany({ where: { clanTag: tag } });
          await tx.player.updateMany({ where: { clanTag: tag }, data: { clanTag: null, clanRank: null, clanDeposited: 0 } });
          await tx.clan.delete({ where: { tag } });
        });

        // X11: audit trail
        await logAdminAction(session!, 'clan_disband', 'clan', tag, { clanName: clan.name, warsCancelled });

        return NextResponse.json({ ok: true, warsCancelled, message: `Clan [${tag}] has been disbanded.${warsCancelled > 0 ? ` ${warsCancelled} active war${warsCancelled > 1 ? 's' : ''} cancelled — escrowed wagers refunded.` : ''}` });
      }

      // ── EDIT ──────────────────────────────────────────────────
      case 'edit': {
        const name = body.name !== undefined ? String(body.name).trim().slice(0, 30) : undefined;
        const description = body.description !== undefined ? String(body.description).trim().slice(0, 200) : undefined;
        const emblem = body.emblem !== undefined ? String(body.emblem).slice(0, 4).replace(/[\x00-\x1F\u200B-\u200D\uFEFF]/g, '') : undefined;

        if (name === undefined && description === undefined && emblem === undefined) {
          return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
        }
        if (name !== undefined && name.length < 3) {
          return NextResponse.json({ error: 'Name must be at least 3 characters.' }, { status: 400 });
        }

        const data: Record<string, string> = {};
        if (name !== undefined && name.length >= 3) data.name = name;
        if (description !== undefined) data.description = description;
        if (emblem !== undefined && emblem.length > 0) data.emblem = emblem;

        if (Object.keys(data).length === 0) {
          return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
        }

        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });

        await db.clan.update({ where: { tag }, data });
        // X11: audit trail
        await logAdminAction(session!, 'clan_edit', 'clan', tag, { fields: Object.keys(data) });
        return NextResponse.json({ ok: true, message: `Clan [${tag}] updated.` });
      }

      // ── SET LEVEL ──────────────────────────────────────────────
      case 'setLevel': {
        const level = parseInt(body.level, 10);
        if (isNaN(level) || level < 1 || level > 99) {
          return NextResponse.json({ error: 'Level must be 1-99.' }, { status: 400 });
        }
        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });
        await db.clan.update({ where: { tag }, data: { level, xp: 0 } });
        // X11: audit trail
        await logAdminAction(session!, 'clan_set_level', 'clan', tag, { level });
        return NextResponse.json({ ok: true, message: `Clan [${tag}] set to level ${level}, XP reset to 0.` });
      }

      // ── SET XP ─────────────────────────────────────────────────
      case 'setXp': {
        const xp = parseInt(body.xp, 10);
        if (isNaN(xp) || xp < 0) {
          return NextResponse.json({ error: 'XP must be a non-negative number.' }, { status: 400 });
        }
        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });
        await db.clan.update({ where: { tag }, data: { xp } });
        // X11: audit trail
        await logAdminAction(session!, 'clan_set_xp', 'clan', tag, { xp });
        return NextResponse.json({ ok: true, message: `Clan [${tag}] XP set to ${xp}.` });
      }

      // ── SET CHIPS ──────────────────────────────────────────────
      case 'setChips': {
        const bankedChips = parseInt(body.bankedChips, 10);
        if (isNaN(bankedChips) || bankedChips < 0) {
          return NextResponse.json({ error: 'Chips must be a non-negative number.' }, { status: 400 });
        }
        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });
        await db.clan.update({ where: { tag }, data: { bankedChips } });
        // X11: audit trail
        await logAdminAction(session!, 'clan_set_chips', 'clan', tag, { bankedChips, previous: clan.bankedChips });
        return NextResponse.json({ ok: true, message: `Clan [${tag}] banked chips set to ${bankedChips}.` });
      }

      // ── SET TOTAL DEPOSITED ────────────────────────────────────
      case 'setTotalDep': {
        const totalDeposited = parseInt(body.totalDeposited, 10);
        if (isNaN(totalDeposited) || totalDeposited < 0) {
          return NextResponse.json({ error: 'Total deposited must be non-negative.' }, { status: 400 });
        }
        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });
        await db.clan.update({ where: { tag }, data: { totalDeposited } });
        // X11: audit trail
        await logAdminAction(session!, 'clan_set_total_deposited', 'clan', tag, { totalDeposited, previous: clan.totalDeposited });
        return NextResponse.json({ ok: true, message: `Clan [${tag}] total deposited set to ${totalDeposited}.` });
      }

      // ── MEMBERS ────────────────────────────────────────────────
      case 'members': {
        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });

        const members = await db.player.findMany({
          where: { clanTag: tag },
          select: {
            id: true, userTag: true, name: true, avatar: true,
            clanRank: true, level: true, bankedChips: true,
            lifetimeKills: true, lifetimeDeaths: true, createdAt: true,
          },
          orderBy: [
            { clanRank: 'asc' }, // Leader first
            { createdAt: 'asc' },
          ],
        });

        return NextResponse.json({
          members: members.map((m) => ({
            id: m.id,
            userTag: m.userTag,
            name: m.name,
            avatar: m.avatar,
            clanRank: m.clanRank,
            level: m.level,
            bankedChips: m.bankedChips,
            lifetimeKills: m.lifetimeKills,
            lifetimeDeaths: m.lifetimeDeaths,
            joinedAt: m.createdAt,
          })),
        });
      }

      // ── KICK ───────────────────────────────────────────────────
      case 'kick': {
        const targetTag = String(body.targetTag || '').trim();
        if (!targetTag) return NextResponse.json({ error: 'Missing targetTag.' }, { status: 400 });

        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });

        const target = await db.player.findUnique({ where: { userTag: targetTag } });
        if (!target) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
        if (target.clanTag !== tag) return NextResponse.json({ error: 'Player is not in this clan.' }, { status: 400 });

        await db.$transaction(async (tx) => {
          await tx.player.update({ where: { id: target.id }, data: { clanTag: null, clanRank: null, clanDeposited: 0 } });
          await tx.clanActivity.create({
            data: {
              clanTag: tag,
              type: 'leave',
              actorTag: 'ADMIN',
              actorName: 'Admin',
              detail: `admin kicked ${target.name} from the syndicate`,
            },
          });
          // Auto-delete empty clan
          const remaining = await tx.player.count({ where: { clanTag: tag } });
          if (remaining === 0) {
            await tx.clanActivity.deleteMany({ where: { clanTag: tag } });
            await tx.clanChallenge.deleteMany({ where: { clanTag: tag } });
            await tx.clanMessage.deleteMany({ where: { clanTag: tag } });
            await tx.clan.delete({ where: { tag } });
          }
        });

        // X11: audit trail
        await logAdminAction(session!, 'clan_kick', 'player', targetTag, { clanTag: tag, targetName: target.name });

        return NextResponse.json({ ok: true, message: `Kicked ${target.name} from [${tag}].` });
      }

      // ── PROMOTE / DEMOTE ───────────────────────────────────────────
      case 'promote': {
        const targetTag = String(body.targetTag || '').trim();
        // T50: game vocabulary is 'Viper' for regular members (see clan routes +
        // roster UI). The old UI sent 'Member', which was stored verbatim and left
        // the player stuck: the in-game promote gate only recognizes 'Viper'.
        // Accept the legacy 'Member' spelling and normalize it to 'Viper'.
        const rawRank = String(body.rank || '').trim();
        const newRank = rawRank === 'Member' ? 'Viper' : rawRank;
        if (!targetTag) return NextResponse.json({ error: 'Missing targetTag.' }, { status: 400 });
        if (!['Leader', 'Co-Leader', 'Viper'].includes(newRank)) {
          return NextResponse.json({ error: 'Rank must be Leader, Co-Leader, or Viper.' }, { status: 400 });
        }

        const clan = await db.clan.findUnique({ where: { tag } });
        if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });

        const target = await db.player.findUnique({ where: { userTag: targetTag } });
        if (!target) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
        if (target.clanTag !== tag) return NextResponse.json({ error: 'Player is not in this clan.' }, { status: 400 });

        await db.$transaction(async (tx) => {
          // If setting a new Leader, demote current Leader
          if (newRank === 'Leader') {
            const currentLeader = await tx.player.findFirst({
              where: { clanTag: tag, clanRank: 'Leader' },
            });
            if (currentLeader && currentLeader.id !== target.id) {
              await tx.player.update({
                where: { id: currentLeader.id },
                data: { clanRank: 'Co-Leader' },
              });
            }
          }

          await tx.player.update({
            where: { id: target.id },
            data: { clanRank: newRank },
          });

          await tx.clanActivity.create({
            data: {
              clanTag: tag,
              type: 'promote',
              actorTag: 'ADMIN',
              actorName: 'Admin',
              detail: `admin set ${target.name} rank to ${newRank}`,
            },
          });
        });

        // X11: audit trail
        await logAdminAction(session!, 'clan_set_rank', 'player', targetTag, { clanTag: tag, targetName: target.name, newRank });

        return NextResponse.json({ ok: true, message: `${target.name} is now ${newRank} of [${tag}].` });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: disband, edit, setLevel, setXp, setChips, setTotalDep, members, kick, promote` },
          { status: 400 },
        );
    }
  } catch (e) {
    console.error('[admin/clans POST] error', e);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
