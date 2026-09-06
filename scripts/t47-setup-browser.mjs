// T47 browser-test setup: create guests, print tags + session cookies
const BASE = 'http://localhost:3000';
async function makeGuest(country = 'IN') {
  const res = await fetch(BASE + '/api/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  });
  const setCookies = res.headers.getSetCookie?.() || [];
  const c = setCookies.find((c) => c.startsWith('va_session='));
  const cookie = c ? c.split(';')[0] : null;
  const data = await res.json().catch(() => ({}));
  return { tag: data.player?.userTag || data.userTag, id: data.player?.id, cookie };
}
const L = await makeGuest('IN');   // leader
const J = await makeGuest('US');   // join requester -> member
const K = await makeGuest('GB');   // invitee
const M = await makeGuest('BR');   // rejected requester
console.log(JSON.stringify({ L, J, K, M }, null, 2));
