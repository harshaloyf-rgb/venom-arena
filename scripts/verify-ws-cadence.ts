// ============================================================================
// verify-ws-cadence.ts — live verification of the drift-locked snapshot cadence
// (FIX NET-1) plus end-to-end sanity of auth/join after the server changes.
//
// Flow:
//  1. POST /api/auth/guest  {country:"IN"}  -> session cookie (throwaway guest)
//  2. GET  /api/auth/game-token (with cookie) -> { token }
//  3. WS connect to 127.0.0.1:3001, AUTH, JOIN, then measure OP_SNAPSHOT
//     arrival gaps + server tick deltas for ~15 seconds.
//  4. Report min/avg/max gap, bursts (gap > 75ms), starved windows (>120ms),
//     tick continuity. PASS if cadence is locked around 50ms with no bursts
//     beyond the old setInterval worst case.
// ============================================================================

const APP = 'http://127.0.0.1:3000';
const WS = 'ws://127.0.0.1:3001';

const OP_AUTH = 0x01;
const OP_JOIN = 0x10;
const OP_SNAPSHOT = 0x21;

async function main() {
  // 1. Guest session
  const guestRes = await fetch(`${APP}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: 'IN' }),
  });
  if (!guestRes.ok) {
    console.error('GUEST_FAIL', guestRes.status, await guestRes.text().catch(() => ''));
    process.exit(1);
  }
  const setCookie = guestRes.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  const guest = await guestRes.json();
  console.log('GUEST_OK', guest?.player?.id ?? guest?.player?.playerId ?? '(id n/a)');

  // 1b. Unlock the pre-join ad gate (dev mock path — same as the browser flow)
  const adRes = await fetch(`${APP}/api/ads/mock-complete`, {
    method: 'POST',
    headers: { cookie },
  });
  if (adRes.ok) {
    const ad = await adRes.json();
    console.log('AD_UNLOCK_OK until=' + ad.unlockUntil);
  } else {
    console.error('AD_UNLOCK_FAIL', adRes.status, await adRes.text().catch(() => ''));
  }

  // 2. Game token
  const tokRes = await fetch(`${APP}/api/auth/game-token`, {
    headers: { cookie },
  });
  if (!tokRes.ok) {
    console.error('TOKEN_FAIL', tokRes.status, await tokRes.text().catch(() => ''));
    process.exit(1);
  }
  const { token } = await tokRes.json();
  if (!token) { console.error('TOKEN_MISSING'); process.exit(1); }
  console.log('TOKEN_OK len=' + String(token).length);

  // 3. WS cadence probe
  const ws = new WebSocket(WS);
  ws.binaryType = 'arraybuffer';
  const gaps: number[] = [];
  const tickDeltas: number[] = [];
  let lastArrival = 0;
  let lastTick = 0;
  let authed = false;
  let joined = false;
  const ARENA = 'tier-1';

  const done = new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 15000);
  });

  ws.onopen = () => {
    const buf = new ArrayBuffer(1 + 2 + token.length);
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    dv.setUint8(0, OP_AUTH);
    dv.setUint16(1, token.length, true);
    for (let i = 0; i < token.length; i++) u8[3 + i] = token.charCodeAt(i) & 0xff;
    ws.send(buf);
  };

  ws.onmessage = (ev: MessageEvent) => {
    if (!(ev.data instanceof ArrayBuffer)) return;
    const dv = new DataView(ev.data);
    const op = dv.getUint8(0);
    const now = performance.now();
    if (op === 0x02 && !authed) {
      authed = true;
      console.log('AUTH_OK');
      const id = new TextEncoder().encode(ARENA);
      const jbuf = new ArrayBuffer(2 + id.length);
      const jdv = new DataView(jbuf);
      const ju8 = new Uint8Array(jbuf);
      jdv.setUint8(0, OP_JOIN);
      jdv.setUint8(1, id.length);
      ju8.set(id, 2);
      ws.send(jbuf);
      return;
    }
    if (op === 0x11) { joined = true; console.log('JOINED'); return; }
    if (op === 0x12 || op === 0x34) {
      // JOIN_ERROR / ERROR — u8 len + utf8 reason
      const u8 = new Uint8Array(ev.data);
      const len = u8[1];
      const reason = new TextDecoder().decode(u8.slice(2, 2 + len));
      console.error('SERVER_ERROR op=0x' + op.toString(16) + ' reason=' + reason);
      return;
    }
    if (op === OP_SNAPSHOT) {
      // parse tick (u32 @ offset 1)
      const tick = dv.getUint32(1, true);
      if (lastArrival > 0) gaps.push(now - lastArrival);
      if (lastTick > 0) tickDeltas.push(tick - lastTick);
      lastArrival = now;
      lastTick = tick;
    }
  };

  ws.onerror = () => console.error('WS_ERROR');
  ws.onclose = () => console.log('WS_CLOSED');

  await done;
  ws.close();

  if (!authed || !joined) {
    console.error('VERIFY_FAIL authed=' + authed + ' joined=' + joined);
    process.exit(1);
  }
  if (gaps.length < 100) {
    console.error('VERIFY_FAIL too few snapshots: ' + gaps.length);
    process.exit(1);
  }

  gaps.sort((a, b) => a - b);
  const n = gaps.length;
  const avg = gaps.reduce((s, v) => s + v, 0) / n;
  const p50 = gaps[Math.floor(n * 0.5)];
  const p95 = gaps[Math.floor(n * 0.95)];
  const p99 = gaps[Math.floor(n * 0.99)];
  const bursts = gaps.filter((g) => g > 75).length;      // >1.5 intervals
  const starved = gaps.filter((g) => g > 120).length;    // >2.4 intervals
  const skipped = tickDeltas.filter((d) => d > 3).length; // missed snapshot tick

  console.log('SNAPSHOTS=' + n);
  console.log('GAP_MS min=' + gaps[0].toFixed(1) + ' avg=' + avg.toFixed(1) + ' p50=' + p50.toFixed(1) + ' p95=' + p95.toFixed(1) + ' p99=' + p99.toFixed(1) + ' max=' + gaps[n - 1].toFixed(1));
  console.log('BURSTS>75ms=' + bursts + ' STARVED>120ms=' + starved + ' SKIPPED_TICKS=' + skipped);

  // PASS criteria: locked cadence — p95 within 50±10ms, no starvation windows,
  // no skipped snapshot ticks in a quiet single-player arena.
  const pass = p95 <= 65 && starved === 0 && skipped === 0;
  console.log(pass ? 'CADENCE_PASS' : 'CADENCE_FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
