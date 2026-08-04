// ============================================================================
// offline-hud.ts — HUD construction, update, and teardown for offline mode.
// ============================================================================
// All functions are standalone helpers that receive the engine instance via
// an OfflineEngineRef.  This avoids extracting class methods into standalone
// functions while keeping the code organised.
// ============================================================================

import type { OfflineEngineRef } from './offline-types';
import { INITIAL_SPAWN_SCORE } from '@/lib/game-config';
import { VIRTUAL_BOT_COUNT, QUICK_EMOTES, EXTRACT_DURATION_MS } from './offline-constants';

// ============================================================================
// Helpers (no engine ref needed)
// ============================================================================

export function makeHudCard(rows: HTMLDivElement[]): HTMLDivElement {
  const card = document.createElement('div');
  card.style.cssText =
    'border:1px solid rgba(51,65,85,0.6);background:rgba(2,6,23,0.8);padding:8px 12px;border-radius:8px;backdrop-filter:blur(4px);font-size:12px;display:flex;flex-direction:column;gap:4px;';
  for (const r of rows) card.appendChild(r);
  return card;
}

export function makeHudRow(
  _icon: string,
  color: string,
  label: string,
  makeValue: () => HTMLSpanElement,
): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};`;
  row.appendChild(dot);
  const lab = document.createElement('span');
  lab.textContent = label;
  lab.style.cssText = 'color:#94a3b8;';
  row.appendChild(lab);
  row.appendChild(makeValue());
  return row;
}

export function makeSpan(text: string, style: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.textContent = text;
  s.style.cssText = style;
  return s;
}

// ============================================================================
// Sub-builders (access engine for callbacks / hudEls storage)
// ============================================================================

function buildLeaderboard(e: OfflineEngineRef): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:absolute;right:12px;top:52px;width:220px;border:1px solid rgba(51,65,85,0.6);background:rgba(2,6,23,0.85);border-radius:8px;backdrop-filter:blur(4px);overflow:hidden;';

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;cursor:pointer;background:rgba(15,23,42,0.8);';
  const title = document.createElement('span');
  title.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;';
  title.textContent = 'Score Leaderboard';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = '▾';
  toggle.style.cssText =
    'background:transparent;border:none;color:#cbd5e1;font-size:14px;cursor:pointer;pointer-events:auto;';
  header.appendChild(title);
  header.appendChild(toggle);
  wrap.appendChild(header);

  // Column header
  const colHeader = document.createElement('div');
  colHeader.style.cssText =
    'display:flex;justify-content:space-between;padding:3px 10px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;border-bottom:1px solid rgba(51,65,85,0.4);';
  const colLeft = document.createElement('span');
  colLeft.textContent = 'Player';
  const colRight = document.createElement('span');
  colRight.textContent = 'Score';
  colHeader.appendChild(colLeft);
  colHeader.appendChild(colRight);
  wrap.appendChild(colHeader);

  const rows = document.createElement('div');
  rows.style.cssText =
    'max-height:240px;overflow-y:auto;padding:4px 6px;display:flex;flex-direction:column;gap:2px;';
  wrap.appendChild(rows);

  e.hudEls.leaderboardRows = rows;
  e.hudEls.leaderboardToggle = toggle;

  const onClick = (ev: MouseEvent) => {
    ev.preventDefault();
    e.hudEls.leaderboardOpen = !e.hudEls.leaderboardOpen;
    rows.style.display = e.hudEls.leaderboardOpen ? 'flex' : 'none';
    toggle.textContent = e.hudEls.leaderboardOpen ? '▾' : '▸';
  };
  header.addEventListener('click', onClick);
  header.style.pointerEvents = 'auto';

  return wrap;
}

function buildEmoteBar(e: OfflineEngineRef): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:absolute;left:8px;bottom:8px;width:min(60vw,260px);border:1px solid rgba(30,41,59,0.9);background:rgba(2,6,23,0.9);padding:8px 10px;border-radius:12px;backdrop-filter:blur(6px);pointer-events:auto;';
  const title = document.createElement('div');
  title.style.cssText =
    'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px;';
  title.textContent = 'Emotes (Keys 1-5)';
  wrap.appendChild(title);
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
  const labels = ['GG! 🏆', 'Target! 🎯', 'Flee! 🏃💨', 'Ripped! 💪', 'Extracting! ⚡'];
  for (let i = 0; i < labels.length; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = labels[i];
    b.style.cssText =
      'border:1px solid #1e293b;background:#0f172a;color:#cbd5e1;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:500;cursor:pointer;';
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      e.setPlayerChat(QUICK_EMOTES[i]);
    });
    btnRow.appendChild(b);
  }
  wrap.appendChild(btnRow);
  return wrap;
}

function buildMobileControls(e: OfflineEngineRef): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:absolute;right:24px;bottom:24px;display:flex;align-items:flex-end;gap:12px;pointer-events:auto;';

  // BOOST button
  const boost = document.createElement('button');
  boost.type = 'button';
  boost.setAttribute('aria-label', 'Boost');
  boost.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
    '<div style="font-size:24px;line-height:1;">⚡</div>' +
    '<div style="font-size:10px;font-weight:bold;">BOOST</div></div>';
  boost.style.cssText =
    'width:64px;height:64px;border-radius:50%;border:1px solid rgba(245,158,11,0.5);background:rgba(245,158,11,0.2);color:#fcd34d;cursor:pointer;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center;';
  const boostDown = (ev: Event) => {
    ev.preventDefault();
    e.boostHold = true;
    e.keys.add(' ');
  };
  const boostUp = (ev: Event) => {
    ev.preventDefault();
    e.boostHold = false;
    e.keys.delete(' ');
  };
  boost.addEventListener('pointerdown', boostDown);
  boost.addEventListener('pointerup', boostUp);
  boost.addEventListener('pointercancel', boostUp);
  boost.addEventListener('contextmenu', (ev) => ev.preventDefault());
  wrap.appendChild(boost);

  // EXTRACT button
  const extract = document.createElement('button');
  extract.type = 'button';
  extract.setAttribute('aria-label', 'Extract');
  extract.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
    '<div style="font-size:22px;line-height:1;">🏆</div>' +
    '<div style="font-size:10px;font-weight:bold;">EXTRACT</div></div>';
  extract.style.cssText =
    'width:80px;height:80px;border-radius:50%;border:1px solid rgba(16,185,129,0.6);background:rgba(16,185,129,0.15);color:#6ee7b7;cursor:pointer;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center;';
  const exDown = (ev: Event) => {
    ev.preventDefault();
    if (e.state !== 'playing') return;
    e.extractHold = true;
    e.beginExtract();
  };
  const exUp = (ev: Event) => {
    ev.preventDefault();
    if (!e.extractHold) return;
    e.extractHold = false;
    e.cancelExtract();
  };
  extract.addEventListener('pointerdown', exDown);
  extract.addEventListener('pointerup', exUp);
  extract.addEventListener('pointercancel', exUp);
  extract.addEventListener('contextmenu', (ev) => ev.preventDefault());
  wrap.appendChild(extract);

  return wrap;
}

function buildLeaveButton(e: OfflineEngineRef): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '⨯ Leave';
  btn.style.cssText =
    'position:absolute;left:12px;bottom:96px;height:36px;padding:0 12px;border-radius:18px;border:1px solid rgba(51,65,85,0.8);background:rgba(2,6,23,0.8);color:#94a3b8;font-size:12px;cursor:pointer;backdrop-filter:blur(4px);pointer-events:auto;';
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    e.handleExitToLobby();
  });
  return btn;
}

// ============================================================================
// Main HUD builders
// ============================================================================

export function buildHUD(e: OfflineEngineRef): void {
  const parent = e.canvas.parentElement;
  if (!parent) return;
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  const root = document.createElement('div');
  root.style.cssText =
    'position:absolute;inset:0;pointer-events:none;z-index:30;font-family:ui-monospace,monospace;';
  e.overlayRoot = root;

  // --- Top-left HUD stack (Score / Kills / Rank / Boost / Bots) ---
  const leftStack = document.createElement('div');
  leftStack.style.cssText =
    'position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:8px;max-width:240px;';
  leftStack.appendChild(makeHudCard([
    makeHudRow('shield', '#ffffff', 'Score:', () => e.hudEls.score = makeSpan('', 'font-weight:bold;color:#fff;')),
  ]));
  leftStack.appendChild(makeHudCard([
    makeHudRow('skull', '#f43f5e', 'Kills:', () => e.hudEls.kills = makeSpan('', 'font-weight:bold;color:#f43f5e;')),
    makeHudRow('trophy', '#eab308', 'Rank:', () => e.hudEls.rank = makeSpan('', 'font-weight:bold;color:#eab308;')),
    makeHudRow('zap', '#f59e0b', 'Boost:', () => {
      const s = makeSpan('SPACE', 'font-weight:bold;color:#f59e0b;');
      return s;
    }),
    makeHudRow('users', '#cbd5e1', 'Bots:', () => e.hudEls.bots = makeSpan('', 'font-weight:bold;color:#cbd5e1;')),
  ]));
  root.appendChild(leftStack);

  // --- Top-right HUD stack (FPS only — no banked chips) ---
  const rightStack = document.createElement('div');
  rightStack.style.cssText =
    'position:absolute;right:12px;top:12px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;';

  const fpsRow = document.createElement('div');
  fpsRow.style.cssText =
    'display:flex;gap:8px;align-items:center;border:1px solid rgba(51,65,85,0.6);background:rgba(2,6,23,0.8);padding:4px 8px;border-radius:6px;font-size:11px;backdrop-filter:blur(4px);';
  e.hudEls.fps = makeSpan('60 fps', 'color:#94a3b8;');
  fpsRow.appendChild(e.hudEls.fps);
  rightStack.appendChild(fpsRow);
  root.appendChild(rightStack);

  // --- Leaderboard panel (top-right, below FPS — ranked by Score) ---
  root.appendChild(buildLeaderboard(e));

  // --- Top-center extract hint ---
  const hint = document.createElement('div');
  hint.style.cssText =
    'position:absolute;left:50%;top:56px;transform:translateX(-50%);text-align:center;font-size:11px;color:#94a3b8;pointer-events:none;';
  hint.innerHTML =
    'Hold <kbd style="border:1px solid #475569;background:#1e293b;padding:1px 4px;border-radius:3px;font-size:10px;color:#e2e8f0;">E</kbd> or tap EXTRACT to end your practice run.';
  e.hudEls.idleHint = hint;
  root.appendChild(hint);

  // --- Extract progress bar (hidden by default) ---
  const exWrap = document.createElement('div');
  exWrap.style.cssText =
    'position:absolute;left:50%;top:80px;transform:translateX(-50%);display:none;border:1px solid rgba(245,158,11,0.4);background:rgba(2,6,23,0.85);padding:8px 16px;border-radius:8px;backdrop-filter:blur(4px);text-align:center;';
  const exPct = makeSpan('0%', 'font-size:12px;font-weight:bold;color:#fbbf24;');
  const exBarWrap = document.createElement('div');
  exBarWrap.style.cssText =
    'margin-top:6px;width:200px;height:8px;border-radius:4px;background:#1e293b;overflow:hidden;';
  const exBar = document.createElement('div');
  exBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(to right,#eab308,#f59e0b);transition:width 80ms linear;';
  exBarWrap.appendChild(exBar);
  exWrap.appendChild(exPct);
  exWrap.appendChild(exBarWrap);
  e.hudEls.extractingWrap = exWrap;
  e.hudEls.extractingBar = exBar;
  e.hudEls.extractingPct = exPct;
  root.appendChild(exWrap);

  // --- Quick chat emotes bar (bottom-left) ---
  root.appendChild(buildEmoteBar(e));

  // --- Mobile controls: BOOST + EXTRACT (bottom-right) ---
  root.appendChild(buildMobileControls(e));

  // --- Leave button (bottom-left edge) ---
  root.appendChild(buildLeaveButton(e));

  parent.appendChild(root);
}

export function teardownHUD(e: OfflineEngineRef): void {
  if (e.endOverlay && e.endOverlay.parentNode) {
    e.endOverlay.parentNode.removeChild(e.endOverlay);
  }
  e.endOverlay = null;
  if (e.overlayRoot && e.overlayRoot.parentNode) {
    e.overlayRoot.parentNode.removeChild(e.overlayRoot);
  }
  e.overlayRoot = null;
  e.hudEls = { leaderboardOpen: true };
}

// ============================================================================
// Per-frame HUD update
// ============================================================================

export function updateHUD(e: OfflineEngineRef): void {
  const p = e.player;
  if (!p) return;
  const totalScore = INITIAL_SPAWN_SCORE + p.score;
  if (e.hudEls.score) e.hudEls.score.textContent = totalScore.toLocaleString();
  if (e.hudEls.kills) e.hudEls.kills.textContent = String(p.kills);
  if (e.hudEls.bots) e.hudEls.bots.textContent = String(VIRTUAL_BOT_COUNT);
  if (e.hudEls.fps) e.hudEls.fps.textContent = `${e.fps} fps`;

  // Rank by total score (player + bots).
  const all: { id: string; name: string; totalScore: number; isPlayer: boolean }[] = [
    { id: p.id, name: p.name, totalScore, isPlayer: true },
  ];
  for (const b of e.bots.values()) {
    all.push({ id: b.id, name: b.name, totalScore: INITIAL_SPAWN_SCORE + b.score, isPlayer: false });
  }
  all.sort((a, b) => b.totalScore - a.totalScore);
  const rank = all.findIndex((s) => s.isPlayer);
  if (e.hudEls.rank) e.hudEls.rank.textContent = `#${rank >= 0 ? rank + 1 : 1}`;

  // Leaderboard (top 10 by score).
  if (e.hudEls.leaderboardRows) {
    const top = all.slice(0, 10);
    const rows = e.hudEls.leaderboardRows;
    const sig = top.map((s) => `${s.id}:${s.totalScore}`).join('|');
    if (sig !== e.lastLeaderboardSig) {
      e.lastLeaderboardSig = sig;
      rows.innerHTML = '';
      for (let i = 0; i < top.length; i++) {
        const s = top[i];
        const row = document.createElement('div');
        row.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:3px 6px;border-radius:4px;font-size:11px;${
          s.isPlayer ? 'background:rgba(34,197,94,0.15);color:#86efac;' : 'color:#cbd5e1;'
        }`;
        const left = document.createElement('span');
        left.style.cssText = 'display:flex;gap:6px;align-items:center;min-width:0;';
        const r = document.createElement('span');
        r.style.cssText = 'color:#64748b;font-weight:bold;min-width:20px;';
        r.textContent = `${i + 1}.`;
        const nm = document.createElement('span');
        nm.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        nm.textContent = s.name;
        left.appendChild(r);
        left.appendChild(nm);
        const sc = document.createElement('span');
        sc.style.cssText = 'font-weight:bold;';
        sc.textContent = String(s.totalScore);
        row.appendChild(left);
        row.appendChild(sc);
        rows.appendChild(row);
      }
    }
  }

  // Extract progress bar.
  if (p.isExtracting && e.hudEls.extractingBar && e.hudEls.extractingPct) {
    const pct = Math.min(100, Math.round((p.extractionProgress / EXTRACT_DURATION_MS) * 100));
    e.hudEls.extractingBar.style.width = `${pct}%`;
    e.hudEls.extractingPct.textContent = `${pct}%`;
  }
}

// ============================================================================
// End screen (death / extract) — no XP, no chips
// ============================================================================

export function showEndScreen(e: OfflineEngineRef, outcome: 'death' | 'extract'): void {
  const parent = e.canvas.parentElement;
  if (!parent) return;
  if (e.endOverlay) {
    if (e.endOverlay.parentNode) e.endOverlay.parentNode.removeChild(e.endOverlay);
    e.endOverlay = null;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);pointer-events:auto;';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const isExtract = outcome === 'extract';
  const mins = Math.floor(e.finalDurationSeconds / 60);
  const secs = e.finalDurationSeconds % 60;
  const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const title = isExtract ? 'Practice Run Completed!' : 'Arena Disintegration!';
  const titleColor = isExtract ? '#fbbf24' : '#ef4444';
  const accent = isExtract
    ? 'linear-gradient(to right,#eab308,#f59e0b)'
    : '#dc2626';
  const subtitle = isExtract
    ? `Practice run finished! You eliminated ${e.finalKills} training bots, reached a score of ${e.finalScore}, and survived for ${mins}m ${secs}s.`
    : `Your snake was destroyed! Final score: ${e.finalScore}. No chips were wagered or lost — offline practice only.`;

  overlay.innerHTML = `
      <div style="width:min(94vw,520px);border:1px solid #1e293b;background:#020617;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.6);overflow:hidden;">
        <div style="height:6px;background:${accent};"></div>
        <div style="padding:24px;">
          <div style="margin:0 auto 12px;width:64px;height:64px;border-radius:16px;border:1px solid ${
            isExtract ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'
          };background:${isExtract ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'};display:flex;align-items:center;justify-content:center;font-size:32px;">
            ${isExtract ? '🧭' : '💀'}
          </div>
          <h3 style="text-align:center;font-size:24px;font-weight:bold;color:${titleColor};margin:0;">${title}</h3>
          <p style="text-align:center;font-size:12px;color:#94a3b8;margin:6px 0 0;">${subtitle}</p>

          <div style="margin-top:16px;border:1px solid #1e293b;background:rgba(15,23,42,0.6);border-radius:8px;padding:12px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#94a3b8;">Final Score:</span>
              <span style="color:#fff;">${e.finalScore.toLocaleString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span style="color:#94a3b8;">Opponents Eliminated:</span>
              <span style="color:#fff;">${e.finalKills} Kills</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span style="color:#94a3b8;">Survival Time:</span>
              <span style="color:#fff;">${durationStr}</span>
            </div>
          </div>

          ${
            isExtract
              ? `<div style="margin-top:12px;border:1px solid #1e293b;background:rgba(15,23,42,0.6);border-radius:8px;padding:12px;text-align:center;">
                   <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#fbbf24;">Offline Training Complete</div>
                   <div style="margin-top:4px;font-size:11px;color:#94a3b8;">No chips, no XP — just pure practice. Great job sharpening your skills!</div>
                 </div>`
              : `<div style="margin-top:12px;border:1px solid rgba(15,23,42,0.6);background:rgba(15,23,42,0.4);border-radius:8px;padding:10px;text-align:center;font-size:11px;color:#94a3b8;">
                   No chips were wagered or lost — offline practice only.
                 </div>`
          }

          <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px;">
            ${!isExtract && e.replayFrames.length > 20 ? `
            <button id="oe-watch-replay" type="button" style="width:100%;padding:12px;border-radius:12px;border:none;color:#fff;font-weight:bold;font-size:14px;cursor:pointer;background:linear-gradient(to right,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;gap:8px;">
              📺 WATCH DEATH REPLAY (${e.replayFrames.length} frames)
            </button>
            ` : ''}
            <button id="oe-play-again" type="button" style="width:100%;padding:12px;border-radius:12px;border:none;color:#fff;font-weight:bold;font-size:14px;cursor:pointer;background:${
              isExtract ? 'linear-gradient(to right,#10b981,#14b8a6)' : 'linear-gradient(to right,#dc2626,#e11d48)'
            };display:flex;align-items:center;justify-content:center;gap:8px;">
              ${isExtract ? '🧭' : '💀'} PLAY AGAIN
            </button>
            <button id="oe-exit" type="button" style="width:100%;padding:10px;border-radius:12px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.1);color:#fcd34d;font-weight:bold;font-size:12px;cursor:pointer;">
              RETURN TO LOBBY
            </button>
          </div>
          <p style="margin-top:12px;text-align:center;font-size:10px;color:#64748b;">Press ESC to exit</p>
        </div>
      </div>
    `;
  parent.appendChild(overlay);
  e.endOverlay = overlay;

  const playAgainBtn = overlay.querySelector('#oe-play-again') as HTMLButtonElement | null;
  const exitBtn = overlay.querySelector('#oe-exit') as HTMLButtonElement | null;
  const watchReplayBtn = overlay.querySelector('#oe-watch-replay') as HTMLButtonElement | null;
  if (watchReplayBtn) {
    watchReplayBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      e.enterReplayMode();
    });
  }
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      e.handlePlayAgain();
    });
  }
  if (exitBtn) {
    exitBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      e.handleExitToLobby();
    });
  }
}
