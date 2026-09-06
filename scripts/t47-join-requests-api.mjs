// T47 — Join Requests + member-invite API suite. Cleanup-BEFORE-setup (T45 lesson).
// Run: bun scripts/t47-join-requests-api.mjs
const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const results = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; results.push(`PASS ${name}`); }
  else { fail++; results.push(`FAIL ${name} ${extra}`); }
}

async function api(path, method, body, cookie) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data, setCookie: res.headers.getSetCookie?.() || [] };
}
function getCookie(res) {
  const c = res.setCookie.find((c) => c.startsWith('va_session='));
  return c ? c.split(';')[0] : null;
}
async function makeGuest(name) {
  const r = await api('/api/auth/guest', 'POST', { country: 'IN' });
  const cookie = getCookie(r);
  const me = await api('/api/auth/me', 'GET', null, cookie);
  return { tag: me.data.player?.userTag, id: me.data.player?.id, cookie, name };
}

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function preclean() {
  const guests = await db.player.findMany({ where: { userTag: { startsWith: 'VM-T47' } }, select: { id: true } });
  const ids = guests.map((g) => g.id);
  await db.clanInvite.deleteMany({ where: { OR: [{ inviteeId: { in: ids } }, { invitedByTag: { startsWith: 'VM-T47' } }] } });
  await db.clanJoinRequest.deleteMany({ where: { OR: [{ playerId: { in: ids } }, { clan: { tag: 'T47A' } }] } });
  await db.clanActivity.deleteMany({ where: { clanTag: 'T47A' } });
  await db.clanChallenge.deleteMany({ where: { clanTag: 'T47A' } });
  await db.clanMessage.deleteMany({ where: { clanTag: 'T47A' } });
  await db.clan.deleteMany({ where: { tag: 'T47A' } });
  await db.player.deleteMany({ where: { userTag: { startsWith: 'VM-T47' } } });
}

try {
  await preclean();

  // ── Setup: A founds clan, B/C/D/E clanless ──
  const A = await makeGuest('A'); const B = await makeGuest('B'); const C = await makeGuest('C');
  const D = await makeGuest('D'); const E = await makeGuest('E');
  const cr = await api('/api/clans/create', 'POST', { tag: 'T47A', name: 'T47 Test Clan', emblem: '🐍', description: 'x' }, A.cookie);
  check('A creates clan', cr.status === 200, JSON.stringify(cr.data));

  // ── Join request flow ──
  const j1 = await api('/api/clans/join', 'POST', { tag: 'T47A' }, B.cookie);
  check('B request joins -> 200 ok', j1.status === 200 && j1.data.ok === true, JSON.stringify(j1.data));
  const j2 = await api('/api/clans/join', 'POST', { tag: 'T47A' }, B.cookie);
  check('B duplicate request -> 409', j2.status === 409, JSON.stringify(j2.data));
  const j3 = await api('/api/clans/join', 'POST', { tag: 'NOPE1' }, B.cookie);
  check('B request unknown clan -> 404', j3.status === 404);

  const meB = await api('/api/auth/me', 'GET', null, B.cookie);
  check('B NOT a member yet (request only)', meB.data.player?.clanTag == null, meB.data.player?.clanTag);

  const inA1 = await api('/api/clans/join-requests', 'GET', null, A.cookie);
  check('A sees 1 incoming request (B)', inA1.data.incoming?.length === 1 && inA1.data.incoming[0].userTag === B.tag, JSON.stringify(inA1.data));
  const outB1 = await api('/api/clans/join-requests', 'GET', null, B.cookie);
  check('B sees 1 outgoing request', outB1.data.outgoing?.length === 1 && outB1.data.outgoing[0].clanTag === 'T47A', JSON.stringify(outB1.data));
  const outA1 = await api('/api/clans/join-requests', 'GET', null, A.cookie);
  check('A (in clan, no outgoing) sees 0 outgoing', outA1.data.outgoing?.length === 0);
  const inC0 = await api('/api/clans/join-requests', 'GET', null, C.cookie);
  check('clanless C (no clan) sees 0 incoming', inC0.data.incoming?.length === 0);

  const bId = inA1.data.incoming[0].id;
  const rej1 = await api('/api/clans/join-requests/respond', 'POST', { requestId: bId, action: 'decline' }, C.cookie);
  check('C (not leader) respond -> 403', rej1.status === 403, JSON.stringify(rej1.data));
  const acc1 = await api('/api/clans/join-requests/respond', 'POST', { requestId: bId, action: 'accept' }, A.cookie);
  check('A accepts B -> 200', acc1.status === 200 && acc1.data.requesterName, JSON.stringify(acc1.data));
  const meB2 = await api('/api/auth/me', 'GET', null, B.cookie);
  check('B is now member Viper', meB2.data.player?.clanTag === 'T47A' && meB2.data.player?.clanRank === 'Viper', JSON.stringify({ t: meB2.data.player?.clanTag, r: meB2.data.player?.clanRank }));
  const outB2 = await api('/api/clans/join-requests', 'GET', null, B.cookie);
  check('B outgoing cleared after accept', outB2.data.outgoing?.length === 0);
  const accAgain = await api('/api/clans/join-requests/respond', 'POST', { requestId: bId, action: 'accept' }, A.cookie);
  check('re-respond to handled request -> 400 NOT_PENDING', accAgain.status === 400);

  // ── Member invite flow (THE FIX: any member can invite) ──
  const inv1 = await api('/api/clans/invite', 'POST', { userTag: C.tag }, A.cookie);
  check('Leader invites C -> 200', inv1.status === 200, JSON.stringify(inv1.data));
  const invListC = await api('/api/clans/invites', 'GET', null, C.cookie);
  check('C sees 1 pending invite', invListC.data.count === 1, JSON.stringify(invListC.data));
  const invAcc = await api('/api/clans/invites/respond', 'POST', { inviteId: invListC.data.invites[0].id, action: 'accept' }, C.cookie);
  check('C accepts invite -> member', invAcc.status === 200 && invAcc.data.clanTag === 'T47A', JSON.stringify(invAcc.data));

  const inv2 = await api('/api/clans/invite', 'POST', { userTag: D.tag }, C.cookie);
  check('VIPER C invites D -> 200 (member invite works!)', inv2.status === 200, JSON.stringify(inv2.data));
  const invListD = await api('/api/clans/invites', 'GET', null, D.cookie);
  const invAccD = await api('/api/clans/invites/respond', 'POST', { inviteId: invListD.data.invites[0].id, action: 'accept' }, D.cookie);
  check('D accepts C invite -> member', invAccD.status === 200 && invAccD.data.clanTag === 'T47A');

  // member guard: clanless E cannot invite
  const inv3 = await api('/api/clans/invite', 'POST', { userTag: D.tag }, E.cookie);
  check('clanless E invite -> 400 NOT_IN_CLAN', inv3.status === 400, JSON.stringify(inv3.data));

  // ── Reject flow ──
  const lvD = await api('/api/clans/leave', 'POST', null, D.cookie);
  check('D leaves clan', lvD.status === 200, JSON.stringify(lvD.data));
  const jr2 = await api('/api/clans/join', 'POST', { tag: 'T47A' }, D.cookie);
  check('D re-requests -> ok', jr2.status === 200);
  const inA2 = await api('/api/clans/join-requests', 'GET', null, A.cookie);
  const dReq = inA2.data.incoming.find((r) => r.userTag === D.tag);
  check('A sees D incoming request', !!dReq, JSON.stringify(inA2.data));
  const dec2 = await api('/api/clans/join-requests/respond', 'POST', { requestId: dReq.id, action: 'decline' }, A.cookie);
  check('A rejects D -> 200', dec2.status === 200);
  const meD = await api('/api/auth/me', 'GET', null, D.cookie);
  check('D still clanless after reject', meD.data.player?.clanTag == null);

  // ── Cancel flow ──
  const jr3 = await api('/api/clans/join', 'POST', { tag: 'T47A' }, D.cookie);
  const outD3 = await api('/api/clans/join-requests', 'GET', null, D.cookie);
  const del1 = await api('/api/clans/join-requests', 'DELETE', { requestId: outD3.data.outgoing[0].id }, D.cookie);
  check('D cancels own request -> 200', del1.status === 200, JSON.stringify(del1.data));
  const outD4 = await api('/api/clans/join-requests', 'GET', null, D.cookie);
  check('D outgoing cleared after cancel', outD4.data.outgoing?.length === 0);
  const del2 = await api('/api/clans/join-requests', 'DELETE', { requestId: outD3.data.outgoing[0].id }, E.cookie);
  check("E can't delete D's request -> 404", del2.status === 404);

  // ── Cross-path hygiene: pending request auto-declined by invite-accept ──
  const jr4 = await api('/api/clans/join', 'POST', { tag: 'T47A' }, D.cookie);
  check('D requests again', jr4.status === 200);
  const inv4 = await api('/api/clans/invite', 'POST', { userTag: D.tag }, A.cookie);
  check('A ALSO invites D (both pending)', inv4.status === 200, JSON.stringify(inv4.data));
  const invListD2 = await api('/api/clans/invites', 'GET', null, D.cookie);
  const accD2 = await api('/api/clans/invites/respond', 'POST', { inviteId: invListD2.data.invites[0].id, action: 'accept' }, D.cookie);
  check('D accepts invite', accD2.status === 200);
  const inA3 = await api('/api/clans/join-requests', 'GET', null, A.cookie);
  check('D pending request auto-declined by invite-accept (incoming 0)', inA3.data.incoming?.length === 0, JSON.stringify(inA3.data));

  // request while invite pending from same clan -> 409 INVITE_PENDING
  const lvD2 = await api('/api/clans/leave', 'POST', null, D.cookie);
  const inv5 = await api('/api/clans/invite', 'POST', { userTag: D.tag }, A.cookie);
  const jr5 = await api('/api/clans/join', 'POST', { tag: 'T47A' }, D.cookie);
  check('request while same-clan invite pending -> 409 INVITE_PENDING', jr5.status === 409 && (jr5.data.error || '').includes('invited'), JSON.stringify(jr5.data));

  // ── Activity logged ──
  const acts = await api('/api/clans/activity?tag=T47A', 'GET', null, A.cookie);
  const hasRequest = acts.data.activities?.some((a) => a.type === 'request');
  check("activity has 'request' entry", !!hasRequest, JSON.stringify(acts.data.activities?.slice(0, 3)));

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail > 0 ? 1 : 0;
} catch (e) {
  console.error('SUITE CRASH:', e);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
