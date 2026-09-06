#!/usr/bin/env node
/**
 * T50 — Verify the 5 bug fixes + player search (against live dev server).
 * Run: node scripts/t50-bugfix-verify.mjs
 *
 * Covers:
 *  BUG 1  status-in-body: clans/settings 403 + friends/request duplicate 400 (real HTTP statuses now)
 *  BUG 2  challenge progress backfill (deposit + chat BEFORE first weekly GET)
 *  BUG 3  disband mid-war refunds BOTH escrows (user disband + admin disband paths)
 *  BUG 4  admin promote rank vocab ('Member' legacy → 'Viper'; in-game promote unblocked)
 *  GAP 5  GET /api/clans/war requires session (401 signed out)
 *  FEAT   /api/players/search by name + by tag fragment (session-gated)
 */
const BASE = 'http://localhost:3000';
let PASS = 0, FAIL = 0;
const results = [];
const cleanupTags = [];

function check(name, cond, detail = '') {
  if (cond) { PASS++; results.push(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
  else { FAIL++; results.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

function jar() {
  let cookie = '';
  return {
    get: () => cookie,
    set: (res) => {
      const sc = res.headers.getSetCookie?.() || [];
      for (const c of sc) {
        const [kv] = c.split(';');
        if (kv.startsWith('va_session=')) cookie = kv;
      }
    },
  };
}

async function api(session, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (session?.get()) headers.Cookie = session.get();
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (session) session.set(res);
  let json = null;
  try { json = await res.json(); } catch { /* html */ }
  return { status: res.status, json };
}

async function guest(country = 'IN') {
  const s = jar();
  const r = await api(s, 'POST', '/api/auth/guest', { country });
  if (r.status !== 200 || !r.json?.player) throw new Error('guest create failed: ' + JSON.stringify(r));
  cleanupTags.push(r.json.player.userTag);
  return { session: s, tag: r.json.player.userTag, name: r.json.player.name };
}

async function personalChips(adminS, tag) {
  // read balance via modify-chips +1 / -1 (net zero) — response carries profile
  const plus = await api(adminS, 'POST', '/api/admin/modify-chips', { userTag: tag, amount: 1 });
  if (plus.status !== 200) return null;
  await api(adminS, 'POST', '/api/admin/modify-chips', { userTag: tag, amount: -1 });
  return plus.json?.player?.bankedChips ?? null;
}

async function clanTreasury(tag) {
  const r = await api(null, 'GET', '/api/clans/list');
  const clan = (r.json?.clans || []).find((c) => c.tag === tag);
  return clan ? clan.bankedChips : null;
}

// ─── Setup ────────────────────────────────────────────────────────────────
const admin = jar();
{
  const r = await api(admin, 'POST', '/api/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }); // creds via env
  if (r.status !== 200 || r.json?.player?.role !== 'admin') throw new Error('admin login failed');
}

const L1 = await guest(); // Leader of VTX
const M1 = await guest(); // Viper in VTX (settings 403 + promote tests)
const L2 = await guest(); // Leader of VTZ
const F1 = await guest(); // friend-request duplicate test
const F2 = await guest();
const L3 = await guest(); // Leader of VTW (admin-disband refund test)

for (const t of [L1.tag, L2.tag, L3.tag]) {
  const r = await api(admin, 'POST', '/api/admin/modify-chips', { userTag: t, amount: 250000 });
  if (r.status !== 200) throw new Error('chip top-up failed for ' + t);
}

// Clans
{
  let r = await api(L1.session, 'POST', '/api/clans/create', { tag: 'VTX', name: 'Vortex Test', description: 't50' });
  if (r.status !== 200) throw new Error('VTX create failed: ' + JSON.stringify(r.json));
  r = await api(L2.session, 'POST', '/api/clans/create', { tag: 'VTZ', name: 'Zephyr Test', description: 't50' });
  if (r.status !== 200) throw new Error('VTZ create failed: ' + JSON.stringify(r.json));
  r = await api(L3.session, 'POST', '/api/clans/create', { tag: 'VTW', name: 'Wraith Test', description: 't50' });
  if (r.status !== 200) throw new Error('VTW create failed: ' + JSON.stringify(r.json));
}

// M1 joins VTX via invite (regression of invite flow too)
{
  const inv = await api(L1.session, 'POST', '/api/clans/invite', { userTag: M1.tag });
  check('setup: invite by tag works', inv.status === 200, `status=${inv.status}`);
  const list = await api(M1.session, 'GET', '/api/clans/invites');
  const invite = (list.json?.invites || []).find((i) => i.clanTag === 'VTX');
  if (!invite) throw new Error('pending invite not found for M1: ' + JSON.stringify(list.json));
  const acc = await api(M1.session, 'POST', '/api/clans/invites/respond', { inviteId: invite.id, action: 'accept' });
  if (acc.status !== 200) throw new Error('invite accept failed: ' + JSON.stringify(acc.json));
}

// Deposits (VTX + VTZ + VTW treasuries) — NO challenges GET yet anywhere
{
  const d1 = await api(L1.session, 'POST', '/api/clans/deposit', { tag: 'VTX', amount: 20000 });
  if (d1.status !== 200) throw new Error('VTX deposit failed: ' + JSON.stringify(d1.json));
  const d2 = await api(L2.session, 'POST', '/api/clans/deposit', { tag: 'VTZ', amount: 20000 });
  if (d2.status !== 200) throw new Error('VTZ deposit failed: ' + JSON.stringify(d2.json));
  const d3 = await api(L3.session, 'POST', '/api/clans/deposit', { tag: 'VTW', amount: 20000 });
  if (d3.status !== 200) throw new Error('VTW deposit failed: ' + JSON.stringify(d3.json));
}

console.log(`Players: L1=${L1.tag} M1=${M1.tag} L2=${L2.tag} F1=${F1.tag} F2=${F2.tag} L3=${L3.tag}`);

// ═══ BUG 1a: settings gate returns real HTTP 403 for non-Leader ═══
{
  const r = await api(M1.session, 'POST', '/api/clans/settings', { tag: 'VTX', description: 'hijack attempt' });
  check('BUG1a: non-Leader settings → HTTP 403 (was 200)', r.status === 403, `status=${r.status} body=${JSON.stringify(r.json)}`);
  const ok = await api(L1.session, 'POST', '/api/clans/settings', { tag: 'VTX', description: 'leader can still edit' });
  check('BUG1a: Leader settings → 200', ok.status === 200, `status=${ok.status}`);
}

// ═══ BUG 2: challenge progress before first weekly GET is retained ═══
{
  // VTX already has a 20,000 deposit logged BEFORE any challenges GET.
  const chat = await api(L1.session, 'POST', '/api/clans/chat', { tag: 'VTX', message: 'backfill probe message' });
  check('BUG2: chat send works', chat.status === 200, `status=${chat.status}`);
  const g = await api(L1.session, 'GET', '/api/clans/challenges?tag=VTX');
  const ch = g.json?.challenges || [];
  const treasury = ch.find((c) => c.type === 'treasury_target');
  const streak = ch.find((c) => c.type === 'deposit_streak');
  const comms = ch.find((c) => c.type === 'chat_activity');
  check('BUG2: 4 weekly challenges exist', ch.length === 4, `count=${ch.length}`);
  check('BUG2: treasury_target kept pre-GET deposit (20000)', !!treasury && treasury.progress >= 20000, `progress=${treasury?.progress}/${treasury?.target}`);
  check('BUG2: deposit_streak counts pre-GET deposit', !!streak && streak.progress >= 1, `progress=${streak?.progress}`);
  check('BUG2: chat_activity counts', !!comms && comms.progress >= 1, `progress=${comms?.progress}`);
}

// ═══ GAP 5: war GET requires session ═══
{
  const anon = await api(null, 'GET', '/api/clans/war?tag=VTX');
  check('BUG5: war GET signed out → HTTP 401', anon.status === 401, `status=${anon.status}`);
  const authed = await api(L1.session, 'GET', '/api/clans/war?tag=VTX');
  check('BUG5: war GET signed in → 200 {war:null}', authed.status === 200 && authed.json?.war === null, `status=${authed.status} war=${JSON.stringify(authed.json?.war)}`);
}

// ═══ BUG 4: admin promote rank vocab + in-game promote unblocked ═══
{
  // Admin demotes M1 using the legacy 'Member' spelling (what the old UI sent)
  const r = await api(admin, 'POST', '/api/admin/clans', { action: 'promote', tag: 'VTX', targetTag: M1.tag, rank: 'Member' });
  check('BUG4: admin promote accepts legacy rank Member', r.status === 200, `status=${r.status} body=${JSON.stringify(r.json)}`);

  const mem = await api(admin, 'POST', '/api/admin/clans', { action: 'members', tag: 'VTX' });
  const m1row = (mem.json?.members || []).find((m) => m.userTag === M1.tag);
  check('BUG4: stored rank normalized to Viper (not Member)', m1row?.clanRank === 'Viper', `rank=${m1row?.clanRank}`);

  // The stuck-member symptom: in-game promote rejected "Only Vipers can be promoted".
  const promote = await api(L1.session, 'POST', '/api/clans/role', { targetTag: M1.tag, action: 'promote' });
  check('BUG4: in-game promote of admin-demoted member now works', promote.status === 200, `status=${promote.status} body=${JSON.stringify(promote.json)}`);

  // And the new UI spelling 'Viper' works too
  const demote = await api(admin, 'POST', '/api/admin/clans', { action: 'promote', tag: 'VTX', targetTag: M1.tag, rank: 'Viper' });
  check('BUG4: admin promote with Viper spelling → 200', demote.status === 200, `status=${demote.status}`);
  const badRank = await api(admin, 'POST', '/api/admin/clans', { action: 'promote', tag: 'VTX', targetTag: M1.tag, rank: 'Ninja' });
  check('BUG4: invalid rank rejected 400', badRank.status === 400, `status=${badRank.status}`);
}

// ═══ BUG 1b: duplicate friend request → real HTTP 400 ═══
{
  const first = await api(F1.session, 'POST', '/api/friends/request', { userTag: F2.tag });
  const dup = await api(F1.session, 'POST', '/api/friends/request', { userTag: F2.tag });
  check('BUG1b: first friend request → 200', first.status === 200, `status=${first.status}`);
  check('BUG1b: duplicate request → HTTP 400 (was 200)', dup.status === 400, `status=${dup.status} body=${JSON.stringify(dup.json)}`);
}

// ═══ FEAT: player search by name + tag ═══
{
  const anon = await api(null, 'GET', '/api/players/search?query=boss');
  check('SEARCH: signed out → HTTP 401', anon.status === 401, `status=${anon.status}`);

  const byName = await api(L1.session, 'GET', '/api/players/search?query=boss');
  const foundName = (byName.json?.players || []).some((p) => p.name === 'boss');
  check('SEARCH: by name finds player "boss" (admin)', byName.status === 200 && foundName, `status=${byName.status} total=${byName.json?.total}`);

  const tagFrag = L2.tag.slice(3, 6); // fragment of the generated tag suffix
  const byTag = await api(L1.session, 'GET', `/api/players/search?query=${tagFrag}`);
  const foundTag = (byTag.json?.players || []).some((p) => p.userTag === L2.tag);
  check(`SEARCH: by tag fragment "${tagFrag}" finds player`, byTag.status === 200 && foundTag, `status=${byTag.status} total=${byTag.json?.total}`);

  const selfExcluded = await api(L1.session, 'GET', '/api/players/search?query=' + L1.tag.slice(3, 6));
  const notSelf = !(selfExcluded.json?.players || []).some((p) => p.userTag === L1.tag);
  check('SEARCH: self excluded from results', notSelf, `total=${selfExcluded.json?.total}`);
}

// ═══ BUG 3a: user disband mid-war refunds BOTH escrows ═══
{
  const chipsBeforeL1 = await personalChips(admin, L1.tag);
  const vtzBefore = await clanTreasury('VTZ');

  const decl = await api(L1.session, 'POST', '/api/clans/war/declare', { tag: 'VTX', targetTag: 'VTZ', wager: 1000 });
  check('BUG3: war declared (both escrowed)', decl.status === 200, `status=${decl.status} body=${JSON.stringify(decl.json)}`);
  const vtzEscrow = await clanTreasury('VTZ');
  check('BUG3: VTZ treasury escrowed −1000', vtzEscrow === vtzBefore - 1000, `before=${vtzBefore} after=${vtzEscrow}`);

  const disband = await api(L1.session, 'POST', '/api/clans/disband');
  check('BUG3: disband reports warsCancelled=1', disband.status === 200 && disband.json?.warsCancelled === 1, `status=${disband.status} body=${JSON.stringify(disband.json)}`);

  const war = await api(L2.session, 'GET', '/api/clans/war?tag=VTZ');
  check('BUG3: war gone after disband', war.status === 200 && war.json?.war === null, `war=${JSON.stringify(war.json?.war)}`);
  const vtzAfter = await clanTreasury('VTZ');
  check('BUG3: VTZ escrow refunded to treasury', vtzAfter === vtzBefore, `before=${vtzBefore} after=${vtzAfter}`);

  const chipsAfterL1 = await personalChips(admin, L1.tag);
  check('BUG3: L1 leader personal escrow refunded +1000', chipsAfterL1 === chipsBeforeL1 + 1000, `before=${chipsBeforeL1} after=${chipsAfterL1}`);

  const act = await api(L2.session, 'GET', '/api/clans/activity?tag=VTZ');
  const refundRow = (act.json?.activities || []).find((a) => (a.detail || '').includes('refunded to the treasury'));
  check('BUG3: opponent activity feed explains refund', !!refundRow, `found=${!!refundRow}`);
}

// ═══ BUG 3b: ADMIN disband mid-war also refunds ═══
{
  const chipsBeforeL3 = await personalChips(admin, L3.tag);
  const vtzPreDeclare = await clanTreasury('VTZ');

  const decl = await api(L2.session, 'POST', '/api/clans/war/declare', { tag: 'VTZ', targetTag: 'VTW', wager: 1000 });
  check('BUG3b: war declared VTZ→VTW', decl.status === 200, `status=${decl.status}`);
  const vtzEscrowed = await clanTreasury('VTZ');
  check('BUG3b: VTZ escrowed −1000', vtzEscrowed === vtzPreDeclare - 1000, `pre=${vtzPreDeclare} escrowed=${vtzEscrowed}`);

  const disband = await api(admin, 'POST', '/api/admin/clans', { action: 'disband', tag: 'VTW' });
  check('BUG3b: admin disband reports warsCancelled + refund message', disband.status === 200 && disband.json?.warsCancelled === 1 && /refunded/.test(disband.json?.message || ''), `status=${disband.status} msg=${disband.json?.message}`);

  const vtzAfter = await clanTreasury('VTZ');
  check('BUG3b: VTZ escrow refunded after ADMIN disband', vtzAfter === vtzPreDeclare, `pre=${vtzPreDeclare} after=${vtzAfter}`);
  const chipsAfterL3 = await personalChips(admin, L3.tag);
  check('BUG3b: VTW leader escrow refunded personally', chipsAfterL3 === chipsBeforeL3 + 1000, `before=${chipsBeforeL3} after=${chipsAfterL3}`);
}

console.log('\n════════ T50 RESULTS ════════');
for (const line of results) console.log(line);
console.log(`\nTOTAL: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
