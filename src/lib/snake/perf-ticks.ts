// Env-gated phase profiler (zero cost in production — one boolean check).
// Enable by setting globalThis.__PERF = true before the game loop, then read
// globalThis.__PERF_REPORT after N ticks. Used by scripts/profile-offline-tick.ts.

interface PhaseAcc { us: number; calls: number; }

function acc(name: string): PhaseAcc {
  const m: Map<string, PhaseAcc> = (globalThis as any).__PERF_PHASES ??= new Map();
  let p = m.get(name);
  if (!p) { p = { us: 0, calls: 0 }; m.set(name, p); }
  return p;
}

/** true while a measurement window is open (set globalThis.__PERF = true directly) */
function active(): boolean {
  return !!(globalThis as any).__PERF;
}

export function perfEnter(name: string): void {
  if (!active()) return;
  const s = acc(name);
  (globalThis as any).__PERF_STACK ??= [];
  (globalThis as any).__PERF_STACK.push({ name, t: performance.now() });
  void s;
}

export function perfExit(name: string): void {
  if (!active()) return;
  const stack: { name: string; t: number }[] = (globalThis as any).__PERF_STACK ??= [];
  // pop until we find the matching name (robust to early returns via wrapper)
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].name === name) {
      const entry = stack.splice(i, 1)[0];
      const p = acc(name);
      p.us += (performance.now() - entry.t) * 1000;
      p.calls++;
      return;
    }
  }
}

export function perfTickDone(): void {
  if (!active()) return;
  const left: number = --(globalThis as any).__PERF_TICKS_LEFT;
  if (left <= 0) {
    const m: Map<string, PhaseAcc> = (globalThis as any).__PERF_PHASES;
    const lines = [...m.entries()]
      .sort((a, b) => b[1].us - a[1].us)
      .map(([k, v]) => `  ${k.padEnd(24)} total=${(v.us / 1000).toFixed(1)}ms  calls=${v.calls}  avg=${(v.us / 1000 / Math.max(1, v.calls)).toFixed(3)}ms`);
    console.log('[PERF] phase breakdown (ms):');
    console.log(lines.join('\n'));
    (globalThis as any).__PERF = false;
    m.clear();
  }
}
